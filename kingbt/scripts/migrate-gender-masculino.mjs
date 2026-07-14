// Ajusta o gender de TODAS as competições do grupo KINGBT para 'masculino'.
// Uso:
//   node migrate-gender-masculino.mjs          -> dry-run (só lista o que mudaria)
//   node migrate-gender-masculino.mjs --apply  -> aplica as alterações
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(JSON.parse(readFileSync(resolve(__dirname, 'serviceAccountKey.json'), 'utf8'))) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
const GROUP = 'KINGBT';
const TARGET = 'masculino';

const snap = await db.collection('groups').doc(GROUP).collection('competitions').get();
console.log(`${snap.docs.length} competições no grupo ${GROUP}.\n`);

const toChange = snap.docs.filter(d => (d.data().gender ?? null) !== TARGET);
if (toChange.length === 0) {
  console.log(`Todas já estão como '${TARGET}'. Nada a fazer.`);
  process.exit(0);
}

console.log(`${toChange.length} competição(ões) com gender diferente de '${TARGET}':`);
toChange.forEach(d => console.log(`  [${(d.data().gender ?? '(sem)').padEnd(10)}] ${d.data().name}  (${d.id})`));

if (!APPLY) {
  console.log(`\nDRY-RUN. Rode com --apply para gravar as alterações.`);
  process.exit(0);
}

const batch = db.batch();
toChange.forEach(d => batch.update(d.ref, { gender: TARGET }));
await batch.commit();
console.log(`\n✅ ${toChange.length} competição(ões) atualizada(s) para gender='${TARGET}'.`);
process.exit(0);
