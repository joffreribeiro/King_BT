import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kingbt:announcementsDismissed';

/** Comunicados que o jogador dispensou (guardado neste aparelho). */
export function useAnnouncementsDismissed() {
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then(raw => {
        const list = raw ? JSON.parse(raw) : [];
        if (alive && Array.isArray(list)) setDismissed(list.filter((x): x is string => typeof x === 'string'));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed(prev => {
      const next = Array.from(new Set([...prev, id])).slice(-100);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { dismissed, dismiss };
}
