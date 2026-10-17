import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(JSON.parse(readFileSync(resolve(__dirname, 'serviceAccountKey.json'), 'utf8'))) });
const db = getFirestore();
const GROUP_ID = 'KINGBT';

// ─── 1. Definir jogadores a criar (guests) ────────────────────────────────────
const GUESTS = [
  { name: 'Marcelão', color: '#F97316' },
  { name: 'Daniel',   color: '#6366F1' },
  { name: 'Luis Nei', color: '#14B8A6' },
  { name: 'Eider',    color: '#EF4444' },
  { name: 'Guilherme',color: '#8B5CF6' },
  { name: 'Roberto',  color: '#06B6D4' },
  { name: 'Marcelo',  color: '#F59E0B' },
];

// ID real do Joffre já existente
const JOFFRE_ID = 'DVaKzoCRWydanfaLvksiv8kUwPJ2';

async function main() {
  const playersCol = db.collection('groups').doc(GROUP_ID).collection('players');
  const compsCol   = db.collection('groups').doc(GROUP_ID).collection('competitions');

  // ── Passo 1: criar jogadores guests que não existem ─────────────────────────
  console.log('Criando jogadores...');
  const existingSnap = await playersCol.get();
  const existingNames = existingSnap.docs.map(d => d.data().name);

  const ids = { Joffre: JOFFRE_ID };

  for (const g of GUESTS) {
    if (existingNames.includes(g.name)) {
      const existing = existingSnap.docs.find(d => d.data().name === g.name);
      ids[g.name] = existing.id;
      console.log(` • ${g.name} já existe: ${existing.id}`);
    } else {
      const ref = await playersCol.add({ name: g.name, color: g.color, guest: true, uid: null });
      ids[g.name] = ref.id;
      console.log(` ✓ ${g.name} criado: ${ref.id}`);
    }
  }

  // Atalhos
  const JO = ids['Joffre'];
  const MA = ids['Marcelão'];
  const DA = ids['Daniel'];
  const LN = ids['Luis Nei'];
  const EI = ids['Eider'];
  const GU = ids['Guilherme'];
  const RO = ids['Roberto'];
  const MC = ids['Marcelo'];

  console.log('\nIDs resolvidos:');
  Object.entries(ids).forEach(([n, id]) => console.log(`  ${n}: ${id}`));

  // ── Passo 2: apagar competições existentes ───────────────────────────────────
  console.log('\nApagando competições existentes...');
  const compsSnap = await compsCol.get();
  const batch1 = db.batch();
  compsSnap.docs.forEach(d => batch1.delete(d.ref));
  await batch1.commit();
  console.log(`✓ ${compsSnap.docs.length} competições apagadas.`);

  // ── Passo 3: montar e inserir competições reais ──────────────────────────────
  let n = 0;
  const mid = () => 'M' + (++n);

  function match(teamA, teamB, scoreA, scoreB) {
    return { id: mid(), stage: 'rotating', teamA, teamB, scoreA, scoreB };
  }

  const COMPETITIONS = [
    {
      name: 'Iate Cota Mil — 05/05',
      format: 'avulso', unit: 'duplas', status: 'done',
      date: '2026-05-05', location: 'Iate Clube Cota Mil',
      config: { rounds: 'single', groups: 2, qualifiers: 1, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
      competitors: [],
      matches: [
        match([MA, LN], [DA, JO], 4, 6),
        match([MA, DA], [JO, LN], 2, 6),
        match([MA, JO], [LN, DA], 4, 6),
        match([MA, DA], [JO, LN], 1, 6),
      ],
    },
    {
      name: 'Arena Eider — 07/05',
      format: 'avulso', unit: 'duplas', status: 'done',
      date: '2026-05-07', location: 'Arena Eider',
      config: { rounds: 'single', groups: 2, qualifiers: 1, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
      competitors: [],
      matches: [
        match([MA, EI], [DA, JO], 6, 1),
        match([DA, MA], [EI, JO], 6, 7),
        match([JO, MA], [EI, DA], 6, 2),
      ],
    },
    {
      name: 'Iate Cota Mil — 12/05',
      format: 'avulso', unit: 'duplas', status: 'done',
      date: '2026-05-12', location: 'Iate Clube Cota Mil',
      config: { rounds: 'single', groups: 2, qualifiers: 1, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
      competitors: [],
      matches: [
        match([MA, DA], [JO, LN], 4, 6),
        match([MA, JO], [LN, DA], 7, 6),
        match([MA, LN], [DA, JO], 7, 6),
      ],
    },
    {
      name: 'BT na Quadra — 02/06',
      format: 'avulso', unit: 'duplas', status: 'done',
      date: '2026-06-02', location: 'BT na Quadra',
      config: { rounds: 'single', groups: 2, qualifiers: 1, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
      competitors: [],
      matches: [
        match([JO, GU], [RO, MC], 6, 2),
        match([RO, GU], [JO, DA], 3, 4),
        match([RO, DA], [MC, GU], 0, 4),
        match([DA, MC], [JO, RO], 3, 4),
        match([DA, GU], [JO, MC], 4, 3),
        match([DA, MC], [GU, RO], 4, 3),
        match([DA, GU], [JO, MC], 2, 4),
      ],
    },
  ];

  console.log(`\nInserindo ${COMPETITIONS.length} competições...`);
  for (const comp of COMPETITIONS) {
    const ref = await compsCol.add(comp);
    console.log(` ✓ [${ref.id}] ${comp.name} — ${comp.matches.length} jogos`);
  }

  console.log('\n✅ Tudo pronto!');
  console.log(`   ${GUESTS.length} jogadores criados/verificados`);
  console.log(`   ${COMPETITIONS.length} competições com IDs reais dos players`);
  process.exit(0);
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
