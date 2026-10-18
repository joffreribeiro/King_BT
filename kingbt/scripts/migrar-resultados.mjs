// M7: cria o mapa `results` (placar oficial por jogo) nas competições gravadas antes dele.
// O app passou a ler o placar só desse mapa; competição sem ele continua valendo pelo array
// `matches`, e a primeira gravação pelo app cria o mapa. Este script faz isso de uma vez para
// todas, para que a proteção da regra (só admin corrige/apaga placar) valha em todas já.
// Competição que já tem o mapa não é tocada. Nenhum outro campo é alterado.
//
// SIMULA por padrão: só conta o que seria gravado. Para gravar de verdade: --apply
//   node scripts/migrar-resultados.mjs            -> simulação
//   node scripts/migrar-resultados.mjs --apply    -> grava
//
// Exige o login do gcloud (scripts/README.md). Faça um backup antes: node scripts/backup-firestore.mjs
import { initAdmin, PROJECT_ID } from './_admin.mjs';

const apply = process.argv.includes('--apply');

// Mesmo formato de src/logic/matchResults.ts (resultOf): sempre as três chaves.
function buildResults(matches) {
  const out = {};
  for (const m of matches ?? []) {
    if (m?.id == null || m.scoreA == null || m.scoreB == null) continue;
    out[m.id] = { scoreA: m.scoreA, scoreB: m.scoreB, sets: m.sets ?? null };
  }
  return out;
}

const db = await initAdmin();
const grupos = await db.collection('groups').get();
let total = 0, jaTinham = 0, aMigrar = 0, jogosComPlacar = 0, gravadas = 0;

for (const g of grupos.docs) {
  const comps = await g.ref.collection('competitions').get();
  for (const d of comps.docs) {
    total++;
    const data = d.data();
    if ('results' in data) { jaTinham++; continue; }
    const results = buildResults(data.matches);
    aMigrar++;
    jogosComPlacar += Object.keys(results).length;
    console.log(`  ${g.id}/${d.id}  "${data.name ?? ''}"  jogos: ${(data.matches ?? []).length}, com placar: ${Object.keys(results).length}`);
    if (apply) {
      // Só grava se o documento não mudou desde a leitura (alguém salvando placar agora).
      await d.ref.update({ results }, { lastUpdateTime: d.updateTime });
      gravadas++;
    }
  }
}

console.log(`\nProjeto: ${PROJECT_ID}`);
console.log(`Competições: ${total} | já com o mapa: ${jaTinham} | a migrar: ${aMigrar} (${jogosComPlacar} jogos com placar)`);
if (aMigrar === 0) { console.log('Nada a migrar.'); process.exit(0); }
if (!apply) { console.log('SIMULAÇÃO. Rode de novo com --apply para gravar (faça o backup antes).'); process.exit(0); }
console.log(`Pronto: mapa criado em ${gravadas} competição(ões).`);
process.exit(0);
