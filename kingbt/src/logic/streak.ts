import type { Competition } from './types';

export interface StreakInfo {
  type: 'winning' | 'inactive' | 'none';
  count?: number;
  daysSince?: number;
}

export interface StreakHistory {
  /** Jogos do jogador, do mais antigo para o mais recente. */
  results: { won: boolean; date: string }[];
  /** Sequência atual: positiva = vitórias seguidas, negativa = derrotas seguidas, 0 = sem jogos. */
  current: number;
  /** Maior sequência de vitórias seguidas do histórico. */
  max: number;
}

export function computeStreakHistory(
  competitions: Competition[],
  playerId: string
): StreakHistory {
  if (!playerId) return { results: [], current: 0, max: 0 };

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

  played.sort((a, b) => a.date.localeCompare(b.date));

  let current = 0;
  for (let i = played.length - 1; i >= 0; i--) {
    if (played[i].won === played[played.length - 1]?.won) {
      if (played[i].won) current++; else current--;
    } else break;
  }

  let max = 0, streak = 0;
  for (const g of played) { if (g.won) { streak++; max = Math.max(max, streak); } else streak = 0; }

  return { results: played, current, max };
}

export function computeStreak(
  competitions: Competition[],
  playerId: string
): StreakInfo {
  if (!playerId) return { type: 'none' };

  const { results: played, current } = computeStreakHistory(competitions, playerId);
  if (played.length === 0) return { type: 'none' };

  if (current >= 2) return { type: 'winning', count: current };

  const lastWin = [...played].reverse().find(g => g.won);
  if (!lastWin) return { type: 'none' };

  const days = Math.floor((Date.now() - new Date(lastWin.date + 'T12:00:00').getTime()) / 86_400_000);
  if (days >= 10) return { type: 'inactive', daysSince: days };

  return { type: 'none' };
}
