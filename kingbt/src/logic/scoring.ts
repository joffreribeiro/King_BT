import type { Player, PlayerStat, RankedPlayer } from './types';

export type { PlayerStat, RankedPlayer };

const HANDICAP_FACTOR: Record<number, number> = {
  [-3]: 1.5,
  [-2]: 1.3,
  [-1]: 1.1,
  [0]:  1.0,
  [1]:  0.9,
  [2]:  0.7,
  [3]:  0.5,
};

function handicapFactor(player: Player): number {
  const h = player.handicap ?? 0;
  return HANDICAP_FACTOR[h] ?? 1.0;
}

export function blankStat(): PlayerStat {
  return { id: '', played: 0, wins: 0, losses: 0, gamesPro: 0, gamesCon: 0 };
}

/** GA = GamesPró ÷ GamesContra (nunca divide por 0) */
export function gameAverage(s: Pick<PlayerStat, 'gamesPro' | 'gamesCon'>): number {
  return s.gamesPro / Math.max(1, s.gamesCon);
}

/** Pts = (V×3) + (J×0,5) + (GA×2) */
export function statPoints(s: PlayerStat): number {
  return s.wins * 3 + s.played * 0.5 + gameAverage(s) * 2;
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
  games: Array<{ teamA: string[]; teamB: string[]; scoreA: number; scoreB: number }>
): RankedPlayer[] {
  const map: Record<string, PlayerStat> = {};
  players.forEach(p => { map[p.id] = { ...blankStat(), id: p.id }; });
  games.forEach(g => applyGame(map, g));
  return players
    .map(p => {
      const s = map[p.id];
      const sg = s.gamesPro - s.gamesCon;
      const ga = gameAverage(s);
      const factor = handicapFactor(p);
      return {
        ...p, ...s, sg, ga,
        winRate: s.played ? Math.round((s.wins / s.played) * 100) : 0,
        points: Math.round(statPoints(s) * factor * 100) / 100,
      } as RankedPlayer;
    })
    .sort((a, b) => b.points - a.points || b.ga - a.ga || b.sg - a.sg || b.wins - a.wins);
}
