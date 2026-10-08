/**
 * Tie-break digitado à mão no registro de placar da competição. É obrigatório quando o set termina em tie-break.
 * Funções puras, usadas pelo ScorerModal.
 */

/**
 * Tie-break marcado à mão num jogo de formato indefinido (Avulso): não há limite de pontos nem de games para
 * conferir, então só exige os dois lados preenchidos e o vencedor do set (quem fez mais games) com mais pontos.
 */
export function erroTiebreakLivre(
  gamesA: number, gamesB: number, pontosA: string | undefined, pontosB: string | undefined,
): string | null {
  if (!pontosA || !pontosB) return 'Informe os pontos dos dois lados do tie-break.';
  if (gamesA === gamesB) return 'O set com tie-break precisa de um vencedor nos games (ex.: 4–3).';
  const pA = parseInt(pontosA, 10) || 0, pB = parseInt(pontosB, 10) || 0;
  const [vencedor, perdedor] = gamesA > gamesB ? [pA, pB] : [pB, pA];
  return vencedor > perdedor ? null : 'O vencedor do set precisa ter mais pontos no tie-break.';
}

/** O set terminou como termina um set decidido no tie-break (tieAt+1 × tieAt games)? Aí dá para informar os pontos dele. */
export function setTerminouEmTiebreak(gamesA: number, gamesB: number, tieAt: number): boolean {
  return Math.max(gamesA, gamesB) === tieAt + 1 && Math.min(gamesA, gamesB) === tieAt;
}

/**
 * Mensagem de erro do tie-break informado, ou null quando válido (em branco é erro: o tie-break é obrigatório).
 * O vencedor do set (quem fez mais games) tem que ter mais pontos, chegar ao limite do tie-break e abrir 2 de diferença.
 */
export function erroTiebreak(
  gamesA: number, gamesB: number, pontosA: string | undefined, pontosB: string | undefined, limite: number,
): string | null {
  const vazioA = !pontosA, vazioB = !pontosB;
  if (vazioA || vazioB) return 'Informe os pontos dos dois lados do tie-break.';
  const pA = parseInt(pontosA!, 10) || 0, pB = parseInt(pontosB!, 10) || 0;
  const [vencedor, perdedor] = gamesA > gamesB ? [pA, pB] : [pB, pA];
  if (vencedor <= perdedor) return 'O vencedor do set precisa ter mais pontos no tie-break.';
  if (vencedor < limite || vencedor - perdedor < 2) return `Tie-break vai a ${limite} pontos, com 2 de diferença (ex.: ${limite}–${limite - 2}).`;
  return null;
}
