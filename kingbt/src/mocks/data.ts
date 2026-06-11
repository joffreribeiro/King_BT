import type { Match } from '../logic/types';

export type MockPlayer = {
  id: string;
  name: string;
  color: string;
  title: string;
  titleEmoji: string;
  uid?: string;
  guest: boolean;
};

export type MockSession = {
  id: string;
  date: string;
  label: string;
  playerIds: string[];
  done: boolean;
};

export type SeasonStat = {
  id: string;
  name: string;
  wins: number;
  losses: number;
  played: number;
  gamesPro: number;
  gamesCon: number;
  sg: number;
  ga: number;
  winRate: number;
  points: number;
};

export const PLAYERS: MockPlayer[] = [
  { id: 'p1', name: 'Joffre',    color: '#FFD166', title: 'Rei das Areias',     titleEmoji: '👑', guest: false },
  { id: 'p2', name: 'Marcelão',  color: '#2DD4BF', title: 'Esforçado',          titleEmoji: '🐝', guest: false },
  { id: 'p3', name: 'Daniel',    color: '#A78BFA', title: 'Estrategista',       titleEmoji: '♟️', guest: false },
  { id: 'p4', name: 'Luis Nei',  color: '#34D399', title: 'Alto Rendimento',    titleEmoji: '📈', guest: false },
  { id: 'p5', name: 'Guilherme', color: '#F472B6', title: 'Em Ascensão',        titleEmoji: '🚀', guest: false },
  { id: 'p6', name: 'Eider',     color: '#94A3B8', title: 'Fundador Honorário', titleEmoji: '🎩', guest: false },
  { id: 'p7', name: 'Roberto',   color: '#FB923C', title: 'Base da Pirâmide',   titleEmoji: '🐌', guest: false },
];

// Rodada 1 — 05/05/2026 — Iate Clube Cota Mil
// Jogadores: Luis Nei(p4), Joffre(p1), Daniel(p3), Marcelao(p2)
// Resultado GA: Luis Nei 2,00 | Joffre 2,00 | Daniel 0,83 | Marcelao 0,37
export const SESSION1_GAMES: (Match & { sessionId: string })[] = [
  { id:'s1g0', stage:'rotating', sessionId:'s1', teamA:['p2','p4'], teamB:['p3','p1'], scoreA:4, scoreB:6 },
  { id:'s1g1', stage:'rotating', sessionId:'s1', teamA:['p2','p3'], teamB:['p1','p4'], scoreA:2, scoreB:6 },
  { id:'s1g2', stage:'rotating', sessionId:'s1', teamA:['p2','p1'], teamB:['p4','p3'], scoreA:4, scoreB:6 },
  { id:'s1g3', stage:'rotating', sessionId:'s1', teamA:['p2','p3'], teamB:['p1','p4'], scoreA:1, scoreB:6 },
];

// Rodada 2 — 07/05/2026 — Arena Eider
// Jogadores: Marcelao(p2), Eider(p6), Joffre(p1), Daniel(p3)
// Resultado GA: Marcelao 1,80 | Eider 1,15 | Joffre 1,00 | Daniel 0,47
// Obs: 6x7 = Daniel/Marcelao perderam 6-7(tb) — tie-break não conta como game extra
export const SESSION2_GAMES: (Match & { sessionId: string })[] = [
  { id:'s2g0', stage:'rotating', sessionId:'s2', teamA:['p2','p6'], teamB:['p3','p1'], scoreA:6, scoreB:1 },
  { id:'s2g1', stage:'rotating', sessionId:'s2', teamA:['p3','p2'], teamB:['p6','p1'], scoreA:6, scoreB:7 },
  { id:'s2g2', stage:'rotating', sessionId:'s2', teamA:['p1','p2'], teamB:['p6','p3'], scoreA:6, scoreB:2 },
];

// Rodada 3 — 12/05/2026 — Iate Clube Cota Mil
// Jogadores: Marcelão(p2), Joffre(p1), Luis Nei(p4), Daniel(p3)
// Resultado GA: Joffre 1,12 | Luis Nei 1,12 | Marcelão 1,00 | Daniel 0,80
// Obs: 7x6(tb) — placar final é 7-6, tie-break não conta como game extra
export const SESSION3_GAMES: (Match & { sessionId: string })[] = [
  { id:'s3g0', stage:'rotating', sessionId:'s3', teamA:['p2','p3'], teamB:['p1','p4'], scoreA:4, scoreB:6 },
  { id:'s3g1', stage:'rotating', sessionId:'s3', teamA:['p2','p1'], teamB:['p4','p3'], scoreA:7, scoreB:6 },
  { id:'s3g2', stage:'rotating', sessionId:'s3', teamA:['p2','p4'], teamB:['p3','p1'], scoreA:7, scoreB:6 },
];

// Rodada 4 — 31/05/2026 — BT na Quadra
// Jogadores: Joffre(p1), Guilherme(p5), Marcelo(p2), Daniel(p3), Roberto(p7)
// Resultado GA: Joffre 1,50 | Guilherme 1,29 | Marcelo 1,05 | Daniel 0,81 | Roberto 0,57
export const SESSION4_GAMES: (Match & { sessionId: string })[] = [
  { id:'s4g0', stage:'rotating', sessionId:'s4', teamA:['p1','p5'], teamB:['p7','p2'], scoreA:6, scoreB:2 },
  { id:'s4g1', stage:'rotating', sessionId:'s4', teamA:['p7','p5'], teamB:['p1','p3'], scoreA:3, scoreB:4 },
  { id:'s4g2', stage:'rotating', sessionId:'s4', teamA:['p7','p3'], teamB:['p2','p5'], scoreA:0, scoreB:4 },
  { id:'s4g3', stage:'rotating', sessionId:'s4', teamA:['p3','p2'], teamB:['p1','p7'], scoreA:3, scoreB:4 },
  { id:'s4g4', stage:'rotating', sessionId:'s4', teamA:['p3','p5'], teamB:['p1','p2'], scoreA:4, scoreB:3 },
  { id:'s4g5', stage:'rotating', sessionId:'s4', teamA:['p3','p2'], teamB:['p5','p7'], scoreA:4, scoreB:3 },
  { id:'s4g6', stage:'rotating', sessionId:'s4', teamA:['p3','p5'], teamB:['p1','p2'], scoreA:2, scoreB:4 },
];

export const SESSIONS: MockSession[] = [
  { id: 's1', date: '2026-05-05', label: '1ª Rodada', playerIds: ['p1','p2','p3','p4'], done: true },
  { id: 's2', date: '2026-05-07', label: '2ª Rodada', playerIds: ['p1','p2','p3','p6'], done: true },
  { id: 's3', date: '2026-05-12', label: '3ª Rodada', playerIds: ['p1','p2','p3','p4'], done: true },
  { id: 's4', date: '2026-05-31', label: '4ª Rodada', playerIds: ['p1','p2','p3','p5','p7'], done: true },
];

// Stats acumulados das 4 rodadas (calculados a partir dos resultados oficiais)
// GA = GP÷GC (divisão); SG = GP−GC (só desempate)
export const SEASON_STATS: SeasonStat[] = [
  // Rodada 1: GP 22, GC 11 → Rodada 2: GP 14, GC 14 → Rodada 3: GP 19, GC 17 → Rodada 4: GP 21, GC 14
  { id:'p1', name:'Joffre',    wins:11, losses:4,  played:15, gamesPro:76, gamesCon:56, sg:20,  ga:1.357, winRate:73, points:43.21 },
  // Rodada 1: GP 11, GC 30 → Rodada 2: GP 18, GC 10 → Rodada 3: GP 18, GC 18 → Rodada 4: GP 20, GC 19
  { id:'p2', name:'Marcelão',  wins:7,  losses:9,  played:16, gamesPro:67, gamesCon:77, sg:-10, ga:0.870, winRate:44, points:30.74 },
  // Rodada 1: GP 15, GC 18 → Rodada 2: GP 9, GC 19 → Rodada 3: GP 16, GC 20 → Rodada 4: GP 17, GC 21
  { id:'p3', name:'Daniel',    wins:5,  losses:11, played:16, gamesPro:57, gamesCon:78, sg:-21, ga:0.731, winRate:31, points:24.46 },
  // Rodada 1: GP 22, GC 11 → Rodada 3: GP 19, GC 17
  { id:'p4', name:'Luis Nei',  wins:5,  losses:2,  played:7,  gamesPro:41, gamesCon:28, sg:13,  ga:1.464, winRate:71, points:21.43 },
  // Rodada 4: GP 22, GC 17
  { id:'p5', name:'Guilherme', wins:3,  losses:3,  played:6,  gamesPro:22, gamesCon:17, sg:5,   ga:1.294, winRate:50, points:14.59 },
  // Rodada 2: GP 15, GC 13
  { id:'p6', name:'Eider',     wins:2,  losses:1,  played:3,  gamesPro:15, gamesCon:13, sg:2,   ga:1.154, winRate:67, points:9.81  },
  // Rodada 4: GP 12, GC 21
  { id:'p7', name:'Roberto',   wins:1,  losses:4,  played:5,  gamesPro:12, gamesCon:21, sg:-9,  ga:0.571, winRate:20, points:6.64  },
];

export const GROUP = {
  id: 'g1',
  name: 'King BT',
  code: 'KINGBT',
  location: 'Iate Clube Cota Mil — Arena Eider',
  season: '2026',
  roundsDone: 4,
};
