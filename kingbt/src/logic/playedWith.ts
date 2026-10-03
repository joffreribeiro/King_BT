import { rankedCompetitions } from './rankingScope';
import type { Competition, Match } from './types';

/** Quem jogou de cada lado. Em duplas fixas o id do lado é o do time — resolve para os jogadores dele. */
function sideMembers(comp: Competition, team: string[] | undefined, id: string | null | undefined): string[] {
  if (team) return team;
  if (!id) return [];
  const competitor = comp.competitors?.find(c => c.id === id);
  return competitor?.members?.length ? competitor.members : [id];
}

/** Os jogadores de cada lado da partida. */
export function matchSides(comp: Competition, m: Match): [string[], string[]] {
  return [sideMembers(comp, m.teamA, m.aId), sideMembers(comp, m.teamB, m.bId)];
}

/** Todos os jogadores de uma partida (os dois lados). */
export function playersOfMatch(comp: Competition, m: Match): string[] {
  return [...sideMembers(comp, m.teamA, m.aId), ...sideMembers(comp, m.teamB, m.bId)];
}

function bothPlayed(comp: Competition, m: Match, a: string, b: string): boolean {
  if (m.scoreA == null || m.scoreB == null) return false;
  const all = playersOfMatch(comp, m);
  return all.includes(a) && all.includes(b);
}

/**
 * Os dois jogaram a mesma partida com placar, juntos ou um contra o outro?
 * É o que libera avaliar um colega no Radar: a nota vem de quem viu o jogo dele.
 */
export function havePlayedTogether(competitions: Competition[], a: string, b: string): boolean {
  if (!a || !b || a === b) return false;
  return rankedCompetitions(competitions).some(comp => comp.matches.some(m => bothPlayed(comp, m, a, b)));
}
