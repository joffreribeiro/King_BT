import type { Competition } from './types';
import { buildRanking } from './scoring';
import { extractPlayerGames } from './formats';

export type DeltaInfo = {
  dir: 'up' | 'down' | 'same' | 'new';
  diff: number;
};

export function computeRankingDeltas(
  competitions: Competition[],
  players: { id: string; name: string; short: string; color: string; handicap?: number }[]
): Record<string, DeltaInfo> {
  if (competitions.length < 2) return {};

  const sorted   = [...competitions].sort((a, b) => a.date.localeCompare(b.date));
  const previous = sorted.slice(0, -1);

  const allGames  = competitions.flatMap(extractPlayerGames);
  const current   = buildRanking(players, allGames);

  const prevGames = previous.flatMap(extractPlayerGames);
  const prev      = buildRanking(players, prevGames);

  const result: Record<string, DeltaInfo> = {};
  current.forEach((p, i) => {
    const prevIdx = prev.findIndex(x => x.id === p.id);
    if (prevIdx === -1) {
      result[p.id] = { dir: 'new', diff: 0 };
    } else {
      const diff = prevIdx - i;
      result[p.id] = {
        dir:  diff > 0 ? 'up' : diff < 0 ? 'down' : 'same',
        diff: Math.abs(diff),
      };
    }
  });
  return result;
}
