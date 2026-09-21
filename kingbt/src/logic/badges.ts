import type { Competition } from './types';
import { DEFAULT_SCORING, type ScoringConfig } from './scoringConfig';
import {
  matchesOf, computeChampCount, computeMaxStreak,
  computeHatTrick, computeUnbeatableMonth, computePerfectPartner,
} from './playerAchievements';

export type Badge = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  unlocked: boolean;
};

export function computeBadges(
  playerId: string,
  competitions: Competition[],
  nameOf?: (id: string) => string,
  cfg: ScoringConfig = DEFAULT_SCORING,
): Badge[] {
  const myMatches = matchesOf(competitions, playerId);
  const wins = myMatches.filter(m => {
    const inA = m.teamA ? m.teamA.includes(playerId) : m.aId === playerId;
    return inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
  });

  const champCount = computeChampCount(competitions, playerId, cfg, nameOf);
  const maxStreak = computeMaxStreak(myMatches, playerId);
  const hasHatTrick = computeHatTrick(competitions, playerId);
  const unbeatable = computeUnbeatableMonth(competitions, playerId);
  const perfectPartner = computePerfectPartner(competitions, playerId);

  return [
    {
      id: 'first_win',
      emoji: '🏆',
      name: 'Primeira Vitória',
      description: 'Vença sua primeira partida',
      unlocked: wins.length >= 1,
    },
    {
      id: 'champion',
      emoji: '👑',
      name: 'Campeão',
      description: 'Conquiste um título',
      unlocked: champCount >= 1,
    },
    {
      id: 'tri_champion',
      emoji: '🔱',
      name: 'Tricampeão',
      description: 'Conquiste 3 títulos',
      unlocked: champCount >= 3,
    },
    {
      id: 'streak_5',
      emoji: '🔥',
      name: '5 Seguidas',
      description: 'Vença 5 partidas consecutivas',
      unlocked: maxStreak >= 5,
    },
    {
      id: 'hat_trick',
      emoji: '🎩',
      name: 'Hat-trick',
      description: 'Vença 3 partidas em uma competição',
      unlocked: hasHatTrick,
    },
    {
      id: 'unbeatable',
      emoji: '🛡️',
      name: 'Imbatível do Mês',
      description: 'Vença todas as partidas em um mês (mín. 3)',
      unlocked: unbeatable,
    },
    {
      id: 'perfect_partner',
      emoji: '🤝',
      name: 'Parceiro Perfeito',
      description: '80%+ de vitórias com um parceiro (mín. 5 jogos)',
      unlocked: perfectPartner,
    },
    {
      id: 'veteran',
      emoji: '⭐',
      name: 'Veterano',
      description: 'Dispute 20 partidas',
      unlocked: myMatches.length >= 20,
    },
  ];
}
