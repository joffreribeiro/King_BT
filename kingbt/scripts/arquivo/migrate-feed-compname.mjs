import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(JSON.parse(readFileSync(resolve(__dirname, 'serviceAccountKey.json'), 'utf8'))) });
const db = getFirestore();

const snap = await db.collection('groups').doc('KINGBT').collection('feed').get();
const toFix = snap.docs.filter(d => {
  const name = d.data().compName ?? '';
  return name.startsWith('Avulso ·');
});

console.log(`Encontrados ${toFix.length} itens com compName começando com "Avulso ·":\n`);
toFix.forEach(d => console.log(`  - "${d.data().compName}"`));

if (toFix.length === 0) {
  console.log('\nNada a migrar.');
  process.exit(0);
}

console.log('\nCorrigindo compName: "Avulso ·" → "Super 8 ·"...\n');
for (const d of toFix) {
  const oldName = d.data().compName;
  const newName = oldName.replace('Avulso ·', 'Super 8 ·');
  await d.ref.update({ compName: newName });
  console.log(`  ✓ "${oldName}" → "${newName}"`);
}

console.log('\nMigração de nomes concluída!');
process.exit(0);
