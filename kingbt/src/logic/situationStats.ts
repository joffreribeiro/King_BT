import type { Competition } from './types';
import { classifySet, reachedDecidingSet } from './setOutcome';

export interface SituationStat {
  key: 'tiebreak' | 'superTiebreak' | 'decidingSet';
  label: string;
  played: number;
  wins: number;
  pct: number;
}

/**
 * Aproveitamento em tiebreak, super tiebreak e set decisivo — derivado
 * retroativamente do placar já salvo (Match.sets) + regra de cada competição
 * (Competition.config.winRule). Não depende de metadado novo por set, então
 * funciona em qualquer partida já registrada, antiga ou nova.
 */
export function computeSituationStats(competitions: Competition[], playerId: string): SituationStat[] {
  let tbPlayed = 0, tbWins = 0;
  let stbPlayed = 0, stbWins = 0;
  let dsPlayed = 0, dsWins = 0;

  if (playerId) {
    competitions.forEach(comp => {
      const winRule = comp.config.winRule;
      comp.matches.forEach(m => {
        if (m.scoreA == null || m.scoreB == null || !m.sets?.length) return;

        const inA = m.teamA ? m.teamA.includes(playerId) : m.aId === playerId;
        const inB = m.teamB ? m.teamB.includes(playerId) : m.bId === playerId;
        if (!inA && !inB) return;

        m.sets!.forEach((set, idx) => {
          const outcome = classifySet(idx, m.sets!, winRule);
          if (outcome === 'normal') return;
          const setWonByA = set.a > set.b;
          const won = inA ? setWonByA : !setWonByA;
          if (outcome === 'tiebreak') { tbPlayed++; if (won) tbWins++; }
          else { stbPlayed++; if (won) stbWins++; }
        });

        if (reachedDecidingSet(m.sets, winRule)) {
          dsPlayed++;
          const wonMatch = inA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
          if (wonMatch) dsWins++;
        }
      });
    });
  }

  const mk = (key: SituationStat['key'], label: string, played: number, wins: number): SituationStat => ({
    key, label, played, wins,
    pct: played > 0 ? Math.round((wins / played) * 100) : 0,
  });

  return [
    mk('tiebreak', 'Tiebreak', tbPlayed, tbWins),
    mk('superTiebreak', 'Super Tiebreak', stbPlayed, stbWins),
    mk('decidingSet', 'Set decisivo', dsPlayed, dsWins),
  ];
}
