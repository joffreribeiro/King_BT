import { collection, doc, setDoc, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './config';
import type { BtAnalise } from '@/logic/btTracker';

const analisesCol = (groupId: string) =>
  collection(db, 'groups', groupId, 'analises');

const analiseDoc = (groupId: string, matchId: string) =>
  doc(db, 'groups', groupId, 'analises', matchId);

export async function saveAnaliseFs(groupId: string, analise: BtAnalise): Promise<void> {
  await setDoc(analiseDoc(groupId, analise.matchId), analise);
}

export async function loadAnaliseFs(groupId: string, matchId: string): Promise<BtAnalise | null> {
  const snap = await getDoc(analiseDoc(groupId, matchId));
  return snap.exists() ? (snap.data() as BtAnalise) : null;
}

export async function listAnalisesFs(groupId: string): Promise<BtAnalise[]> {
  const snap = await getDocs(analisesCol(groupId));
  return snap.docs.map(d => d.data() as BtAnalise);
}

export async function deleteAnaliseFs(groupId: string, matchId: string): Promise<void> {
  await deleteDoc(analiseDoc(groupId, matchId));
}
