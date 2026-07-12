import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
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

export async function deleteGroup(groupId: string): Promise<void> {
  const batch = writeBatch(db);
  const subCollections = ['players', 'competitions', 'feed', 'treinos'];
  for (const sub of subCollections) {
    const snap = await getDocs(collection(db, 'groups', groupId, sub));
    snap.docs.forEach(d => batch.delete(d.ref));
  }
  batch.delete(doc(db, 'groups', groupId));
  await batch.commit();
}

export async function updatePlayerHandicap(
  groupId: string,
  playerId: string,
  handicap: number
): Promise<void> {
  await updateDoc(doc(db, 'groups', groupId, 'players', playerId), { handicap });
}
