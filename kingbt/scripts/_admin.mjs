// Inicialização única do Admin SDK para os scripts de manutenção.
//
// SEM arquivo de chave: usa as Application Default Credentials (ADC), isto é, o login da SUA conta Google,
// feito uma vez com o gcloud (passo a passo em scripts/README.md):
//   gcloud auth login
//   gcloud config set project king-bt-7f559
//   gcloud auth application-default login
//   gcloud auth application-default set-quota-project king-bt-7f559
//
// Uso:  import { initAdmin, PROJECT_ID } from './_admin.mjs';   const db = await initAdmin();
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

export const PROJECT_ID = 'king-bt-7f559';

const aqui = dirname(fileURLToPath(import.meta.url));

function abortar(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

/** Inicia o Admin SDK com o login do gcloud e devolve o Firestore. Aborta com mensagem clara se algo estiver errado. */
export async function initAdmin() {
  // Chave de conta de serviço é justamente o que vazou no passado: não aceitamos nem como alternativa.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    abortar('A variável GOOGLE_APPLICATION_CREDENTIALS está definida (arquivo de chave). Este projeto não usa arquivo de chave: remova a variável e use o login do gcloud (scripts/README.md).');
  }
  const chaves = readdirSync(aqui).filter(f => /^serviceAccount.*\.json$/i.test(f));
  if (chaves.length > 0) {
    abortar(`Há arquivo de chave ao lado dos scripts (${chaves.join(', ')}). Apague-o e use o login do gcloud (scripts/README.md).`);
  }

  const credential = applicationDefault();
  try {
    await credential.getAccessToken();
  } catch (e) {
    abortar(`Sem login do Google para o Admin SDK. Rode: gcloud auth application-default login\n(${e?.message ?? e})`);
  }

  if (getApps().length === 0) initializeApp({ credential, projectId: PROJECT_ID });
  return getFirestore();
}
