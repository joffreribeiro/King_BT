import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(JSON.parse(readFileSync(resolve(__dirname, 'serviceAccountKey.json'), 'utf8'))) });
const db = getFirestore();
const GROUP_ID = 'KINGBT';

// Jogadores do grupo (IDs ficam vazios pois são avulso por nome)
// Para avulso, teamA/teamB são arrays de player IDs do grupo.
// Como não temos os IDs dos players aqui, usamos strings dos nomes
// que o GroupPlayersContext vai resolver via findPlayer().
// Os competidores são mapeados pelo nome — igual ao que o feed usa.

let matchCounter = 0;
function mid() { return 'M' + (++matchCounter); }

function avulsoMatch(teamA, teamB, scoreA, scoreB) {
  return {
    id: mid(),
    stage: 'rotating',
    teamA,
    teamB,
    scoreA,
    scoreB,
    scoreA_null: false,
    scoreB_null: false,
  };
}

// Vamos usar os nomes como IDs temporários — o app já faz findPlayer por ID
// e cai no fallback do nome se não achar. Para avulso isso é suficiente.
// Nomes exatos conforme cadastro no grupo:
const JO = 'Joffre';
const MA = 'Marcelão';
const DA = 'Daniel';
const LN = 'Luis Nei';
const EI = 'Eider';
const GU = 'Guilherme';
const RO = 'Roberto';
const MC = 'Marcelo';

const COMPETITIONS = [
  {
    name: 'Iate Cota Mil — 05/05',
    format: 'avulso',
    unit: 'duplas',
    status: 'done',
    date: '2026-05-05',
    location: 'Iate Clube Cota Mil',
    config: { rounds: 'single', groups: 2, qualifiers: 1, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
    competitors: [],
    matches: [
      avulsoMatch([MA, LN], [DA, JO], 4, 6),
      avulsoMatch([MA, DA], [JO, LN], 2, 6),
      avulsoMatch([MA, JO], [LN, DA], 4, 6),
      avulsoMatch([MA, DA], [JO, LN], 1, 6),
    ],
  },
  {
    name: 'Arena Eider — 07/05',
    format: 'avulso',
    unit: 'duplas',
    status: 'done',
    date: '2026-05-07',
    location: 'Arena Eider',
    config: { rounds: 'single', groups: 2, qualifiers: 1, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
    competitors: [],
    matches: [
      avulsoMatch([MA, EI], [DA, JO], 6, 1),
      avulsoMatch([DA, MA], [EI, JO], 6, 7),
      avulsoMatch([JO, MA], [EI, DA], 6, 2),
    ],
  },
  {
    name: 'Iate Cota Mil — 12/05',
    format: 'avulso',
    unit: 'duplas',
    status: 'done',
    date: '2026-05-12',
    location: 'Iate Clube Cota Mil',
    config: { rounds: 'single', groups: 2, qualifiers: 1, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
    competitors: [],
    matches: [
      avulsoMatch([MA, DA], [JO, LN], 4, 6),
      avulsoMatch([MA, JO], [LN, DA], 7, 6),
      avulsoMatch([MA, LN], [DA, JO], 7, 6),
    ],
  },
  {
    name: 'BT na Quadra — 02/06',
    format: 'avulso',
    unit: 'duplas',
    status: 'done',
    date: '2026-06-02',
    location: 'BT na Quadra',
    config: { rounds: 'single', groups: 2, qualifiers: 1, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
    competitors: [],
    matches: [
      avulsoMatch([JO, GU], [RO, MC], 6, 2),
      avulsoMatch([RO, GU], [JO, DA], 3, 4),
      avulsoMatch([RO, DA], [MC, GU], 0, 4),
      avulsoMatch([DA, MC], [JO, RO], 3, 4),
      avulsoMatch([DA, GU], [JO, MC], 4, 3),
      avulsoMatch([DA, MC], [GU, RO], 4, 3),
      avulsoMatch([DA, GU], [JO, MC], 2, 4),
    ],
  },
];

async function main() {
  const col = db.collection('groups').doc(GROUP_ID).collection('competitions');

  // 1. Apagar todas as competições existentes
  console.log('Apagando competições existentes...');
  const snap = await col.get();
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`✓ ${snap.docs.length} competições apagadas.\n`);

  // 2. Inserir as novas
  console.log(`Inserindo ${COMPETITIONS.length} competições...`);
  for (const comp of COMPETITIONS) {
    const ref = await col.add(comp);
    console.log(` ✓ [${ref.id}] ${comp.name} — ${comp.matches.length} jogos`);
  }

  console.log(`\n✅ Pronto! ${COMPETITIONS.length} competições inseridas.`);
  process.exit(0);
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
