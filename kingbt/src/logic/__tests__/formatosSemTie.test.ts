// btTracker.ts importa AsyncStorage; usa o mock oficial do pacote (não há setup global de mocks no projeto).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { setFechado, tieAtGames, deriveWinRule, classifySet } from '../setOutcome';
import { placardInicial, avancaPonto, type BtWinRule, type BtPlacardState } from '../btTracker';
import { getBeachTennisScoreState } from '../btScoring';
import { WIN_RULE_PRESETS } from '@/constants/winRulePresets';

const regra = (tiebreakAt: 'none' | 'fixed'): BtWinRule => ({ sets: 1, games: 4, tiebreak: 7, tiebreakAt });
/** Um game inteiro para a dupla (4 pontos seguidos). */
const game = (st: BtPlacardState, d: 'A' | 'B') => { for (let i = 0; i < 4; i++) st = avancaPonto(st, d); return st; };
const jogar = (rule: BtWinRule, seq: ('A' | 'B')[]) => seq.reduce((st, d) => game(st, d), placardInicial(rule));

describe('MD1 · 4 games sem tie (tiebreakAt "none")', () => {
  it('nunca há tie-break e o set fecha em 4 games', () => {
    expect(tieAtGames(4, 'none')).toBe(Infinity);
    expect(setFechado(4, 3, 4, 'none')).toBe(true);
    expect(setFechado(4, 0, 4, 'none')).toBe(true);
    expect(setFechado(3, 3, 4, 'none')).toBe(false);
  });
  it('em 3-3 o próximo game decide (4-3) e não entra tie-break', () => {
    const em33 = jogar(regra('none'), ['A', 'B', 'A', 'B', 'A', 'B']);
    expect(em33.tiebreak).toBe(false);
    expect(em33.encerrada).toBe(false);
    const fim = game(em33, 'B');
    expect(fim.encerrada).toBe(true);
    expect(fim.winnerDupla).toBe('B');
    expect([fim.historicGamesA[0], fim.historicGamesB[0]]).toEqual([3, 4]);
  });
  it('validação de placar final', () => {
    const r = { games: 4, tiebreak: 7, tiebreakAt: 'none' as const };
    expect(getBeachTennisScoreState(4, 3, r)).toBe('done');
    expect(getBeachTennisScoreState(4, 4, r)).toBe('invalid');
    expect(getBeachTennisScoreState(5, 3, r)).toBe('invalid');
    expect(getBeachTennisScoreState(3, 3, r)).toBe('normal');
  });
});

describe('MD1 · 4 games fixos (tiebreakAt "fixed"): só 4 games, pode empatar', () => {
  it('fecha ao completar 4 games no total', () => {
    expect(setFechado(2, 2, 4, 'fixed')).toBe(true);
    expect(setFechado(3, 0, 4, 'fixed')).toBe(false);
    expect(setFechado(4, 0, 4, 'fixed')).toBe(true);
  });
  it('2 x 2 encerra a partida empatada, sem vencedor e sem set para ninguém', () => {
    const fim = jogar(regra('fixed'), ['A', 'B', 'A', 'B']);
    expect(fim.encerrada).toBe(true);
    expect(fim.winnerDupla).toBeNull();
    expect([fim.setsA, fim.setsB]).toEqual([0, 0]);
    expect([fim.historicGamesA[0], fim.historicGamesB[0]]).toEqual([2, 2]);
  });
  it('3 x 1 e 4 x 0 têm vencedor no 4º game', () => {
    const a = jogar(regra('fixed'), ['A', 'B', 'A', 'A']);
    expect(a.encerrada).toBe(true);
    expect(a.winnerDupla).toBe('A');
    expect([a.historicGamesA[0], a.historicGamesB[0]]).toEqual([3, 1]);
    const b = jogar(regra('fixed'), ['B', 'B', 'B', 'B']);
    expect(b.winnerDupla).toBe('B');
  });
  it('não encerra antes dos 4 games', () => {
    expect(jogar(regra('fixed'), ['A', 'A', 'A']).encerrada).toBe(false);
  });
  it('validação de placar final: soma dos games = 4', () => {
    const r = { games: 4, tiebreak: 7, tiebreakAt: 'fixed' as const };
    expect(getBeachTennisScoreState(2, 2, r)).toBe('done');
    expect(getBeachTennisScoreState(3, 1, r)).toBe('done');
    expect(getBeachTennisScoreState(3, 2, r)).toBe('invalid');
    expect(getBeachTennisScoreState(2, 1, r)).toBe('normal');
  });
});

describe('presets novos', () => {
  it('existem os dois formatos de 1 set e 4 games', () => {
    const sem = WIN_RULE_PRESETS.find(p => p.tbAt === 'none');
    const fixo = WIN_RULE_PRESETS.find(p => p.tbAt === 'fixed');
    expect(sem).toMatchObject({ sets: 1, games: 4, label: 'MD1 · 4 games', desc: 'Sem tie' });
    expect(fixo).toMatchObject({ sets: 1, games: 4, stb: false });
    expect(deriveWinRule({ sets: 1, games: 4, tiebreakAt: 'fixed' }).tieMode).toBe('fixed');
  });
  it('um set fechado em 4-3 num formato sem tie não é classificado como tie-break', () => {
    expect(classifySet(0, [{ a: 4, b: 3 }], { sets: 1, games: 4, tiebreakAt: 'none' })).toBe('normal');
  });
});
