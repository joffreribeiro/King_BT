import {
  collection, doc, addDoc, updateDoc, setDoc, onSnapshot,
  query, orderBy, arrayUnion, arrayRemove, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import type { Competition, Match, JoinRequest } from '@/logic/types';

const compsCol = (groupId: string) =>
  collection(db, 'groups', groupId, 'competitions');

const compDoc = (groupId: string, compId: string) =>
  doc(db, 'groups', groupId, 'competitions', compId);

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

/** Atualiza placar ao vivo de um jogo (durante a partida) */
export async function updateLiveScore(
  groupId: string,
  compId: string,
  updatedMatches: Match[]
): Promise<void> {
  await updateDoc(compDoc(groupId, compId), { matches: updatedMatches });
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
