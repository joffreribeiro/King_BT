import {
  collection, doc, getDoc, setDoc, deleteDoc, updateDoc, arrayUnion, onSnapshot, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';

/**
 * Pedido de entrada num grupo: groups/{gid}/joinRequests/{uid}. Quem tem o
 * código do grupo NÃO entra direto — cria este pedido e o admin aprova ou
 * recusa. O doc tem o uid do próprio pedinte como id (um pedido por pessoa).
 */
export interface GroupJoinRequest {
  uid: string;
  name: string;
  requestedAt: string;
}

const reqDoc = (groupId: string, uid: string) => doc(db, 'groups', groupId, 'joinRequests', uid);

export async function requestToJoin(groupId: string, uid: string, name: string): Promise<void> {
  await setDoc(reqDoc(groupId, uid), { uid, name, requestedAt: new Date().toISOString() });
}

/** O pedido ainda existe? (false = foi aprovado e apagado, recusado, ou cancelado). Erro de leitura vira null. */
export async function hasJoinRequest(groupId: string, uid: string): Promise<boolean | null> {
  try {
    return (await getDoc(reqDoc(groupId, uid))).exists();
  } catch {
    return null;
  }
}

/** O próprio pedinte desiste do pedido. */
export async function cancelJoinRequest(groupId: string, uid: string): Promise<void> {
  await deleteDoc(reqDoc(groupId, uid));
}

/** Admin: pedidos pendentes do grupo, em tempo real. Erro (ex.: regra ainda não publicada) vira lista vazia. */
export function subscribeJoinRequests(
  groupId: string,
  onData: (requests: GroupJoinRequest[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'groups', groupId, 'joinRequests'),
    snap => onData(
      snap.docs
        .map(d => ({ uid: d.id, name: String(d.data().name ?? '?'), requestedAt: String(d.data().requestedAt ?? '') }))
        .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)),
    ),
    err => { onData([]); onError?.(err); },
  );
}

/** Admin: aprova — coloca a pessoa na lista de membros e apaga o pedido. */
export async function approveJoinRequest(groupId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId), { members: arrayUnion(uid) });
  await deleteDoc(reqDoc(groupId, uid));
}

/** Admin: recusa — só apaga o pedido. */
export async function rejectJoinRequest(groupId: string, uid: string): Promise<void> {
  await deleteDoc(reqDoc(groupId, uid));
}
