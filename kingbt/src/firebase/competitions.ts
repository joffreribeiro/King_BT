import {
  collection, doc, addDoc, updateDoc, setDoc, deleteDoc, onSnapshot, getDocs,
  query, orderBy, arrayUnion, arrayRemove, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import type { Competition, Match, JoinRequest, LiveScore, SetScore } from '@/logic/types';

const compsCol = (groupId: string) =>
  collection(db, 'groups', groupId, 'competitions');

const compDoc = (groupId: string, compId: string) =>
  doc(db, 'groups', groupId, 'competitions', compId);

const liveMatchesCol = (groupId: string, compId: string) =>
  collection(db, 'groups', groupId, 'competitions', compId, 'liveMatches');

const liveMatchDoc = (groupId: string, compId: string, matchId: string) =>
  doc(db, 'groups', groupId, 'competitions', compId, 'liveMatches', matchId);

/** Escuta competições do grupo em tempo real */
export function subscribeCompetitions(
  groupId: string,
  onData: (comps: Competition[]) => void
): Unsubscribe {
  const q = query(compsCol(groupId), orderBy('date', 'desc'));
  return onSnapshot(q, snap => {
    const comps = snap.docs.map(d => ({ id: d.id, ...d.data() } as Competition));
    onData(comps);
  });
}

/** Busca competições do grupo uma única vez (sem listener) — usado por telas de resumo/agregação que não precisam de tempo real. */
export async function fetchCompetitionsOnce(groupId: string): Promise<Competition[]> {
  const snap = await getDocs(query(compsCol(groupId), orderBy('date', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Competition));
}

/** Cria nova competição */
export async function createCompetition(
  groupId: string,
  comp: Omit<Competition, 'id'>
): Promise<string> {
  const ref = await addDoc(compsCol(groupId), comp);
  return ref.id;
}

/** Salva placar de um jogo */
export async function saveMatchScore(
  groupId: string,
  compId: string,
  matchId: string,
  scoreA: number,
  scoreB: number,
  updatedMatches: Match[]
): Promise<void> {
  await updateDoc(compDoc(groupId, compId), {
    matches: updatedMatches,
  });
}

/** Deleta competição permanentemente e limpa o feed associado */
export async function deleteCompetition(groupId: string, compId: string): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  const { deleteFeedItemsByComp } = await import('./feed');
  await Promise.all([
    deleteDoc(compDoc(groupId, compId)),
    deleteFeedItemsByComp(groupId, compId),
  ]);
}

/** Atualiza competição inteira (status, matches resolvidos) */
export async function updateCompetition(
  groupId: string,
  comp: Competition
): Promise<void> {
  const { id, ...data } = comp;
  // Remove chaves com valor undefined — o Firestore rejeita a gravação inteira
  // se qualquer campo aninhado (ex.: match.aId) for undefined.
  const sanitized = JSON.parse(JSON.stringify(data));
  await updateDoc(compDoc(groupId, id), sanitized);
}

// ── Placar ao vivo / rascunho (subcoleção liveMatches) ──────────────────────
// Campos efêmeros de Match (liveScore/draftSets) vivem fora do array
// `matches` da competição, num doc pequeno por partida — assim marcar um
// ponto na Quadra ao Vivo não reescreve a competição inteira a cada toque.

/** Grava o placar ao vivo de um jogo. */
export async function setLiveScore(
  groupId: string, compId: string, matchId: string, liveScore: LiveScore
): Promise<void> {
  await setDoc(liveMatchDoc(groupId, compId, matchId), { liveScore }, { merge: true });
}

/** Limpa o placar ao vivo (fim de partida ou cancelamento). */
export async function clearLiveScore(
  groupId: string, compId: string, matchId: string
): Promise<void> {
  await setDoc(liveMatchDoc(groupId, compId, matchId), { liveScore: null }, { merge: true });
}

/** Salva um rascunho de placar set a set. */
export async function setDraftSets(
  groupId: string, compId: string, matchId: string, draftSets: SetScore[]
): Promise<void> {
  await setDoc(liveMatchDoc(groupId, compId, matchId), { draftSets }, { merge: true });
}

/** Limpa o rascunho. */
export async function clearDraftSets(
  groupId: string, compId: string, matchId: string
): Promise<void> {
  await setDoc(liveMatchDoc(groupId, compId, matchId), { draftSets: null }, { merge: true });
}

/** Apaga o doc de estado ao vivo inteiro — chamado quando o placar final é salvo. */
export async function deleteLiveMatch(
  groupId: string, compId: string, matchId: string
): Promise<void> {
  try { await deleteDoc(liveMatchDoc(groupId, compId, matchId)); } catch { /* doc pode não existir — ok */ }
}

/** Escuta o placar ao vivo/rascunho de todos os jogos de UMA competição. */
export function subscribeLiveMatches(
  groupId: string,
  compId: string,
  onUpdate: (matchId: string, data: { liveScore: LiveScore | null; draftSets: SetScore[] | null }) => void
): Unsubscribe {
  return onSnapshot(liveMatchesCol(groupId, compId), snap => {
    snap.docChanges().forEach(change => {
      const matchId = change.doc.id;
      if (change.type === 'removed') {
        onUpdate(matchId, { liveScore: null, draftSets: null });
      } else {
        const data = change.doc.data() as { liveScore?: LiveScore | null; draftSets?: SetScore[] | null };
        onUpdate(matchId, { liveScore: data.liveScore ?? null, draftSets: data.draftSets ?? null });
      }
    });
  });
}

/** Confirma participação de um jogador em competição upcoming */
export async function confirmParticipation(
  groupId: string,
  compId: string,
  playerId: string
): Promise<void> {
  await updateDoc(compDoc(groupId, compId), {
    confirmedIds: arrayUnion(playerId),
  });
}

/** Cancela participação de um jogador em competição upcoming */
export async function cancelParticipation(
  groupId: string,
  compId: string,
  playerId: string
): Promise<void> {
  await updateDoc(compDoc(groupId, compId), {
    confirmedIds: arrayRemove(playerId),
  });
}

/** Visitante (não-membro) de grupo público solicita inscrição numa competição */
export async function requestRegistration(
  groupId: string,
  compId: string,
  request: JoinRequest
): Promise<void> {
  await updateDoc(compDoc(groupId, compId), {
    joinRequests: arrayUnion(request),
  });
}

/** Visitante cancela sua própria solicitação de inscrição */
export async function cancelRegistrationRequest(
  groupId: string,
  compId: string,
  request: JoinRequest
): Promise<void> {
  await updateDoc(compDoc(groupId, compId), {
    joinRequests: arrayRemove(request),
  });
}

/** Admin recusa uma solicitação — só remove o pedido, sem outro efeito */
export async function rejectJoinRequest(
  groupId: string,
  compId: string,
  request: JoinRequest
): Promise<void> {
  await updateDoc(compDoc(groupId, compId), {
    joinRequests: arrayRemove(request),
  });
}

/**
 * Admin aprova uma solicitação: o visitante vira membro pleno do grupo —
 * ganha um perfil de jogador vinculado, entra em `members` e é confirmado
 * na competição. A solicitação é removida ao final.
 */
export async function approveJoinRequest(
  groupId: string,
  compId: string,
  request: JoinRequest,
  playerColor: string
): Promise<void> {
  await setDoc(doc(db, 'groups', groupId, 'players', request.uid), {
    name: request.name,
    uid: request.uid,
    color: playerColor,
    guest: false,
  });
  await updateDoc(doc(db, 'groups', groupId), {
    members: arrayUnion(request.uid),
  });
  await updateDoc(compDoc(groupId, compId), {
    confirmedIds: arrayUnion(request.uid),
    joinRequests: arrayRemove(request),
  });
}
