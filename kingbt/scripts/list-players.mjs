import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(JSON.parse(readFileSync(resolve(__dirname, 'serviceAccountKey.json'), 'utf8'))) });
const db = getFirestore();

const snap = await db.collection('groups').doc('KINGBT').collection('players').get();
console.log(`${snap.docs.length} jogadores:\n`);
snap.docs.forEach(d => {
  const data = d.data();
  console.log(`ID: ${d.id}  |  name: "${data.name}"  |  guest: ${data.guest}  |  uid: ${data.uid ?? 'null'}`);
});
process.exit(0);
