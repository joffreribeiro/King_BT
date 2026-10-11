import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from './config';
import type { BtAnalise } from '@/logic/btTracker';
import { enqueueLatest } from '@/store/syncQueue';

const analisesCol = (groupId: string) =>
  collection(db, 'groups', groupId, 'analises');

/**
 * Os ids dos jogos se repetem entre competições (L0, L1, G0L2…). Antes o documento da análise era só o id do jogo,
 * então a análise do "L0" de uma competição aparecia — e era sobrescrita — no "L0" de qualquer outra do grupo.
 * Agora o documento é "<competição>__<jogo>". Os documentos antigos (só o id do jogo) continuam lidos, mas só
 * valem para a competição que consta dentro deles.
 */
export const chaveAnalise = (a: { competitionId: string; matchId: string }) => `${a.competitionId}__${a.matchId}`;

const analiseDoc = (groupId: string, docId: string) =>
  doc(db, 'groups', groupId, 'analises', docId);

export async function saveAnaliseFs(groupId: string, analise: BtAnalise): Promise<void> {
  await setDoc(analiseDoc(groupId, chaveAnalise(analise)), analise);
}

export async function loadAnaliseFs(groupId: string, matchId: string, competitionId: string): Promise<BtAnalise | null> {
  const novo = await getDoc(analiseDoc(groupId, chaveAnalise({ competitionId, matchId })));
  if (novo.exists()) return novo.data() as BtAnalise;
  // Formato antigo: só vale se a análise guardada ali é mesmo desta competição.
  const antigo = await getDoc(analiseDoc(groupId, matchId));
  if (!antigo.exists()) return null;
  const a = antigo.data() as BtAnalise;
  return a.competitionId === competitionId ? a : null;
}

/** Junta duplicatas (formato antigo + novo da mesma partida): fica a mais completa, depois a mais recente. */
export function semDuplicatas(analises: BtAnalise[]): BtAnalise[] {
  const porChave = new Map<string, BtAnalise>();
  for (const a of analises) {
    const k = chaveAnalise(a);
    const atual = porChave.get(k);
    if (!atual || a.pontos.length > atual.pontos.length || (a.pontos.length === atual.pontos.length && a.criadaEm > atual.criadaEm)) porChave.set(k, a);
  }
  return [...porChave.values()];
}

/** As `qtd` (padrão 50) análises mais recentes do grupo — a tela já ordena por `criadaEm`
 * desc e mostra lista; sem limite, crescia sem teto (uma análise por partida
 * tracked ao vivo). */
export async function listAnalisesFs(groupId: string, qtd = 50): Promise<BtAnalise[]> {
  const q = query(analisesCol(groupId), orderBy('criadaEm', 'desc'), limit(qtd));
  const snap = await getDocs(q);
  return semDuplicatas(snap.docs.map(d => d.data() as BtAnalise));
}

export async function deleteAnaliseFs(groupId: string, matchId: string, competitionId: string): Promise<void> {
  await deleteDoc(analiseDoc(groupId, chaveAnalise({ competitionId, matchId })));
  // Documento no formato antigo: só apaga se for desta competição (o id pode ser de outra).
  const antigo = await getDoc(analiseDoc(groupId, matchId));
  if (antigo.exists() && (antigo.data() as BtAnalise).competitionId === competitionId) await deleteDoc(analiseDoc(groupId, matchId));
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
      a => `SAVE_ANALISE:${(() => { const x = a.payload.analise as BtAnalise | undefined; return x ? chaveAnalise(x) : ''; })()}`,
    );
  }
}
