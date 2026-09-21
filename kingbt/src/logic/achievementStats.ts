import type { Competition } from './types';
import { computeStreakHistory } from './streak';
import type { UserAchievementStats } from '@/constants/achievements';
import { DEFAULT_SCORING, type ScoringConfig } from './scoringConfig';
import {
  computeChampCount, computeHatTrick, computeUnbeatableMonth,
  computePerfectPartner, computeFormatWins,
} from './playerAchievements';

export function computeAchievementStats(
  competitions: Competition[],
  playerId: string,
  sharesCount = 0,
  cfg: ScoringConfig = DEFAULT_SCORING,
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

  const champCount = computeChampCount(competitions, playerId, cfg, id => id);
  const super8Wins = computeFormatWins(competitions, playerId, ['super8']);
  const ligaWins   = computeFormatWins(competitions, playerId, ['liga', 'grupos']);
  const avulsoWins = computeFormatWins(competitions, playerId, ['avulso', 'mata']);
  const hatTrick = computeHatTrick(competitions, playerId);
  const unbeatable = computeUnbeatableMonth(competitions, playerId);
  const perfectPartner = computePerfectPartner(competitions, playerId);

  return {
    totalWins, totalMatches, currentStreak, maxStreak,
    currentRating: 0, // filled by caller with ranking points
    champCount, super8Wins, ligaWins, avulsoWins,
    hatTrick, unbeatable, perfectPartner, sharesCount,
  };
}
