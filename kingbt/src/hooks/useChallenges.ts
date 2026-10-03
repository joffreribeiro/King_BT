import { useEffect, useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { subscribeChallenges } from '@/firebase/challenges';
import type { Challenge } from '@/logic/challenges';

/**
 * Desafios do grupo em tempo real. `denied` fica true se o Firestore recusar a leitura (regra
 * ainda não publicada) — as telas avisam em vez de parecer que ninguém desafiou ninguém.
 */
export function useChallenges() {
  const { group } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    setChallenges([]); setLoaded(false); setDenied(false);
    if (!group) return;
    return subscribeChallenges(
      group.id,
      list => { setChallenges(list); setLoaded(true); },
      () => setDenied(true),
    );
  }, [group?.id]);

  return { challenges, loaded, denied };
}
