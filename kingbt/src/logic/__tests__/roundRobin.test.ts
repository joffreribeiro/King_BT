import { generateSchedule, generateScheduleIndividual, generateScheduleDuplas, balancedPairs } from '../roundRobin';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));

describe('generateSchedule — Americano (duplas rotativas)', () => {
  it('retorna vazio com menos de 4 jogadores', () => {
    expect(generateSchedule(players(3))).toEqual([]);
  });

  it('cobre todos os pares de parceiros possíveis', () => {
    for (const n of [4, 5, 8]) {
      const games = generateSchedule(players(n));
      const covered = new Set<string>();
      for (const g of games) {
        const [a, b] = [...g.teamA!].sort();
        const [d, e] = [...g.teamB!].sort();
        covered.add(`${a}|${b}`);
        covered.add(`${d}|${e}`);
      }
      expect(covered.size).toBe((n * (n - 1)) / 2);
    }
  });

  it('nenhum jogador aparece nos dois times do mesmo jogo', () => {
    const games = generateSchedule(players(8));
    for (const g of games) {
      const all = [...g.teamA!, ...g.teamB!];
      expect(new Set(all).size).toBe(4);
    }
  });

  it('equilibra o número de jogos por pessoa (diferença máxima 2)', () => {
    const games = generateSchedule(players(8));
    const count: Record<string, number> = {};
    for (const g of games) [...g.teamA!, ...g.teamB!].forEach(id => { count[id] = (count[id] ?? 0) + 1; });
    const values = Object.values(count);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
  });
});

describe('generateScheduleIndividual — Super 8 individual', () => {
  it('gera round-robin completo 1v1', () => {
    const comps = players(8).map(p => ({ id: p.id, members: [p.id] }));
    const games = generateScheduleIndividual(comps);
    expect(games).toHaveLength(28); // C(8,2)
    for (const g of games) {
      expect(g.teamA).toHaveLength(1);
      expect(g.teamB).toHaveLength(1);
      expect(g.teamA![0]).not.toBe(g.teamB![0]);
    }
  });

  it('retorna vazio com menos de 2 competidores', () => {
    expect(generateScheduleIndividual([{ id: 'a', members: ['a'] }])).toEqual([]);
  });
});

describe('generateScheduleDuplas — Super 8 duplas fixas', () => {
  it('cada dupla joga contra todas as outras', () => {
    const comps = [
      { id: 'd1', members: ['p1', 'p2'] },
      { id: 'd2', members: ['p3', 'p4'] },
      { id: 'd3', members: ['p5', 'p6'] },
      { id: 'd4', members: ['p7', 'p8'] },
    ];
    const games = generateScheduleDuplas(comps);
    expect(games).toHaveLength(6); // C(4,2)
    for (const g of games) {
      expect(g.teamA).toHaveLength(2);
      expect(g.teamB).toHaveLength(2);
    }
  });
});

describe('balancedPairs — pareamento snake pelo ranking', () => {
  it('pareia 1º com último, 2º com penúltimo', () => {
    const ps = players(4);
    const ranking = [
      { id: 'p1', points: 100 },
      { id: 'p2', points: 80 },
      { id: 'p3', points: 60 },
      { id: 'p4', points: 40 },
    ];
    expect(balancedPairs(ps, ranking)).toEqual([
      ['p1', 'p4'],
      ['p2', 'p3'],
    ]);
  });

  it('jogadores fora do ranking vão para o fim', () => {
    const ps = [{ id: 'novato' }, ...players(3)];
    const ranking = [
      { id: 'p1', points: 100 },
      { id: 'p2', points: 80 },
      { id: 'p3', points: 60 },
    ];
    const pairs = balancedPairs(ps, ranking);
    expect(pairs[0]).toEqual(['p1', 'novato']);
  });
});
