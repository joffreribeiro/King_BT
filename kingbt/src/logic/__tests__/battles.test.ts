import { computeBattles, battleHighlights, computePartnerships, partnerHighlights, filterByPeriod } from '@/logic/battles';
import type { Competition } from '@/logic/types';

const comp = (matches: any[]): Competition => ({ id: 'c', matches } as unknown as Competition);
const m = (a: string[], b: string[], sa: number, sb: number) => ({ id: Math.random().toString(), teamA: a, teamB: b, scoreA: sa, scoreB: sb });

describe('computeBattles', () => {
  const comps = [comp([
    m(['me', 'p1'], ['x', 'y'], 6, 3),   // venci x e y
    m(['me', 'p1'], ['x', 'z'], 2, 6),   // perdi para x e z
    m(['x', 'y'], ['me', 'p2'], 6, 0),   // perdi para x e y (eu no lado B)
    m(['a', 'b'], ['c', 'd'], 6, 1),     // jogo alheio
    m(['me', 'p1'], ['x', 'y'], null as any, null as any), // sem placar
  ])];
  const battles = computeBattles('me', comps);
  const get = (id: string) => battles.find(b => b.id === id)!;

  it('conta cada adversário de cada dupla; parceiro não conta', () => {
    expect(get('x')).toMatchObject({ played: 3, wins: 1, losses: 2, pct: 33 });
    expect(get('y')).toMatchObject({ played: 2, wins: 1, losses: 1, pct: 50 });
    expect(get('z')).toMatchObject({ played: 1, wins: 0, losses: 1, pct: 0 });
    expect(battles.find(b => b.id === 'p1')).toBeUndefined();
    expect(battles.find(b => b.id === 'a')).toBeUndefined();
  });
  it('ordena por jogos', () => {
    expect(battles[0].id).toBe('x');
  });
  it('individual (aId/bId)', () => {
    const r = computeBattles('me', [comp([{ id: '1', aId: 'me', bId: 'q', scoreA: 6, scoreB: 4 }, { id: '2', aId: 'q', bId: 'me', scoreA: 6, scoreB: 1 }])]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'q', played: 2, wins: 1, losses: 1, pct: 50, gamesPro: 7, gamesCon: 10 });
  });
  it('games, último confronto e sequência', () => {
    const c = (date: string, ms: any[]) => ({ id: date, date, matches: ms } as unknown as Competition);
    const r = computeBattles('me', [
      c('2026-01-01', [{ id: '1', aId: 'me', bId: 'q', scoreA: 6, scoreB: 4 }]),
      c('2026-02-01', [{ id: '2', aId: 'me', bId: 'q', scoreA: 6, scoreB: 2 }]),
      c('2026-03-01', [{ id: '3', aId: 'q', bId: 'me', scoreA: 3, scoreB: 6 }]),
    ] as any);
    expect(r[0].streak).toEqual({ won: true, count: 3 });
    expect(r[0].last).toEqual({ date: '2026-03-01', won: true, gf: 6, gc: 3 });
    expect(r[0]).toMatchObject({ gamesPro: 18, gamesCon: 9 });
  });
  it('parcerias: melhor e pior dupla', () => {
    const c = (ms: any[]) => ({ id: 'c', date: '2026-01-01', matches: ms } as unknown as Competition);
    const ps = computePartnerships('me', [c([
      m(['me', 'a'], ['x', 'y'], 6, 1), m(['me', 'a'], ['x', 'y'], 6, 1), m(['me', 'a'], ['x', 'y'], 1, 6),
      m(['me', 'b'], ['x', 'y'], 1, 6), m(['me', 'b'], ['x', 'y'], 2, 6),
      m(['me', 'z'], ['x', 'y'], 6, 0),
    ])]);
    const h = partnerHighlights(ps);
    expect(h.best?.partnerId).toBe('a');
    expect(h.worst?.partnerId).toBe('b'); // z só jogou 1 vez
  });
  it('filtra por período', () => {
    const cs = [{ id: 'a', date: '2026-09-10', matches: [] }, { id: 'b', date: '2025-09-10', matches: [] }] as unknown as Competition[];
    const now = new Date('2026-09-20T12:00:00');
    expect(filterByPeriod(cs, 'mes', now).map(x => x.id)).toEqual(['a']);
    expect(filterByPeriod(cs, 'ano', now).map(x => x.id)).toEqual(['a']);
    expect(filterByPeriod(cs, 'geral', now)).toHaveLength(2);
  });
  it('destaques: carrasco, freguês e rival', () => {
    const h = battleHighlights(battles);
    expect(h.carrasco?.id).toBe('x'); // 1V-2D; y está 1-1 (sem saldo) e z só jogou 1
    expect(h.fregues).toBeNull();     // ninguém com saldo positivo e 2+ jogos
    expect(h.rival?.id).toBe('x');
  });
  it('a mesma pessoa não é carrasco e freguês; vale a taxa, não a contagem', () => {
    const h = battleHighlights([
      { id: 'a', played: 22, wins: 12, losses: 10, pct: 55 },
      { id: 'b', played: 4, wins: 1, losses: 3, pct: 25 },
      { id: 'c', played: 3, wins: 3, losses: 0, pct: 100 },
    ] as any);
    expect(h.rival?.id).toBe('a');
    expect(h.carrasco?.id).toBe('b');
    expect(h.fregues?.id).toBe('c'); // 'a' tem saldo positivo mas taxa menor
  });
  it('sem vitórias/derrotas não há freguês/carrasco', () => {
    const h = battleHighlights([{ id: 'a', played: 2, wins: 0, losses: 2, pct: 0 }] as any);
    expect(h.fregues).toBeNull();
    expect(h.carrasco?.id).toBe('a');
    expect(battleHighlights([])).toEqual({ carrasco: null, fregues: null, rival: null });
  });
});
