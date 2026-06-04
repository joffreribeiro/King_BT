import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';

type Group = {
  id: string;
  name: string;
  code: string;
};

type AuthState = {
  user: User | null;
  group: Group | null;
  loading: boolean;
  error: string | null;
};

type AuthContextType = AuthState & {
  signInWithGoogle: () => Promise<void>;
  joinGroup: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const Ctx = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]   = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Escuta mudanças de auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Busca grupo do usuário
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          const { groupId } = userDoc.data();
          if (groupId) {
            const groupDoc = await getDoc(doc(db, 'groups', groupId));
            if (groupDoc.exists()) {
              setGroup({ id: groupDoc.id, ...groupDoc.data() } as Group);
            }
          }
        }
      } else {
        setGroup(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signInWithGoogle() {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // Cria/atualiza doc do usuário
      await setDoc(doc(db, 'users', result.user.uid), {
        name: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e: any) {
      setError('Erro ao entrar com Google. Tente novamente.');
    }
  }

  async function joinGroup(code: string) {
    if (!user) { setError('Faça login primeiro.'); return; }
    try {
      setError(null);
      const q = query(collection(db, 'groups'), where('code', '==', code.toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) { setError('Código do grupo não encontrado.'); return; }

      const groupDoc = snap.docs[0];
      const groupData = groupDoc.data();

      // Adiciona usuário ao grupo
      const members: string[] = groupData.members ?? [];
      if (!members.includes(user.uid)) {
        await setDoc(doc(db, 'groups', groupDoc.id), {
          members: [...members, user.uid],
        }, { merge: true });
      }

      // Cria player no grupo se não existir
      const playerRef = doc(db, 'groups', groupDoc.id, 'players', user.uid);
      const playerSnap = await getDoc(playerRef);
      if (!playerSnap.exists()) {
        await setDoc(playerRef, {
          name: user.displayName ?? 'Jogador',
          uid: user.uid,
          color: '#FFD166',
          guest: false,
        });
      }

      // Associa grupo ao usuário
      await setDoc(doc(db, 'users', user.uid), { groupId: groupDoc.id }, { merge: true });
      setGroup({ id: groupDoc.id, ...groupData } as Group);
    } catch (e: any) {
      setError('Erro ao entrar no grupo. Tente novamente.');
    }
  }

  async function logout() {
    await signOut(auth);
    setGroup(null);
  }

  return (
    <Ctx.Provider value={{ user, group, loading, error, signInWithGoogle, joinGroup, logout, clearError: () => setError(null) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
