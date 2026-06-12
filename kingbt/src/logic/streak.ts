import type { Competition } from './types';

export interface StreakInfo {
  type: 'winning' | 'inactive' | 'none';
  count?: number;
  daysSince?: number;
}

export function computeStreak(
  competitions: Competition[],
  playerId: string
): StreakInfo {
  if (!playerId) return { type: 'none' };

  const played: { won: boolean; date: string }[] = [];

  competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreB == null) return;

      const inA = m.aId === playerId || m.teamA?.includes(playerId);
      const inB = m.bId === playerId || m.teamB?.includes(playerId);
      if (!inA && !inB) return;

      const won = inA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
      played.push({ won, date: comp.date });
    });
  });

  if (played.length === 0) return { type: 'none' };

  played.sort((a, b) => a.date.localeCompare(b.date));

  let streak = 0;
  for (let i = played.length - 1; i >= 0; i--) {
    if (played[i].won) streak++;
    else break;
  }

  if (streak >= 2) return { type: 'winning', count: streak };

  const lastWin = [...played].reverse().find(g => g.won);
  if (!lastWin) return { type: 'none' };

  const days = Math.floor((Date.now() - new Date(lastWin.date + 'T12:00:00').getTime()) / 86_400_000);
  if (days >= 10) return { type: 'inactive', daysSince: days };

  return { type: 'none' };
}
