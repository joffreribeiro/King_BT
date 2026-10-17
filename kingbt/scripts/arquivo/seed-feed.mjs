import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Procura a service account key em locais comuns
const keyPaths = [
  resolve(__dirname, 'serviceAccountKey.json'),
  resolve(__dirname, '../serviceAccountKey.json'),
];
const keyPath = keyPaths.find(p => existsSync(p));

if (!keyPath) {
  console.error('\n❌ Arquivo serviceAccountKey.json não encontrado.');
  console.error('Baixe em: Firebase Console → Configurações do projeto → Contas de serviço → Gerar nova chave privada');
  console.error('Salve como: kingbt/scripts/serviceAccountKey.json\n');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();
const GROUP_ID = 'KINGBT';

function ts(dateStr) {
  return Timestamp.fromDate(new Date(dateStr));
}

function match(nameA, nameB, scoreA, scoreB, compName, date) {
  return {
    type: 'match_result',
    compId: 'avulso',
    compName,
    format: 'avulso',
    sideA: { ids: [], name: nameA, score: scoreA },
    sideB: { ids: [], name: nameB, score: scoreB },
    timestamp: ts(date),
    reactions: { '👑': [], '🔥': [], '💪': [] },
    comments: [],
  };
}

const FEED_ITEMS = [
  // ── 05/05/2026 — Iate Clube Cota Mil ──────────────────────────────────────
  match('Marcelão / Luis Nei', 'Daniel / Joffre',   4, 6, 'Avulso · Iate Cota Mil 05/05', '2026-05-05T10:00:00'),
  match('Marcelão / Daniel',   'Joffre / Luis Nei', 2, 6, 'Avulso · Iate Cota Mil 05/05', '2026-05-05T10:30:00'),
  match('Marcelão / Joffre',   'Luis Nei / Daniel', 4, 6, 'Avulso · Iate Cota Mil 05/05', '2026-05-05T11:00:00'),
  match('Marcelão / Daniel',   'Joffre / Luis Nei', 1, 6, 'Avulso · Iate Cota Mil 05/05', '2026-05-05T11:30:00'),

  // ── 07/05/2026 — Arena Eider ───────────────────────────────────────────────
  match('Marcelão / Eider',  'Daniel / Joffre', 6, 1, 'Avulso · Arena Eider 07/05', '2026-05-07T10:00:00'),
  match('Daniel / Marcelão', 'Eider / Joffre',  6, 7, 'Avulso · Arena Eider 07/05', '2026-05-07T10:30:00'),
  match('Joffre / Marcelão', 'Eider / Daniel',  6, 2, 'Avulso · Arena Eider 07/05', '2026-05-07T11:00:00'),

  // ── 12/05/2026 — Iate Clube Cota Mil ──────────────────────────────────────
  match('Marcelão / Daniel',   'Joffre / Luis Nei', 4, 6, 'Avulso · Iate Cota Mil 12/05', '2026-05-12T10:00:00'),
  match('Marcelão / Joffre',   'Luis Nei / Daniel', 7, 6, 'Avulso · Iate Cota Mil 12/05', '2026-05-12T10:30:00'),
  match('Marcelão / Luis Nei', 'Daniel / Joffre',   7, 6, 'Avulso · Iate Cota Mil 12/05', '2026-05-12T11:00:00'),

  // ── 02/06/2026 — BT na Quadra ─────────────────────────────────────────────
  match('Joffre / Guilherme',  'Roberto / Marcelo',   6, 2, 'Avulso · BT na Quadra 02/06', '2026-06-02T10:00:00'),
  match('Roberto / Guilherme', 'Joffre / Daniel',     3, 4, 'Avulso · BT na Quadra 02/06', '2026-06-02T10:30:00'),
  match('Roberto / Daniel',    'Marcelo / Guilherme', 0, 4, 'Avulso · BT na Quadra 02/06', '2026-06-02T11:00:00'),
  match('Daniel / Marcelo',    'Joffre / Roberto',    3, 4, 'Avulso · BT na Quadra 02/06', '2026-06-02T11:30:00'),
  match('Daniel / Guilherme',  'Joffre / Marcelo',    4, 3, 'Avulso · BT na Quadra 02/06', '2026-06-02T12:00:00'),
  match('Daniel / Marcelo',    'Guilherme / Roberto', 4, 3, 'Avulso · BT na Quadra 02/06', '2026-06-02T12:30:00'),
  match('Daniel / Guilherme',  'Joffre / Marcelo',    2, 4, 'Avulso · BT na Quadra 02/06', '2026-06-02T13:00:00'),
];

async function main() {
  const feedCol = db.collection('groups').doc(GROUP_ID).collection('feed');

  // 1. Apagar todos os documentos existentes
  console.log('Apagando feed existente...');
  const snap = await feedCol.get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`✓ ${snap.docs.length} documentos apagados.`);

  // 2. Inserir novos em ordem
  console.log(`\nInserindo ${FEED_ITEMS.length} eventos...`);
  for (const item of FEED_ITEMS) {
    await feedCol.add(item);
    console.log(` ✓ ${item.sideA.name} ${item.sideA.score}×${item.sideB.score} ${item.sideB.name}  [${item.compName}]`);
  }

  console.log(`\n✅ Pronto! ${FEED_ITEMS.length} eventos inseridos no grupo ${GROUP_ID}.`);
  process.exit(0);
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
