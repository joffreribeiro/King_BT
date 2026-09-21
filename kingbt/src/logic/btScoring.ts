import { tieAtGames } from './setOutcome';

export type ScoreState =
  | 'normal'
  | 'advantage'
  | 'tiebreak'
  | 'done'
  | 'invalid';

export interface BtScoreRule {
  games: number;
  tiebreak: number;
  /** Onde o tie-break do set acontece — ver `tieAtGames`. Padrão: 'deuce'. */
  tiebreakAt?: 'deuce' | 'full';
}

const DEFAULT_RULE: BtScoreRule = { games: 6, tiebreak: 7 };

/**
 * Estado de um set a partir do placar de games.
 *
 * Toda a regra sai de `tieAtGames`: o tie-break acontece em T-T e o set termina
 * no máximo em T+1 games. Com `'deuce'` (padrão dos presets) T = G-1, então um
 * set de 4 games vai a 3-3 e fecha em 4-3. Com `'full'` T = G, o set exige 2
 * games de vantagem até G-G e fecha em G+1.
 *
 * Antes esta função assumia sempre `'full'`, ignorando a configuração da
 * competição — por isso discordava do registro manual em todo preset 'deuce'.
 */
export function getBeachTennisScoreState(a: number, b: number, rule: BtScoreRule = DEFAULT_RULE): ScoreState {
  if (a < 0 || b < 0) return 'invalid';
  if (!Number.isInteger(a) || !Number.isInteger(b)) return 'invalid';

  const G = rule.games;
  const T = tieAtGames(G, rule.tiebreakAt);
  const maxGames = T + 1; // maior nº de games que um lado pode ter no set

  const max = Math.max(a, b);
  const min = Math.min(a, b);

  if (max > maxGames) return 'invalid';

  // Set fechado no limite: vencedor do tie-break (T+1 x T) ou, em 'deuce',
  // fechamento direto em G games.
  if (max === maxGames) {
    if (max <= min) return 'invalid';
    // Em 'full', chegar a G+1 exige ter passado por G-(G-1) ou G-G: 7-3 num
    // set de 6 é inalcançável, o set teria fechado em 6-3.
    if (maxGames > G && min < G - 1) return 'invalid';
    return 'done';
  }

  // Fechamento antes do tie-break: alcançou G games com 2 de vantagem.
  // Só existe em 'full' — em 'deuce' G já é o próprio maxGames.
  if (max >= G && max - min >= 2) return 'done';

  // Tie-break em T-T.
  if (a === T && b === T) return 'tiebreak';

  // Em 'full', G x (G-1) ainda não decide: falta a vantagem de 2.
  if (max >= G && max - min === 1) return 'advantage';

  return 'normal';
}

/** Mensagem de feedback para o árbitro. */
export function getScoreHint(a: number, b: number, rule: BtScoreRule = DEFAULT_RULE): string | null {
  const G = rule.games;
  const TB = rule.tiebreak;
  const T = tieAtGames(G, rule.tiebreakAt);
  const state = getBeachTennisScoreState(a, b, rule);
  if (state === 'tiebreak')  return `${T}-${T} — Tie-break! (primeiro a ${TB} pts)`;
  if (state === 'advantage') return `${Math.max(a, b)}-${Math.min(a, b)} — jogue até ${T + 1}`;
  if (state === 'invalid')   return `Placar inválido para o beach tennis`;
  return null;
}

/** True se o placar pode ser salvo como resultado final. */
export function isValidFinalScore(a: number, b: number, rule: BtScoreRule = DEFAULT_RULE): boolean {
  return getBeachTennisScoreState(a, b, rule) === 'done';
}
