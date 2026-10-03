import { gameAverage, statPoints, buildRanking } from '@/logic/scoring';
import {
  DEFAULT_SCORING, validateScoringConfig, parseGaPlan, gaSmoothingFor, planWithChange, resolveScoring,
} from '@/logic/scoringConfig';
import type { PlayerGame } from '@/logic/scoring';

describe('GA suavizado', () => {
  it('sem K, comportamento antigo: satura em 9,99 sem games contra', () => {
    expect(gameAverage({ gamesPro: 6, gamesCon: 0 })).toBe(9.99);
    expect(gameAverage({ gamesPro: 0, gamesCon: 0 })).toBe(0);
    expect(gameAverage({ gamesPro: 30, gamesCon: 20 })).toBeCloseTo(1.5);
  });
  it('com K, uma única partida 6×0 deixa de disparar', () => {
    expect(gameAverage({ gamesPro: 6, gamesCon: 0 }, 4)).toBeCloseTo(2.5); // (6+4)/(0+4)
    expect(gameAverage({ gamesPro: 0, gamesCon: 0 }, 4)).toBe(0); // sem games, sem GA (não ganha 2 pontos de graça)
  });
  it('quem jogou muito quase não muda', () => {
    const raw = gameAverage({ gamesPro: 162, gamesCon: 149 });
    const smooth = gameAverage({ gamesPro: 162, gamesCon: 149 }, 4);
    expect(Math.abs(raw - smooth)).toBeLessThan(0.02);
  });
  it('statPoints usa o K da config efetiva', () => {
    const s = { played: 1, wins: 1, gamesPro: 6, gamesCon: 0 };
    const off = statPoints(s, DEFAULT_SCORING);
    const on = statPoints(s, { ...DEFAULT_SCORING, gaSmoothing: 4 });
    expect(off).toBeCloseTo(3 + 0.5 + 9.99 * 2);
    expect(on).toBeCloseTo(3 + 0.5 + 2.5 * 2);
  });
  it('o ranking não coloca no topo quem jogou uma só partida', () => {
    const g = (a: string[], b: string[], ga: number, gb: number): PlayerGame => ({ teamA: a, teamB: b, gamesA: ga, gamesB: gb, winner: ga > gb ? 'A' : 'B' });
    const players = ['novato', 'veterano', 'x'].map(id => ({ id, name: id, short: id, color: '#fff' }));
    const games: PlayerGame[] = [g(['novato'], ['x'], 6, 0)];
    for (let i = 0; i < 5; i++) games.push(g(['veterano'], ['x'], 6, 4)); // 5 vitórias
    for (let i = 0; i < 3; i++) games.push(g(['veterano'], ['x'], 4, 6)); // 3 derrotas
    const antes = buildRanking(players, games, DEFAULT_SCORING).map(r => r.id);
    const depois = buildRanking(players, games, { ...DEFAULT_SCORING, gaSmoothing: 4 }).map(r => r.id);
    expect(antes[0]).toBe('novato'); // sem K: 1 jogo 6×0 satura o GA e lidera
    expect(depois[0]).toBe('veterano');
  });
});

describe('plano de suavização por temporada', () => {
  it('sem plano, K = 0', () => { expect(gaSmoothingFor(undefined, 5)).toBe(0); });
  it('K em vigor é o do último passo com from ≤ temporada', () => {
    const plan = [{ from: 2, k: 4 }, { from: 5, k: 8 }];
    expect([1, 2, 4, 5, 9].map(s => gaSmoothingFor(plan, s))).toEqual([0, 4, 4, 8, 8]);
  });
  it('ligar na temporada 1 só vale a partir da 2', () => {
    const plan = planWithChange(undefined, 1, 4);
    expect(plan).toEqual([{ from: 2, k: 4 }]);
    expect(gaSmoothingFor(plan, 1)).toBe(0);
    expect(gaSmoothingFor(plan, 2)).toBe(4);
  });
  it('mudar o K mantém o que vale hoje e agenda o novo para a próxima', () => {
    const plan = planWithChange([{ from: 1, k: 4 }], 3, 8);
    expect(plan).toEqual([{ from: 1, k: 4 }, { from: 4, k: 8 }]);
    expect(gaSmoothingFor(plan, 3)).toBe(4);
  });
  it('salvar o mesmo K não agenda nada; um agendamento ainda não iniciado é substituído', () => {
    expect(planWithChange([{ from: 1, k: 4 }], 3, 4)).toEqual([{ from: 1, k: 4 }]);
    expect(planWithChange([{ from: 1, k: 4 }, { from: 4, k: 8 }], 3, 0)).toEqual([{ from: 1, k: 4 }, { from: 4, k: 0 }]);
    expect(planWithChange([{ from: 4, k: 8 }], 3, 0)).toEqual([]);
  });
  it('immediately: vale já na temporada atual, sem mexer nas anteriores', () => {
    expect(planWithChange(undefined, 1, 4, true)).toEqual([{ from: 1, k: 4 }]);
    expect(gaSmoothingFor(planWithChange(undefined, 1, 4, true), 1)).toBe(4);
    expect(planWithChange([{ from: 1, k: 4 }], 3, 8, true)).toEqual([{ from: 1, k: 4 }, { from: 3, k: 8 }]);
    expect(planWithChange([{ from: 1, k: 4 }, { from: 3, k: 8 }], 3, 4, true)).toEqual([{ from: 1, k: 4 }]);
    expect(planWithChange(undefined, 1, 0, true)).toEqual([]);
  });
  it('parseGaPlan descarta passos inválidos e ordena', () => {
    expect(parseGaPlan([{ from: 3, k: 4 }, { from: 0, k: 4 }, { from: 2, k: 99 }, null, { from: 1, k: 2 }])).toEqual([{ from: 1, k: 2 }, { from: 3, k: 4 }]);
    expect(parseGaPlan('x')).toEqual([]);
  });
  it('validateScoringConfig preserva o plano; resolveScoring deriva o K da temporada', () => {
    const v = validateScoringConfig({ winCoef: 3, playedCoef: 0.5, gaCoef: 2, gaSmoothingPlan: [{ from: 2, k: 4 }] });
    expect(v.gaSmoothingPlan).toEqual([{ from: 2, k: 4 }]);
    expect(resolveScoring(v, 1).gaSmoothing).toBe(0);
    expect(resolveScoring(v, 2).gaSmoothing).toBe(4);
    expect((validateScoringConfig({ winCoef: 3, playedCoef: 0.5, gaCoef: 2, gaSmoothing: 9 }) as any).gaSmoothing).toBeUndefined();
  });
});
