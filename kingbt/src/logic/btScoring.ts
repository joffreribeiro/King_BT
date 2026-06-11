export type ScoreState =
  | 'normal'
  | 'advantage'
  | 'tiebreak'
  | 'done'
  | 'invalid';

/**
 * Retorna o estado atual do placar em um set de beach tennis.
 * Regras: primeiro a 6 (win by 2), 5-5 → 7-5, 6-6 → tie-break (7 pts, win by 2)
 */
export function getBeachTennisScoreState(a: number, b: number): ScoreState {
  if (a < 0 || b < 0) return 'invalid';

  const max = Math.max(a, b);
  const min = Math.min(a, b);

  // Scores finais válidos
  if (max === 6 && min <= 4) return 'done';     // 6-0 … 6-4
  if (max === 7 && min === 5) return 'done';     // 7-5
  if (max === 7 && min === 6) return 'done';     // 7-6 (tie-break)

  // Estados intermediários
  if (a === 5 && b === 5) return 'advantage';   // jogar até 7
  if (a === 6 && b === 6) return 'tiebreak';    // ir para tie-break
  if (max === 6 && min === 5) return 'advantage'; // 6-5 ainda não é fim (5-5 evoluiu)

  // Em andamento normal
  if (max < 6) return 'normal';

  return 'invalid';
}

/** Mensagem de feedback para o árbitro. */
export function getScoreHint(a: number, b: number): string | null {
  const state = getBeachTennisScoreState(a, b);
  if (state === 'advantage') return `Empate em 5-5 — jogue até 7`;
  if (state === 'tiebreak')  return `6-6 — Tie-break! (primeiro a 7 pts)`;
  if (state === 'invalid')   return `Placar inválido para o beach tennis`;
  return null;
}

/** True se o placar pode ser salvo como resultado final. */
export function isValidFinalScore(a: number, b: number): boolean {
  return getBeachTennisScoreState(a, b) === 'done';
}
