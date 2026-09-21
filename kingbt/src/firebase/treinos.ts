import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from './config';
import type { BtTreino } from '@/logic/btTreino';

const treinosCol = (groupId: string) =>
  collection(db, 'groups', groupId, 'treinos');

const treinoDoc = (groupId: string, treinoId: string) =>
  doc(db, 'groups', groupId, 'treinos', treinoId);

export async function saveTreinoFs(groupId: string, treino: BtTreino): Promise<void> {
  await setDoc(treinoDoc(groupId, treino.id), treino);
}

export async function loadTreinoFs(groupId: string, treinoId: string): Promise<BtTreino | null> {
  const snap = await getDoc(treinoDoc(groupId, treinoId));
  return snap.exists() ? (snap.data() as BtTreino) : null;
}

/** Os 50 treinos mais recentes do grupo — a tela já ordena por `criadoEm`
 * desc e mostra lista; sem limite, crescia sem teto. */
export async function listTreinosFs(groupId: string): Promise<BtTreino[]> {
  const q = query(treinosCol(groupId), orderBy('criadoEm', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as BtTreino);
}

export async function deleteTreinoFs(groupId: string, treinoId: string): Promise<void> {
  await deleteDoc(treinoDoc(groupId, treinoId));
}
