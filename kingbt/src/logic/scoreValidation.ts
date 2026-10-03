import type { Competition, Match, SetScore } from './types';
import { matchSides } from './playedWith';

/**
 * Confirmação de placar (opcional, por competição): quando ligada, o placar lançado por um jogador
 * NÃO vale na hora. Fica como "pendente" no jogo (`pendingScore`) até o outro lado confirmar; se
 * contestar, o admin decide. Placar do admin (ou de quem criou a competição) vale direto.
 * Só depois de confirmado o placar entra em `scoreA/scoreB` — por isso ranking, XP e estatísticas
 * continuam lendo só os placares oficiais, sem saber que isso existe.
 */

export const DISPUTE_REASON_MAX = 140;

/** A competição exige confirmação dos placares? */
export const requiresConfirmation = (c: Pick<Competition, 'config'>): boolean => c.config?.requireConfirmation === true;

/** Este placar lançado agora precisa ser confirmado? (Admin e criador da competição lançam direto.) */
export const mustConfirm = (c: Pick<Competition, 'config'>, canManage: boolean): boolean => requiresConfirmation(c) && !canManage;

export type ValidationOp =
  | { kind: 'submit'; matchId: string; scoreA: number; scoreB: number; sets?: SetScore[]; by: string; at: string }
  | { kind: 'dispute'; matchId: string; by: string; reason?: string; at: string }
  | { kind: 'discard'; matchId: string };

/** Aplica a operação sobre a competição. Nunca mexe em scoreA/scoreB: isso é só da confirmação. */
export function applyValidationOp(comp: Competition, op: ValidationOp): Competition {
  return {
    ...comp,
    matches: comp.matches.map(m => {
      if (m.id !== op.matchId) return m;
      if (op.kind === 'submit') {
        return {
          ...m,
          pendingScore: { scoreA: op.scoreA, scoreB: op.scoreB, ...(op.sets ? { sets: op.sets } : {}), by: op.by, at: op.at },
        };
      }
      if (op.kind === 'dispute') {
        if (!m.pendingScore) return m;
        const reason = (op.reason ?? '').trim().slice(0, DISPUTE_REASON_MAX);
        return {
          ...m,
          pendingScore: { ...m.pendingScore, disputed: true, disputedBy: op.by, disputedAt: op.at, ...(reason ? { reason } : {}) },
        };
      }
      const { pendingScore: _discarded, ...rest } = m;
      return rest;
    }),
  };
}

/** De que lado o jogador está na partida: 'A', 'B' ou null (não joga). */
export function sideOfPlayer(comp: Competition, m: Match, playerId: string | null | undefined): 'A' | 'B' | null {
  if (!playerId) return null;
  const [a, b] = matchSides(comp, m);
  if (a.includes(playerId)) return 'A';
  if (b.includes(playerId)) return 'B';
  return null;
}

/**
 * Pode confirmar o placar pendente: o admin/criador, ou um jogador do lado OPOSTO ao de quem lançou
 * (se quem lançou nem joga a partida, qualquer um dos jogadores). Placar contestado não se confirma:
 * só o admin resolve.
 */
export function canConfirmScore(comp: Competition, m: Match, playerId: string | null | undefined, canManage: boolean): boolean {
  const p = m.pendingScore;
  if (!p) return false;
  if (canManage) return true;
  if (p.disputed) return false;
  const me = sideOfPlayer(comp, m, playerId);
  if (!me) return false;
  const submitter = sideOfPlayer(comp, m, p.by);
  return submitter === null || submitter !== me;
}

/** Pode contestar: quem pode confirmar (menos o admin, que decide direto), com o placar ainda não contestado. */
export function canDisputeScore(comp: Competition, m: Match, playerId: string | null | undefined): boolean {
  return !!m.pendingScore && !m.pendingScore.disputed && canConfirmScore(comp, m, playerId, false);
}

export interface PendingItem { comp: Competition; match: Match }

/** Placares esperando a confirmação deste jogador (como jogador, não como admin), dos mais recentes aos mais antigos. */
export function awaitingMyConfirmation(comps: Competition[], playerId: string | null | undefined): PendingItem[] {
  if (!playerId) return [];
  const out: PendingItem[] = [];
  for (const comp of comps) {
    if (!requiresConfirmation(comp)) continue;
    for (const match of comp.matches) {
      if (canConfirmScore(comp, match, playerId, false)) out.push({ comp, match });
    }
  }
  return out.sort((a, b) => (b.match.pendingScore?.at ?? '').localeCompare(a.match.pendingScore?.at ?? ''));
}

/** Todos os placares pendentes de uma competição (aguardando ou contestados). */
export const pendingOf = (comp: Competition): Match[] => comp.matches.filter(m => !!m.pendingScore);
