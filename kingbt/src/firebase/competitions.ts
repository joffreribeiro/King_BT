import {
  collection, doc, addDoc, updateDoc, onSnapshot,
  query, orderBy, arrayUnion, arrayRemove, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import type { Competition, Match } from '@/logic/types';

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
  await updateDoc(compDoc(groupId, id), data);
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
