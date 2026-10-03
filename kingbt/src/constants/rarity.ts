/**
 * Raridade das conquistas, pela dificuldade de conseguir. Fica aqui, separada da
 * lista de conquistas, para ajustar sem mexer nas regras de cada uma.
 */
export type Rarity = 'comum' | 'incomum' | 'rara' | 'epica' | 'lendaria' | 'mitica';

export const RARITY_ORDER: Rarity[] = ['comum', 'incomum', 'rara', 'epica', 'lendaria', 'mitica'];

export const RARITY_LABEL: Record<Rarity, string> = {
  comum: 'Comum', incomum: 'Incomum', rara: 'Rara', epica: 'Épica', lendaria: 'Lendária', mitica: 'Mítica',
};

/** Cor de cada raridade (rara azul e épica roxa, como no feed). */
export const RARITY_COLOR: Record<Rarity, string> = {
  comum: '#9CA3AF', incomum: '#54B981', rara: '#5AA9FF', epica: '#C084FC', lendaria: '#FF8A3D', mitica: '#F3C544',
};

const BY_ID: Record<string, Rarity> = {
  // ── já existiam ──
  first_win: 'comum', wins_5: 'comum', hat_trick: 'comum', influencer: 'comum',
  wins_20: 'rara', streak_3: 'rara', rating_10: 'rara', champion: 'rara', versatil: 'rara',
  streak_5: 'epica', rating_20: 'epica', super8_master: 'epica', perfect_partner: 'epica', tri_champion: 'epica',
  unbeatable: 'mitica',
  // ── Coroas ──
  super8_bronze: 'comum', super8_silver: 'incomum', super8_gold: 'rara', bi_champion: 'rara',
  // ── Insígnias ──
  first_rating: 'comum', ratings_10: 'incomum', hive_shield: 'epica',
  // ── Favos ──
  first_match: 'comum', first_podium: 'incomum', events_10: 'incomum', events_25: 'rara', events_50: 'epica',
  hive_sealed: 'epica', saldo_king: 'rara',
  // ── Provas da Rainha ──
  triple_crown: 'lendaria', streak_10: 'mitica', radar_gold: 'mitica',
  // ── Temporada ──
  season_champion: 'lendaria', season_runnerup: 'epica',
};

/** Conquista sem raridade definida (nova) cai em "comum". */
export function rarityOf(achievementId: string): Rarity {
  return BY_ID[achievementId] ?? 'comum';
}
