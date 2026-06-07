import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from './config';

export type GroupPlayer = {
  id: string;
  name: string;
  color: string;
  guest: boolean;
  uid?: string | null;
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
