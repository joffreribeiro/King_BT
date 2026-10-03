import { useMemo } from 'react';
import { useRatings } from './useRatings';
import { communityAverage, skillAverage, type Skills } from '@/logic/skills';
import { playerXp, type PlayerXp } from '@/logic/playerLevel';
import { achievementXp } from '@/logic/xpConfig';
import { useAchievementStats } from './useAchievementStats';
import { useSettings } from '@/store/SettingsContext';
import { honorsOf } from '@/logic/honors';

/**
 * XP do jogador: jogos, vitórias, competições, colegas avaliados, conquistas
 * (pela raridade) e o bônus do Radar — cada um pelo valor que o grupo definiu.
 * A média dos colegas entra quando as avaliações existem e podem ser lidas; se a
 * leitura for recusada (regra ainda não publicada) ou ninguém avaliou, vale só a
 * autoavaliação.
 */
export function usePlayerXp(
  playerId: string | undefined, gamesPlayed: number, self?: Skills,
  points = 0, ratedCount = 0,
): PlayerXp & { unlocked: number; counts: { played: number; wins: number; events: number; rated: number; honors: number } } {
  const { ratings } = useRatings(playerId);
  const { xpConfig, honors } = useSettings();
  const honorCount = playerId ? honorsOf(honors, playerId).length : 0;
  const stats = useAchievementStats(playerId, points, ratedCount);
  return useMemo(() => {
    const { avg } = communityAverage(ratings.map(r => r.skills));
    const communityAvg = avg ? skillAverage(avg) : null;
    const ach = achievementXp(stats, xpConfig);
    const xp = playerXp(
      gamesPlayed, self, communityAvg,
      { wins: stats.totalWins, events: stats.events ?? 0, rated: ratedCount, honors: honorCount, achievementXp: ach.xp },
      xpConfig,
    );
    return { ...xp, unlocked: ach.unlocked, counts: { played: gamesPlayed, wins: stats.totalWins, events: stats.events ?? 0, rated: ratedCount, honors: honorCount } };
  }, [ratings, gamesPlayed, self, stats, xpConfig, ratedCount, honorCount]);
}
