import { buildCompetition } from './formats';
import type { Competition, Match, Unit } from './types';
import { WIN_RULE_PRESETS } from '@/constants/winRulePresets';

/** Regra padrão dos jogos rápidos: MD3 · 4 games, com tie e super tie-break. */
export const QUICK_GAME_PRESET = 6;

/**
 * Uma partida avulsa de um jogo só, já com os dois lados definidos e sem placar. É a base do "Jogo Rápido"
 * e dos jogos marcados a partir de um desafio. Conta nas estatísticas, mas some das listas de competições (isFriendly).
 */
export function quickGameCompetition(o: {
  name: string;
  teamA: string[];
  teamB: string[];
  unit?: Unit;
  presetIndex?: number;
  creatorId?: string | null;
}): Competition {
  const p = WIN_RULE_PRESETS[o.presetIndex ?? QUICK_GAME_PRESET];
  const comp = buildCompetition({
    name: o.name,
    format: 'avulso',
    unit: o.unit ?? 'individual',
    gender: 'misto',
    competitors: [],
    config: {
      rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false,
      winRule: {
        sets: p.sets, games: p.games, tiebreak: p.tb,
        tiebreakAt: p.tbAt, superTiebreak: p.stb, superTiebreakPts: p.stbPts,
      },
    },
  });
  const match: Match = {
    id: 'am_' + Date.now(),
    stage: 'rotating',
    teamA: o.teamA, teamB: o.teamB,
    scoreA: null, scoreB: null,
  };
  return { ...comp, isFriendly: true, matches: [match], ...(o.creatorId ? { createdBy: o.creatorId } : {}) };
}
