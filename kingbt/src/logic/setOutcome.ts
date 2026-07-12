import type { SetScore, WinRule } from './types';

export type SetOutcome = 'normal' | 'tiebreak' | 'superTiebreak';

export interface DerivedWinRule {
  maxSets: number;
  setsToWin: number;
  gamesWin: number;
  superTb: boolean;
  superTbPts: number;
  tieAt: number;
}

// Mesmos defaults usados ao vivo em ScorerModal.tsx — mantidos aqui para que
// a classificação retroativa bata exatamente com a validação de placar.
export function deriveWinRule(winRule: WinRule | undefined): DerivedWinRule {
  const maxSets    = winRule?.sets ?? 3;
  const setsToWin  = Math.ceil(maxSets / 2);
  const gamesWin   = winRule?.games ?? 6;
  const superTb    = winRule?.superTiebreak ?? true;
  const superTbPts = winRule?.superTiebreakPts ?? 10;
  const tbAt       = winRule?.tiebreakAt ?? 'deuce';
  const tieAt      = tbAt === 'full' ? gamesWin : gamesWin - 1;
  return { maxSets, setsToWin, gamesWin, superTb, superTbPts, tieAt };
}

export function isDecidingSet(setIdx: number, priorSets: SetScore[], rule: DerivedWinRule): boolean {
  if (!rule.superTb) return false;
  if (rule.maxSets <= 1) return false;
  if (setIdx !== rule.maxSets - 1) return false;
  let sA = 0, sB = 0;
  for (const s of priorSets) {
    if (s.a > s.b) sA++;
    else if (s.b > s.a) sB++;
  }
  return sA === rule.setsToWin - 1 && sB === rule.setsToWin - 1;
}

/**
 * Classifica como um set foi decidido, usando só o placar final salvo
 * (Match.sets) e a regra da própria competição (Competition.config.winRule).
 * Funciona retroativamente em qualquer partida já salva — não depende de
 * nenhum metadado novo por set.
 */
export function classifySet(setIdx: number, sets: SetScore[], winRule: WinRule | undefined): SetOutcome {
  const rule = deriveWinRule(winRule);
  const set = sets[setIdx];
  if (!set) return 'normal';

  if (isDecidingSet(setIdx, sets.slice(0, setIdx), rule)) return 'superTiebreak';

  const loserGames = Math.min(set.a, set.b);
  return loserGames === rule.tieAt ? 'tiebreak' : 'normal';
}

/** Um set decisivo foi disputado quando a partida usou todos os sets possíveis (empate até o último). */
export function reachedDecidingSet(sets: SetScore[] | null | undefined, winRule: WinRule | undefined): boolean {
  const rule = deriveWinRule(winRule);
  return (sets?.length ?? 0) === rule.maxSets && rule.maxSets > 1;
}
