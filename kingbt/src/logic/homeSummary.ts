import type { Competition, Match } from './types';

/** Só o que a Home precisa de cada linha do ranking (subconjunto de RankedPlayer). */
export interface RankLine { id: string; points: number; played: number; provisional?: boolean }

export type RankGap =
  | { kind: 'leader'; position: 1; points: number; lead: number }
  | { kind: 'inside'; position: number; points: number; target: number }
  | { kind: 'outside'; position: number; points: number; target: number; gap: number; tied: boolean };

/** Diferença abaixo disso conta como empate (mesma tolerância dos pontos, arredondados em 2 casas). */
const EPS = 0.005;

/**
 * Posição do jogador no ranking e quanto falta para o Top N.
 * `ranking` já vem ordenado (buildRanking → sortRanking). Retorna null quando
 * o jogador não está no ranking ou ainda não jogou — sem jogo não há posição
 * que mereça uma frase motivacional.
 */
export function rankGap(ranking: RankLine[], myId: string | null | undefined, topN = 5): RankGap | null {
  if (!myId) return null;
  // Só quem tem posição conta (quem está "em classificação" fica de fora do topo e da conta da distância).
  ranking = ranking.filter(r => !r.provisional);
  const idx = ranking.findIndex(r => r.id === myId);
  if (idx < 0) return null;
  const me = ranking[idx];
  if (me.played <= 0 || me.provisional) return null; // ainda em classificação: sem posição

  const position = idx + 1;
  const targetRow = ranking[Math.min(topN, ranking.length) - 1];

  if (position === 1) {
    const second = ranking[1];
    return { kind: 'leader', position: 1, points: me.points, lead: second ? me.points - second.points : 0 };
  }
  if (position <= topN) {
    return { kind: 'inside', position, points: me.points, target: ranking[0].points };
  }
  const gap = Math.max(0, targetRow.points - me.points);
  return { kind: 'outside', position, points: me.points, target: targetRow.points, gap, tied: gap < EPS };
}

/** Ids de jogadores de um lado do jogo (time, competidor nomeado ou jogador direto). */
function sideMembers(comp: Competition, m: Match, side: 'a' | 'b'): string[] {
  const team = side === 'a' ? m.teamA : m.teamB;
  if (team?.length) return team;
  const id = side === 'a' ? m.aId : m.bId;
  if (!id) return [];
  const competitor = comp.competitors.find(c => c.id === id);
  return competitor ? competitor.members : [id];
}

export interface PendingMatches {
  count: number;
  /** Competição do jogo pendente mais antigo na lista (para abrir ao tocar). */
  compId: string | null;
  compName: string | null;
}

/**
 * Jogos sem placar, em competições ativas, em que o jogador participa.
 * Amistosos entram: o atalho da Home também os considera "próximo jogo".
 */
export function myPendingMatches(comps: Competition[], myId: string | null | undefined): PendingMatches {
  const empty = { count: 0, compId: null, compName: null };
  if (!myId) return empty;
  let count = 0;
  let first: Competition | null = null;
  for (const comp of comps) {
    if (comp.status !== 'active') continue;
    for (const m of comp.matches) {
      if (m.scoreA != null || m.pendingScore) continue;
      if (sideMembers(comp, m, 'a').includes(myId) || sideMembers(comp, m, 'b').includes(myId)) {
        count++;
        if (!first) first = comp;
      }
    }
  }
  return first ? { count, compId: first.id, compName: first.name } : empty;
}

/** Solicitações de inscrição aguardando o admin, somadas nas competições. */
export function pendingJoinRequests(comps: Competition[]): { count: number; compId: string | null } {
  let count = 0;
  let compId: string | null = null;
  for (const c of comps) {
    const n = c.joinRequests?.length ?? 0;
    if (n > 0) { count += n; if (!compId) compId = c.id; }
  }
  return { count, compId };
}

/** Item do feed reduzido ao que a Home precisa (subconjunto de FeedItem). */
export interface FeedLike {
  type: 'match_result' | 'rank_change' | 'comp_done' | 'champion' | 'rivalry_milestone' | 'honor';
  compName: string;
  sideA?: { name: string; score: number };
  sideB?: { name: string; score: number };
  playerName?: string;
  oldPos?: number;
  newPos?: number;
  newPoints?: number;
  milestoneEmoji?: string;
  milestoneTitle?: string;
  milestoneDesc?: string;
}

export interface FeedLine { emoji: string; title: string; sub: string }

/** Resumo de uma linha de um item do feed, para o bloco "Acontecendo no grupo". */
export function feedLine(it: FeedLike): FeedLine {
  switch (it.type) {
    case 'match_result': {
      const a = it.sideA, b = it.sideB;
      const score = a && b ? `${a.name} ${a.score}–${b.score} ${b.name}` : 'Jogo encerrado';
      return { emoji: '🎾', title: score, sub: it.compName };
    }
    case 'rank_change': {
      const up = (it.newPos ?? 0) < (it.oldPos ?? 0);
      const pts = it.newPoints != null ? ` · ${(Math.round(it.newPoints * 100) / 100).toString().replace('.', ',')} pts` : '';
      return {
        emoji: up ? '📈' : '📉',
        title: `${it.playerName ?? 'Jogador'} ${up ? 'subiu' : 'caiu'} no ranking`,
        sub: `Agora em #${it.newPos ?? '?'}${pts}`,
      };
    }
    case 'comp_done':
      return { emoji: '🏆', title: `${it.compName} foi finalizado`, sub: it.playerName ? `Campeão: ${it.playerName}` : 'Confira o resultado final' };
    case 'champion':
      return { emoji: '👑', title: `${it.playerName ?? 'Jogador'} é campeão`, sub: it.compName };
    case 'rivalry_milestone':
      return { emoji: it.milestoneEmoji ?? '⚔️', title: it.milestoneTitle ?? 'Rivalidade', sub: it.milestoneDesc ?? '' };
    case 'honor':
      return { emoji: it.milestoneEmoji ?? '🏅', title: it.milestoneTitle ?? 'Honraria', sub: it.milestoneDesc ?? '' };
  }
}
