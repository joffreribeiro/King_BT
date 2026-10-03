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
  // ── Extras (Coroas, Favos, Insígnias e Provas). Opcionais: quem monta as
  // estatísticas sem eles continua funcionando, e valem 0.
  /** Competições disputadas (fora amistosos). */
  events?: number;
  super8Gold?: number;
  super8Silver?: number;
  super8Bronze?: number;
  /** Top 3 em Super 8 + títulos nas outras competições. */
  podiums?: number;
  /** Maior sequência de títulos seguidos. */
  titleStreakMax?: number;
  invictos?: number;
  saldoKing?: number;
  /** Quantos colegas este jogador já avaliou no Radar. */
  ratingsGiven?: number;
  /** Quantas pessoas avaliaram este jogador. */
  communityCount?: number;
  /** Menor média entre as 10 habilidades na avaliação da comunidade (0 sem avaliações). */
  communityMin?: number;
  /** Temporadas encerradas em que terminou em 1º. */
  seasonTitles?: number;
  /** Temporadas encerradas em que terminou em 2º. */
  seasonRunnerUps?: number;
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

  // ══ Novas: Coroas, Insígnias, Favos e Provas da Rainha ════════════════
  // ── Coroas (resultados em competições) ────────────────────────────────
  {
    id: 'super8_gold',
    icon: '👑',
    title: 'Coroa do Super 8',
    description: 'Termine em 1º lugar em um Super 8',
    color: '#F3C544',
    category: 'titles',
    progress: s => Math.min((s.super8Gold ?? 0) / 1, 1),
    progressLabel: s => `${Math.min(s.super8Gold ?? 0, 1)}/1`,
  },
  {
    id: 'super8_silver',
    icon: '🥈',
    title: 'Ferrão de Prata',
    description: 'Termine em 2º lugar em um Super 8',
    color: '#9CA3AF',
    category: 'titles',
    progress: s => Math.min((s.super8Silver ?? 0) / 1, 1),
    progressLabel: s => `${Math.min(s.super8Silver ?? 0, 1)}/1`,
  },
  {
    id: 'super8_bronze',
    icon: '🥉',
    title: 'Ferrão de Bronze',
    description: 'Termine em 3º lugar em um Super 8',
    color: '#C2891A',
    category: 'titles',
    progress: s => Math.min((s.super8Bronze ?? 0) / 1, 1),
    progressLabel: s => `${Math.min(s.super8Bronze ?? 0, 1)}/1`,
  },
  {
    id: 'bi_champion',
    icon: '🏆',
    title: 'Bicampeão',
    description: 'Conquiste 2 títulos',
    color: '#F3C544',
    category: 'titles',
    progress: s => Math.min(s.champCount / 2, 1),
    progressLabel: s => `${Math.min(s.champCount, 2)}/2`,
  },
  // ── Insígnias (a comunidade) ──────────────────────────────────────────
  {
    id: 'first_rating',
    icon: '👁️',
    title: 'Primeiro Olhar',
    description: 'Avalie um colega pela primeira vez',
    color: '#54B981',
    category: 'social',
    progress: s => Math.min((s.ratingsGiven ?? 0) / 1, 1),
    progressLabel: s => `${Math.min(s.ratingsGiven ?? 0, 1)}/1`,
  },
  {
    id: 'ratings_10',
    icon: '🔍',
    title: 'Olho de Vespa',
    description: 'Avalie 10 colegas',
    color: '#54B981',
    category: 'social',
    progress: s => Math.min((s.ratingsGiven ?? 0) / 10, 1),
    progressLabel: s => `${Math.min(s.ratingsGiven ?? 0, 10)}/10`,
  },
  {
    id: 'hive_shield',
    icon: '🛡️',
    title: 'Escudo da Colmeia',
    description: 'Todas as habilidades da avaliação com nota da comunidade ≥ 7,0 (mín. 3 avaliações)',
    color: '#C084FC',
    category: 'social',
    progress: s => (s.communityCount ?? 0) < 3 ? 0 : Math.min((s.communityMin ?? 0) / 7, 1),
    progressLabel: s => (s.communityCount ?? 0) < 3
      ? `${s.communityCount ?? 0}/3 avaliações`
      : `menor nota ${(s.communityMin ?? 0).toFixed(1).replace('.', ',')}/7`,
  },
  // ── Favos (marcos automáticos) ────────────────────────────────────────
  {
    id: 'first_match',
    icon: '🐝',
    title: 'Primeira Ferroada',
    description: 'Dispute sua primeira partida',
    color: '#6B7FD7',
    category: 'wins',
    progress: s => Math.min(s.totalMatches / 1, 1),
    progressLabel: s => `${Math.min(s.totalMatches, 1)}/1`,
  },
  {
    id: 'first_podium',
    icon: '🏅',
    title: 'Pódio da Colmeia',
    description: 'Termine entre os 3 primeiros de uma competição pela primeira vez',
    color: '#54B981',
    category: 'titles',
    progress: s => Math.min((s.podiums ?? 0) / 1, 1),
    progressLabel: s => `${Math.min(s.podiums ?? 0, 1)}/1`,
  },
  {
    id: 'events_10',
    icon: '🐝',
    title: 'Enxame',
    description: 'Dispute 10 competições',
    color: '#54B981',
    category: 'wins',
    progress: s => Math.min((s.events ?? 0) / 10, 1),
    progressLabel: s => `${Math.min(s.events ?? 0, 10)}/10`,
  },
  {
    id: 'events_25',
    icon: '🐝',
    title: 'Grande Enxame',
    description: 'Dispute 25 competições',
    color: '#5AA9FF',
    category: 'wins',
    progress: s => Math.min((s.events ?? 0) / 25, 1),
    progressLabel: s => `${Math.min(s.events ?? 0, 25)}/25`,
  },
  {
    id: 'events_50',
    icon: '🐝',
    title: 'Enxame Lendário',
    description: 'Dispute 50 competições',
    color: '#C084FC',
    category: 'wins',
    progress: s => Math.min((s.events ?? 0) / 50, 1),
    progressLabel: s => `${Math.min(s.events ?? 0, 50)}/50`,
  },
  {
    id: 'hive_sealed',
    icon: '🍯',
    title: 'Colmeia Blindada',
    description: 'Termine uma competição sem nenhuma derrota (mín. 3 jogos)',
    color: '#C084FC',
    category: 'streak',
    progress: s => Math.min((s.invictos ?? 0) / 1, 1),
    progressLabel: s => `${Math.min(s.invictos ?? 0, 1)}/1`,
  },
  {
    id: 'saldo_king',
    icon: '📈',
    title: 'Rei do Saldo',
    description: 'Tenha o melhor saldo de games de uma competição (mín. 3 jogos)',
    color: '#5AA9FF',
    category: 'rating',
    progress: s => Math.min((s.saldoKing ?? 0) / 1, 1),
    progressLabel: s => `${Math.min(s.saldoKing ?? 0, 1)}/1`,
  },
  // ── Provas da Rainha (os feitos mais difíceis) ────────────────────────
  {
    id: 'streak_10',
    icon: '⚡',
    title: 'Fúria da Vespa',
    description: 'Vença 10 partidas seguidas',
    color: '#F3C544',
    category: 'streak',
    progress: s => Math.min(s.maxStreak / 10, 1),
    progressLabel: s => `${Math.min(s.maxStreak, 10)}/10`,
  },
  {
    id: 'triple_crown',
    icon: '👑',
    title: 'Coroa Tripla',
    description: 'Seja campeão de 3 competições seguidas',
    color: '#FF8A3D',
    category: 'titles',
    progress: s => Math.min((s.titleStreakMax ?? 0) / 3, 1),
    progressLabel: s => `${Math.min(s.titleStreakMax ?? 0, 3)}/3`,
  },
  {
    id: 'radar_gold',
    icon: '✨',
    title: 'Ferrão de Ouro',
    description: 'Todas as habilidades da avaliação com nota da comunidade ≥ 9,0 (mín. 3 avaliações)',
    color: '#F3C544',
    category: 'social',
    progress: s => (s.communityCount ?? 0) < 3 ? 0 : Math.min((s.communityMin ?? 0) / 9, 1),
    progressLabel: s => (s.communityCount ?? 0) < 3
      ? `${s.communityCount ?? 0}/3 avaliações`
      : `menor nota ${(s.communityMin ?? 0).toFixed(1).replace('.', ',')}/9`,
  },
  {
    id: 'season_champion',
    icon: '🏆',
    title: 'Rei da Colmeia',
    description: 'Termine uma temporada em 1º lugar no ranking',
    color: '#F3C544',
    category: 'titles',
    progress: s => Math.min((s.seasonTitles ?? 0) / 1, 1),
    progressLabel: s => `${Math.min(s.seasonTitles ?? 0, 1)}/1`,
  },
  {
    id: 'season_runnerup',
    icon: '🥈',
    title: 'Vice da Colmeia',
    description: 'Termine uma temporada em 2º lugar no ranking',
    color: '#C0C7D1',
    category: 'titles',
    progress: s => Math.min((s.seasonRunnerUps ?? 0) / 1, 1),
    progressLabel: s => `${Math.min(s.seasonRunnerUps ?? 0, 1)}/1`,
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
