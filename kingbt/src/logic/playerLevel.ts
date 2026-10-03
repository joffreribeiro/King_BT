import { skillAverage, type Skills } from './skills';
import { DEFAULT_XP_CONFIG, type XpConfig } from './xpConfig';

/**
 * Nível do jogador, por experiência (XP): jogos disputados, vitórias, competições,
 * colegas avaliados, conquistas (por raridade) e um bônus pela nota do Radar
 * (autoavaliação, e a média dos colegas quando existir). Todo mundo sobe
 * jogando; quem vence, participa e se envolve sobe mais rápido. Quanto cada
 * ação vale está em XpConfig (o admin do grupo ajusta). Nomes e faixas ficam aqui, num lugar só, para ajustar sem mexer nas telas.
 */
export const LEVELS = [
  { name: 'Zangão I',      min: 0 },
  { name: 'Zangão II',     min: 5 },
  { name: 'Zangão III',    min: 10 },
  { name: 'Operária I',    min: 15 },
  { name: 'Operária II',   min: 25 },
  { name: 'Operária III',  min: 35 },
  { name: 'Guerreira I',   min: 50 },
  { name: 'Guerreira II',  min: 70 },
  { name: 'Guerreira III', min: 95 },
  { name: 'Caçadora I',    min: 120 },
  { name: 'Caçadora II',   min: 160 },
  { name: 'Caçadora III',  min: 210 },
  { name: 'Rainha I',      min: 300 },
  { name: 'Rainha II',     min: 450 },
  { name: 'Rainha III',    min: 700 },
] as const;

/** Cada ponto de média do Radar acima de 1 vale este tanto de XP (média 10 = 45 XP, média 5 = 20 XP). */
export const XP_PER_RADAR_POINT = 5;

/** O que, além dos jogos, entra na conta do XP. Tudo opcional: ausente vale 0. */
export interface XpExtras {
  wins?: number;
  /** Competições disputadas. */
  events?: number;
  /** Colegas que o jogador avaliou no Radar. */
  rated?: number;
  /** Honrarias recebidas do admin. */
  honors?: number;
  /** XP já somado das conquistas desbloqueadas (ver achievementXp). */
  achievementXp?: number;
}

export interface PlayerXp {
  xp: number;
  /** XP vindo dos jogos disputados. */
  games: number;
  /** XP por vitórias. */
  winsXp: number;
  /** XP por competições disputadas. */
  eventsXp: number;
  /** XP por colegas avaliados. */
  ratingXp: number;
  /** XP por honrarias recebidas. */
  honorsXp: number;
  /** XP das conquistas desbloqueadas. */
  achievementsXp: number;
  /** XP vindo do Radar. 0 se ninguém avaliou ainda. */
  bonus: number;
  /** Média do Radar usada no bônus, ou null. */
  radarAvg: number | null;
}

/**
 * XP = jogos + bônus do Radar. Média do Radar: a autoavaliação e a média dos
 * colegas, meio a meio (só a que existir, se faltar uma). Sem nenhuma nota
 * salva o bônus é 0 — o "5 em tudo" padrão não conta como avaliação.
 */
export function playerXp(
  gamesPlayed: number, self?: Skills, communityAvg?: number | null,
  extras: XpExtras = {}, cfg: XpConfig = DEFAULT_XP_CONFIG,
): PlayerXp {
  const n = (v: number | undefined) => Math.max(0, Math.floor(Number.isFinite(v as number) ? (v as number) : 0));
  const played = n(gamesPlayed);
  const games = played * cfg.game;
  const winsXp = n(extras.wins) * cfg.win;
  const eventsXp = n(extras.events) * cfg.event;
  const ratingXp = n(extras.rated) * cfg.rating;
  const honorsXp = n(extras.honors) * cfg.honor;
  const achievementsXp = n(extras.achievementXp);
  const selfAvg = skillAverage(self);
  const parts = [selfAvg, communityAvg ?? null].filter((v): v is number => v != null);
  const radarAvg = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
  const bonus = radarAvg != null ? Math.max(0, Math.round((radarAvg - 1) * XP_PER_RADAR_POINT)) : 0;
  return { xp: games + winsXp + eventsXp + ratingXp + honorsXp + achievementsXp + bonus, games, winsXp, eventsXp, ratingXp, honorsXp, achievementsXp, bonus, radarAvg: radarAvg != null ? Math.round(radarAvg * 10) / 10 : null };
}

export interface PlayerLevel {
  name: string;
  /** Posição na lista (0 = primeiro nível). */
  index: number;
  /** Próximo nível, ou null se já está no último. */
  next: { name: string; min: number } | null;
  /** Progresso dentro do nível atual, de 0 a 1 (1 no nível máximo). */
  progress: number;
  /** XP que faltam para o próximo nível (0 no nível máximo). */
  remaining: number;
}

export interface LevelRow {
  name: string;
  /** XP necessário para entrar neste nível. */
  min: number;
  /** Faixa do nome ("Zangão", "Rainha"...). */
  tier: string;
  status: 'reached' | 'current' | 'locked';
  /** XP que ainda faltam para chegar aqui (0 se já alcançou). */
  remaining: number;
}

/** Todos os níveis com o estado de cada um para um jogador com este XP. */
export function levelRows(xp: number): LevelRow[] {
  const cur = playerLevel(xp).index;
  const v = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  return LEVELS.map((l, i) => ({
    name: l.name,
    min: l.min,
    tier: l.name.split(' ')[0],
    status: i < cur ? 'reached' : i === cur ? 'current' : 'locked',
    remaining: Math.max(0, l.min - v),
  }));
}

/** Nível a partir do XP (ver `playerXp`). */
export function playerLevel(xp: number): PlayerLevel {
  const v = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (v >= LEVELS[i].min) index = i;
  const cur = LEVELS[index];
  const nxt = LEVELS[index + 1] ?? null;
  if (!nxt) return { name: cur.name, index, next: null, progress: 1, remaining: 0 };
  return {
    name: cur.name,
    index,
    next: { name: nxt.name, min: nxt.min },
    progress: (v - cur.min) / (nxt.min - cur.min),
    remaining: nxt.min - v,
  };
}
