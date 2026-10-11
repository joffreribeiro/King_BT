import type { Match, SetScore, WinRule } from './types';

export type SetOutcome = 'normal' | 'tiebreak' | 'superTiebreak';

export interface DerivedWinRule {
  maxSets: number;
  setsToWin: number;
  gamesWin: number;
  superTb: boolean;
  superTbPts: number;
  tieAt: number;
  /** Modo do tie-break da regra (padrão 'deuce'). */
  tieMode: TiebreakAt;
}

// Mesmos defaults usados ao vivo em ScorerModal.tsx — mantidos aqui para que
// a classificação retroativa bata exatamente com a validação de placar.
/**
 * Placar de games em que o tie-break do set acontece, e a partir dele todo o
 * resto da regra de set: o set termina no máximo em `tieAtGames + 1` games.
 *
 * - `'deuce'` (padrão): tie-break em (G-1)-(G-1); quem vence fecha em G.
 *   É o que dizem os presets — "4 games, tie 7 em 3-3", "6 games, tie em 5-5".
 * - `'full'`: tie-break em G-G, ao estilo do tênis; quem vence fecha em G+1,
 *   e antes disso o set exige 2 games de vantagem ("4 games, tie em 4-4").
 *
 * Os três motores de placar do app (validação em btScoring, marcação ao vivo
 * em btTracker e registro manual no ScorerModal) derivam o ponto de tie-break
 * daqui — antes cada um tinha o seu, e só o registro manual olhava a
 * configuração da competição.
 *
 * `'deuce'` É a regra real que o grupo joga (confirmado com o usuário em
 * 20/09/2026): em 5-5 (set de 6 games) já entra o tie-break, o set nunca
 * passa de 6 games para o vencedor. Um audit anterior apontou "7-5 vira
 * tiebreak, 7-6 vira normal" como bug de classifySet — mas esses placares
 * são impossíveis sob 'deuce', então a classificação nunca chega a rodar
 * sobre eles na prática. Não mexer nesse default sem reconfirmar a regra.
 */
export type TiebreakAt = 'deuce' | 'full' | 'none' | 'fixed';

/**
 * Além de 'deuce' e 'full' há dois formatos sem tie-break:
 * - `'none'`: sem tie-break — o set vai a G games e em (G-1)-(G-1) o próximo game decide (fecha em G x (G-1)).
 * - `'fixed'`: joga SÓ G games no total (ex.: 4) e quem fez mais vence; pode terminar empatado (2 x 2).
 * Nos dois nunca há tie-break, então o ponto de tie-break é "nunca" (Infinity).
 */
export function tieAtGames(games: number, tiebreakAt?: TiebreakAt): number {
  if (tiebreakAt === 'none' || tiebreakAt === 'fixed') return Number.POSITIVE_INFINITY;
  return (tiebreakAt ?? 'deuce') === 'full' ? games : games - 1;
}

/** Um set com `mine` x `theirs` games já está fechado? (mesma conta no placar ao vivo, na semente e no registro manual) */
export function setFechado(mine: number, theirs: number, games: number, tiebreakAt?: TiebreakAt): boolean {
  if (tiebreakAt === 'fixed') return mine + theirs >= games;
  if (tiebreakAt === 'none') return mine >= games;
  const T = tieAtGames(games, tiebreakAt);
  return (mine >= T + 1 && mine > theirs) || (mine >= games && mine - theirs >= 2);
}

export function deriveWinRule(winRule: WinRule | undefined): DerivedWinRule {
  const maxSets    = winRule?.sets ?? 3;
  const setsToWin  = Math.ceil(maxSets / 2);
  const gamesWin   = winRule?.games ?? 6;
  const superTb    = winRule?.superTiebreak ?? true;
  const superTbPts = winRule?.superTiebreakPts ?? 10;
  const tieAt      = tieAtGames(gamesWin, winRule?.tiebreakAt);
  const tieMode: TiebreakAt = winRule?.tiebreakAt ?? 'deuce';
  return { maxSets, setsToWin, gamesWin, superTb, superTbPts, tieAt, tieMode };
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

/**
 * Games de cada lado de uma partida — a conta que alimenta GP/GC e o GA.
 * Fonte única: antes, dez telas repetiam `sets.reduce(...)` inline e por isso
 * divergiam sozinhas.
 *
 * Um set decidido em super tie-break conta **1-0 para quem venceu**: ele é
 * disputado em pontos (10-8), e somar esses pontos como se fossem games
 * distorceria o GA — um único STB injetaria ~18 games na conta.
 *
 * O set é identificado pela marca `stb` nos jogos novos. Nos antigos, gravados
 * antes da marca existir, ele é reconstruído a partir da regra da competição
 * quando `winRule` é informada.
 */
export function matchGames(
  m: Pick<Match, 'scoreA' | 'scoreB'> & { sets?: SetScore[] | null },
  winRule?: WinRule,
): { a: number; b: number } {
  const sets = m.sets;
  if (!sets || sets.length === 0) return { a: m.scoreA ?? 0, b: m.scoreB ?? 0 };

  const rule = winRule ? deriveWinRule(winRule) : null;
  let a = 0, b = 0;
  sets.forEach((s, i) => {
    const isStb = s.stb ?? (rule ? isDecidingSet(i, sets.slice(0, i), rule) : false);
    if (isStb) {
      if (s.a > s.b) a += 1;
      else if (s.b > s.a) b += 1;
    } else {
      a += s.a;
      b += s.b;
    }
  });
  return { a, b };
}

/** Um set decisivo foi disputado quando a partida usou todos os sets possíveis (empate até o último). */
export function reachedDecidingSet(sets: SetScore[] | null | undefined, winRule: WinRule | undefined): boolean {
  const rule = deriveWinRule(winRule);
  return (sets?.length ?? 0) === rule.maxSets && rule.maxSets > 1;
}
