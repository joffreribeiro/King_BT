// Apaga de /users os dados de aparelho que o cadastro coletava (marca, modelo, SO, fuso, idioma, região).
// O app deixou de gravá-los; este script limpa os que já estavam gravados. Os demais campos não são tocados.
//
// SIMULA por padrão: só conta o que seria apagado. Para apagar de verdade: --apply
//   node scripts/limpar-dados-aparelho.mjs            -> simulação
//   node scripts/limpar-dados-aparelho.mjs --apply    -> apaga os campos
//
// Exige o login do gcloud (scripts/README.md). Faça um backup antes: node scripts/backup-firestore.mjs
import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin, PROJECT_ID } from './_admin.mjs';

const CAMPOS = ['platformVersion', 'deviceBrand', 'deviceModel', 'deviceType', 'osName', 'osVersion', 'locale', 'region', 'timezone'];
const apply = process.argv.includes('--apply');

const db = await initAdmin();
const snap = await db.collection('users').get();
const porCampo = Object.fromEntries(CAMPOS.map(c => [c, 0]));
let docsAfetados = 0;
const lote = db.batch();

for (const d of snap.docs) {
  const data = d.data();
  const presentes = CAMPOS.filter(c => c in data);
  if (presentes.length === 0) continue;
  docsAfetados++;
  presentes.forEach(c => porCampo[c]++);
  if (apply) lote.update(d.ref, Object.fromEntries(presentes.map(c => [c, FieldValue.delete()])));
}

console.log(`Projeto: ${PROJECT_ID}`);
console.log(`Documentos em /users: ${snap.size} | com dados de aparelho: ${docsAfetados}`);
console.log('Por campo:', JSON.stringify(porCampo));
if (docsAfetados === 0) { console.log('Nada a limpar.'); process.exit(0); }
if (!apply) { console.log('SIMULAÇÃO. Rode de novo com --apply para apagar (faça o backup antes).'); process.exit(0); }
await lote.commit();
console.log(`Pronto: campos removidos de ${docsAfetados} documento(s).`);
process.exit(0);
