import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeFeed, type FeedItem } from '@/firebase/feed';
import { useAuth } from './AuthContext';

type FeedContextType = {
  items: FeedItem[];
  loaded: boolean;
  error: string | null;
};

const Ctx = createContext<FeedContextType>({ items: [], loaded: false, error: null });

export function FeedProvider({ children }: { children: ReactNode }) {
  const { user, group } = useAuth();
  const [items, setItems]   = useState<FeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!user || !group) {
      setLoaded(false);
      setItems([]);
      setError(null);
      return;
    }
    setLoaded(false);
    setError(null);
    const unsub = subscribeFeed(
      group.id,
      data => {
        setItems(data);
        setLoaded(true);
        setError(null);
      },
      err => {
        console.error('[KingBT] Feed subscribe error:', err.code);
        setLoaded(true); // para o skeleton parar
        setError(err.code === 'permission-denied'
          ? 'Atualize as regras do Firestore para incluir a coleção feed.'
          : err.message);
      }
    );
    return unsub;
  }, [user, group]);

  return <Ctx.Provider value={{ items, loaded, error }}>{children}</Ctx.Provider>;
}

export function useFeed() {
  return useContext(Ctx);
}
