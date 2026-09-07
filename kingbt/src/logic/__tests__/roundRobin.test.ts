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

describe('generateSchedule — equilíbrio por handicap', () => {
  /** Soma, pra cada jogador, de (handicap do próprio time − handicap do time adversário) em cada jogo — mede quem pegou parceiros fracos/adversários fortes ao longo do torneio. */
  function balanceByPlayer(games: ReturnType<typeof generateSchedule>, byId: Record<string, number>) {
    const balance: Record<string, number> = {};
    for (const g of games) {
      const [a, b] = g.teamA!;
      const [d, e] = g.teamB!;
      const edge = (byId[a] + byId[b]) - (byId[d] + byId[e]);
      balance[a] = (balance[a] ?? 0) + edge;
      balance[b] = (balance[b] ?? 0) + edge;
      balance[d] = (balance[d] ?? 0) - edge;
      balance[e] = (balance[e] ?? 0) - edge;
    }
    return balance;
  }

  it('sem handicap, gera o mesmo calendário de antes (uma única tentativa)', () => {
    const semHandicap = generateSchedule(players(8));
    const comHandicapZero = generateSchedule(players(8).map(p => ({ ...p, handicap: 0 })));
    expect(comHandicapZero).toEqual(semHandicap);
  });

  it('continua cobrindo todos os pares e equilibrando jogos mesmo com handicaps variados', () => {
    const ps = players(8).map((p, i) => ({ ...p, handicap: [2, 1, 1, 0, 0, -1, -1, -2][i] }));
    const games = generateSchedule(ps);

    const covered = new Set<string>();
    const count: Record<string, number> = {};
    for (const g of games) {
      const [a, b] = [...g.teamA!].sort();
      const [d, e] = [...g.teamB!].sort();
      covered.add(`${a}|${b}`);
      covered.add(`${d}|${e}`);
      [...g.teamA!, ...g.teamB!].forEach(id => { count[id] = (count[id] ?? 0) + 1; });
    }
    expect(covered.size).toBe((8 * 7) / 2);
    const values = Object.values(count);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
  });

  it('nunca deixa o desequilíbrio por handicap pior do que a versão sem equilíbrio (guloso original)', () => {
    const byId: Record<string, number> = {
      p1: 2, p2: 1, p3: 1, p4: 0, p5: 0, p6: -1, p7: -1, p8: -2,
    };
    const ps = players(8).map(p => ({ ...p, handicap: byId[p.id] }));
    const games = generateSchedule(ps);
    const balance = balanceByPlayer(games, byId);
    const score = Object.values(balance).reduce((s, x) => s + x * x, 0);

    // Score do guloso original (sem considerar handicap nos empates), calculado
    // uma vez e travado aqui: a versão com handicap nunca deve ficar pior que isso.
    const baselineScore = 320;
    expect(score).toBeLessThanOrEqual(baselineScore);
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
