import type { Competition } from './types';

/** Competição amistosa (countsForRanking === false) não entra em ranking, XP, conquistas nem avaliação dos colegas. */
export const countsForRanking = (c: Pick<Competition, 'countsForRanking'>): boolean => c.countsForRanking !== false;

export const rankedCompetitions = <T extends Pick<Competition, 'countsForRanking'>>(comps: T[]): T[] =>
  comps.some(c => !countsForRanking(c)) ? comps.filter(countsForRanking) : comps;
