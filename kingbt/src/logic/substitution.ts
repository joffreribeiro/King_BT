import type { Match, Substitution } from './types';

/**
 * Aplica uma substituição de jogador: do jogo `fromMatchId` em diante,
 * troca `originalId` por `substituteId` em todos os jogos ainda sem placar.
 * Jogos já disputados ficam intactos (as estatísticas do original são preservadas).
 *
 * Importante: nunca introduz chaves com valor `undefined` (ex.: aId/bId em
 * jogos de Super 8, ou teamA/teamB em jogos de mata-mata) — o Firestore
 * rejeita `undefined` e a gravação inteira falharia.
 */
export function applySubstitution(matches: Match[], sub: Substitution): Match[] {
  const fromIdx = matches.findIndex(m => m.id === sub.fromMatchId);
  return matches.map((m, i) => {
    if (i < fromIdx || m.scoreA != null) return m;
    const r: Match = { ...m };
    if (r.aId != null && r.aId === sub.originalId) r.aId = sub.substituteId;
    if (r.bId != null && r.bId === sub.originalId) r.bId = sub.substituteId;
    if (r.teamA) r.teamA = r.teamA.map(id => id === sub.originalId ? sub.substituteId : id);
    if (r.teamB) r.teamB = r.teamB.map(id => id === sub.originalId ? sub.substituteId : id);
    return r;
  });
}
