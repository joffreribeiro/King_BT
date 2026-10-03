import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from './config';
import { cleanSkills, type Skills } from '@/logic/skills';
import { isCategory } from '@/logic/categorySuggestion';
import type { Category } from '@/logic/playerAbout';

/** Avaliação que um jogador do grupo deu a outro: groups/{gid}/players/{playerId}/ratings/{raterUid}. */
export interface Rating {
  raterUid: string;
  skills: Skills;
  /** Categoria em que quem avaliou acha que o jogador está (opcional). */
  category?: Category;
  /** Quando foi gravada (ms); ausente enquanto o servidor ainda não confirmou a escrita. */
  updatedAtMs?: number;
}

const ratingsCol = (groupId: string, playerId: string) =>
  collection(db, 'groups', groupId, 'players', playerId, 'ratings');

/** Escuta as avaliações recebidas por um jogador. Erro (ex.: regra ainda não publicada) vira lista vazia + onError. */
export function subscribeRatings(
  groupId: string,
  playerId: string,
  onData: (ratings: Rating[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    ratingsCol(groupId, playerId),
    snap => onData(snap.docs.map(d => ({
      raterUid: d.id,
      skills: (d.data().skills ?? {}) as Skills,
      category: isCategory(d.data().category) ? d.data().category : undefined,
      updatedAtMs: typeof d.data().updatedAt?.toMillis === 'function' ? d.data().updatedAt.toMillis() : undefined,
    }))),
    err => { onData([]); onError?.(err); },
  );
}

/** Grava (ou troca) a avaliação de quem está logado sobre um jogador. Uma por avaliador. */
/**
 * Grava (ou troca) a avaliação de quem está logado sobre um jogador. Uma por avaliador.
 * `raterPlayerId` é o perfil de jogador de quem avalia: nele fica a lista de quem já
 * foi avaliado, que alimenta as conquistas "Primeiro Olhar" e "Olho de Vespa".
 */
export async function saveRating(groupId: string, playerId: string, raterUid: string, skills: Skills, raterPlayerId?: string | null, category?: Category | null): Promise<void> {
  await setDoc(doc(ratingsCol(groupId, playerId), raterUid), {
    skills: cleanSkills(skills),
    ...(category ? { category } : {}),
    updatedAt: serverTimestamp(),
  });
  await markRated(groupId, raterPlayerId, playerId, true);
}

/** Anota (ou tira) o avaliado na lista do avaliador. Falha aqui não desfaz a avaliação já gravada. */
async function markRated(groupId: string, raterPlayerId: string | null | undefined, ratedId: string, add: boolean): Promise<void> {
  if (!raterPlayerId) return;
  try {
    await updateDoc(doc(db, 'groups', groupId, 'players', raterPlayerId), { ratedIds: add ? arrayUnion(ratedId) : arrayRemove(ratedId) });
  } catch { /* só afeta a contagem de conquistas; a avaliação em si já foi salva */ }
}

export async function deleteRating(groupId: string, playerId: string, raterUid: string, raterPlayerId?: string | null): Promise<void> {
  await deleteDoc(doc(ratingsCol(groupId, playerId), raterUid));
  await markRated(groupId, raterPlayerId, playerId, false);
}
