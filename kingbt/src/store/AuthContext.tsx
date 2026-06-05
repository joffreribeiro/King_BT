import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signOut,
  type User,
} from 'firebase/auth';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';

WebBrowser.maybeCompleteAuthSession();

export type Group = {
  id: string;
  name: string;
  code: string;
  admins?: string[];
};

type AuthState = {
  user: User | null;
  group: Group | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
};

type AuthContextType = AuthState & {
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  joinGroup: (code: string) => Promise<void>;
  createGroup: (name: string) => Promise<void>;
  leaveGroup: () => Promise<void>;
  switchGroup: (groupId: string) => Promise<void>;
  getMyGroups: () => Promise<Group[]>;
  logout: () => Promise<void>;
  clearError: () => void;
  promoteToAdmin: (uid: string) => Promise<void>;
  removeFromGroup: (uid: string) => Promise<void>;
};

const Ctx = createContext<AuthContextType | null>(null);

const GOOGLE_WEB_CLIENT_ID = '859106891704-s022doc6nkck7eqqmapklbmqonodjfoo.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '859106891704-55sipqmpiph4m9gr5kdj377mu47hufvc.apps.googleusercontent.com';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<User | null>(null);
  const [group, setGroup]   = useState<Group | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token } = googleResponse.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).then(async (result) => {
        await setDoc(doc(db, 'users', result.user.uid), {
          name: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoURL,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }).catch(() => {});
    }
  }, [googleResponse]);
  const [error, setError]   = useState<string | null>(null);

  // Captura resultado do redirect do Google (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        await setDoc(doc(db, 'users', result.user.uid), {
          name: result.user.displayName,
          email: result.user.email,
          photoURL: result.user.photoURL,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    }).catch(() => {});
  }, []);

  // Escuta mudanças de auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      console.log('[Auth] onAuthStateChanged:', u?.uid ?? 'null');
      setUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        console.log('[Auth] userDoc exists:', userDoc.exists(), userDoc.data());
        if (userDoc.exists()) {
          const { groupId } = userDoc.data();
          console.log('[Auth] groupId:', groupId);
          if (groupId) {
            const groupDoc = await getDoc(doc(db, 'groups', groupId));
            console.log('[Auth] groupDoc exists:', groupDoc.exists());
            if (groupDoc.exists()) {
              const gData = groupDoc.data();
              const g = { id: groupDoc.id, ...gData } as Group;
              setGroup(g);
              const admins: string[] = gData.admins ?? [];
              setIsAdmin(admins.includes(u.uid));
              console.log('[Auth] group set:', g.name, 'isAdmin:', admins.includes(u.uid));
            }
          }
        }
        setLoading(false);
      } else {
        setGroup(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  async function signInWithGoogle() {
    try {
      setError(null);
      if (Platform.OS !== 'web') {
        // APK nativo → usa expo-auth-session
        await googlePromptAsync();
      } else {
        // Web desktop → popup
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        try {
          const result = await signInWithPopup(auth, provider);
          await setDoc(doc(db, 'users', result.user.uid), {
            name: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (popupErr: any) {
          if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/popup-closed-by-user') {
            await signInWithRedirect(auth, provider);
          } else {
            throw popupErr;
          }
        }
      }
    } catch (e: any) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError('Erro ao entrar com Google. Tente novamente.');
      }
    }
  }

  async function signInWithEmail(email: string, password: string) {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setError('E-mail ou senha incorretos.');
    }
  }

  async function signUpWithEmail(name: string, email: string, password: string) {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await setDoc(doc(db, 'users', result.user.uid), {
        name, email, updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') setError('E-mail já cadastrado.');
      else if (e.code === 'auth/weak-password') setError('Senha muito fraca. Use 6+ caracteres.');
      else setError('Erro ao criar conta. Tente novamente.');
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

      // Adiciona usuário ao grupo (filtra strings vazias do array)
      const members: string[] = (groupData.members ?? []).filter((m: unknown) => typeof m === 'string' && m !== '');
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

      // Associa grupo ao usuário e salva no histórico
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const prevGroupIds: string[] = userSnap.data()?.groupIds ?? [];
      const groupIds = prevGroupIds.includes(groupDoc.id) ? prevGroupIds : [...prevGroupIds, groupDoc.id];
      await setDoc(doc(db, 'users', user.uid), { groupId: groupDoc.id, groupIds }, { merge: true });
      const g = { id: groupDoc.id, ...groupData } as Group;
      setGroup(g);
      const admins: string[] = groupData.admins ?? [];
      setIsAdmin(admins.includes(user.uid));
    } catch (e: any) {
      setError('Erro ao entrar no grupo. Tente novamente.');
    }
  }

  async function promoteToAdmin(uid: string) {
    if (!group || !isAdmin) return;
    const admins = [...(group.admins ?? [])];
    if (!admins.includes(uid)) {
      admins.push(uid);
      await setDoc(doc(db, 'groups', group.id), { admins }, { merge: true });
      setGroup(prev => prev ? { ...prev, admins } : prev);
    }
  }

  async function removeFromGroup(uid: string) {
    if (!group || !isAdmin) return;
    const members = (group as any).members?.filter((m: string) => m !== uid) ?? [];
    await setDoc(doc(db, 'groups', group.id), { members }, { merge: true });
  }

  async function getMyGroups(): Promise<Group[]> {
    if (!user) return [];
    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const groupIds: string[] = userSnap.data()?.groupIds ?? [];
      const groups = await Promise.all(
        groupIds.map(async (gid) => {
          const gSnap = await getDoc(doc(db, 'groups', gid));
          if (!gSnap.exists()) return null;
          return { id: gSnap.id, ...gSnap.data() } as Group;
        })
      );
      return groups.filter(Boolean) as Group[];
    } catch {
      return [];
    }
  }

  async function switchGroup(groupId: string) {
    if (!user) return;
    try {
      setError(null);
      const gSnap = await getDoc(doc(db, 'groups', groupId));
      if (!gSnap.exists()) { setError('Grupo não encontrado.'); return; }
      const gData = gSnap.data();
      await setDoc(doc(db, 'users', user.uid), { groupId }, { merge: true });
      const g = { id: gSnap.id, ...gData } as Group;
      setGroup(g);
      setIsAdmin((gData.admins ?? []).includes(user.uid));
    } catch {
      setError('Erro ao trocar de grupo.');
    }
  }

  async function leaveGroup() {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { groupId: null }, { merge: true });
      setGroup(null);
      setIsAdmin(false);
    } catch (e: any) {
      setError('Erro ao sair do grupo. Tente novamente.');
    }
  }

  async function createGroup(name: string) {
    if (!user) { setError('Faça login primeiro.'); return; }
    try {
      setError(null);
      // Gera código a partir do nome (sem espaços, maiúsculo, max 8 chars)
      const code = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'GRUPO' + Math.floor(Math.random() * 1000);
      const groupRef = doc(collection(db, 'groups'));
      await setDoc(groupRef, {
        name,
        code,
        admins: [user.uid],
        members: [user.uid],
      });
      // Cria player no grupo
      await setDoc(doc(db, 'groups', groupRef.id, 'players', user.uid), {
        name: user.displayName ?? 'Jogador',
        uid: user.uid,
        color: '#FFD166',
        guest: false,
      });
      // Associa grupo ao usuário e salva no histórico
      const userSnap2 = await getDoc(doc(db, 'users', user.uid));
      const prevGroupIds2: string[] = userSnap2.data()?.groupIds ?? [];
      const groupIds2 = prevGroupIds2.includes(groupRef.id) ? prevGroupIds2 : [...prevGroupIds2, groupRef.id];
      await setDoc(doc(db, 'users', user.uid), { groupId: groupRef.id, groupIds: groupIds2 }, { merge: true });
      setGroup({ id: groupRef.id, name, code, admins: [user.uid] });
      setIsAdmin(true);
    } catch (e: any) {
      setError('Erro ao criar grupo. Tente novamente.');
    }
  }

  async function logout() {
    await signOut(auth);
    setGroup(null);
  }

  return (
    <Ctx.Provider value={{ user, group, isAdmin, loading, error, signInWithGoogle, signInWithEmail, signUpWithEmail, joinGroup, createGroup, leaveGroup, switchGroup, getMyGroups, logout, clearError: () => setError(null), promoteToAdmin, removeFromGroup }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
