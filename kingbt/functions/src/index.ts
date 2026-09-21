import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();

export type AppUser = {
  uid: string;
  name: string;
  email: string | null;
  photoURL: string | null;
};

const MAX_RESULTS = 20;
const RATE_LIMIT_MAX_CALLS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Janela deslizante simples: cada uid tem um contador em /rateLimits/{key},
 * que reseta sozinho quando a janela expira. Estourar o limite lança
 * 'resource-exhausted' — o Firestore Admin SDK ignora as regras de
 * segurança do Firestore, então esta coleção não precisa (nem deve) ter
 * regra de leitura/escrita pro cliente; ela só existe pra esta function.
 */
async function checkRateLimit(uid: string, key: string, max: number, windowMs: number): Promise<void> {
  const db = getFirestore();
  const ref = db.collection('rateLimits').doc(`${key}_${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.data() as { count: number; windowStart: number } | undefined;
    if (!data || now - data.windowStart > windowMs) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }
    if (data.count >= max) {
      throw new HttpsError('resource-exhausted', 'Muitas buscas em pouco tempo. Espere um instante e tente de novo.');
    }
    tx.update(ref, { count: data.count + 1 });
  });
}

/**
 * Busca usuários por nome ou e-mail (substring, case-insensitive).
 *
 * Roda no servidor com Admin SDK — não passa pelas regras do Firestore, que
 * proíbem `list` em /users (só `get` por uid específico é permitido ao
 * cliente). Antes desta function, a busca baixava a coleção /users inteira
 * (getDocs sem filtro) direto do app e filtrava no cliente: qualquer conta
 * logada podia, chamando o SDK direto, obter nome e e-mail de todos os
 * usuários cadastrados no app inteiro, não só do próprio grupo.
 *
 * A function em si ainda devolve nome/e-mail de qualquer usuário do app
 * (não só do grupo de quem chama) — necessário pra achar gente de fora pra
 * convidar. Sem limite de chamadas, isso permitia devassar a base inteira
 * testando substrings (uma letra de cada vez, 20 resultados por chamada).
 * O rate limit não impede achar UM e-mail específico, mas torna essa
 * varredura inviável na prática.
 */
export const searchUsers = onCall<{ term: string }>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login necessário.');
  }
  await checkRateLimit(request.auth.uid, 'searchUsers', RATE_LIMIT_MAX_CALLS, RATE_LIMIT_WINDOW_MS);

  const term = (request.data?.term ?? '').trim().toLowerCase();
  if (!term) return [];

  const db = getFirestore();
  const snap = await db.collection('users').get();

  const results: AppUser[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const name: string = data.name ?? '?';
    const email: string | null = data.email ?? null;
    if (
      name.toLowerCase().includes(term) ||
      (email ?? '').toLowerCase().includes(term)
    ) {
      results.push({
        uid: doc.id,
        name,
        email,
        photoURL: data.photoURL ?? null,
      });
      if (results.length >= MAX_RESULTS) break;
    }
  }
  return results;
});

// Token de leitura pública do GitHub (escopo mínimo — só precisa ler commits
// de um repo público), configurado como secret do Firebase, nunca exposto
// ao cliente. Configurar uma vez: gerar um PAT em
// https://github.com/settings/tokens (classic, sem escopos marcados — leitura
// pública já é suficiente) e rodar `firebase functions:secrets:set GITHUB_TOKEN`.
const githubToken = defineSecret('GITHUB_TOKEN');

/**
 * Devolve o SHA do commit mais recente em main — usado pelo app pra saber se
 * há uma versão mais nova publicada (src/store/UpdateContext.tsx).
 *
 * Antes o app chamava a API pública do GitHub direto do cliente, sem
 * autenticação: 60 requisições/hora por IP. Numa rede compartilhada (clube,
 * quadra), várias pessoas checando pelo mesmo IP público esgotavam essa cota
 * rápido, e a checagem simplesmente parava de funcionar em silêncio pra todo
 * mundo naquela rede. Um token aumentaria o limite pra 5000/hora, mas colocar
 * esse token DIRETO no bundle do cliente seria pior que o problema original —
 * qualquer pessoa pode extrair um token de um app instalado. Por isso a
 * chamada autenticada mora aqui, no servidor, com o token como secret.
 */
export const getLatestCommitSha = onCall(
  { secrets: [githubToken] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login necessário.');
    }
    const res = await fetch('https://api.github.com/repos/joffreribeiro/King_BT/commits/main', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${githubToken.value()}`,
      },
    });
    if (!res.ok) {
      throw new HttpsError('unavailable', `GitHub API respondeu ${res.status}`);
    }
    const commit = await res.json() as { sha?: string };
    if (!commit.sha) {
      throw new HttpsError('internal', 'Resposta do GitHub sem sha.');
    }
    return { sha: commit.sha };
  },
);
