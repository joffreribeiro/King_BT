import type { Challenge } from './challenges';
import { effectiveStatus, involves, isDoubles } from './challenges';
import type { Honor } from './honors';
import type { Announcement } from './announcements';
import { isActive } from './announcements';
import type { Competition } from './types';
import { awaitingMyConfirmation } from './scoreValidation';

/** Aviso pessoal montado a partir de dados que o app já carrega (sem gravar nada). */
export interface PersonalNotif {
  id: string;
  type: 'challenge_in' | 'challenge_reply' | 'challenge_game' | 'score_confirm' | 'honor' | 'announcement';
  title: string;
  description: string;
  createdAt: Date;
  /** Para onde levar ao tocar: uma competição ou uma rota do app. */
  actionCompId?: string;
  actionRoute?: string;
}

const first = (name: string) => name.split(' ')[0];
const when = (iso?: string): Date => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? new Date(t) : new Date(0);
};

/**
 * O que importa para o jogador agora: desafios recebidos e respondidos, jogos de desafio a marcar,
 * placares esperando a confirmação dele, honrarias recebidas e comunicados do admin.
 * Sem jogador (conta sem perfil) só sobram os comunicados.
 */
export function personalNotifs(o: {
  myId: string | null | undefined;
  challenges: Challenge[];
  honors: Honor[];
  announcements: Announcement[];
  competitions: Competition[];
  nameOf: (id: string) => string;
  now?: Date;
}): PersonalNotif[] {
  const { myId, nameOf } = o;
  const now = o.now ?? new Date();
  const out: PersonalNotif[] = [];

  for (const a of o.announcements) {
    if (!isActive(a, now)) continue;
    out.push({
      id: `ann_${a.id}`, type: 'announcement', title: a.title ? `Comunicado: ${a.title}` : 'Comunicado do grupo',
      description: a.text, createdAt: when(a.date),
    });
  }
  if (!myId) return out;

  for (const c of o.challenges) {
    if (!involves(c, myId)) continue;
    const st = effectiveStatus(c, now);
    const kind = isDoubles(c) ? 'desafio de duplas' : 'desafio';
    if (c.toId === myId && st === 'pending') {
      out.push({
        id: `chin_${c.id}`, type: 'challenge_in', title: `${first(nameOf(c.fromId))} desafiou você`,
        description: [isDoubles(c) ? 'Jogo de duplas' : 'Jogo 1 contra 1', c.when, c.message].filter(Boolean).join(' · '),
        createdAt: when(c.createdAt), actionRoute: '/desafios',
      });
    }
    if (c.fromId === myId && (st === 'accepted' || st === 'declined')) {
      out.push({
        id: `chrep_${c.id}_${st}`, type: 'challenge_reply',
        title: `${first(nameOf(c.toId))} ${st === 'accepted' ? 'aceitou' : 'recusou'} seu ${kind}`,
        description: st === 'accepted' && !c.compId ? 'Marque o jogo para valer.' : st === 'accepted' ? 'Jogo marcado.' : 'Quem sabe na próxima.',
        createdAt: when(c.respondedAt ?? c.createdAt), actionRoute: '/desafios',
      });
    }
    if (st === 'accepted' && !c.compId && (c.fromId === myId || c.toId === myId)) {
      out.push({
        id: `chgame_${c.id}`, type: 'challenge_game', title: 'Desafio aceito: falta marcar o jogo',
        description: `${first(nameOf(c.fromId))} × ${first(nameOf(c.toId))}`,
        createdAt: when(c.respondedAt ?? c.createdAt), actionRoute: '/desafios',
      });
    }
  }

  for (const { comp, match } of awaitingMyConfirmation(o.competitions, myId)) {
    const p = match.pendingScore;
    if (!p) continue;
    out.push({
      id: `scconf_${match.id}_${p.at}`, type: 'score_confirm',
      title: `Confirme o placar: ${comp.name}`, description: `${first(nameOf(p.by))} lançou ${p.scoreA} × ${p.scoreB}`,
      createdAt: when(p.at), actionCompId: comp.id,
    });
  }

  for (const h of o.honors) {
    if (h.playerId !== myId) continue;
    out.push({
      id: `honor_${h.id}`, type: 'honor', title: `Você recebeu a honraria ${h.title}`,
      description: h.note ?? 'Veja na aba Conquistas do seu perfil.', createdAt: when(h.date), actionRoute: '/(app)/profile',
    });
  }
  return out;
}
