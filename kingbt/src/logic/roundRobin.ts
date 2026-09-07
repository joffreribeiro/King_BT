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

type Quartet = { a: number; b: number; d: number; e: number };
type TieBreak = 'first' | 'fair' | 'random';

/**
 * Roda o guloso original (repetição de parceiro > cobertura de pares > nº de
 * jogos por pessoa) uma vez, usando `tieBreak` para decidir qual candidato
 * escolher quando vários times empatam nesses três critérios:
 * - 'first'  → o comportamento de sempre (primeiro candidato encontrado).
 * - 'fair'   → dentre os empatados, o que deixa o `balance` (favorecimento
 *              acumulado por handicap) mais equilibrado entre todo mundo.
 * - 'random' → um empatado aleatório, para explorar outras estruturas.
 * O handicap NUNCA entra nos três critérios estruturais acima — só desempata
 * entre times já igualmente bons nisso, então nunca força repetição de
 * parceiro nem atrasa a cobertura de um par só para nivelar dificuldade.
 */
function runAttempt(
  ids: string[],
  h: number[],
  tieBreak: TieBreak
): { games: Match[]; balance: number[]; complete: boolean } {
  const n = ids.length;
  const idx = ids.map((_, i) => i);
  const partner = Array.from({ length: n }, () => Array(n).fill(0)) as number[][];
  const played   = Array(n).fill(0) as number[];
  const covered  = Array.from({ length: n }, () => Array(n).fill(false)) as boolean[][];
  /**
   * Saldo acumulado de favorecimento por jogador: soma, em cada rodada já
   * jogada, de (handicap do próprio time − handicap do time adversário).
   * É zero-soma por construção; manter cada entrada perto de 0 é o proxy
   * usado pra equilibrar quem pegou parceiros fracos/adversários fortes.
   */
  const balance = Array(n).fill(0) as number[];

  const totalPairs = n * (n - 1) / 2;
  let done = 0;
  const maxGames = Math.ceil(n * (n - 1) / 4) + n;
  const combos = combinations(idx, 4);
  const games: Match[] = [];

  while (done < totalPairs && games.length < maxGames) {
    let bestCost = Infinity;
    let tied: Quartet[] = [];

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

        if (cost < bestCost) { bestCost = cost; tied = [{ a, b, d, e }]; }
        else if (cost === bestCost) { tied.push({ a, b, d, e }); }
      }
    }

    if (tied.length === 0) break;
    let best: Quartet;
    if (tieBreak === 'first' || tied.length === 1) {
      best = tied[0];
    } else if (tieBreak === 'random') {
      best = tied[Math.floor(Math.random() * tied.length)];
    } else {
      best = tied[0];
      let bestFair = Infinity;
      for (const cand of tied) {
        const { a, b, d, e } = cand;
        const edge = (h[a] + h[b]) - (h[d] + h[e]);
        const trial = balance.slice();
        trial[a] += edge; trial[b] += edge; trial[d] -= edge; trial[e] -= edge;
        const fair = trial.reduce((s, x) => s + x * x, 0);
        if (fair < bestFair) { bestFair = fair; best = cand; }
      }
    }

    const { a, b, d, e } = best;
    partner[a][b]++; partner[b][a]++; partner[d][e]++; partner[e][d]++;
    played[a]++; played[b]++; played[d]++; played[e]++;
    const edge = (h[a] + h[b]) - (h[d] + h[e]);
    balance[a] += edge; balance[b] += edge;
    balance[d] -= edge; balance[e] -= edge;
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
  return { games, balance, complete: done === totalPairs };
}

/** Quantas tentativas rodar pra achar a escala mais equilibrada por handicap — cresce o esforço só o suficiente pra manter a geração rápida mesmo em grupos grandes. */
function attemptsFor(n: number): number {
  if (n <= 10) return 40;
  if (n <= 14) return 20;
  if (n <= 18) return 10;
  return 5;
}

/**
 * Gera o calendário de um torneio Americano (duplas rotativas).
 * Greedy: minimiza repetição de parceiros, maximiza cobertura de pares,
 * equilibra nº de jogos por pessoa.
 *
 * Quando os jogadores têm `handicap`, gera várias tentativas (desempatando
 * de formas diferentes entre times estruturalmente equivalentes) e fica com
 * a que deixa mais equilibrado, entre todos, quem pegou parceiros fracos e
 * adversários fortes ao longo do torneio. Sem handicap, roda uma única vez
 * (idêntico ao comportamento anterior). Nunca pode sair pior do que a
 * tentativa determinística de sempre, porque ela sempre entra na disputa.
 */
export function generateSchedule(players: Pick<Player, 'id' | 'handicap'>[]): Match[] {
  const n = players.length;
  if (n < 4) return [];

  const ids = players.map(p => p.id);
  const h   = players.map(p => p.handicap ?? 0);
  const hasHandicap = h.some(v => v !== 0);

  const tieBreaks: TieBreak[] = ['first'];
  if (hasHandicap) {
    tieBreaks.push('fair');
    while (tieBreaks.length < attemptsFor(n)) tieBreaks.push('random');
  }

  let best: { games: Match[]; balance: number[] } | null = null;
  let bestScore = Infinity;
  for (const tieBreak of tieBreaks) {
    const result = runAttempt(ids, h, tieBreak);
    if (!result.complete) continue;
    const score = result.balance.reduce((s, x) => s + x * x, 0);
    if (score < bestScore) { bestScore = score; best = result; }
  }
  return best ? best.games : runAttempt(ids, h, 'first').games;
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
