import { addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from './config';
import { parseChallenge, type Challenge } from '@/logic/challenges';

const col = (groupId: string) => collection(db, 'groups', groupId, 'challenges');

/** Desafios do grupo em tempo real, do mais novo para o mais antigo. Erro (ex.: regra ainda não publicada) vira lista vazia + onError. */
export function subscribeChallenges(
  groupId: string,
  onData: (list: Challenge[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    col(groupId),
    snap => onData(
      snap.docs
        .map(d => parseChallenge(d.id, d.data()))
        .filter((c): c is Challenge => !!c)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),
    err => { onData([]); onError?.(err); },
  );
}

export async function createChallenge(groupId: string, data: Omit<Challenge, 'id'>): Promise<string> {
  const ref = await addDoc(col(groupId), data);
  return ref.id;
}

/** O desafiado aceita ou recusa. */
export async function respondChallenge(groupId: string, id: string, accept: boolean): Promise<void> {
  await updateDoc(doc(col(groupId), id), { status: accept ? 'accepted' : 'declined', respondedAt: new Date().toISOString() });
}

/** O desafiante desiste enquanto ninguém respondeu. */
export async function cancelChallenge(groupId: string, id: string): Promise<void> {
  await updateDoc(doc(col(groupId), id), { status: 'cancelled', respondedAt: new Date().toISOString() });
}

/** Liga a partida criada ao desafio aceito. */
export async function linkChallengeGame(groupId: string, id: string, compId: string): Promise<void> {
  await updateDoc(doc(col(groupId), id), { compId });
}

export async function deleteChallenge(groupId: string, id: string): Promise<void> {
  await deleteDoc(doc(col(groupId), id));
}
