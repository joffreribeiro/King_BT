import React, { createContext, useContext, useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getQueue, removeFromQueue, getQueueSize } from './syncQueue';
import { updateCompetition } from '@/firebase/competitions';
import type { Competition } from '@/logic/types';
import { useAuth } from './AuthContext';

type SyncQueueContextType = {
  pendingCount: number;
  isOnline: boolean;
};

const Ctx = createContext<SyncQueueContextType>({ pendingCount: 0, isOnline: true });

export function SyncQueueProvider({ children }: { children: React.ReactNode }) {
  const { group } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      if (online) flushQueue();
    });
    return unsub;
  }, [group]);

  useEffect(() => {
    const interval = setInterval(async () => {
      setPendingCount(await getQueueSize());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  async function flushQueue() {
    if (!group) return;
    const queue = await getQueue();
    for (const item of queue) {
      try {
        if (item.type === 'UPDATE_COMP') {
          await updateCompetition(
            item.payload.groupId as string,
            item.payload.data as Competition
          );
          await removeFromQueue(item.id);
        }
      } catch {
        // Deixar na fila para tentar novamente
      }
    }
    setPendingCount(await getQueueSize());
  }

  return (
    <Ctx.Provider value={{ pendingCount, isOnline }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSyncQueue() {
  return useContext(Ctx);
}
