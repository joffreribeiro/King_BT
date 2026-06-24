export type AchievementCategory = 'wins' | 'streak' | 'rating' | 'formats' | 'social' | 'titles';

export interface UserAchievementStats {
  totalWins: number;
  totalMatches: number;
  currentStreak: number;
  maxStreak: number;
  currentRating: number;
  champCount: number;
  super8Wins: number;
  ligaWins: number;
  avulsoWins: number;
  hatTrick: boolean;       // 3+ wins in one competition
  unbeatable: boolean;     // all wins in a month (min 3)
  perfectPartner: boolean; // 80%+ win rate with one partner (min 5)
  sharesCount: number;
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
  category: AchievementCategory;
  /** Returns 0..1 progress toward unlock */
  progress: (s: UserAchievementStats) => number;
  /** Human-readable current/target (e.g. "3/5") */
  progressLabel: (s: UserAchievementStats) => string;
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── Wins ──────────────────────────────────────────────────────────────
  {
    id: 'first_win',
    icon: '⭐',
    title: '1ª Vitória',
    description: 'Vença sua primeira partida',
    color: '#6B7FD7',
    category: 'wins',
    progress: s => Math.min(s.totalWins / 1, 1),
    progressLabel: s => `${Math.min(s.totalWins, 1)}/1`,
  },
  {
    id: 'wins_5',
    icon: '🥈',
    title: '5 Vitórias',
    description: 'Alcance 5 vitórias no total',
    color: '#F3C544',
    category: 'wins',
    progress: s => Math.min(s.totalWins / 5, 1),
    progressLabel: s => `${Math.min(s.totalWins, 5)}/5`,
  },
  {
    id: 'wins_20',
    icon: '🥇',
    title: 'Veterano',
    description: 'Dispute 20 partidas',
    color: '#54B981',
    category: 'wins',
    progress: s => Math.min(s.totalMatches / 20, 1),
    progressLabel: s => `${Math.min(s.totalMatches, 20)}/20`,
  },
  {
    id: 'hat_trick',
    icon: '🎩',
    title: 'Hat-trick',
    description: 'Vença 3 partidas em uma competição',
    color: '#C084FC',
    category: 'wins',
    progress: s => s.hatTrick ? 1 : 0,
    progressLabel: s => s.hatTrick ? '1/1' : '0/1',
  },
  // ── Streak ────────────────────────────────────────────────────────────
  {
    id: 'streak_3',
    icon: '🔥',
    title: 'Em Chamas',
    description: 'Vença 3 partidas seguidas',
    color: '#E5483D',
    category: 'streak',
    progress: s => Math.min(s.currentStreak / 3, 1),
    progressLabel: s => `${Math.min(s.currentStreak, 3)}/3`,
  },
  {
    id: 'streak_5',
    icon: '🔥🔥',
    title: 'Imparável',
    description: 'Vença 5 partidas seguidas',
    color: '#C084FC',
    category: 'streak',
    progress: s => Math.min(s.maxStreak / 5, 1),
    progressLabel: s => `${Math.min(s.maxStreak, 5)}/5`,
  },
  {
    id: 'unbeatable',
    icon: '🛡️',
    title: 'Imbatível do Mês',
    description: 'Vença todas as partidas em um mês (mín. 3)',
    color: '#6B7FD7',
    category: 'streak',
    progress: s => s.unbeatable ? 1 : 0,
    progressLabel: s => s.unbeatable ? '1/1' : '0/1',
  },
  // ── Rating ────────────────────────────────────────────────────────────
  {
    id: 'rating_10',
    icon: '📈',
    title: 'Double Digit',
    description: 'Alcance rating 10.0+',
    color: '#6B7FD7',
    category: 'rating',
    progress: s => Math.min(s.currentRating / 10, 1),
    progressLabel: s => `${s.currentRating.toFixed(1)}/10`,
  },
  {
    id: 'rating_20',
    icon: '🚀',
    title: 'Estratosfera',
    description: 'Alcance rating 20.0+',
    color: '#F3C544',
    category: 'rating',
    progress: s => Math.min(s.currentRating / 20, 1),
    progressLabel: s => `${s.currentRating.toFixed(1)}/20`,
  },
  // ── Titles ────────────────────────────────────────────────────────────
  {
    id: 'champion',
    icon: '👑',
    title: 'Campeão',
    description: 'Conquiste um título em qualquer formato',
    color: '#F3C544',
    category: 'titles',
    progress: s => Math.min(s.champCount / 1, 1),
    progressLabel: s => `${Math.min(s.champCount, 1)}/1`,
  },
  {
    id: 'tri_champion',
    icon: '🔱',
    title: 'Tricampeão',
    description: 'Conquiste 3 títulos',
    color: '#C084FC',
    category: 'titles',
    progress: s => Math.min(s.champCount / 3, 1),
    progressLabel: s => `${Math.min(s.champCount, 3)}/3`,
  },
  // ── Formats ───────────────────────────────────────────────────────────
  {
    id: 'super8_master',
    icon: '◈',
    title: 'Rei do Super 8',
    description: 'Vença 5 partidas no Super 8',
    color: '#C084FC',
    category: 'formats',
    progress: s => Math.min(s.super8Wins / 5, 1),
    progressLabel: s => `${Math.min(s.super8Wins, 5)}/5`,
  },
  {
    id: 'versatil',
    icon: '🎯',
    title: 'Versátil',
    description: 'Vença em 3 formatos diferentes',
    color: '#54B981',
    category: 'formats',
    progress: s => {
      const count = (s.super8Wins >= 1 ? 1 : 0) + (s.ligaWins >= 1 ? 1 : 0) + (s.avulsoWins >= 1 ? 1 : 0);
      return Math.min(count / 3, 1);
    },
    progressLabel: s => {
      const count = (s.super8Wins >= 1 ? 1 : 0) + (s.ligaWins >= 1 ? 1 : 0) + (s.avulsoWins >= 1 ? 1 : 0);
      return `${count}/3`;
    },
  },
  {
    id: 'perfect_partner',
    icon: '🤝',
    title: 'Parceiro Perfeito',
    description: '80%+ de vitórias com um parceiro (mín. 5 jogos)',
    color: '#54B981',
    category: 'formats',
    progress: s => s.perfectPartner ? 1 : 0,
    progressLabel: s => s.perfectPartner ? '1/1' : '0/1',
  },
  // ── Social ────────────────────────────────────────────────────────────
  {
    id: 'influencer',
    icon: '📢',
    title: 'Influenciador',
    description: 'Compartilhe 5 resultados',
    color: '#C084FC',
    category: 'social',
    progress: s => Math.min(s.sharesCount / 5, 1),
    progressLabel: s => `${Math.min(s.sharesCount, 5)}/5`,
  },
];

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  wins:    'Vitórias',
  streak:  'Sequências',
  rating:  'Rating',
  titles:  'Títulos',
  formats: 'Formatos',
  social:  'Social',
};
