import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeFeed, fetchFeedOnce, type FeedItem } from '@/firebase/feed';
import { useAuth } from './AuthContext';

type FeedContextType = {
  items: FeedItem[];
  loaded: boolean;
  error: string | null;
  /** Busca o feed do servidor uma vez (pull-to-refresh) — o listener em tempo
   * real já mantém tudo sincronizado; serve mais como reconexão explícita. */
  refresh: () => Promise<void>;
};

const Ctx = createContext<FeedContextType>({ items: [], loaded: false, error: null, refresh: async () => {} });

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
        setLoaded(true);
        setError(err.code === 'permission-denied'
          ? 'Atualize as regras do Firestore para incluir a coleção feed.'
          : err.message);
      }
    );
    return unsub;
  }, [user, group]);

  async function refresh() {
    if (!group) return;
    const data = await fetchFeedOnce(group.id);
    setItems(data);
    setLoaded(true);
    setError(null);
  }

  return <Ctx.Provider value={{ items, loaded, error, refresh }}>{children}</Ctx.Provider>;
}

export function useFeed() {
  return useContext(Ctx);
}
