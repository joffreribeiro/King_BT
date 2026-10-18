// Testa firestore.rules contra o emulador do Firestore, ANTES de deployar.
// Roda uma vez, contra o emulador local (sem tocar produção): `npm run test:rules`
// (o script sobe o emulador, roda este arquivo, derruba o emulador). Também
// dá pra rodar direto contra um emulador já em pé em 127.0.0.1:8090:
// `node test/firestore.rules.test.mjs`.
//
// Cobre o portão de admin (excluir jogo, trocar jogadores, renomear, excluir
// competição, apagar post do feed), entrada em grupo por código sem vazar
// dados de grupos privados (/groupCodes), autoria de comentário no feed, e
// a subcoleção de placar ao vivo (/liveMatches). Não é suíte de regressão
// completa de todas as regras antigas.

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch, Timestamp,
} from 'firebase/firestore';

// Docs de teste para /groupCodes que precisam ser recriados do zero por não
// terem código-base fixo em CODE1/CODE2 (senão o emulador acumula estado
// entre execuções do script e um doc "create" vira "update" na 2ª rodada).
const CODE_NEW = 'CODIGONOVO';

const PROJECT_ID = 'kingbt-rules-test';
const GID = 'grupo1';
const GID2 = 'grupo2'; // grupo separado, pra testar que código/membro de um não vaza no outro

const MEMBER_UID = 'membro1';
const ADMIN_UID = 'admin1';
const SUPER_ADMIN_EMAIL = 'joffre.ribeiro@gmail.com';
const SUPER_ADMIN_UID = 'superadmin-nao-e-membro-da-lista-admins';
const OUTSIDER_UID = 'defora1';
const MEMBER2_UID = 'membro2';
const MEMBER3_UID = 'membro3';

const CODE1 = 'KINGBT1';
const CODE2 = 'KINGBT2';

let testEnv;

// Passo 3 da migração do super admin: só a custom claim vale (o e-mail verificado deixa de bastar).
// Rode com SUPER_ADMIN_SO_POR_CLAIM=1 depois de trocar isSuperAdmin() em firestore.rules pelo modo só-claim.
const SO_CLAIM = process.env.SUPER_ADMIN_SO_POR_CLAIM === '1';
// O que se espera de um e-mail verificado SEM claim: vale durante a migração, deixa de valer no Passo 3.
const EMAIL_VERIFICADO_SEM_CLAIM = SO_CLAIM ? 'fail' : 'succeed';

// Estado inicial do grupo e da competição, recriado antes de cada teste via
// setDoc "as admin" (a API de teste ignora as regras — with.withSecurityRulesDisabled).
async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'groups', GID), {
      name: 'King BT',
      code: CODE1,
      members: [MEMBER_UID, ADMIN_UID, SUPER_ADMIN_UID, MEMBER2_UID, MEMBER3_UID],
      admins: [ADMIN_UID],
      visibility: 'privado',
    });
    await setDoc(doc(db, 'groupCodes', CODE1), { groupId: GID });
    await setDoc(doc(db, 'groups', GID2), {
      name: 'Outro grupo',
      code: CODE2,
      members: [],
      admins: [OUTSIDER_UID], // dono do grupo2, não tem nada a ver com grupo1
      visibility: 'privado',
    });
    await setDoc(doc(db, 'groupCodes', CODE2), { groupId: GID2 });
    await deleteDoc(doc(db, 'groupCodes', CODE_NEW)).catch(() => {}); // limpa resíduo de execuções anteriores
    await setDoc(doc(db, 'groups', GID, 'competitions', 'comp1'), {
      name: 'Rodada de teste',
      format: 'avulso',
      matches: [
        { id: 'm1', stage: 'rotating', teamA: ['p1', 'p2'], teamB: ['p3', 'p4'], scoreA: 6, scoreB: 3 },
        { id: 'm2', stage: 'rotating', teamA: ['p1', 'p3'], teamB: ['p2', 'p4'], scoreA: null, scoreB: null },
      ],
      status: 'active',
    });
    await setDoc(doc(db, 'groups', GID, 'feed', 'post1'), {
      type: 'match_result',
      compId: 'comp1',
      matchId: 'm1',
      compName: 'Rodada de teste',
      reactions: {},
      comments: [
        { uid: MEMBER_UID, name: 'Membro Um', text: 'Boa partida!', ts: Timestamp.now() },
      ],
    });
  });
}

// `verificado` só vale quando há e-mail: true (padrão — o token do Firebase de uma conta com e-mail
// confirmado), false (e-mail não confirmado) ou 'ausente' (token sem o campo email_verified).
function ctxFor(uid, email, verificado = true) {
  if (!email) return testEnv.authenticatedContext(uid);
  const claims = verificado === 'ausente' ? { email } : { email, email_verified: verificado };
  return testEnv.authenticatedContext(uid, claims);
}

// Conta que recebeu a custom claim `superAdmin` (gravada pelo servidor). `extra` acrescenta ou sobrescreve campos do token.
function ctxClaim(uid, extra = {}) {
  return testEnv.authenticatedContext(uid, { superAdmin: true, ...extra });
}

async function run() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8090,
    },
  });

  const results = [];
  async function check(label, promise, expect) {
    try {
      await promise;
      results.push({ label, ok: expect === 'succeed', got: 'succeed' });
    } catch (e) {
      results.push({ label, ok: expect === 'fail', got: 'fail', err: e.message?.split('\n')[0] });
    }
  }

  // ── 1. Excluir um jogo (matches encolhe) ──────────────────────────────
  await seed();
  {
    const memberDb = ctxFor(MEMBER_UID).firestore();
    const compRef = doc(memberDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef); // leitura ainda passa pelas regras normalmente
    const comp = snap.data();
    const shrunk = { ...comp, matches: comp.matches.filter(m => m.id !== 'm2') };
    await check(
      'MEMBRO comum não pode excluir um jogo (matches encolhe)',
      updateDoc(compRef, shrunk),
      'fail',
    );
  }
  await seed();
  {
    const adminDb = ctxFor(ADMIN_UID).firestore();
    const compRef = doc(adminDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef);
    const comp = snap.data();
    const shrunk = { ...comp, matches: comp.matches.filter(m => m.id !== 'm2') };
    await check(
      'ADMIN do grupo pode excluir um jogo',
      updateDoc(compRef, shrunk),
      'succeed',
    );
  }
  await seed();
  {
    const superDb = ctxClaim(SUPER_ADMIN_UID, { email: SUPER_ADMIN_EMAIL, email_verified: true }).firestore();
    const compRef = doc(superDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef);
    const comp = snap.data();
    const shrunk = { ...comp, matches: comp.matches.filter(m => m.id !== 'm2') };
    await check(
      'SUPER ADMIN (fora da lista admins do grupo) pode excluir um jogo',
      updateDoc(compRef, shrunk),
      'succeed',
    );
  }

  // ── 2. Renomear a competição ───────────────────────────────────────────
  await seed();
  {
    const memberDb = ctxFor(MEMBER_UID).firestore();
    const compRef = doc(memberDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef);
    await check(
      'MEMBRO comum não pode renomear a competição',
      updateDoc(compRef, { ...snap.data(), name: 'Nome trocado' }),
      'fail',
    );
  }
  await seed();
  {
    const adminDb = ctxFor(ADMIN_UID).firestore();
    const compRef = doc(adminDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef);
    await check(
      'ADMIN pode renomear a competição',
      updateDoc(compRef, { ...snap.data(), name: 'Nome trocado' }),
      'succeed',
    );
  }

  // ── 3. Marcar placar de um jogo pendente (matches NÃO encolhe) ────────
  await seed();
  {
    const memberDb = ctxFor(MEMBER_UID).firestore();
    const compRef = doc(memberDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef);
    const comp = snap.data();
    const scored = {
      ...comp,
      matches: comp.matches.map(m => m.id === 'm2' ? { ...m, scoreA: 6, scoreB: 4 } : m),
    };
    await check(
      'MEMBRO comum pode marcar o placar de um jogo pendente (uso do dia a dia)',
      updateDoc(compRef, scored),
      'succeed',
    );
  }

  // ── 4. Adicionar um jogo novo (matches cresce) ─────────────────────────
  await seed();
  {
    const memberDb = ctxFor(MEMBER_UID).firestore();
    const compRef = doc(memberDb, 'groups', GID, 'competitions', 'comp1');
    const snap = await getDoc(compRef);
    const comp = snap.data();
    const added = {
      ...comp,
      matches: [...comp.matches, { id: 'm3', stage: 'rotating', teamA: ['p1', 'p4'], teamB: ['p2', 'p3'], scoreA: null, scoreB: null }],
    };
    await check(
      'MEMBRO comum pode adicionar um jogo novo (matches cresce)',
      updateDoc(compRef, added),
      'succeed',
    );
  }

  // ── 5. Excluir a competição inteira ─────────────────────────────────────
  await seed();
  await check(
    'MEMBRO comum não pode excluir a competição inteira',
    deleteDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'competitions', 'comp1')),
    'fail',
  );
  await seed();
  await check(
    'ADMIN pode excluir a competição inteira',
    deleteDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groups', GID, 'competitions', 'comp1')),
    'succeed',
  );

  // ── 6. Apagar o post do feed ────────────────────────────────────────────
  await seed();
  await check(
    'MEMBRO comum não pode apagar um post do feed',
    deleteDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1')),
    'fail',
  );
  await seed();
  await check(
    'ADMIN pode apagar um post do feed',
    deleteDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groups', GID, 'feed', 'post1')),
    'succeed',
  );

  // ── 7. Reagir/comentar no feed continua livre pra qualquer membro ──────
  await seed();
  await check(
    'MEMBRO comum ainda pode reagir/comentar no feed (não é delete)',
    updateDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1'), {
      reactions: { '👑': [MEMBER_UID] },
    }),
    'succeed',
  );

  // ── 8. De fora do grupo, nada ───────────────────────────────────────────
  await seed();
  await check(
    'Quem não é membro do grupo não lê a competição',
    getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID, 'competitions', 'comp1')),
    'fail',
  );

  // ── 9. Grupo privado não vaza mais pra fora só por estar logado ────────
  await seed();
  await check(
    'Quem não é membro NÃO lê o doc do grupo privado (código, membros, admins)',
    getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID)),
    'fail',
  );
  await seed();
  await check(
    'MEMBRO lê o doc do próprio grupo normalmente',
    getDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID)),
    'succeed',
  );

  // ── 10. /groupCodes resolve código→id sem expor o resto do grupo ───────
  await seed();
  await check(
    'Qualquer autenticado lê /groupCodes (só recebe o id, não os dados do grupo)',
    getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groupCodes', CODE1)),
    'succeed',
  );
  await seed();
  await check(
    'Quem tem o código NÃO se autoadiciona em members (precisa da aprovação do admin)',
    updateDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID), {
      members: arrayUnion(OUTSIDER_UID),
    }),
    'fail',
  );

  // ── "Explorar grupos públicos": consulta por visibility ────────────────
  await seed();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'groups', 'publico1'), { name: 'Aberto', code: 'ABERTO', members: [ADMIN_UID], admins: [ADMIN_UID], visibility: 'publico' });
  });
  // Consulta que o app faz ao entrar (AuthContext, "reconciliar grupos"): grupos em que o próprio uid é membro.
  await check('MEMBRO lista os grupos em que é membro (members array-contains uid)',
    getDocs(query(collection(ctxFor(MEMBER_UID).firestore(), 'groups'), where('members', 'array-contains', MEMBER_UID))), 'succeed');
  await check('Ninguém lista os grupos de OUTRA pessoa (array-contains de outro uid)',
    getDocs(query(collection(ctxFor(OUTSIDER_UID).firestore(), 'groups'), where('members', 'array-contains', MEMBER_UID))), 'fail');
  await check('DE FORA lista grupos PÚBLICOS (where visibility == publico)',
    getDocs(query(collection(ctxFor(OUTSIDER_UID).firestore(), 'groups'), where('visibility', '==', 'publico'))), 'succeed');
  await check('DE FORA não lista grupos sem o filtro de público',
    getDocs(collection(ctxFor(OUTSIDER_UID).firestore(), 'groups')), 'fail');
  await check('DE FORA lê um grupo PRIVADO: negado',
    getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID)), 'fail');

  // ── Pedido de entrada com aprovação do admin ───────────────────────────
  const reqRef = (uid, asUid) => doc(ctxFor(asUid).firestore(), 'groups', GID, 'joinRequests', uid);
  const goodReq = (uid) => ({ uid, name: 'Fulano', requestedAt: '2026-09-30T12:00:00.000Z' });
  await seed();
  await check('DE FORA cria o próprio pedido de entrada',
    setDoc(reqRef(OUTSIDER_UID, OUTSIDER_UID), goodReq(OUTSIDER_UID)), 'succeed');
  await seed();
  await check('DE FORA não cria pedido em nome de outra pessoa',
    setDoc(reqRef('outro', OUTSIDER_UID), goodReq('outro')), 'fail');
  await seed();
  await check('Pedido com campo extra é recusado',
    setDoc(reqRef(OUTSIDER_UID, OUTSIDER_UID), { ...goodReq(OUTSIDER_UID), role: 'admin' }), 'fail');
  await seed();
  await check('MEMBRO não precisa (nem pode) criar pedido',
    setDoc(reqRef(MEMBER_UID, MEMBER_UID), goodReq(MEMBER_UID)), 'fail');
  await seed();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'groups', GID, 'joinRequests', OUTSIDER_UID), goodReq(OUTSIDER_UID));
  });
  await check('O próprio pedinte lê o pedido (pra saber se foi recusado)',
    getDoc(reqRef(OUTSIDER_UID, OUTSIDER_UID)), 'succeed');
  await check('ADMIN lê o pedido',
    getDoc(reqRef(OUTSIDER_UID, ADMIN_UID)), 'succeed');
  await check('MEMBRO comum não lê pedidos dos outros',
    getDoc(reqRef(OUTSIDER_UID, MEMBER_UID)), 'fail');
  await check('Pedido não pode ser editado',
    updateDoc(reqRef(OUTSIDER_UID, OUTSIDER_UID), { name: 'Outro' }), 'fail');
  await check('ADMIN aprova: adiciona a pessoa em members',
    updateDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groups', GID), { members: arrayUnion(OUTSIDER_UID) }), 'succeed');
  await check('ADMIN apaga o pedido depois de aprovar',
    deleteDoc(reqRef(OUTSIDER_UID, ADMIN_UID)), 'succeed');
  await check('Aprovado passa a ler o grupo',
    getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID)), 'succeed');
  await seed();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'groups', GID, 'joinRequests', OUTSIDER_UID), goodReq(OUTSIDER_UID));
  });
  await check('MEMBRO comum não apaga pedido de outro',
    deleteDoc(reqRef(OUTSIDER_UID, MEMBER_UID)), 'fail');
  await check('O pedinte cancela o próprio pedido',
    deleteDoc(reqRef(OUTSIDER_UID, OUTSIDER_UID)), 'succeed');
  await seed();
  await check(
    'Não-admin não cria /groupCodes apontando pra um grupo que não é dele',
    setDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groupCodes', CODE_NEW), { groupId: GID2 }),
    'fail',
  );
  await seed();
  await check(
    'Admin do grupo cria /groupCodes apontando pro próprio grupo (fluxo normal de createGroup)',
    setDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groupCodes', CODE_NEW), { groupId: GID }),
    'succeed',
  );
  await seed();
  await check(
    '/groupCodes não pode trocar o grupo a que aponta',
    updateDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groupCodes', CODE1), { groupId: GID2 }),
    'fail',
  );
  await seed();
  await check(
    'Admin atualiza a prévia pública (nome/descrição/visibilidade) do código',
    updateDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groupCodes', CODE1), { name: 'King BT', description: 'Sábados na praia', visibility: 'privado' }),
    'succeed',
  );
  await seed();
  await check(
    'Admin recria o registro de um código que não existia (grupo antigo), com groupId',
    setDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groupCodes', CODE_NEW), { groupId: GID, name: 'King BT', description: '', visibility: 'privado' }, { merge: true }),
    'succeed',
  );
  await seed();
  await check(
    'Admin não toma um código que já aponta para outro grupo',
    setDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groupCodes', CODE2), { groupId: GID, name: 'X' }, { merge: true }),
    'fail',
  );
  await seed();
  await check(
    'Quem não é admin não altera a prévia do código',
    updateDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groupCodes', CODE1), { name: 'Hackeado' }),
    'fail',
  );
  await seed();
  await check(
    'Criar código com campo fora da prévia é recusado',
    setDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groupCodes', CODE_NEW), { groupId: GID, extra: 1 }),
    'fail',
  );

  // ── 11. Comentário do feed: autoria checada de verdade ──────────────────
  await seed();
  await check(
    'MEMBRO adiciona comentário com o próprio uid',
    updateDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1'), {
      comments: [
        { uid: MEMBER_UID, name: 'Membro Um', text: 'Boa partida!', ts: Timestamp.now() },
        { uid: MEMBER_UID, name: 'Membro Um', text: 'De novo!', ts: Timestamp.now() },
      ],
    }),
    'succeed',
  );
  await seed();
  await check(
    'MEMBRO NÃO consegue adicionar comentário assinado com uid de outra pessoa',
    updateDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1'), {
      comments: [
        { uid: MEMBER_UID, name: 'Membro Um', text: 'Boa partida!', ts: Timestamp.now() },
        { uid: ADMIN_UID, name: 'Admin', text: 'Forjado!', ts: Timestamp.now() },
      ],
    }),
    'fail',
  );
  await seed();
  await check(
    'MEMBRO apaga o PRÓPRIO comentário',
    updateDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1'), {
      comments: [],
    }),
    'succeed',
  );
  await seed();
  {
    // Comentário de outra pessoa (admin) além do já existente do membro
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'groups', GID, 'feed', 'post1'), {
        comments: [
          { uid: MEMBER_UID, name: 'Membro Um', text: 'Boa partida!', ts: Timestamp.now() },
          { uid: ADMIN_UID, name: 'Admin', text: 'Comentário do admin', ts: Timestamp.now() },
        ],
      });
    });
    const snap = await getDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1'));
    const comments = snap.data().comments; // uma única leitura — filter() e o array final precisam vir da MESMA referência
    await check(
      'MEMBRO NÃO consegue apagar comentário de OUTRO membro',
      updateDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'feed', 'post1'), {
        comments: comments.filter(c => c.uid !== ADMIN_UID),
      }),
      'fail',
    );
  }
  await seed();
  {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'groups', GID, 'feed', 'post1'), {
        comments: [
          { uid: MEMBER_UID, name: 'Membro Um', text: 'Boa partida!', ts: Timestamp.now() },
        ],
      });
    });
    await check(
      'ADMIN pode apagar comentário de outro membro (moderação)',
      updateDoc(doc(ctxFor(ADMIN_UID).firestore(), 'groups', GID, 'feed', 'post1'), {
        comments: [],
      }),
      'succeed',
    );
  }

  // ── 12. Placar ao vivo (/liveMatches) ───────────────────────────────────
  await seed();
  await check(
    'MEMBRO grava placar ao vivo de um jogo da própria competição',
    setDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'), {
      liveScore: { gamesA: 3, gamesB: 2, setsA: 0, setsB: 0, updatedAt: new Date().toISOString(), scorerUid: MEMBER_UID, scorerName: 'Membro Um' },
    }, { merge: true }),
    'succeed',
  );
  await seed();
  await check(
    'MEMBRO lê o placar ao vivo de um jogo da própria competição',
    (async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'), {
          liveScore: { gamesA: 1, gamesB: 0, setsA: 0, setsB: 0, updatedAt: new Date().toISOString(), scorerUid: ADMIN_UID, scorerName: 'Admin' },
        });
      });
      await getDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'));
    })(),
    'succeed',
  );
  await seed();
  await check(
    'Quem não é membro NÃO grava placar ao vivo',
    setDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'), {
      liveScore: { gamesA: 1, gamesB: 0, setsA: 0, setsB: 0, updatedAt: new Date().toISOString() },
    }, { merge: true }),
    'fail',
  );
  await seed();
  await check(
    'Quem não é membro NÃO lê o placar ao vivo',
    (async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'), {
          liveScore: { gamesA: 1, gamesB: 0, setsA: 0, setsB: 0, updatedAt: new Date().toISOString() },
        });
      });
      await getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'));
    })(),
    'fail',
  );
  await seed();
  await check(
    'MEMBRO apaga o doc de placar ao vivo (fim de partida)',
    (async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'), {
          liveScore: { gamesA: 6, gamesB: 4, setsA: 1, setsB: 0, updatedAt: new Date().toISOString() },
        });
      });
      await deleteDoc(doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm2'));
    })(),
    'succeed',
  );

  // ── Vinculação de perfil (linkToPlayer) ────────────────────────────────
  // O perfil que o admin cadastra antes tem id ALEATÓRIO, não o uid de quem
  // vai usá-lo. A regra antiga só aceitava `playerId == uid`, então o fluxo
  // de entrada no grupo caía em permission-denied para todo mundo que não
  // fosse admin.
  const P_LIVRE = 'perfilSemDono';
  const P_DO_ADMIN = 'perfilDoAdmin';
  const P_DO_MEMBRO = 'perfilJaVinculadoAoMembro';

  async function seedPlayers() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'groups', GID, 'players', P_LIVRE), {
        name: 'Convidado', color: '#FFD166', guest: true, uid: null,
      });
      await setDoc(doc(db, 'groups', GID, 'players', P_DO_ADMIN), {
        name: 'Admin', color: '#2DD4BF', guest: false, uid: ADMIN_UID, handicap: 0,
      });
      await setDoc(doc(db, 'groups', GID, 'players', P_DO_MEMBRO), {
        name: 'Membro', color: '#A78BFA', guest: false, uid: MEMBER_UID,
      });
    });
  }

  await seed(); await seedPlayers();
  await check(
    'MEMBRO se vincula a um perfil sem dono (fluxo de entrada no grupo)',
    setDoc(
      doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'players', P_LIVRE),
      { uid: MEMBER_UID, guest: false },
      { merge: true },
    ),
    'succeed',
  );

  await seed(); await seedPlayers();
  await check(
    'MEMBRO NÃO rouba um perfil já vinculado a outra pessoa',
    setDoc(
      doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'players', P_DO_ADMIN),
      { uid: MEMBER_UID },
      { merge: true },
    ),
    'fail',
  );

  await seed(); await seedPlayers();
  await check(
    'MEMBRO NÃO se vincula carimbando o uid de OUTRA pessoa',
    setDoc(
      doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'players', P_LIVRE),
      { uid: OUTSIDER_UID, guest: false },
      { merge: true },
    ),
    'fail',
  );

  await seed(); await seedPlayers();
  await check(
    'MEMBRO NÃO aproveita a vinculação para mexer em outro campo (handicap)',
    setDoc(
      doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'players', P_LIVRE),
      { uid: MEMBER_UID, guest: false, handicap: 3 },
      { merge: true },
    ),
    'fail',
  );

  await seed(); await seedPlayers();
  await check(
    'DONO do perfil vinculado troca o próprio nome (id do doc != uid)',
    updateDoc(
      doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'players', P_DO_MEMBRO),
      { name: 'Nome Novo' },
    ),
    'succeed',
  );

  await seed(); await seedPlayers();
  await check(
    'MEMBRO NÃO altera o handicap de OUTRO jogador',
    updateDoc(
      doc(ctxFor(MEMBER_UID).firestore(), 'groups', GID, 'players', P_DO_ADMIN),
      { handicap: 3 },
    ),
    'fail',
  );

  await seed(); await seedPlayers();
  await check(
    'ADMIN altera o handicap de qualquer jogador',
    updateDoc(
      doc(ctxFor(ADMIN_UID).firestore(), 'groups', GID, 'players', P_DO_MEMBRO),
      { handicap: 2 },
    ),
    'succeed',
  );

  // ── Enumeração de /groupCodes ──────────────────────────────────────────
  // Listar a coleção devolvia o groupId de TODOS os grupos; com a regra de
  // `members`, que deixa um não-membro se adicionar sozinho, isso era
  // entrada livre em qualquer grupo privado sem nunca ter visto o código.
  await seed();
  await check(
    'Ninguém LISTA /groupCodes (enumeração de todos os grupos)',
    getDocs(collection(ctxFor(OUTSIDER_UID).firestore(), 'groupCodes')),
    'fail',
  );

  await seed();
  await check(
    'Nem um membro consegue LISTAR /groupCodes',
    getDocs(collection(ctxFor(MEMBER_UID).firestore(), 'groupCodes')),
    'fail',
  );

  await seed();
  await check(
    'Entrar por código continua funcionando (get do código exato)',
    getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'groupCodes', CODE1)),
    'succeed',
  );

  // ── Enumeração de /users ────────────────────────────────────────────────
  // getDocs(collection('users')) sem filtro baixava nome e e-mail de TODOS
  // os usuários do app para qualquer conta logada — era a implementação
  // antiga de searchUsers (tela "adicionar membro existente"), rodando
  // direto no cliente. A busca agora roda numa Cloud Function com Admin
  // SDK; aqui só garantimos que a porta antiga (list direto do cliente)
  // continua fechada, e que o get por uid específico — usado por
  // removeFromGroup para checar o groupId de quem está saindo — não quebrou.
  async function seedUsers() {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'users', MEMBER_UID), { name: 'Membro', email: 'membro@example.com', groupId: GID });
      await setDoc(doc(db, 'users', OUTSIDER_UID), { name: 'De Fora', email: 'defora@example.com', groupId: null });
    });
  }

  await seed(); await seedUsers();
  await check(
    'Ninguém LISTA /users (enumeração de nome/e-mail de todo mundo)',
    getDocs(collection(ctxFor(OUTSIDER_UID).firestore(), 'users')),
    'fail',
  );

  await seed(); await seedUsers();
  await check(
    'GET por uid específico continua funcionando (removeFromGroup depende disso)',
    getDoc(doc(ctxFor(ADMIN_UID).firestore(), 'users', MEMBER_UID)),
    'succeed',
  );

  await seed(); await seedUsers();
  await check(
    'Usuário lê o próprio doc normalmente',
    getDoc(doc(ctxFor(MEMBER_UID).firestore(), 'users', MEMBER_UID)),
    'succeed',
  );

  // ── A2: GET de /users só pelo dono, super admin e admin do grupo ativo ──
  await seed(); await seedUsers();
  await check('A2: outro MEMBRO comum não lê o doc (e-mail) de um colega',
    getDoc(doc(ctxFor(MEMBER2_UID).firestore(), 'users', MEMBER_UID)), 'fail');
  await check('A2: conta de FORA não lê o doc de um membro',
    getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'users', MEMBER_UID)), 'fail');
  await check('A2: admin de OUTRO grupo não lê o doc de quem está no grupo1',
    getDoc(doc(ctxFor(OUTSIDER_UID).firestore(), 'users', MEMBER_UID)), 'fail');
  await check('A2: admin do grupo ativo lê o doc do membro (removeFromGroup)',
    getDoc(doc(ctxFor(ADMIN_UID).firestore(), 'users', MEMBER_UID)), 'succeed');
  await check('A2: super admin verificado lê o doc de qualquer um',
    getDoc(doc(ctxFor(SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, true).firestore(), 'users', OUTSIDER_UID)), EMAIL_VERIFICADO_SEM_CLAIM);
  await check('A2: super admin com a claim lê o doc de qualquer um',
    getDoc(doc(ctxClaim(SUPER_ADMIN_UID).firestore(), 'users', OUTSIDER_UID)), 'succeed');
  await check('A2: admin não lê o doc de quem não tem grupo ativo (groupId nulo)',
    getDoc(doc(ctxFor(ADMIN_UID).firestore(), 'users', OUTSIDER_UID)), 'fail');
  await check('A2: admin lendo doc que não existe é negado (o cliente trata)',
    getDoc(doc(ctxFor(ADMIN_UID).firestore(), 'users', 'inexistente')), 'fail');

  // ── Avaliação da comunidade (players/{id}/ratings/{uid}) ───────────────
  await seed();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // jogador "pedro" (id aleatório, vinculado ao MEMBER_UID) e "ana" (sem dono)
    await setDoc(doc(db, 'groups', GID, 'players', 'pedro'), { name: 'Pedro', uid: MEMBER_UID, guest: false });
    await setDoc(doc(db, 'groups', GID, 'players', 'ana'), { name: 'Ana', guest: false });
  });
  const ratingRef = (uid, playerId, rater) => doc(ctxFor(uid).firestore(), 'groups', GID, 'players', playerId, 'ratings', rater);
  const okSkills = { smash: 7, lob: 5, defesa: 6 };

  await check('MEMBRO avalia outro jogador com o próprio uid',
    setDoc(ratingRef(MEMBER_UID, 'ana', MEMBER_UID), { skills: okSkills, updatedAt: Timestamp.now() }), 'succeed');
  await check('MEMBRO NÃO avalia em nome de outro uid',
    setDoc(ratingRef(MEMBER_UID, 'ana', ADMIN_UID), { skills: okSkills }), 'fail');
  await check('MEMBRO NÃO avalia a si mesmo (perfil vinculado ao próprio uid)',
    setDoc(ratingRef(MEMBER_UID, 'pedro', MEMBER_UID), { skills: okSkills }), 'fail');
  await check('MEMBRO NÃO avalia a si mesmo (id do doc = próprio uid)',
    setDoc(ratingRef(MEMBER_UID, MEMBER_UID, MEMBER_UID), { skills: okSkills }), 'fail');
  await check('Nota acima de 10 é recusada',
    setDoc(ratingRef(ADMIN_UID, 'ana', ADMIN_UID), { skills: { smash: 11 } }), 'fail');
  await check('Nota 0 é recusada (mínimo é 1)',
    setDoc(ratingRef(ADMIN_UID, 'ana', ADMIN_UID), { skills: { smash: 0 } }), 'fail');
  await check('Nota não inteira é recusada',
    setDoc(ratingRef(ADMIN_UID, 'ana', ADMIN_UID), { skills: { smash: 6.5 } }), 'fail');
  await check('Habilidade desconhecida é recusada',
    setDoc(ratingRef(ADMIN_UID, 'ana', ADMIN_UID), { skills: { forca: 5 } }), 'fail');
  await check('Avaliação com categoria percebida válida é aceita',
    setDoc(ratingRef(MEMBER_UID, 'ana', MEMBER_UID), { skills: okSkills, category: 'B', updatedAt: Timestamp.now() }), 'succeed');
  await check('Categoria percebida inválida é recusada',
    setDoc(ratingRef(MEMBER_UID, 'ana', MEMBER_UID), { skills: okSkills, category: 'Z' }), 'fail');
  await check('Campo extra no doc é recusado',
    setDoc(ratingRef(ADMIN_UID, 'ana', ADMIN_UID), { skills: okSkills, extra: 1 }), 'fail');
  await check('MEMBRO lê as avaliações do grupo',
    getDocs(collection(ctxFor(ADMIN_UID).firestore(), 'groups', GID, 'players', 'ana', 'ratings')), 'succeed');
  await check('DE FORA do grupo não lê as avaliações',
    getDocs(collection(ctxFor(OUTSIDER_UID).firestore(), 'groups', GID, 'players', 'ana', 'ratings')), 'fail');
  await check('DE FORA do grupo não avalia',
    setDoc(ratingRef(OUTSIDER_UID, 'ana', OUTSIDER_UID), { skills: okSkills }), 'fail');
  await check('MEMBRO apaga a própria avaliação',
    deleteDoc(ratingRef(MEMBER_UID, 'ana', MEMBER_UID)), 'succeed');
  await check('MEMBRO não apaga a avaliação de outro',
    deleteDoc(ratingRef(MEMBER_UID, 'ana', ADMIN_UID)), 'fail');

  // ── Desafios (groups/{gid}/challenges/{id}) ────────────────────────────
  const chRef = (asUid, id) => doc(ctxFor(asUid).firestore(), 'groups', GID, 'challenges', id);
  const newCh = { fromId: 'p1', toId: 'p2', fromUid: MEMBER_UID, toUid: MEMBER2_UID, message: 'Bora?', status: 'pending', createdAt: '2026-10-02T12:00:00.000Z' };
  // seed() + o perfil p1 do desafiante (a regra exige que o fromId seja o perfil do próprio usuário)
  const seedC = async () => {
    await seed();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'groups', GID, 'players', 'p1'), { name: 'P1', uid: MEMBER_UID, guest: false });
      await setDoc(doc(ctx.firestore(), 'groups', GID, 'players', 'p-do-outro'), { name: 'Do outro', uid: MEMBER2_UID, guest: false });
    });
  };
  const seedCh = async (over = {}) => {
    await seed();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'groups', GID, 'challenges', 'c1'), { ...newCh, ...over });
    });
  };
  await seedC();
  await check('MEMBRO cria um desafio', setDoc(chRef(MEMBER_UID, 'c1'), newCh), 'succeed');
  await seedC();
  await check('Não cria desafio assinado por outra pessoa', setDoc(chRef(MEMBER2_UID, 'c1'), newCh), 'fail');
  await seedC();
  await check('Desafio já nasce pendente (aceito é recusado)', setDoc(chRef(MEMBER_UID, 'c1'), { ...newCh, status: 'accepted' }), 'fail');
  await seedC();
  await check('Desafio com campo extra é recusado', setDoc(chRef(MEMBER_UID, 'c1'), { ...newCh, compId: 'x' }), 'fail');
  await seedC();
  await check('Não desafia a si mesmo', setDoc(chRef(MEMBER_UID, 'c1'), { ...newCh, toUid: MEMBER_UID }), 'fail');
  await seedC();
  await check('Mensagem grande demais é recusada', setDoc(chRef(MEMBER_UID, 'c1'), { ...newCh, message: 'x'.repeat(141) }), 'fail');
  await seedC();
  await check('Desafio de duplas válido', setDoc(chRef(MEMBER_UID, 'c-duplas'), { ...newCh, fromPartnerId: 'p3', toPartnerId: 'p4' }), 'succeed');
  await seedC();
  await check('Duplas: só um parceiro é recusado', setDoc(chRef(MEMBER_UID, 'c1'), { ...newCh, fromPartnerId: 'p3' }), 'fail');
  await seedC();
  await check('Duplas: parceiro repetido é recusado', setDoc(chRef(MEMBER_UID, 'c1'), { ...newCh, fromPartnerId: 'p3', toPartnerId: 'p3' }), 'fail');
  await seedC();
  await check('Duplas: parceiro igual ao adversário é recusado', setDoc(chRef(MEMBER_UID, 'c1'), { ...newCh, fromPartnerId: 'p2', toPartnerId: 'p4' }), 'fail');
  await seedC();
  await check('B6: NÃO desafia usando o perfil (fromId) de OUTRA pessoa', setDoc(chRef(MEMBER_UID, 'c-b6-novo'), { ...newCh, fromId: 'p-do-outro' }), 'fail');
  await check('B6: controle — o mesmo desafio com o PRÓPRIO perfil (p1) é aceito', setDoc(chRef(MEMBER_UID, 'c-b6-controle'), newCh), 'succeed');
  await seedC();
  await check('DE FORA do grupo não cria desafio', setDoc(chRef(OUTSIDER_UID, 'c1'), { ...newCh, fromUid: OUTSIDER_UID }), 'fail');

  await seedCh();
  await check('MEMBRO lê os desafios do grupo', getDoc(chRef(MEMBER3_UID, 'c1')), 'succeed');
  await check('DE FORA não lê desafios', getDoc(chRef(OUTSIDER_UID, 'c1')), 'fail');
  await check('O desafiado aceita', updateDoc(chRef(MEMBER2_UID, 'c1'), { status: 'accepted', respondedAt: '2026-10-02T13:00:00.000Z' }), 'succeed');
  await seedCh();
  await check('O desafiado recusa', updateDoc(chRef(MEMBER2_UID, 'c1'), { status: 'declined', respondedAt: '2026-10-02T13:00:00.000Z' }), 'succeed');
  await seedCh();
  await check('O desafiante NÃO aceita o próprio desafio', updateDoc(chRef(MEMBER_UID, 'c1'), { status: 'accepted' }), 'fail');
  await check('Terceiro (membro) não responde', updateDoc(chRef(MEMBER3_UID, 'c1'), { status: 'accepted' }), 'fail');
  await check('O desafiado não muda quem desafiou', updateDoc(chRef(MEMBER2_UID, 'c1'), { status: 'accepted', fromUid: MEMBER2_UID }), 'fail');
  await check('O desafiante cancela', updateDoc(chRef(MEMBER_UID, 'c1'), { status: 'cancelled', respondedAt: '2026-10-02T13:00:00.000Z' }), 'succeed');

  await seedCh({ status: 'accepted' });
  await check('Um dos dois liga a partida ao desafio aceito', updateDoc(chRef(MEMBER_UID, 'c1'), { compId: 'comp9' }), 'succeed');
  await check('O jogo já ligado não pode ser trocado', updateDoc(chRef(MEMBER2_UID, 'c1'), { compId: 'outro' }), 'fail');
  await seedCh({ status: 'accepted' });
  await check('Terceiro não liga partida ao desafio', updateDoc(chRef(MEMBER3_UID, 'c1'), { compId: 'comp9' }), 'fail');
  await seedCh();
  await check('Desafio ainda pendente não aceita partida ligada', updateDoc(chRef(MEMBER_UID, 'c1'), { compId: 'comp9' }), 'fail');
  await seedCh();
  await check('O desafiado não apaga o desafio', deleteDoc(chRef(MEMBER2_UID, 'c1')), 'fail');
  await check('O desafiante apaga o próprio desafio', deleteDoc(chRef(MEMBER_UID, 'c1')), 'succeed');

  // ── A1: super admin exige e-mail VERIFICADO ────────────────────────────
  // Antes bastava o token ter o e-mail certo. Sem `email_verified`, quem registrasse uma conta com
  // este endereço virava dono de todos os grupos e de /config.
  {
    const OUTRO_EMAIL = 'outra.pessoa@gmail.com';
    const cfgRef = (db) => doc(db, 'config', 'appVersion');
    const grupoRef = (db) => doc(db, 'groups', GID);
    const compRef = (db) => doc(db, 'groups', GID, 'competitions', 'comp1');

    await seed();
    await check('A1: SUPER ADMIN com e-mail verificado grava em /config',
      setDoc(cfgRef(ctxFor(SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, true).firestore()), { minBuildTime: 1 }), EMAIL_VERIFICADO_SEM_CLAIM);
    await check('A1: o mesmo e-mail SEM verificação não grava em /config',
      setDoc(cfgRef(ctxFor(SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, false).firestore()), { minBuildTime: 2 }), 'fail');
    await check('A1: o mesmo e-mail com token SEM o campo email_verified não grava em /config',
      setDoc(cfgRef(ctxFor(SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, 'ausente').firestore()), { minBuildTime: 3 }), 'fail');
    await check('A1: e-mail verificado de OUTRA pessoa não grava em /config',
      setDoc(cfgRef(ctxFor('outro-uid', OUTRO_EMAIL, true).firestore()), { minBuildTime: 4 }), 'fail');
    await check('A1: membro comum (sem e-mail) não grava em /config',
      setDoc(cfgRef(ctxFor(MEMBER_UID).firestore()), { minBuildTime: 5 }), 'fail');
    await check('A1: /config continua legível por qualquer conta logada',
      getDoc(cfgRef(ctxFor(MEMBER_UID).firestore())), 'succeed');

    await seed();
    await check('A1: SUPER ADMIN verificado edita um grupo em que não é admin',
      updateDoc(grupoRef(ctxFor(SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, true).firestore()), { name: 'Nome pelo super admin' }), EMAIL_VERIFICADO_SEM_CLAIM);
    await seed();
    await check('A1: o mesmo e-mail SEM verificação não edita o grupo',
      updateDoc(grupoRef(ctxFor(SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, false).firestore()), { name: 'Nome invasor' }), 'fail');
    await check('A1: o mesmo e-mail SEM verificação não exclui a competição',
      deleteDoc(compRef(ctxFor(SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, false).firestore())), 'fail');
    await check('A1: o mesmo e-mail com token SEM o campo email_verified não exclui a competição',
      deleteDoc(compRef(ctxFor(SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, 'ausente').firestore())), 'fail');
    await check('A1: e-mail verificado de OUTRA pessoa não exclui a competição',
      deleteDoc(compRef(ctxFor('outro-uid', OUTRO_EMAIL, true).firestore())), 'fail');
    await check('A1: SUPER ADMIN verificado exclui a competição',
      deleteDoc(compRef(ctxFor(SUPER_ADMIN_UID, SUPER_ADMIN_EMAIL, true).firestore())), EMAIL_VERIFICADO_SEM_CLAIM);
  }

  // ── B6: brechas pequenas das regras ─────────────────────────────────────
  {
    const uRef = (uid, alvo) => doc(ctxFor(uid).firestore(), 'users', alvo);
    const seedU = async () => {
      await seed();
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', MEMBER_UID), { name: 'Membro', groupId: GID, groupIds: [GID, 'outro-grupo'] });
      });
    };
    await seedU();
    await check('B6: admin tira o grupo da lista de quem sai (groupIds sem o grupo)',
      updateDoc(uRef(ADMIN_UID, MEMBER_UID), { groupId: null, groupIds: arrayRemove(GID) }), 'succeed');
    await seedU();
    await check('B6: admin limpa só o groupId e deixa a lista como está',
      updateDoc(uRef(ADMIN_UID, MEMBER_UID), { groupId: null }), 'succeed');
    await seedU();
    await check('B6: admin NÃO põe uma lista arbitrária em groupIds',
      updateDoc(uRef(ADMIN_UID, MEMBER_UID), { groupId: null, groupIds: ['grupo-inventado'] }), 'fail');
    await seedU();
    await check('B6: admin NÃO apaga outros grupos da lista (só o de onde a pessoa sai)',
      updateDoc(uRef(ADMIN_UID, MEMBER_UID), { groupId: null, groupIds: [] }), 'fail');

    const pRef = (uid, id) => doc(ctxFor(uid).firestore(), 'groups', GID, 'players', id);
    await seed();
    await check('B6: membro cria o PRÓPRIO perfil (uid dele)', setDoc(pRef(MEMBER_UID, MEMBER_UID), { name: 'Eu', uid: MEMBER_UID, guest: false }), 'succeed');
    await check('B6: membro cria convidado (sem uid)', setDoc(pRef(MEMBER_UID, 'conv1'), { name: 'Convidado', uid: null, guest: true }), 'succeed');
    await check('B6: membro NÃO cria perfil com o uid de OUTRA pessoa', setDoc(pRef(MEMBER_UID, 'falso1'), { name: 'Falso', uid: MEMBER2_UID, guest: false }), 'fail');
    await check('B6: admin cria perfil para outra pessoa (aprovar inscrição)', setDoc(pRef(ADMIN_UID, 'aprovado1'), { name: 'Aprovado', uid: OUTSIDER_UID, guest: false }), 'succeed');
  }

  // ── M1: visitante de grupo público só mexe no PRÓPRIO pedido de inscrição ──
  {
    const PUB = 'grupopub';
    const VISITOR = OUTSIDER_UID;
    const OTHER_UID = 'outro-visitante';
    const meu = { uid: VISITOR, name: 'Visitante', requestedAt: '2026-10-17T10:00:00.000Z' };
    const alheio = { uid: OTHER_UID, name: 'Outro', requestedAt: '2026-10-17T09:00:00.000Z' };
    const seedPub = async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'groups', PUB), { name: 'Aberto', code: 'ABERTO2', members: [ADMIN_UID], admins: [ADMIN_UID], visibility: 'publico' });
        await setDoc(doc(db, 'groups', PUB, 'competitions', 'c1'), { name: 'Aberta', format: 'avulso', status: 'upcoming', matches: [], joinRequests: [alheio] });
      });
    };
    const cRef = (uid) => doc(ctxFor(uid).firestore(), 'groups', PUB, 'competitions', 'c1');

    await seedPub();
    await check('M1: visitante acrescenta o PRÓPRIO pedido', updateDoc(cRef(VISITOR), { joinRequests: arrayUnion(meu) }), 'succeed');
    await seedPub();
    await check('M1: visitante NÃO acrescenta pedido em nome de outra pessoa',
      updateDoc(cRef(VISITOR), { joinRequests: arrayUnion({ uid: 'vitima', name: 'Vítima', requestedAt: 'x' }) }), 'fail');
    await check('M1: visitante NÃO acrescenta pedido com campo extra',
      updateDoc(cRef(VISITOR), { joinRequests: arrayUnion({ ...meu, extra: 'lixo' }) }), 'fail');
    await check('M1: visitante NÃO acrescenta dois pedidos de uma vez',
      updateDoc(cRef(VISITOR), { joinRequests: [alheio, meu, { ...meu, requestedAt: 'y' }] }), 'fail');
    await check('M1: visitante NÃO apaga o pedido de OUTRA pessoa',
      updateDoc(cRef(VISITOR), { joinRequests: arrayRemove(alheio) }), 'fail');
    await check('M1: visitante NÃO zera a lista inteira', updateDoc(cRef(VISITOR), { joinRequests: [] }), 'fail');
    await check('M1: visitante NÃO troca o pedido alheio por outro (mesmo tamanho)',
      updateDoc(cRef(VISITOR), { joinRequests: [meu] }), 'fail');
    await check('M1: visitante NÃO mexe em outro campo junto', updateDoc(cRef(VISITOR), { joinRequests: arrayUnion(meu), status: 'done' }), 'fail');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'groups', PUB, 'competitions', 'c1'), { name: 'Aberta', format: 'avulso', status: 'upcoming', matches: [], joinRequests: [alheio, meu] });
    });
    await check('M1: visitante remove o PRÓPRIO pedido', updateDoc(cRef(VISITOR), { joinRequests: arrayRemove(meu) }), 'succeed');
    await seedPub();
    await check('M1: admin (membro) recusa o pedido de outra pessoa', updateDoc(cRef(ADMIN_UID), { joinRequests: arrayRemove(alheio) }), 'succeed');

    // M6: aprovar um pedido vira UM lote atômico (jogador + membro + inscrição + remoção do pedido)
    await seedPub();
    {
      const adb = ctxFor(ADMIN_UID).firestore();
      const b = writeBatch(adb);
      b.set(doc(adb, 'groups', PUB, 'players', OTHER_UID), { name: 'Outro', uid: OTHER_UID, color: '#2DD4BF', guest: false });
      b.update(doc(adb, 'groups', PUB), { members: arrayUnion(OTHER_UID) });
      b.update(doc(adb, 'groups', PUB, 'competitions', 'c1'), { confirmedIds: arrayUnion(OTHER_UID), joinRequests: arrayRemove(alheio) });
      await check('M6: lote atômico de aprovação (admin) é aceito pelas regras', b.commit(), 'succeed');
    }
  }

  // ── A3 (plano A): endurecimento parcial de competição, liveMatches e comentários ──
  {
    const compRef = (uid) => doc(ctxFor(uid).firestore(), 'groups', GID, 'competitions', 'comp1');
    await seed();
    await check('A3: membro NÃO troca o formato da competição',
      updateDoc(compRef(MEMBER_UID), { format: 'super8' }), 'fail');
    await check('A3: membro NÃO passa a ser "criador" da competição',
      updateDoc(compRef(MEMBER_UID), { createdBy: MEMBER_UID }), 'fail');
    await check('A3: membro NÃO acrescenta unit/gender depois de criada',
      updateDoc(compRef(MEMBER_UID), { unit: 'duplas' }), 'fail');
    await check('A3: membro NÃO grava um status inventado',
      updateDoc(compRef(MEMBER_UID), { status: 'hackeada' }), 'fail');
    await check('A3: membro encerra a competição (status válido) — uso normal',
      updateDoc(compRef(MEMBER_UID), { status: 'done' }), 'succeed');
    await seed();
    await check('A3: ADMIN troca o formato (continua podendo)',
      updateDoc(compRef(ADMIN_UID), { format: 'super8' }), 'succeed');

    const liveRef = (uid) => doc(ctxFor(uid).firestore(), 'groups', GID, 'competitions', 'comp1', 'liveMatches', 'm1');
    await seed();
    await check('A3: membro grava o placar ao vivo (liveScore)',
      setDoc(liveRef(MEMBER_UID), { liveScore: { a: 1, b: 0 } }, { merge: true }), 'succeed');
    await check('A3: membro grava rascunho (draftSets)',
      setDoc(liveRef(MEMBER_UID), { draftSets: [] }, { merge: true }), 'succeed');
    await check('A3: liveMatches rejeita campo estranho',
      setDoc(liveRef(MEMBER_UID), { lixo: 'x'.repeat(100) }, { merge: true }), 'fail');
    await check('A3: membro apaga o doc ao vivo (fim da partida)',
      deleteDoc(liveRef(MEMBER_UID)), 'succeed');
    await check('A3: quem é de fora não grava em liveMatches',
      setDoc(liveRef(OUTSIDER_UID), { liveScore: { a: 9, b: 9 } }, { merge: true }), 'fail');

    const postRef = (uid) => doc(ctxFor(uid).firestore(), 'groups', GID, 'feed', 'post1');
    const antigos = [{ uid: MEMBER_UID, name: 'Membro Um', text: 'Boa partida!', ts: Timestamp.now() }];
    const comentario = (text, name = 'Membro Dois') => ({ comments: [...antigos, { uid: MEMBER2_UID, name, text, ts: Timestamp.now() }] });
    await seed();
    await check('A3: comentário normal passa', updateDoc(postRef(MEMBER2_UID), comentario('Boa!')), 'succeed');
    await seed();
    await check('A3: comentário gigante (>1000) é recusado', updateDoc(postRef(MEMBER2_UID), comentario('x'.repeat(1001))), 'fail');
    await seed();
    await check('A3: nome gigante no comentário é recusado', updateDoc(postRef(MEMBER2_UID), comentario('oi', 'n'.repeat(81))), 'fail');
  }

  // ── A1 (passo 2): custom claim `superAdmin` ────────────────────────────
  // A claim é gravada pelo servidor (scripts/set-super-admin.mjs); o cliente não consegue forjá-la.
  {
    const cfgRef = (db) => doc(db, 'config', 'appVersion');
    const grupoRef = (db) => doc(db, 'groups', GID);
    const compRef = (db) => doc(db, 'groups', GID, 'competitions', 'comp1');
    const comClaim = (uid, extra) => ctxClaim(uid, extra).firestore();

    await seed();
    await check('A1/claim: conta com superAdmin=true grava em /config (mesmo sem e-mail no token)',
      setDoc(cfgRef(comClaim('uid-claim')), { minBuildTime: 10 }), 'succeed');
    await check('A1/claim: superAdmin=false não grava em /config',
      setDoc(cfgRef(comClaim('uid-claim', { superAdmin: false })), { minBuildTime: 11 }), 'fail');
    await check('A1/claim: superAdmin como TEXTO "true" não vale (tem de ser booleano)',
      setDoc(cfgRef(comClaim('uid-claim', { superAdmin: 'true' })), { minBuildTime: 12 }), 'fail');
    await check('A1/claim: e-mail de outra pessoa COM claim vale (a prova é a claim, não o e-mail)',
      setDoc(cfgRef(comClaim('uid-claim', { email: 'outra.pessoa@gmail.com', email_verified: true })), { minBuildTime: 13 }), 'succeed');
    await seed();
    await check('A1/claim: conta com claim edita um grupo em que não é admin',
      updateDoc(grupoRef(comClaim('uid-claim')), { name: 'Pela claim' }), 'succeed');
    await seed();
    await check('A1/claim: conta com claim exclui a competição',
      deleteDoc(compRef(comClaim('uid-claim'))), 'succeed');
    await seed();
    await check('A1/claim: membro SEM a claim não exclui a competição',
      deleteDoc(compRef(ctxFor(MEMBER_UID).firestore())), 'fail');
  }

  await testEnv.cleanup();

  const failed = results.filter(r => !r.ok);
  for (const r of results) {
    const mark = r.ok ? 'OK  ' : 'FALHOU';
    console.log(`${mark} — ${r.label}${r.err ? `  (${r.err})` : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passaram.`);
  if (failed.length > 0) process.exit(1);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
