import type { Match, Player } from './types';

function combinations<T>(arr: T[], k: number): T[][] {
  const res: T[][] = [];
  const rec = (start: number, combo: T[]) => {
    if (combo.length === k) { res.push(combo.slice()); return; }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); rec(i + 1, combo); combo.pop(); }
  };
  rec(0, []);
  return res;
}

/**
 * Gera o calendário de um torneio Americano (duplas rotativas).
 * Greedy: minimiza repetição de parceiros, maximiza cobertura de pares,
 * equilibra nº de jogos por pessoa.
 */
export function generateSchedule(players: Pick<Player, 'id'>[]): Match[] {
  const n = players.length;
  if (n < 4) return [];

  const ids = players.map(p => p.id);
  const idx = ids.map((_, i) => i);
  const partner = Array.from({ length: n }, () => Array(n).fill(0)) as number[][];
  const played   = Array(n).fill(0) as number[];
  const covered  = Array.from({ length: n }, () => Array(n).fill(false)) as boolean[][];

  const totalPairs = n * (n - 1) / 2;
  let done = 0;
  const maxGames = Math.ceil(n * (n - 1) / 4) + n;
  const combos = combinations(idx, 4);
  const games: Match[] = [];

  while (done < totalPairs && games.length < maxGames) {
    let best: { a: number; b: number; d: number; e: number } | null = null;
    let bestCost = Infinity;

    for (const c of combos) {
      const splits: [number[], number[]][] = [
        [[c[0], c[1]], [c[2], c[3]]],
        [[c[0], c[2]], [c[1], c[3]]],
        [[c[0], c[3]], [c[1], c[2]]],
      ];
      for (const [[a, b], [d, e]] of splits) {
        let cost = (partner[a][b] + partner[d][e]) * 100;
        cost += played[a] + played[b] + played[d] + played[e];
        cost -= ((covered[a][b] ? 0 : 1) + (covered[d][e] ? 0 : 1)) * 1000;
        if (cost < bestCost) { bestCost = cost; best = { a, b, d, e }; }
      }
    }

    if (!best) break;
    const { a, b, d, e } = best;
    partner[a][b]++; partner[b][a]++; partner[d][e]++; partner[e][d]++;
    played[a]++; played[b]++; played[d]++; played[e]++;
    if (!covered[a][b]) { covered[a][b] = covered[b][a] = true; done++; }
    if (!covered[d][e]) { covered[d][e] = covered[e][d] = true; done++; }

    games.push({
      id: 'g' + games.length,
      stage: 'rotating',
      teamA: [ids[a], ids[b]],
      teamB: [ids[d], ids[e]],
      scoreA: null,
      scoreB: null,
    });
  }
  return games;
}
