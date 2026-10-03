import { sortByLevel, splitPots, drawPotPairs, type PotPlayer } from '@/logic/potDraw';

const P = (id: string, category?: string, rank?: number): PotPlayer => ({ id, category, rank });

describe('potDraw', () => {
  it('ordena por categoria e, dentro dela, pelo ranking; sem categoria vem depois', () => {
    const ps = [P('d', 'D', 1), P('a2', 'A', 5), P('a1', 'A', 2), P('sem', undefined, 0), P('open', 'Open', 9)];
    expect(sortByLevel(ps).map(p => p.id)).toEqual(['open', 'a1', 'a2', 'd', 'sem']);
  });
  it('sem categoria nenhuma, vale só o ranking', () => {
    expect(sortByLevel([P('x', undefined, 3), P('y', undefined, 1), P('z')]).map(p => p.id)).toEqual(['y', 'x', 'z']);
  });
  it('número par: metade em cada pote', () => {
    const r = splitPots([P('a', 'A'), P('b', 'B'), P('c', 'C'), P('d', 'D')]);
    expect(r).toEqual({ pot1: ['a', 'b'], pot2: ['c', 'd'], leftover: null });
  });
  it('número ímpar: o do meio sobra', () => {
    const r = splitPots([P('a', 'A'), P('b', 'B'), P('c', 'C'), P('d', 'D'), P('e', 'Iniciante')]);
    expect(r).toEqual({ pot1: ['a', 'b'], pot2: ['d', 'e'], leftover: 'c' });
  });
  it('cada dupla tem um de cada pote e todos aparecem uma vez só', () => {
    const ps = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id, i) => P(id, undefined, i));
    for (let t = 0; t < 20; t++) {
      const { pot1, pot2, pairs, leftover } = drawPotPairs(ps);
      expect(leftover).toBeNull();
      expect(pairs).toHaveLength(4);
      for (const [x, y] of pairs) { expect(pot1).toContain(x); expect(pot2).toContain(y); }
      expect(pairs.flat().sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    }
  });
  it('o resultado depende do sorteio (e é repetível com o mesmo gerador)', () => {
    const ps = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => P(id, undefined, i));
    const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };
    const r1 = drawPotPairs(ps, seq([0.9, 0.1, 0.5]));
    const r2 = drawPotPairs(ps, seq([0.9, 0.1, 0.5]));
    expect(r1.pairs).toEqual(r2.pairs);
    expect(drawPotPairs(ps, () => 0.99).pairs).not.toEqual(drawPotPairs(ps, () => 0).pairs);
  });
  it('menos de dois jogadores: sem duplas', () => {
    expect(drawPotPairs([P('a')]).pairs).toEqual([]);
    expect(drawPotPairs([]).pairs).toEqual([]);
  });
});
