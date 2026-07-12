import { collection, getDocs } from 'firebase/firestore';
import { db } from './config';

export type AppUser = {
  uid: string;
  name: string;
  email: string | null;
  photoURL: string | null;
};

export async function searchUsers(term: string): Promise<AppUser[]> {
  const trimmed = term.trim().toLowerCase();
  if (!trimmed) return [];
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map(d => {
      const data = d.data();
      return {
        uid: d.id,
        name: data.name ?? '?',
        email: data.email ?? null,
        photoURL: data.photoURL ?? null,
      } as AppUser;
    })
    .filter(u =>
      u.name.toLowerCase().includes(trimmed) ||
      (u.email ?? '').toLowerCase().includes(trimmed)
    );
}
