import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccount.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const NEW_CODE = 'SOCINHOS';

async function main() {
  const snap = await db.collection('groups').where('name', '==', 'Socinhos').get();
  if (snap.empty) {
    console.error('Grupo "Socinhos" não encontrado.');
    process.exit(1);
  }

  for (const d of snap.docs) {
    const data = d.data();
    console.log(`Grupo encontrado: ${d.id} — code atual: ${data.code}`);
    await d.ref.update({ code: NEW_CODE });
    console.log(`Código atualizado para: ${NEW_CODE}`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
