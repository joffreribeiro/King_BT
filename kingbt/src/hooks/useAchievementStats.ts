import { useMemo } from 'react';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useSettings } from '@/store/SettingsContext';
import { useRatings } from './useRatings';
import { computeAchievementStats } from '@/logic/achievementStats';
import { seasonPlacements } from '@/logic/seasons';
import { communityAverage, SKILLS } from '@/logic/skills';
import type { UserAchievementStats } from '@/constants/achievements';

/**
 * Estatísticas das conquistas de um jogador: as das competições + as da
 * comunidade (quantos colegas ele avaliou e a nota que os colegas deram a ele).
 * Sem avaliações lidas (ou regra ainda não publicada), as conquistas da
 * comunidade ficam em 0 e o resto funciona normalmente.
 */
export function useAchievementStats(playerId: string | undefined, points: number, ratedCount: number): UserAchievementStats {
  const { state } = useCompetitions();
  const { scoringConfig, seasons } = useSettings();
  const { ratings } = useRatings(playerId);

  return useMemo(() => {
    const { avg, count } = communityAverage(ratings.map(r => r.skills));
    const communityMin = avg ? Math.min(...SKILLS.map(sk => avg[sk.key])) : 0;
    const placements = seasonPlacements(seasons, playerId ?? '');
    const base = computeAchievementStats(state.competitions, playerId ?? '', 0, scoringConfig, {
      ratingsGiven: ratedCount, communityCount: count, communityMin,
      seasonTitles: placements.titles, seasonRunnerUps: placements.runnerUps,
    });
    return { ...base, currentRating: points };
  }, [state.competitions, playerId, scoringConfig, seasons, ratings, points, ratedCount]);
}
