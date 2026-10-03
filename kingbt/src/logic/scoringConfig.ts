/**
 * Coeficientes da fórmula de pontuação:
 * Pts = (V×winCoef) + (J×playedCoef) + (GA×gaCoef) + (Eventos×eventCoef).
 * Escolhida na criação do grupo; editável depois pelo admin do grupo.
 * Persistida em /groups/{groupId}/config/scoring no Firestore.
 */
export interface ScoringConfig {
  winCoef: number;
  playedCoef: number;
  gaCoef: number;
  /** Bônus por nº de competições distintas em que o jogador participou (opcional; ausente/0 = sem bônus). */
  eventCoef?: number;
  /**
   * Suavização do GA (valor K) EM VIGOR agora: GA = (GP+K) ÷ (GC+K). 0/ausente = GA puro (GP÷GC).
   * É derivado — calculado de `gaSmoothingPlan` pela temporada atual (ver resolveScoring) — e nunca é gravado.
   */
  gaSmoothing?: number;
  /** Plano gravado: a partir de qual temporada vale qual K. Mudanças só entram na PRÓXIMA temporada. */
  gaSmoothingPlan?: GaStep[];
  /**
   * Mínimo de jogos para entrar na classificação do ranking do grupo. Quem jogou menos fica "em classificação"
   * (aparece abaixo, sem posição). 0 = sem mínimo; ausente = padrão (DEFAULT_MIN_GAMES). Vale na hora, sem esperar temporada.
   */
  minGames?: number;
}

export const MIN_GAMES_MAX = 999;
/** Mínimo de jogos quando o grupo ainda não definiu. */
export const DEFAULT_MIN_GAMES = 5;

/** Mínimo de jogos em vigor: o do grupo se for válido (0 a 999), senão o padrão. */
export function minGamesOf(cfg: Pick<ScoringConfig, 'minGames'> | undefined): number {
  const v = cfg?.minGames;
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MIN_GAMES_MAX ? (v as number) : DEFAULT_MIN_GAMES;
}

/** A partir da temporada `from` (1 = primeira), o GA usa o valor K = `k` (0 = desligado). */
export interface GaStep { from: number; k: number }

export const GA_SMOOTHING_MAX = 20;
/** Valor sugerido ao ligar a suavização. */
export const DEFAULT_GA_SMOOTHING = 4;

/** Lê um plano bruto (Firestore): só passos válidos, em ordem de temporada, um por temporada. */
export function parseGaPlan(raw: unknown): GaStep[] {
  if (!Array.isArray(raw)) return [];
  const byFrom = new Map<number, number>();
  for (const x of raw) {
    const from = (x as GaStep)?.from, k = (x as GaStep)?.k;
    if (Number.isInteger(from) && from >= 1 && Number.isInteger(k) && k >= 0 && k <= GA_SMOOTHING_MAX) byFrom.set(from, k);
  }
  return [...byFrom.entries()].sort((a, b) => a[0] - b[0]).map(([from, k]) => ({ from, k }));
}

/** K em vigor na temporada `season`: o do último passo com from ≤ season (sem passo = 0). */
export function gaSmoothingFor(plan: GaStep[] | undefined, season: number): number {
  let k = 0;
  for (const s of plan ?? []) if (s.from <= season) k = s.k;
  return k;
}

/**
 * Novo plano ao salvar `k`: o que já vale hoje (e o passado) fica; qualquer mudança agendada que
 * ainda não começou é substituída; e se `k` difere do que vale hoje, entra a partir da PRÓXIMA temporada.
 * Com `immediately`, entra já na temporada atual.
 */
export function planWithChange(plan: GaStep[] | undefined, currentSeason: number, k: number, immediately = false): GaStep[] {
  if (immediately) {
    // Vale já na temporada atual: refaz o passo desta temporada (recalcula o ranking de agora; as encerradas não mudam).
    const before = (plan ?? []).filter(s => s.from < currentSeason);
    return k === gaSmoothingFor(before, currentSeason) ? before : [...before, { from: currentSeason, k }];
  }
  const kept = (plan ?? []).filter(s => s.from <= currentSeason);
  if (k === gaSmoothingFor(kept, currentSeason)) return kept;
  return [...kept, { from: currentSeason + 1, k }];
}

/** Config efetiva da temporada: preenche `gaSmoothing` a partir do plano. */
export function resolveScoring(cfg: ScoringConfig, season: number): ScoringConfig {
  return { ...cfg, gaSmoothing: gaSmoothingFor(cfg.gaSmoothingPlan, season) };
}

/** Fórmula padrão histórica: V×3 + J×0,5 + GA×2 (sem bônus de eventos). */
export const DEFAULT_SCORING: ScoringConfig = { winCoef: 3, playedCoef: 0.5, gaCoef: 2, eventCoef: 0 };

/** Coeficientes fora deste intervalo são rejeitados (limite de sanidade). */
const MIN_COEF = 0;
const MAX_COEF = 100;

function isValidCoef(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= MIN_COEF && v <= MAX_COEF;
}

/** eventCoef é opcional — ausente conta como válido (equivale a 0). */
function isValidOptionalCoef(v: unknown): boolean {
  return v === undefined || isValidCoef(v);
}

/**
 * Valida um config bruto (ex.: vindo do Firestore ou de um input). Rejeita
 * NaN, negativos, não-números e valores fora do intervalo; retorna o
 * fallback (DEFAULT_SCORING) se qualquer coeficiente for inválido.
 */
export function validateScoringConfig(
  cfg: unknown,
  fallback: ScoringConfig = DEFAULT_SCORING,
): ScoringConfig {
  if (!cfg || typeof cfg !== 'object') return fallback;
  const c = cfg as Record<string, unknown>;
  if (!isValidCoef(c.winCoef) || !isValidCoef(c.playedCoef) || !isValidCoef(c.gaCoef) || !isValidOptionalCoef(c.eventCoef)) {
    return fallback;
  }
  const plan = parseGaPlan(c.gaSmoothingPlan);
  return {
    winCoef: c.winCoef, playedCoef: c.playedCoef, gaCoef: c.gaCoef,
    eventCoef: (c.eventCoef as number | undefined) ?? 0,
    ...(plan.length ? { gaSmoothingPlan: plan } : {}),
    ...(Number.isInteger(c.minGames) && (c.minGames as number) >= 0 && (c.minGames as number) <= MIN_GAMES_MAX ? { minGames: c.minGames as number } : {}),
  };
}

/** True se todos os coeficientes são válidos (usado na UI antes de salvar). */
export function isScoringConfigValid(cfg: unknown): boolean {
  if (!cfg || typeof cfg !== 'object') return false;
  const c = cfg as Record<string, unknown>;
  return isValidCoef(c.winCoef) && isValidCoef(c.playedCoef) && isValidCoef(c.gaCoef) && isValidOptionalCoef(c.eventCoef);
}

/** Aplica os pontos por vitória escolhidos na criação da competição (config.scoring.winPts) sobre a fórmula do grupo. */
export function withCompetitionScoring(cfg: ScoringConfig, config?: { scoring?: { winPts?: number } }): ScoringConfig {
  const w = config?.scoring?.winPts;
  return typeof w === 'number' && Number.isFinite(w) && w >= 0 ? { ...cfg, winCoef: w } : cfg;
}
