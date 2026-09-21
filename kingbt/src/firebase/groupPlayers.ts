import { collection, onSnapshot, addDoc, deleteDoc, doc, getDoc, updateDoc, writeBatch, getDocs, arrayRemove, type DocumentReference } from 'firebase/firestore';
import { db } from './config';

export type GroupPlayer = {
  id: string;
  name: string;
  color: string;
  guest: boolean;
  uid?: string | null;
  handicap?: number;
};

export function subscribeGroupPlayers(
  groupId: string,
  onData: (players: GroupPlayer[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'groups', groupId, 'players'),
    (snap) => {
      const players: GroupPlayer[] = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as GroupPlayer))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
      onData(players);
    },
    () => {}
  );
}

export async function addGuestPlayer(
  groupId: string,
  name: string,
  color: string
): Promise<string> {
  const ref = await addDoc(collection(db, 'groups', groupId, 'players'), {
    name: name.trim(),
    color,
    guest: true,
    uid: null,
  });
  return ref.id;
}

export async function removeGuestPlayer(groupId: string, playerId: string): Promise<void> {
  await deleteDoc(doc(db, 'groups', groupId, 'players', playerId));
}

// writeBatch tem teto de 500 operações — um grupo ativo (muitas competições,
// cada uma com liveMatches, mais membros a desassociar) passa disso fácil.
// Este batcher acumula e comita sozinho ao se aproximar do limite.
const BATCH_MAX = 450;

function makeBatcher() {
  let batch = writeBatch(db);
  let count = 0;
  const commits: Promise<void>[] = [];
  function flushIfNeeded() {
    if (count >= BATCH_MAX) {
      commits.push(batch.commit());
      batch = writeBatch(db);
      count = 0;
    }
  }
  return {
    delete(ref: DocumentReference) {
      batch.delete(ref);
      count++;
      flushIfNeeded();
    },
    update(ref: DocumentReference, data: Record<string, unknown>) {
      batch.update(ref, data);
      count++;
      flushIfNeeded();
    },
    async finish() {
      if (count > 0) commits.push(batch.commit());
      await Promise.all(commits);
    },
  };
}

/**
 * Apaga um grupo inteiro: subcoleções diretas, liveMatches de cada
 * competição (subcoleção aninhada — não aparece na lista de subcoleções
 * diretas), o código de entrada em /groupCodes, e desassocia o grupo de
 * cada ex-membro (groupId ativo + o registro em groupIds).
 *
 * Antes só apagava players/competitions/feed/treinos: ficavam para trás
 * analises, liveMatches e o doc em groupCodes — o código continuava
 * reservado e passava a apontar para um grupo inexistente, então quem
 * tentasse entrar por ele recebia erro. E o groupId/groupIds dos usuários
 * nunca era limpo.
 */
export async function deleteGroup(groupId: string): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(groupRef);
  const groupData = groupSnap.data() as { code?: string; members?: string[] } | undefined;

  const b = makeBatcher();

  // liveMatches é subcoleção de CADA competição — precisa listar as
  // competições primeiro para achar os caminhos.
  const compsSnap = await getDocs(collection(db, 'groups', groupId, 'competitions'));
  for (const compDoc of compsSnap.docs) {
    const liveSnap = await getDocs(
      collection(db, 'groups', groupId, 'competitions', compDoc.id, 'liveMatches')
    );
    liveSnap.docs.forEach(d => b.delete(d.ref));
  }

  const subCollections = ['players', 'competitions', 'feed', 'treinos', 'analises'];
  for (const sub of subCollections) {
    const snap = await getDocs(collection(db, 'groups', groupId, sub));
    snap.docs.forEach(d => b.delete(d.ref));
  }

  if (groupData?.code) {
    b.delete(doc(db, 'groupCodes', groupData.code));
  }

  // Desassocia o grupo de cada ex-membro. A regra só autoriza o update
  // quando o groupId ATIVO do usuário é justamente este grupo — por isso
  // lê antes de decidir: quem já trocou de grupo ativo (mas ainda constava
  // como membro daqui) não pode ter o groupId ativo mexido pela regra, e
  // fica com uma entrada órfã em groupIds — caso raro, e bem menor que o
  // código de entrada quebrado que este fix resolve.
  for (const uid of groupData?.members ?? []) {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.data()?.groupId === groupId) {
      b.update(userRef, { groupId: null, groupIds: arrayRemove(groupId) });
    }
  }

  b.delete(groupRef);
  await b.finish();
}

export async function updatePlayerHandicap(
  groupId: string,
  playerId: string,
  handicap: number
): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId, 'players', playerId), { handicap });
}
