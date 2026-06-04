import type { Competition } from '../logic/types';
import { PLAYERS } from './data';

// Converte jogadores em Competitors individuais
const toCompetitor = (id: string) => {
  const p = PLAYERS.find(pl => pl.id === id)!;
  return { id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, members: [id] };
};

export const MOCK_COMPETITIONS: Competition[] = [
  {
    id: 'c1',
    name: 'Rodada 4 — Americano',
    format: 'avulso',
    unit: 'individual',
    status: 'done',
    date: '2026-05-31',
    config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
    competitors: ['p1','p2','p3','p4','p5','p6'].map(toCompetitor),
    matches: [
      { id:'m1', stage:'rotating', teamA:['p1','p4'], teamB:['p2','p3'], scoreA:6, scoreB:4 },
      { id:'m2', stage:'rotating', teamA:['p2','p5'], teamB:['p1','p6'], scoreA:5, scoreB:6 },
      { id:'m3', stage:'rotating', teamA:['p3','p6'], teamB:['p4','p5'], scoreA:3, scoreB:6 },
    ],
  },
  {
    id: 'c2',
    name: 'Liga de Maio',
    format: 'liga',
    unit: 'individual',
    status: 'active',
    date: '2026-05-01',
    config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: { mode: 'games', target: 6 } },
    competitors: ['p1','p2','p3','p4'].map(toCompetitor),
    matches: [
      { id:'l1', stage:'league', round:1, aId:'p1', bId:'p2', scoreA:6, scoreB:4, aSrc:null, bSrc:null },
      { id:'l2', stage:'league', round:1, aId:'p3', bId:'p4', scoreA:null, scoreB:null, aSrc:null, bSrc:null },
      { id:'l3', stage:'league', round:2, aId:'p1', bId:'p3', scoreA:null, scoreB:null, aSrc:null, bSrc:null },
      { id:'l4', stage:'league', round:2, aId:'p2', bId:'p4', scoreA:null, scoreB:null, aSrc:null, bSrc:null },
      { id:'l5', stage:'league', round:3, aId:'p1', bId:'p4', scoreA:null, scoreB:null, aSrc:null, bSrc:null },
      { id:'l6', stage:'league', round:3, aId:'p2', bId:'p3', scoreA:null, scoreB:null, aSrc:null, bSrc:null },
    ],
  },
  {
    id: 'c3',
    name: 'Copa Mata-Mata',
    format: 'mata',
    unit: 'individual',
    status: 'active',
    date: '2026-06-01',
    config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: true, winRule: { mode: 'games', target: 6 } },
    competitors: ['p1','p2','p3','p4','p5','p6','p7'].map(toCompetitor),
    matches: [
      { id:'K0_0', stage:'ko', koRound:0, koTotal:3, cnt:4, slot:0, aId:'p1', bId:'p8', aSrc:null, bSrc:null, scoreA:null, scoreB:null },
      { id:'K0_1', stage:'ko', koRound:0, koTotal:3, cnt:4, slot:1, aId:'p4', bId:'p5', aSrc:null, bSrc:null, scoreA:null, scoreB:null },
      { id:'K0_2', stage:'ko', koRound:0, koTotal:3, cnt:4, slot:2, aId:'p3', bId:'p6', aSrc:null, bSrc:null, scoreA:null, scoreB:null },
      { id:'K0_3', stage:'ko', koRound:0, koTotal:3, cnt:4, slot:3, aId:'p2', bId:'p7', aSrc:null, bSrc:null, scoreA:null, scoreB:null },
      { id:'K1_0', stage:'ko', koRound:1, koTotal:3, cnt:2, slot:0, aId:null, bId:null, aSrc:{type:'winner',match:'K0_0'}, bSrc:{type:'winner',match:'K0_1'}, scoreA:null, scoreB:null },
      { id:'K1_1', stage:'ko', koRound:1, koTotal:3, cnt:2, slot:1, aId:null, bId:null, aSrc:{type:'winner',match:'K0_2'}, bSrc:{type:'winner',match:'K0_3'}, scoreA:null, scoreB:null },
      { id:'K2_0', stage:'ko', koRound:2, koTotal:3, cnt:1, slot:0, aId:null, bId:null, aSrc:{type:'winner',match:'K1_0'}, bSrc:{type:'winner',match:'K1_1'}, scoreA:null, scoreB:null },
      { id:'Kthird', stage:'ko', koRound:2, third:true, cnt:1, slot:1, aId:null, bId:null, aSrc:{type:'loser',match:'K1_0'}, bSrc:{type:'loser',match:'K1_1'}, scoreA:null, scoreB:null },
    ],
  },
];
