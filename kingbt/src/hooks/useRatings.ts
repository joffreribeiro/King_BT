import { useEffect, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { subscribeRatings, type Rating } from '@/firebase/ratings';

/**
 * Avaliações que um jogador recebeu, em tempo real. `denied` fica true se o
 * Firestore recusar a leitura (regra de avaliações ainda não publicada) — a
 * tela avisa em vez de parecer que ninguém avaliou.
 */
export function useRatings(playerId: string | undefined) {
  const { group } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    setRatings([]); setLoaded(false); setDenied(false);
    if (!group || !playerId) return;
    return subscribeRatings(
      group.id, playerId,
      r => { setRatings(r); setLoaded(true); },
      () => setDenied(true),
    );
  }, [group?.id, playerId]);

  return { ratings, loaded, denied };
}
