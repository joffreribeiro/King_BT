import { useEffect, useState } from 'react';
import { subscribeJoinRequests, type GroupJoinRequest } from '@/firebase/joinRequests';

/**
 * Pedidos de entrada pendentes do grupo, em tempo real. Só o admin consegue ler
 * (regra do Firestore); para os demais — ou se a regra ainda não foi publicada —
 * a lista fica vazia e não quebra nada.
 */
export function useGroupJoinRequests(groupId: string | undefined, enabled: boolean): GroupJoinRequest[] {
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);

  useEffect(() => {
    if (!groupId || !enabled) { setRequests([]); return; }
    return subscribeJoinRequests(groupId, setRequests);
  }, [groupId, enabled]);

  return requests;
}
