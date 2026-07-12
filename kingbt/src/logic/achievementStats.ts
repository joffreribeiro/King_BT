import type { Competition } from './types';
import { competitionChampion } from './formats';
import { computeStreakHistory } from './streak';
import type { UserAchievementStats } from '@/constants/achievements';

export function computeAchievementStats(
  competitions: Competition[],
  playerId: string,
  sharesCount = 0
): UserAchievementStats {
  if (!playerId) {
    return {
      totalWins: 0, totalMatches: 0, currentStreak: 0, maxStreak: 0,
      currentRating: 0, champCount: 0, super8Wins: 0, ligaWins: 0,
      avulsoWins: 0, hatTrick: false, unbeatable: false, perfectPartner: false,
      sharesCount: 0,
    };
  }

  // Wins / total / sequência — fonte única compartilhada com o banner do
  // dashboard e a seção de streak das estatísticas (src/logic/streak.ts).
  const history = computeStreakHistory(competitions, playerId);
  const totalWins    = history.results.filter(g => g.won).length;
  const totalMatches = history.results.length;
  const currentStreak = Math.max(0, history.current);
  const maxStreak      = history.max;

  // Champ count
  const champCount = competitions.filter(c => {
    if (c.status !== 'done') return false;
    const champ = competitionChampion(c, id => id);
    return champ && champ.members.includes(playerId);
  }).length;

  // Format wins
  const formatWins = (fmt: string) =>
    competitions
      .filter(c => c.format === fmt)
      .flatMap(c => c.matches)
      .filter(m => {
        if (m.scoreA == null) return false;
        const inA = m.teamA ? m.teamA.includes(playerId) : m.aId === playerId;
        const inB = m.teamB ? m.teamB.includes(playerId) : m.bId === playerId;
        if (!inA && !inB) return false;
        return inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
      }).length;

  const super8Wins = formatWins('super8');
  const ligaWins   = formatWins('liga') + formatWins('grupos');
  const avulsoWins = formatWins('avulso') + formatWins('mata');

  // Hat-trick
  const hatTrick = competitions.some(c => {
    const compWins = c.matches.filter(m => {
      if (m.scoreA == null) return false;
      const inA = m.teamA ? m.teamA.includes(playerId) : m.aId === playerId;
      const inB = m.teamB ? m.teamB.includes(playerId) : m.bId === playerId;
      if (!inA && !inB) return false;
      return inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
    }).length;
    return compWins >= 3;
  });

  // Unbeatable in a month
  const monthMap: Record<string, { w: number; total: number }> = {};
  competitions.forEach(c => {
    const month = c.date?.slice(0, 7) ?? '';
    c.matches.forEach(m => {
      if (m.scoreA == null || !month) return;
      const inA = m.teamA ? m.teamA.includes(playerId) : m.aId === playerId;
      const inB = m.teamB ? m.teamB.includes(playerId) : m.bId === playerId;
      if (!inA && !inB) return;
      if (!monthMap[month]) monthMap[month] = { w: 0, total: 0 };
      monthMap[month].total++;
      const won = inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
      if (won) monthMap[month].w++;
    });
  });
  const unbeatable = Object.values(monthMap).some(r => r.total >= 3 && r.w === r.total);

  // Perfect partner
  const partnerMap: Record<string, { wins: number; played: number }> = {};
  competitions.forEach(c => {
    c.matches.filter(m => m.scoreA != null && m.teamA && m.teamB).forEach(m => {
      const inA = m.teamA!.includes(playerId);
      const inB = m.teamB!.includes(playerId);
      if (!inA && !inB) return;
      const myTeam = inA ? m.teamA! : m.teamB!;
      const partner = myTeam.find(id => id !== playerId);
      if (!partner) return;
      const won = inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
      if (!partnerMap[partner]) partnerMap[partner] = { wins: 0, played: 0 };
      partnerMap[partner].played++;
      if (won) partnerMap[partner].wins++;
    });
  });
  const perfectPartner = Object.values(partnerMap).some(p => p.played >= 5 && p.wins / p.played >= 0.8);

  return {
    totalWins, totalMatches, currentStreak, maxStreak,
    currentRating: 0, // filled by caller with ranking points
    champCount, super8Wins, ligaWins, avulsoWins,
    hatTrick, unbeatable, perfectPartner, sharesCount,
  };
}
