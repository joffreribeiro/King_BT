import type { Player, PlayerStat, RankedPlayer } from './types';
import { DEFAULT_SCORING, type ScoringConfig } from './scoringConfig';

export type { PlayerStat, RankedPlayer };

/** Épsilon para comparar pontos/GA em ponto flutuante. */
const EPS = 1e-9;

/** Forma canônica de estatísticas agregadas de um competidor. */
export interface ScoreStats {
  played: number;
  wins: number;
  gamesPro: number;
  gamesCon: number;
}

/** Linha mínima para ordenação de ranking/classificação. */
export interface RankRow {
  id: string;
  points: number;
  sg: number;
  ga: number;
  wins: number;
}

export function blankStat(): PlayerStat {
  return { id: '', played: 0, wins: 0, losses: 0, gamesPro: 0, gamesCon: 0 };
}

/** GA = GamesPró ÷ GamesContra (nunca divide por 0, máximo 9.99) */
export function gameAverage(s: Pick<ScoreStats, 'gamesPro' | 'gamesCon'>): number {
  if (s.gamesCon === 0) return s.gamesPro > 0 ? 9.99 : 0;
  return Math.min(9.99, s.gamesPro / s.gamesCon);
}

/**
 * Pts = (V×winCoef) + (J×playedCoef) + (GA×gaCoef).
 * Coeficientes vêm do cfg (padrão: V×3 + J×0,5 + GA×2).
 */
export function statPoints(s: ScoreStats, cfg: ScoringConfig = DEFAULT_SCORING): number {
  return s.wins * cfg.winCoef + s.played * cfg.playedCoef + gameAverage(s) * cfg.gaCoef;
}

/**
 * Comparador único de ranking/classificação. Ordem de desempate:
 * pontos → confronto direto → saldo de games → GA → vitórias → alfabético.
 * @param h2h  -1 se A vem antes, 1 se B vem antes, 0 empate.
 * @param nameOf nome usado no desempate alfabético final.
 */
export function compareRank(
  a: RankRow,
  b: RankRow,
  h2h: (idA: string, idB: string) => number,
  nameOf: (id: string) => string,
): number {
  const byPts = b.points - a.points;  if (Math.abs(byPts) > EPS) return byPts;
  const byH2H = h2h(a.id, b.id);       if (byH2H !== 0) return byH2H;   // 1° confronto direto
  const bySg  = b.sg   - a.sg;         if (bySg  !== 0) return bySg;     // 2° saldo de games
  const byGa  = b.ga   - a.ga;         if (Math.abs(byGa) > EPS) return byGa; // 3° GA
  const byW   = b.wins - a.wins;       if (byW   !== 0) return byW;      // 4° vitórias
  return nameOf(a.id).localeCompare(nameOf(b.id), 'pt-BR', { sensitivity: 'base' });
}

export function applyGame(
  statsMap: Record<string, PlayerStat>,
  game: { teamA: string[]; teamB: string[]; scoreA: number; scoreB: number }
): void {
  if (game.scoreA === game.scoreB) return;
  const aWin = game.scoreA > game.scoreB;
  for (const id of game.teamA) {
    if (!statsMap[id]) statsMap[id] = { ...blankStat(), id };
    const s = statsMap[id];
    s.played++; s.gamesPro += game.scoreA; s.gamesCon += game.scoreB;
    if (aWin) s.wins++; else s.losses++;
  }
  for (const id of game.teamB) {
    if (!statsMap[id]) statsMap[id] = { ...blankStat(), id };
    const s = statsMap[id];
    s.played++; s.gamesPro += game.scoreB; s.gamesCon += game.scoreA;
    if (aWin) s.losses++; else s.wins++;
  }
}

export function buildRanking(
  players: Player[],
  games: Array<{ teamA: string[]; teamB: string[]; scoreA: number; scoreB: number }>,
  cfg: ScoringConfig = DEFAULT_SCORING,
): RankedPlayer[] {
  const map: Record<string, PlayerStat> = {};
  players.forEach(p => { map[p.id] = { ...blankStat(), id: p.id }; });
  games.forEach(g => applyGame(map, g));

  function h2h(idA: string, idB: string): number {
    let wA = 0, wB = 0;
    games.forEach(g => {
      if (g.scoreA === g.scoreB) return;
      const aInA = g.teamA.includes(idA), bInA = g.teamA.includes(idB);
      const aInB = g.teamB.includes(idA), bInB = g.teamB.includes(idB);
      if ((aInA && bInA) || (aInB && bInB)) return; // mesmo time
      const aWon = g.scoreA > g.scoreB;
      if (aInA && bInB) { if (aWon) wA++; else wB++; }
      else if (aInB && bInA) { if (!aWon) wA++; else wB++; }
    });
    if (wA !== wB) return wA > wB ? -1 : 1;
    return 0;
  }

  const ranked = players.map(p => {
    const s = map[p.id];
    const sg = s.gamesPro - s.gamesCon;
    const ga = gameAverage(s);
    return {
      ...p, ...s, sg, ga,
      winRate: s.played ? Math.round((s.wins / s.played) * 100) : 0,
      points: Math.round(statPoints(s, cfg) * 100) / 100,
    } as RankedPlayer;
  });

  const nameOf = (id: string) => ranked.find(r => r.id === id)?.name ?? id;
  return ranked.sort((a, b) => compareRank(a, b, h2h, nameOf));
}
