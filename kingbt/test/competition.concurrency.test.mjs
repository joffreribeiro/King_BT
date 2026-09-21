// Prova, contra o emulador, que salvar placar deixou de ser last-write-wins.
//
// O cenário é o da quadra: duas pessoas abrem a mesma competição, cada uma
// marca o jogo que está arbitrando, e as duas salvam quase ao mesmo tempo.
// Como toda escrita de competição reescreve o documento inteiro (o array
// `matches` vai junto), partir do estado local significa gravar por cima do
// que a outra acabou de salvar — sem erro nenhum na tela.
//
// Rodar: ver AGENTS.md → "O emulador SOBE nesta máquina".

import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';

const PROJECT_ID = 'kingbt-concurrency-test';
const GID = 'grupo1';
const CID = 'comp1';

let testEnv;
const results = [];
function check(label, ok, detalhe) {
  results.push({ label, ok, detalhe });
}

const competicaoInicial = () => ({
  name: 'Rodada de teste',
  format: 'avulso',
  unit: 'duplas',
  gender: 'misto',
  status: 'active',
  date: '2026-09-20',
  config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: {} },
  competitors: [],
  matches: [
    { id: 'jogo1', stage: 'rotating', teamA: ['p1'], teamB: ['p2'], scoreA: null, scoreB: null },
    { id: 'jogo2', stage: 'rotating', teamA: ['p3'], teamB: ['p4'], scoreA: null, scoreB: null },
  ],
});

async function semear(db) {
  await setDoc(doc(db, 'groups', GID, 'competitions', CID), competicaoInicial());
}

const ref = (db) => doc(db, 'groups', GID, 'competitions', CID);

/** Marca um placar partindo de uma cópia lida ANTES (o estado da tela). */
async function salvarDoEstadoLocal(db, snapshotAntigo, matchId, a, b) {
  const proximo = {
    ...snapshotAntigo,
    matches: snapshotAntigo.matches.map(m => (m.id === matchId ? { ...m, scoreA: a, scoreB: b } : m)),
  };
  await setDoc(ref(db), proximo);
}

/** Marca um placar relendo o documento dentro da transação (a correção). */
async function salvarComTransacao(db, matchId, a, b) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref(db));
    if (!snap.exists()) return;
    const atual = snap.data();
    tx.update(ref(db), {
      ...atual,
      matches: atual.matches.map(m => (m.id === matchId ? { ...m, scoreA: a, scoreB: b } : m)),
    });
  });
}

async function placares(db) {
  const snap = await getDoc(ref(db));
  const m = snap.data().matches;
  return {
    jogo1: m.find(x => x.id === 'jogo1').scoreA,
    jogo2: m.find(x => x.id === 'jogo2').scoreA,
  };
}

async function run() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: '127.0.0.1', port: 8090, rules: 'rules_version = "2"; service cloud.firestore { match /databases/{d}/documents { match /{p=**} { allow read, write: if true; } } }' },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // ── 1. O bug: os dois partem do mesmo estado local ────────────────────
    await semear(db);
    const estadoDaTela = (await getDoc(ref(db))).data(); // os dois aparelhos leram isto
    await salvarDoEstadoLocal(db, estadoDaTela, 'jogo1', 2, 0);
    await salvarDoEstadoLocal(db, estadoDaTela, 'jogo2', 2, 1);
    const depoisDoLocal = await placares(db);
    check(
      'Escrita a partir do estado local PERDE o placar de quem salvou primeiro',
      depoisDoLocal.jogo1 === null && depoisDoLocal.jogo2 === 2,
      `jogo1=${depoisDoLocal.jogo1} jogo2=${depoisDoLocal.jogo2}`,
    );

    // ── 2. A correção: cada escrita relê o servidor ───────────────────────
    await semear(db);
    await salvarComTransacao(db, 'jogo1', 2, 0);
    await salvarComTransacao(db, 'jogo2', 2, 1);
    const depoisDaTransacao = await placares(db);
    check(
      'Com transação, os DOIS placares sobrevivem',
      depoisDaTransacao.jogo1 === 2 && depoisDaTransacao.jogo2 === 2,
      `jogo1=${depoisDaTransacao.jogo1} jogo2=${depoisDaTransacao.jogo2}`,
    );

    // ── 3. Transações disparadas em paralelo ─────────────────────────────
    await semear(db);
    await Promise.all([
      salvarComTransacao(db, 'jogo1', 2, 0),
      salvarComTransacao(db, 'jogo2', 2, 1),
    ]);
    const emParalelo = await placares(db);
    check(
      'Transações simultâneas: nenhuma sobrescreve a outra',
      emParalelo.jogo1 === 2 && emParalelo.jogo2 === 2,
      `jogo1=${emParalelo.jogo1} jogo2=${emParalelo.jogo2}`,
    );

    // ── 4. Adicionar jogo avulso em paralelo (era a action UPDATE) ───────
    await semear(db);
    const addMatch = (id) => runTransaction(db, async (tx) => {
      const snap = await tx.get(ref(db));
      const atual = snap.data();
      tx.update(ref(db), {
        ...atual,
        matches: [...atual.matches, { id, stage: 'rotating', teamA: ['p5'], teamB: ['p6'], scoreA: null, scoreB: null }],
      });
    });
    await Promise.all([addMatch('novo1'), addMatch('novo2')]);
    const comNovos = (await getDoc(ref(db))).data().matches.map(m => m.id);
    check(
      'Dois jogos avulsos adicionados ao mesmo tempo: os dois entram',
      comNovos.includes('novo1') && comNovos.includes('novo2'),
      comNovos.join(','),
    );
  });

  await testEnv.cleanup();

  for (const r of results) {
    console.log(`${r.ok ? 'OK  ' : 'FALHOU'} — ${r.label}${r.detalhe ? `  (${r.detalhe})` : ''}`);
  }
  const falhas = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - falhas}/${results.length} passaram.`);
  if (falhas > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
