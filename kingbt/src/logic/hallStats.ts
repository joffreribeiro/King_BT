import { countsForRanking } from './rankingScope';
import type { Competition, Match } from './types';
import { avulsoRanking, competitionChampion } from './formats';
import { DEFAULT_SCORING, type ScoringConfig } from './scoringConfig';
import { matchGames } from './setOutcome';

/** Números extras das conquistas (Coroas, Favos e Provas), calculados das competições. */
export interface HallStats {
  /** Competições (fora amistosos) em que o jogador teve ao menos um jogo com placar. */
  events: number;
  /** Colocações em Super 8 encerrados. */
  super8Gold: number;
  super8Silver: number;
  super8Bronze: number;
  /** Pódios: top 3 em Super 8 + títulos nas outras competições. */
  podiums: number;
  /** Maior sequência de títulos seguidos, nas competições encerradas em que jogou. */
  titleStreakMax: number;
  /** Competições encerradas sem nenhuma derrota (mín. 3 jogos). */
  invictos: number;
  /** Competições encerradas em que teve o melhor saldo de games (mín. 3 jogos). */
  saldoKing: number;
}

/** Jogos mínimos numa competição para valer Invicto / Rei do Saldo (evita "invicto" com 1 jogo). */
export const MIN_GAMES = 3;

/** Jogadores de um lado do jogo: time, competidor nomeado ou jogador direto. */
function sideMembers(comp: Competition, m: Match, side: 'a' | 'b'): string[] {
  const team = side === 'a' ? m.teamA : m.teamB;
  if (team?.length) return team;
  const id = side === 'a' ? m.aId : m.bId;
  if (!id) return [];
  const c = comp.competitors.find(x => x.id === id);
  return c ? c.members : [id];
}

/** Por jogador: jogos, vitórias, derrotas e games a favor/contra numa competição (só jogos com placar e sem empate). */
function perPlayer(comp: Competition) {
  const map = new Map<string, { played: number; wins: number; losses: number; pro: number; con: number }>();
  const row = (id: string) => {
    let r = map.get(id);
    if (!r) { r = { played: 0, wins: 0, losses: 0, pro: 0, con: 0 }; map.set(id, r); }
    return r;
  };
  for (const m of comp.matches) {
    if (m.scoreA == null || m.scoreB == null || m.scoreA === m.scoreB) continue;
    const aWon = m.scoreA > m.scoreB;
    const { a: gA, b: gB } = matchGames(m, comp.config?.winRule);
    for (const id of sideMembers(comp, m, 'a')) { const r = row(id); r.played++; r.pro += gA; r.con += gB; if (aWon) r.wins++; else r.losses++; }
    for (const id of sideMembers(comp, m, 'b')) { const r = row(id); r.played++; r.pro += gB; r.con += gA; if (aWon) r.losses++; else r.wins++; }
  }
  return map;
}

export function computeHallStats(comps: Competition[], playerId: string, cfg: ScoringConfig = DEFAULT_SCORING): HallStats {
  const out: HallStats = { events: 0, super8Gold: 0, super8Silver: 0, super8Bronze: 0, podiums: 0, titleStreakMax: 0, invictos: 0, saldoKing: 0 };
  if (!playerId) return out;

  // Só as competições em que o jogador jogou, da mais antiga para a mais nova.
  const mine = comps
    .filter(c => !c.isFriendly && countsForRanking(c))
    .map(c => ({ c, stat: perPlayer(c).get(playerId), all: perPlayer(c) }))
    .filter(x => x.stat && x.stat.played > 0)
    .sort((a, b) => (a.c.date ?? '').localeCompare(b.c.date ?? ''));

  out.events = mine.length;

  let streak = 0;
  for (const { c, stat, all } of mine) {
    if (c.status !== 'done' || !stat) continue;

    // Título e colocação
    let champion = false;
    if (c.format === 'super8') {
      const idx = avulsoRanking(c, undefined, cfg).indexOf(playerId);
      if (idx === 0) { out.super8Gold++; champion = true; out.podiums++; }
      else if (idx === 1) { out.super8Silver++; out.podiums++; }
      else if (idx === 2) { out.super8Bronze++; out.podiums++; }
    } else {
      const champ = competitionChampion(c, undefined, cfg);
      champion = !!champ && champ.members.includes(playerId);
      if (champion) out.podiums++;
    }
    if (champion) { streak++; out.titleStreakMax = Math.max(out.titleStreakMax, streak); } else { streak = 0; }

    // Invicto: sem nenhuma derrota
    if (stat.played >= MIN_GAMES && stat.losses === 0 && stat.wins > 0) out.invictos++;

    // Rei do Saldo: melhor saldo de games entre quem jogou o mínimo (empate no topo conta para todos)
    if (stat.played >= MIN_GAMES) {
      const saldos = [...all.values()].filter(r => r.played >= MIN_GAMES).map(r => r.pro - r.con);
      if (stat.pro - stat.con === Math.max(...saldos)) out.saldoKing++;
    }
  }
  return out;
}
