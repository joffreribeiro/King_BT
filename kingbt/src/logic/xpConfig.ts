import { ACHIEVEMENTS, type UserAchievementStats } from '@/constants/achievements';
import { rarityOf, RARITY_ORDER, type Rarity } from '@/constants/rarity';

/**
 * Quanto XP cada ação rende (o admin do grupo pode ajustar). O XP decide o
 * nível do jogador — ver logic/playerLevel. Valores inteiros de 0 a 999.
 */
export interface XpConfig {
  /** Por jogo disputado. */
  game: number;
  /** Por vitória (somado ao XP de disputar o jogo). */
  win: number;
  /** Por competição disputada. */
  event: number;
  /** Por colega avaliado no Radar. */
  rating: number;
  /** Por honraria recebida do admin. */
  honor: number;
  /** Por conquista desbloqueada, conforme a raridade dela. */
  rarity: Record<Rarity, number>;
}

export const DEFAULT_XP_CONFIG: XpConfig = {
  game: 1,
  win: 1,
  event: 3,
  rating: 2,
  honor: 5,
  rarity: { comum: 1, incomum: 3, rara: 6, epica: 12, lendaria: 25, mitica: 40 },
};

const MAX_XP = 999;

const clean = (v: unknown, d: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_XP ? Math.round(v) : d;

/** Lê um XpConfig bruto (Firestore ou formulário): campo ausente ou inválido volta ao padrão, sem derrubar o resto. */
export function validateXpConfig(raw: unknown): XpConfig {
  const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const r = c.rarity && typeof c.rarity === 'object' ? (c.rarity as Record<string, unknown>) : {};
  const D = DEFAULT_XP_CONFIG;
  return {
    game: clean(c.game, D.game),
    win: clean(c.win, D.win),
    event: clean(c.event, D.event),
    rating: clean(c.rating, D.rating),
    honor: clean(c.honor, D.honor),
    rarity: Object.fromEntries(RARITY_ORDER.map(k => [k, clean(r[k], D.rarity[k])])) as Record<Rarity, number>,
  };
}

/** XP somado pelas conquistas já desbloqueadas (progresso completo), cada uma pela sua raridade. */
export function achievementXp(stats: UserAchievementStats, cfg: XpConfig = DEFAULT_XP_CONFIG): { xp: number; unlocked: number } {
  let xp = 0, unlocked = 0;
  for (const a of ACHIEVEMENTS) {
    if (a.progress(stats) >= 1) { xp += cfg.rarity[rarityOf(a.id)]; unlocked++; }
  }
  return { xp, unlocked };
}
