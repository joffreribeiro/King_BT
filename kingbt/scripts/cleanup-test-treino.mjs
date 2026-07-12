import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(JSON.parse(readFileSync(resolve(__dirname, 'serviceAccountKey.json'), 'utf8'))) });
const db = getFirestore();

const snap = await db.collection('groups').doc('KINGBT').collection('treinos').get();
console.log(`${snap.docs.length} treino(s) encontrados:`);
for (const d of snap.docs) {
  console.log(`- ${d.id}: ${JSON.stringify(d.data()).slice(0, 120)}`);
  await d.ref.delete();
  console.log(`  deletado.`);
}
process.exit(0);
