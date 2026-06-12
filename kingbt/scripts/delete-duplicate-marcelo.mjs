import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccount.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const OLD_ID = 'wxuEAlOGg80lGRI53PRL'; // Marcelo duplicado (já foi migrado para Marcelão)
const GROUP_ID = 'KINGBT';

async function main() {
  const playerRef = db.collection('groups').doc(GROUP_ID).collection('players').doc(OLD_ID);
  const snap = await playerRef.get();

  if (!snap.exists) {
    console.log('Player duplicado já não existe, nada a fazer.');
    process.exit(0);
  }

  console.log('Dados do player a deletar:', snap.data());
  await playerRef.delete();
  console.log(`Player ${OLD_ID} deletado com sucesso.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
