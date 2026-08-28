import { collection, doc, setDoc, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './config';
import type { BtAnalise } from '@/logic/btTracker';
import { enqueueLatest } from '@/store/syncQueue';

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

/**
 * Grava a análise na nuvem e, se falhar, deixa na fila de sincronização para
 * subir quando a conexão voltar. Antes as chamadas eram `saveAnaliseFs(...)
 * .catch(() => {})`: numa quadra sem sinal — o caso normal — uma partida
 * inteira marcada ponto a ponto ficava só no aparelho, sem aviso e sem entrar
 * na contagem de pendências do banner.
 */
export async function saveAnaliseSynced(groupId: string, analise: BtAnalise): Promise<void> {
  try {
    await saveAnaliseFs(groupId, analise);
  } catch {
    await enqueueLatest(
      { type: 'SAVE_ANALISE', payload: { groupId, analise } },
      a => `SAVE_ANALISE:${(a.payload.analise as BtAnalise | undefined)?.matchId ?? ''}`,
    );
  }
}
