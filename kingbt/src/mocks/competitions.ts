import type { Competition } from '../logic/types';
import { PLAYERS } from './data';

const toCompetitor = (id: string) => {
  const p = PLAYERS.find(pl => pl.id === id)!;
  return { id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, members: [id] };
};

// p1=Joffre p2=Marcelão p3=Daniel p4=Luis Nei p5=Guilherme p6=Eider p7=Roberto

export const MOCK_COMPETITIONS: Competition[] = [
  // ── 1ª Rodada — 05/05/2026 — Iate Clube Cota Mil ──────────────────────────
  // Marcelao/LuisNei x Daniel/Joffre → 4x6
  // Marcelao/Daniel x Joffre/LuisNei → 2x6
  // Marcelao/Joffre x LuisNei/Daniel → 4x6
  // Marcelao/Daniel x Joffre/LuisNei → 1x6
  {
    id: 'c1',
    name: '1ª Rodada — 05/05',
    format: 'avulso',
    unit: 'individual',
    status: 'done',
    date: '2026-05-05',
    location: 'Iate Clube Cota Mil',
    config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
    competitors: ['p1','p2','p3','p4'].map(toCompetitor),
    matches: [
      { id:'c1m1', stage:'rotating', teamA:['p2','p4'], teamB:['p3','p1'], scoreA:4,  scoreB:6  },
      { id:'c1m2', stage:'rotating', teamA:['p2','p3'], teamB:['p1','p4'], scoreA:2,  scoreB:6  },
      { id:'c1m3', stage:'rotating', teamA:['p2','p1'], teamB:['p4','p3'], scoreA:4,  scoreB:6  },
      { id:'c1m4', stage:'rotating', teamA:['p2','p3'], teamB:['p1','p4'], scoreA:1,  scoreB:6  },
    ],
  },

  // ── 2ª Rodada — 07/05/2026 — Arena Eider ──────────────────────────────────
  // Marcelao/Eider x Daniel/Joffre → 6x1
  // Daniel/Marcelao x Eider/Joffre → 6x7  (tie-break: não conta game extra)
  // Joffre/Marcelao x Eider/Daniel → 6x2
  {
    id: 'c2',
    name: '2ª Rodada — 07/05',
    format: 'avulso',
    unit: 'individual',
    status: 'done',
    date: '2026-05-07',
    location: 'Arena Eider',
    config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
    competitors: ['p1','p2','p3','p6'].map(toCompetitor),
    matches: [
      { id:'c2m1', stage:'rotating', teamA:['p2','p6'], teamB:['p3','p1'], scoreA:6,  scoreB:1  },
      { id:'c2m2', stage:'rotating', teamA:['p3','p2'], teamB:['p6','p1'], scoreA:6,  scoreB:7  },
      { id:'c2m3', stage:'rotating', teamA:['p1','p2'], teamB:['p6','p3'], scoreA:6,  scoreB:2  },
    ],
  },

  // ── 3ª Rodada — 12/05/2026 — Iate Clube Cota Mil ──────────────────────────
  // Marcelão/Daniel x Joffre/LuisNei → 4x6
  // Marcelão/Joffre x LuisNei/Daniel → 7x6 (tb 7x5)
  // Marcelão/LuisNei x Daniel/Joffre → 7x6 (tb 7x4)
  {
    id: 'c3',
    name: '3ª Rodada — 12/05',
    format: 'avulso',
    unit: 'individual',
    status: 'done',
    date: '2026-05-12',
    location: 'Iate Clube Cota Mil',
    config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
    competitors: ['p1','p2','p3','p4'].map(toCompetitor),
    matches: [
      { id:'c3m1', stage:'rotating', teamA:['p2','p3'], teamB:['p1','p4'], scoreA:4,  scoreB:6  },
      { id:'c3m2', stage:'rotating', teamA:['p2','p1'], teamB:['p4','p3'], scoreA:7,  scoreB:6  },
      { id:'c3m3', stage:'rotating', teamA:['p2','p4'], teamB:['p3','p1'], scoreA:7,  scoreB:6  },
    ],
  },

  // ── 4ª Rodada — 31/05/2026 — BT na Quadra ─────────────────────────────────
  // Joffre/Guilherme x Roberto/Marcelo   → 6x2
  // Roberto/Guilherme x Joffre/Daniel    → 3x4
  // Roberto/Daniel x Marcelo/Guilherme   → 0x4
  // Daniel/Marcelo x Joffre/Roberto      → 3x4
  // Daniel/Guilherme x Joffre/Marcelo    → 4x3
  // Daniel/Marcelo x Guilherme/Roberto   → 4x3
  // Daniel/Guilherme x Joffre/Marcelo    → 2x4
  {
    id: 'c4',
    name: '4ª Rodada — 31/05',
    format: 'avulso',
    unit: 'individual',
    status: 'done',
    date: '2026-05-31',
    location: 'BT na Quadra',
    config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
    competitors: ['p1','p2','p3','p5','p7'].map(toCompetitor),
    matches: [
      { id:'c4m1', stage:'rotating', teamA:['p1','p5'], teamB:['p7','p2'], scoreA:6,  scoreB:2  },
      { id:'c4m2', stage:'rotating', teamA:['p7','p5'], teamB:['p1','p3'], scoreA:3,  scoreB:4  },
      { id:'c4m3', stage:'rotating', teamA:['p7','p3'], teamB:['p2','p5'], scoreA:0,  scoreB:4  },
      { id:'c4m4', stage:'rotating', teamA:['p3','p2'], teamB:['p1','p7'], scoreA:3,  scoreB:4  },
      { id:'c4m5', stage:'rotating', teamA:['p3','p5'], teamB:['p1','p2'], scoreA:4,  scoreB:3  },
      { id:'c4m6', stage:'rotating', teamA:['p3','p2'], teamB:['p5','p7'], scoreA:4,  scoreB:3  },
      { id:'c4m7', stage:'rotating', teamA:['p3','p5'], teamB:['p1','p2'], scoreA:2,  scoreB:4  },
    ],
  },
];
