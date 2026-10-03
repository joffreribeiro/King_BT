import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'kingbt:rateDismissed';

/** Competições cujo aviso "avalie quem jogou com você" o jogador dispensou (guardado neste aparelho). */
export function useRateDismissed() {
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

  const dismiss = useCallback((compIds: string[]) => {
    setDismissed(prev => {
      const next = Array.from(new Set([...prev, ...compIds])).slice(-50);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { dismissed, dismiss };
}
