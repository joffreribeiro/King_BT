import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './config';

export type AppUser = {
  uid: string;
  name: string;
  email: string | null;
  photoURL: string | null;
};

// Busca no servidor (functions/src/index.ts), com Admin SDK. A regra do
// Firestore proíbe `list` em /users — baixar a coleção inteira e filtrar no
// cliente, como este arquivo fazia antes, expunha nome e e-mail de todos os
// usuários do app para qualquer conta logada.
const searchUsersFn = httpsCallable<{ term: string }, AppUser[]>(getFunctions(app), 'searchUsers');

export async function searchUsers(term: string): Promise<AppUser[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const result = await searchUsersFn({ term: trimmed });
  return result.data;
}
