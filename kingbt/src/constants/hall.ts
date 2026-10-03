/**
 * As quatro categorias da aba Conquistas do perfil, com nomes do King BT.
 * Cada conquista pertence a uma. Fica separado de constants/achievements.ts
 * (que agrupa por tipo de regra) para ajustar a apresentação sem mexer nelas.
 */
export type HallCategory = 'coroas' | 'insignias' | 'favos' | 'provas';

export const HALL_CATEGORIES: { id: HallCategory; label: string; icon: string; hint: string }[] = [
  { id: 'coroas',    label: 'Coroas',            icon: '👑', hint: 'Resultados em competições: campeão, vice e pódio.' },
  { id: 'insignias', label: 'Insígnias',         icon: '🛡️', hint: 'Reconhecimento da comunidade: avaliações e notas dos colegas.' },
  { id: 'favos',     label: 'Favos',             icon: '🍯', hint: 'Marcos automáticos: partidas, competições e feitos.' },
  { id: 'provas',    label: 'Provas da Rainha',  icon: '⚜️', hint: 'Os feitos mais difíceis do King BT.' },
];

const BY_ID: Record<string, HallCategory> = {
  // Coroas
  champion: 'coroas', bi_champion: 'coroas', tri_champion: 'coroas',
  super8_gold: 'coroas', super8_silver: 'coroas', super8_bronze: 'coroas',
  season_champion: 'coroas', season_runnerup: 'coroas',
  // Insígnias
  influencer: 'insignias', first_rating: 'insignias', ratings_10: 'insignias', hive_shield: 'insignias',
  // Favos
  first_match: 'favos', first_win: 'favos', wins_5: 'favos', wins_20: 'favos', hat_trick: 'favos',
  streak_3: 'favos', streak_5: 'favos', rating_10: 'favos', rating_20: 'favos',
  first_podium: 'favos', events_10: 'favos', events_25: 'favos', events_50: 'favos',
  hive_sealed: 'favos', saldo_king: 'favos', versatil: 'favos', perfect_partner: 'favos', super8_master: 'favos',
  // Provas da Rainha
  streak_10: 'provas', triple_crown: 'provas', radar_gold: 'provas', unbeatable: 'provas',
};

/** Conquista sem categoria definida cai em "Favos". */
export function hallCategoryOf(achievementId: string): HallCategory {
  return BY_ID[achievementId] ?? 'favos';
}
