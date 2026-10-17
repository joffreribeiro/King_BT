import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(JSON.parse(readFileSync(resolve(__dirname, 'serviceAccountKey.json'), 'utf8'))) });
const db = getFirestore();

const snap = await db.collection('groups').doc('KINGBT').collection('feed').get();
const avulsos = snap.docs.filter(d => d.data().format === 'avulso');

console.log(`Encontrados ${avulsos.length} itens de feed com format=avulso:\n`);
avulsos.forEach(d => console.log(`  - ${d.data().compName} (${d.id})`));

if (avulsos.length === 0) {
  console.log('\nNada a migrar.');
  process.exit(0);
}

console.log('\nMigrando format: avulso → super8 no feed...\n');
for (const d of avulsos) {
  await d.ref.update({ format: 'super8' });
  console.log(`  ✓ ${d.data().compName}`);
}

console.log('\nMigração do feed concluída!');
process.exit(0);
