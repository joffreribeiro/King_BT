/**
 * Coeficientes da fórmula de pontuação: Pts = (V×winCoef) + (J×playedCoef) + (GA×gaCoef).
 * Editável só pelo Super Admin; persistido em /config/scoring no Firestore.
 */
export interface ScoringConfig {
  winCoef: number;
  playedCoef: number;
  gaCoef: number;
}

/** Fórmula padrão histórica: V×3 + J×0,5 + GA×2. */
export const DEFAULT_SCORING: ScoringConfig = { winCoef: 3, playedCoef: 0.5, gaCoef: 2 };

/** Coeficientes fora deste intervalo são rejeitados (limite de sanidade). */
const MIN_COEF = 0;
const MAX_COEF = 100;

function isValidCoef(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= MIN_COEF && v <= MAX_COEF;
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
  if (!isValidCoef(c.winCoef) || !isValidCoef(c.playedCoef) || !isValidCoef(c.gaCoef)) {
    return fallback;
  }
  return { winCoef: c.winCoef, playedCoef: c.playedCoef, gaCoef: c.gaCoef };
}

/** True se todos os coeficientes são válidos (usado na UI antes de salvar). */
export function isScoringConfigValid(cfg: unknown): boolean {
  if (!cfg || typeof cfg !== 'object') return false;
  const c = cfg as Record<string, unknown>;
  return isValidCoef(c.winCoef) && isValidCoef(c.playedCoef) && isValidCoef(c.gaCoef);
}
