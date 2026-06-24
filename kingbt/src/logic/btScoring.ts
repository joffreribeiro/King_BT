export type ScoreState =
  | 'normal'
  | 'advantage'
  | 'tiebreak'
  | 'done'
  | 'invalid';

export interface BtScoreRule {
  games: number;
  tiebreak: number;
}

const DEFAULT_RULE: BtScoreRule = { games: 6, tiebreak: 7 };

/**
 * Retorna o estado atual do placar em um set de beach tennis.
 * Regras: primeiro a G (win by 2), (G-1)-(G-1) → G+1, G-G → tie-break (TB pts, win by 2)
 */
export function getBeachTennisScoreState(a: number, b: number, rule: BtScoreRule = DEFAULT_RULE): ScoreState {
  if (a < 0 || b < 0) return 'invalid';

  const G = rule.games;
  const max = Math.max(a, b);
  const min = Math.min(a, b);

  // Scores finais válidos
  if (max === G && min <= G - 2) return 'done';         // G-0 … G-(G-2)  ex: 4-0..4-2, 6-0..6-4
  if (max === G + 1 && min === G - 1) return 'done';   // (G+1)-(G-1)    ex: 5-3, 7-5
  if (max === G + 1 && min === G) return 'done';        // tiebreak ganho ex: 5-4, 7-6

  // Estados intermediários
  if (a === G - 1 && b === G - 1) return 'advantage';  // (G-1)-(G-1) → jogue até G+1  ex: 3-3, 5-5
  if (a === G && b === G) return 'tiebreak';            // G-G → tie-break               ex: 4-4, 6-6
  if (max === G && min === G - 1) return 'advantage';   // G-(G-1) → ainda não é fim     ex: 4-3, 6-5

  // Em andamento normal
  if (max < G) return 'normal';

  return 'invalid';
}

/** Mensagem de feedback para o árbitro. */
export function getScoreHint(a: number, b: number, rule: BtScoreRule = DEFAULT_RULE): string | null {
  const G = rule.games;
  const TB = rule.tiebreak;
  const state = getBeachTennisScoreState(a, b, rule);
  if (state === 'advantage') return `Empate em ${G - 1}-${G - 1} — jogue até ${G + 1}`;
  if (state === 'tiebreak')  return `${G}-${G} — Tie-break! (primeiro a ${TB} pts)`;
  if (state === 'invalid')   return `Placar inválido para o beach tennis`;
  return null;
}

/** True se o placar pode ser salvo como resultado final. */
export function isValidFinalScore(a: number, b: number, rule: BtScoreRule = DEFAULT_RULE): boolean {
  return getBeachTennisScoreState(a, b, rule) === 'done';
}
