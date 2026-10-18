import { resultOf, withTrustedScores, buildResults } from '../matchResults';
import { applyScore, clearScore } from '../competitionOps';
import type { Competition, Match } from '../types';

const jogo = (id: string, scoreA: number | null, scoreB: number | null, extra: Partial<Match> = {}): Match =>
  ({ id, stage: 'rotating', teamA: ['p1', 'p2'], teamB: ['p3', 'p4'], scoreA, scoreB, ...extra });

const comp = (matches: Match[], results?: Competition['results']): Competition => ({
  id: 'c1', name: 'Rodada', format: 'avulso', unit: 'duplas', gender: 'misto', status: 'active', date: '2026-10-18',
  config: {} as Competition['config'], competitors: [], matches, ...(results ? { results } : {}),
} as Competition);

describe('resultOf', () => {
  it('jogo sem placar não tem resultado', () => {
    expect(resultOf(jogo('m1', null, null))).toBeNull();
    expect(resultOf(jogo('m1', 6, null))).toBeNull();
  });
  it('sempre devolve as três chaves (sets null quando não há)', () => {
    expect(resultOf(jogo('m1', 6, 3))).toEqual({ scoreA: 6, scoreB: 3, sets: null });
    expect(resultOf(jogo('m1', 1, 0, { sets: [{ a: 6, b: 3 }] }))).toEqual({ scoreA: 1, scoreB: 0, sets: [{ a: 6, b: 3 }] });
  });
});

describe('withTrustedScores', () => {
  it('sem o mapa (competição antiga), vale o placar do array', () => {
    const c = comp([jogo('m1', 6, 3)]);
    expect(withTrustedScores(c)).toBe(c);
  });
  it('com o mapa, o placar do array é ignorado', () => {
    // Alguém reescreveu o placar dentro do array direto no banco: não vale.
    const c = comp([jogo('m1', 0, 6), jogo('m2', 6, 0)], { m1: { scoreA: 6, scoreB: 3, sets: null } });
    const lido = withTrustedScores(c).matches;
    expect(lido[0]).toMatchObject({ id: 'm1', scoreA: 6, scoreB: 3, sets: null });
    expect(lido[1]).toMatchObject({ id: 'm2', scoreA: null, scoreB: null });
    expect(lido[1].sets).toBeUndefined();
  });
  it('mantém o resto do jogo (jogadores, fase)', () => {
    const c = comp([jogo('m1', null, null, { round: 2 })], { m1: { scoreA: 4, scoreB: 6, sets: null } });
    expect(withTrustedScores(c).matches[0]).toMatchObject({ teamA: ['p1', 'p2'], teamB: ['p3', 'p4'], round: 2 });
  });
});

describe('buildResults', () => {
  it('competição antiga: cria o mapa a partir dos jogos com placar', () => {
    expect(buildResults([jogo('m1', 6, 3), jogo('m2', null, null)], undefined)).toEqual({ m1: { scoreA: 6, scoreB: 3, sets: null } });
  });
  it('entradas que já existiam voltam idênticas (é o que a regra exige de quem não é admin)', () => {
    const base = { m1: { scoreA: 6, scoreB: 3, sets: [{ a: 6, b: 3 }] } };
    const lidos = withTrustedScores(comp([jogo('m1', null, null), jogo('m2', null, null)], base)).matches;
    const depois = applyScore(comp(lidos, base), 'm2', 6, 4).matches;
    const r = buildResults(depois, base);
    expect(r.m1).toEqual(base.m1);
    expect(r.m2).toEqual({ scoreA: 6, scoreB: 4, sets: null });
  });
  it('apagar o placar (admin) tira a entrada', () => {
    const base = { m1: { scoreA: 6, scoreB: 3, sets: null } };
    const lido = withTrustedScores(comp([jogo('m1', null, null)], base));
    expect(buildResults(clearScore(lido, 'm1').matches, base)).toEqual({});
  });
  it('não apaga a entrada de um jogo que saiu do array', () => {
    const base = { m9: { scoreA: 6, scoreB: 0, sets: null } };
    expect(buildResults([jogo('m1', null, null)], base)).toEqual(base);
  });
  it('não altera o objeto de origem', () => {
    const base = { m1: { scoreA: 6, scoreB: 3, sets: null } };
    buildResults([jogo('m1', null, null)], base);
    expect(base).toEqual({ m1: { scoreA: 6, scoreB: 3, sets: null } });
  });
});
