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

export const SESSIONS: MockSession[] = [
  { id: 's1', date: '2026-04-05', label: 'Rodada 1', playerIds: ['p1','p2','p3','p4','p5','p6','p7'], done: true },
  { id: 's2', date: '2026-04-19', label: 'Rodada 2', playerIds: ['p1','p2','p3','p4','p5','p6','p7'], done: true },
  { id: 's3', date: '2026-05-10', label: 'Rodada 3', playerIds: ['p1','p2','p3','p4','p5','p6','p7'], done: true },
  { id: 's4', date: '2026-05-31', label: 'Rodada 4', playerIds: ['p1','p2','p3','p4','p5','p6'],      done: true },
];

// Stats oficiais (documento 02/06/2026) — GA = GP÷GC
export const SEASON_STATS: SeasonStat[] = [
  { id:'p1', name:'Joffre',    wins:11, losses:4,  played:15, gamesPro:76, gamesCon:56, sg:20,  ga:1.357, winRate:73, points:43.21 },
  { id:'p2', name:'Marcelão',  wins:7,  losses:9,  played:16, gamesPro:67, gamesCon:77, sg:-10, ga:0.870, winRate:44, points:30.74 },
  { id:'p3', name:'Daniel',    wins:5,  losses:11, played:16, gamesPro:57, gamesCon:78, sg:-21, ga:0.731, winRate:31, points:24.46 },
  { id:'p4', name:'Luis Nei',  wins:5,  losses:2,  played:7,  gamesPro:41, gamesCon:28, sg:13,  ga:1.464, winRate:71, points:21.43 },
  { id:'p5', name:'Guilherme', wins:3,  losses:3,  played:6,  gamesPro:22, gamesCon:17, sg:5,   ga:1.294, winRate:50, points:14.59 },
  { id:'p6', name:'Eider',     wins:2,  losses:1,  played:3,  gamesPro:15, gamesCon:13, sg:2,   ga:1.154, winRate:67, points:9.81  },
  { id:'p7', name:'Roberto',   wins:1,  losses:4,  played:5,  gamesPro:12, gamesCon:21, sg:-9,  ga:0.571, winRate:20, points:6.64  },
];

export const SESSION4_GAMES: (Match & { sessionId: string })[] = [
  { id:'s4g0', stage:'rotating', sessionId:'s4', teamA:['p1','p4'], teamB:['p2','p3'], scoreA:6, scoreB:4 },
  { id:'s4g1', stage:'rotating', sessionId:'s4', teamA:['p2','p5'], teamB:['p1','p6'], scoreA:5, scoreB:6 },
  { id:'s4g2', stage:'rotating', sessionId:'s4', teamA:['p3','p6'], teamB:['p4','p5'], scoreA:3, scoreB:6 },
];

export const GROUP = {
  id: 'g1',
  name: 'King BT',
  code: 'KINGBT',
  location: 'Iate Clube Cota Mil — Arena Eider',
  season: '2026',
  roundsDone: 4,
};
