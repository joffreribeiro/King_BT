import type { Match, Player, Competitor } from './types';

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

/**
 * Super 8 individual: round-robin completo 1v1, todos contra todos.
 * Mínimo 2 jogadores.
 */
export function generateScheduleIndividual(competitors: Pick<Competitor, 'id' | 'members'>[]): Match[] {
  const n = competitors.length;
  if (n < 2) return [];
  const games: Match[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const idA = competitors[i].members[0] ?? competitors[i].id;
      const idB = competitors[j].members[0] ?? competitors[j].id;
      games.push({
        id: 'g' + games.length,
        stage: 'rotating',
        teamA: [idA],
        teamB: [idB],
        scoreA: null,
        scoreB: null,
      });
    }
  }
  return games;
}

/**
 * Super 8 com duplas fixas: round-robin completo, cada dupla joga contra todas as outras.
 * Mínimo 2 duplas.
 */
export function generateScheduleDuplas(competitors: Pick<Competitor, 'id' | 'members'>[]): Match[] {
  const n = competitors.length;
  if (n < 2) return [];
  const games: Match[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const cA = competitors[i];
      const cB = competitors[j];
      games.push({
        id: 'g' + games.length,
        stage: 'rotating',
        teamA: cA.members.length >= 2 ? [cA.members[0], cA.members[1]] : [cA.members[0] ?? cA.id],
        teamB: cB.members.length >= 2 ? [cB.members[0], cB.members[1]] : [cB.members[0] ?? cB.id],
        scoreA: null,
        scoreB: null,
      });
    }
  }
  return games;
}

/** Snake pairing: 1°+N°, 2°+(N-1)°, etc. para equilibrar duplas pelo ranking */
export function balancedPairs(
  players: { id: string }[],
  ranking: { id: string; points: number }[]
): [string, string][] {
  const sorted = [...players].sort((a, b) => {
    const rA = ranking.findIndex(r => r.id === a.id);
    const rB = ranking.findIndex(r => r.id === b.id);
    return (rA === -1 ? 9999 : rA) - (rB === -1 ? 9999 : rB);
  });
  const pairs: [string, string][] = [];
  const n = sorted.length;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    pairs.push([sorted[i].id, sorted[n - 1 - i].id]);
  }
  return pairs;
}
