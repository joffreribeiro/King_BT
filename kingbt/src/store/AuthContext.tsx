import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signOut,
  type User,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';
import * as Device from 'expo-device';
import * as Localization from 'expo-localization';

function collectDeviceInfo(via: 'email' | 'google' | 'invite') {
  return {
    registeredAt: new Date().toISOString(),
    registeredVia: via,
    platform: Platform.OS,
    platformVersion: Platform.Version,
    deviceBrand: Device.brand ?? null,
    deviceModel: Device.modelName ?? null,
    deviceType: Device.deviceType === 1 ? 'phone' : Device.deviceType === 2 ? 'tablet' : 'unknown',
    osName: Device.osName ?? null,
    osVersion: Device.osVersion ?? null,
    locale: Localization.getLocales()[0]?.languageTag ?? null,
    region: Localization.getLocales()[0]?.regionCode ?? null,
    timezone: Localization.getCalendars()[0]?.timeZone ?? null,
  };
}

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

export interface UnlinkedPlayer {
  id: string;
  name: string;
  color: string;
}

type AuthContextType = AuthState & {
  myPlayerId: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  joinGroup: (code: string) => Promise<{ unlinkedPlayers: UnlinkedPlayer[]; needsLink?: boolean }>;
  linkToPlayer: (playerId: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]         = useState<User | null>(null);
  const [group, setGroup]       = useState<Group | null>(null);
  const [isAdmin, setIsAdmin]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  // Captura resultado do redirect do Google (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    import('firebase/auth').then(({ getRedirectResult }) => {
      getRedirectResult(auth).then(async (result) => {
        if (result?.user) {
          await setDoc(doc(db, 'users', result.user.uid), {
            name: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL,
            updatedAt: new Date().toISOString(),
            ...collectDeviceInfo('google'),
          }, { merge: true });
        }
      }).catch(() => {});
    });
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
          const { groupId, groupIds } = userDoc.data();
          // Garante que o grupo atual está salvo no histórico
          if (groupId) {
            const prevIds: string[] = groupIds ?? [];
            if (!prevIds.includes(groupId)) {
              await setDoc(doc(db, 'users', u.uid), { groupIds: [...prevIds, groupId] }, { merge: true });
            }
            const groupDoc = await getDoc(doc(db, 'groups', groupId));
            if (groupDoc.exists()) {
              const gData = groupDoc.data();
              const g = { id: groupDoc.id, ...gData } as Group;
              setGroup(g);
              const admins: string[] = gData.admins ?? [];
              setIsAdmin(admins.includes(u.uid));
              // Resolve o playerId do usuário no grupo
              const playersSnap = await getDocs(collection(db, 'groups', groupId, 'players'));
              const myPlayer = playersSnap.docs.find(d => d.data().uid === u.uid);
              setMyPlayerId(myPlayer?.id ?? null);
            }
          }
        }
        setLoading(false);
      } else {
        setGroup(null);
        setMyPlayerId(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  async function signInWithGoogle() {
    if (Platform.OS !== 'web') return; // Google login só disponível na web
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
      if (isMobile) {
        const { signInWithRedirect } = await import('firebase/auth');
        await signInWithRedirect(auth, provider);
      } else {
        try {
          const result = await signInWithPopup(auth, provider);
          await setDoc(doc(db, 'users', result.user.uid), {
            name: result.user.displayName,
            email: result.user.email,
            photoURL: result.user.photoURL,
            updatedAt: new Date().toISOString(),
            ...collectDeviceInfo('google'),
          }, { merge: true });
        } catch (popupErr: any) {
          if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/popup-closed-by-user') {
            const { signInWithRedirect } = await import('firebase/auth');
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
        ...collectDeviceInfo('email'),
      }, { merge: true });
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') setError('E-mail já cadastrado.');
      else if (e.code === 'auth/weak-password') setError('Senha muito fraca. Use 6+ caracteres.');
      else setError('Erro ao criar conta. Tente novamente.');
    }
  }

  async function joinGroup(code: string): Promise<{ unlinkedPlayers: UnlinkedPlayer[] }> {
    if (!user) { setError('Faça login primeiro.'); return { unlinkedPlayers: [] }; }
    try {
      setError(null);
      const q = query(collection(db, 'groups'), where('code', '==', code.toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) { setError('Código do grupo não encontrado.'); return { unlinkedPlayers: [] }; }

      const groupDoc = snap.docs[0];
      const groupData = groupDoc.data();
      const groupId = groupDoc.id;

      // Adiciona usuário ao grupo
      const members: string[] = (groupData.members ?? []).filter((m: unknown) => typeof m === 'string' && m !== '');
      if (!members.includes(user.uid)) {
        await setDoc(doc(db, 'groups', groupId), { members: [...members, user.uid] }, { merge: true });
      }

      // Associa grupo ao usuário
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const prevGroupIds: string[] = userSnap.data()?.groupIds ?? [];
      const groupIds = prevGroupIds.includes(groupId) ? prevGroupIds : [...prevGroupIds, groupId];
      await setDoc(doc(db, 'users', user.uid), {
        groupId, groupIds,
        lastJoinedGroupAt: new Date().toISOString(),
        ...collectDeviceInfo('invite'),
      }, { merge: true });

      const g = { id: groupId, ...groupData } as Group;
      setGroup(g);
      const admins: string[] = groupData.admins ?? [];
      setIsAdmin(admins.includes(user.uid));

      // Verifica se o usuário já tem player vinculado (cadastro anterior no mesmo grupo)
      const playersSnap = await getDocs(collection(db, 'groups', groupId, 'players'));
      const myPlayer = playersSnap.docs.find(d => d.data().uid === user.uid);
      if (myPlayer) {
        // Já tem player vinculado — entra direto sem perguntar
        setMyPlayerId(myPlayer.id);
        return { unlinkedPlayers: [], needsLink: false };
      }

      // Usuário novo no grupo — retorna jogadores sem uid para vincular
      const unlinked: UnlinkedPlayer[] = playersSnap.docs
        .filter(d => !d.data().uid)
        .map(d => ({ id: d.id, name: d.data().name ?? '?', color: d.data().color ?? '#FFD166' }));

      // Sempre mostra o modal para o usuário escolher/criar perfil
      return { unlinkedPlayers: unlinked, needsLink: true };
    } catch (e: any) {
      setError('Erro ao entrar no grupo. Tente novamente.');
      return { unlinkedPlayers: [] };
    }
  }

  async function linkToPlayer(playerId: string) {
    if (!user || !group) return;
    try {
      // Vincula uid ao player existente e marca como não-guest
      await setDoc(doc(db, 'groups', group.id, 'players', playerId), {
        uid: user.uid,
        guest: false,
      }, { merge: true });
      setMyPlayerId(playerId);
    } catch (e: any) {
      setError('Erro ao vincular perfil. Tente novamente.');
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
    <Ctx.Provider value={{ user, group, isAdmin, loading, error, myPlayerId, signInWithGoogle, signInWithEmail, signUpWithEmail, joinGroup, linkToPlayer, createGroup, leaveGroup, switchGroup, getMyGroups, logout, clearError: () => setError(null), promoteToAdmin, removeFromGroup }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
