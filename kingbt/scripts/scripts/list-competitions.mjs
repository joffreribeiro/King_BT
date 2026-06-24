import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(JSON.parse(readFileSync(resolve(__dirname, 'serviceAccountKey.json'), 'utf8'))) });
const db = getFirestore();

const snap = await db.collection('groups').doc('KINGBT').collection('competitions').get();
console.log(`${snap.docs.length} competições encontradas:\n`);
snap.docs.forEach(d => {
  const data = d.data();
  console.log(`ID: ${d.id}`);
  console.log(`  name: ${data.name}`);
  console.log(`  format: ${data.format}`);
  console.log(`  status: ${data.status}`);
  console.log(`  date: ${data.date}`);
  console.log(`  matches: ${data.matches?.length ?? 0}`);
  console.log();
});
process.exit(0);
