import type { Competition, Match } from './types';
import { competitionChampion } from './formats';
import { DEFAULT_SCORING, type ScoringConfig } from './scoringConfig';

/**
 * Lógica compartilhada entre badges.ts e achievementStats.ts — os dois
 * calculavam campeonatos, hat-trick, "imbatível do mês" e "parceiro
 * perfeito" com código quase idêntico, copiado e colado. O risco real da
 * duplicação: corrigir uma regra num dos dois e esquecer do outro faz
 * badges e conquistas divergirem em silêncio.
 *
 * Comportamento preservado EXATAMENTE como estava nos dois originais: um
 * empate (m.scoreA === m.scoreB) não é tratado como caso especial em lugar
 * nenhum — cai em `false` na comparação `>` estrita, contando como
 * "participou mas não venceu" (derruba streak, entra no total de
 * partidas/parcerias, não soma vitória). Mudar essa semântica não é escopo
 * desta extração.
 */

function joga(m: Match, playerId: string): boolean {
  const inA = m.teamA ? m.teamA.includes(playerId) : m.aId === playerId;
  const inB = m.teamB ? m.teamB.includes(playerId) : m.bId === playerId;
  return inA || inB;
}

function inTeamA(m: Match, playerId: string): boolean {
  return m.teamA ? m.teamA.includes(playerId) : m.aId === playerId;
}

/** Vitória estrita: false para derrota E para empate — igual ao `>` que os dois originais usavam. */
function won(m: Match, playerId: string): boolean {
  return inTeamA(m, playerId) ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
}

/** Jogos em que o jogador participou e há placar. */
export function matchesOf(competitions: Competition[], playerId: string): Match[] {
  return competitions.flatMap(c => c.matches.filter(m => m.scoreA != null && joga(m, playerId)));
}

/** Nº de competições encerradas (status 'done') em que o jogador foi campeão. */
export function computeChampCount(
  competitions: Competition[],
  playerId: string,
  cfg: ScoringConfig = DEFAULT_SCORING,
  nameOf?: (id: string) => string,
): number {
  return competitions.filter(c => {
    if (c.status !== 'done') return false;
    const champ = competitionChampion(c, nameOf, cfg);
    return champ && champ.members.includes(playerId);
  }).length;
}

/** Sequência máxima de vitórias consecutivas, na ordem em que os jogos aparecem. */
export function computeMaxStreak(matches: Match[], playerId: string): number {
  let max = 0, streak = 0;
  for (const m of matches) {
    if (won(m, playerId)) { streak++; max = Math.max(max, streak); }
    else streak = 0;
  }
  return max;
}

/** true se o jogador venceu 3+ partidas numa mesma competição. */
export function computeHatTrick(competitions: Competition[], playerId: string): boolean {
  return competitions.some(c => {
    const compWins = c.matches.filter(m => m.scoreA != null && joga(m, playerId) && won(m, playerId)).length;
    return compWins >= 3;
  });
}

/** true se, em algum mês, o jogador jogou 3+ partidas e venceu todas. */
export function computeUnbeatableMonth(competitions: Competition[], playerId: string): boolean {
  const monthMap: Record<string, { w: number; total: number }> = {};
  competitions.forEach(c => {
    const month = c.date?.slice(0, 7) ?? '';
    c.matches.forEach(m => {
      if (m.scoreA == null || !month || !joga(m, playerId)) return;
      if (!monthMap[month]) monthMap[month] = { w: 0, total: 0 };
      monthMap[month].total++;
      if (won(m, playerId)) monthMap[month].w++;
    });
  });
  return Object.values(monthMap).some(r => r.total >= 3 && r.w === r.total);
}

/** true se algum parceiro de dupla tem 5+ jogos com o jogador e 80%+ de aproveitamento. */
export function computePerfectPartner(competitions: Competition[], playerId: string): boolean {
  const partnerMap: Record<string, { wins: number; played: number }> = {};
  competitions.forEach(c => {
    c.matches.filter(m => m.scoreA != null && m.teamA && m.teamB).forEach(m => {
      const inA = m.teamA!.includes(playerId);
      const inB = m.teamB!.includes(playerId);
      if (!inA && !inB) return;
      const myTeam = inA ? m.teamA! : m.teamB!;
      const partner = myTeam.find(id => id !== playerId);
      if (!partner) return;
      if (!partnerMap[partner]) partnerMap[partner] = { wins: 0, played: 0 };
      partnerMap[partner].played++;
      if (won(m, playerId)) partnerMap[partner].wins++;
    });
  });
  return Object.values(partnerMap).some(p => p.played >= 5 && p.wins / p.played >= 0.8);
}

/** Vitórias do jogador em partidas de um conjunto de formatos. */
export function computeFormatWins(competitions: Competition[], playerId: string, formats: string[]): number {
  return competitions
    .filter(c => formats.includes(c.format))
    .flatMap(c => c.matches)
    .filter(m => m.scoreA != null && joga(m, playerId) && won(m, playerId))
    .length;
}
