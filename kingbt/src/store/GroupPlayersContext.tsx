import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeGroupPlayers, type GroupPlayer } from '@/firebase/groupPlayers';
import { useAuth } from './AuthContext';
import type { PlayerInfo } from '@/logic/types';
import { resolvePlayer } from '@/logic/players';

export type { PlayerInfo };

type CtxType = {
  groupPlayers: GroupPlayer[];
  findPlayer: (id: string) => PlayerInfo | undefined;
};

// Sem Provider (ex.: componente renderizado fora da árvore do app), não há
// como saber quem é o jogador — retornar undefined é o comportamento seguro;
// antes caía num fallback de dados fictícios (@/mocks/data), que podia
// devolver um nome errado com aparência de válido.
const defaultFind = (): PlayerInfo | undefined => undefined;

const Ctx = createContext<CtxType>({ groupPlayers: [], findPlayer: defaultFind });

export function GroupPlayersProvider({ children }: { children: ReactNode }) {
  const { user, group } = useAuth();
  const [groupPlayers, setGroupPlayers] = useState<GroupPlayer[]>([]);

  useEffect(() => {
    // Zera ANTES de subscrever o novo grupo (ou ao deslogar/sair): sem
    // isso, a lista antiga ficava na tela até o primeiro snapshot do novo
    // grupo chegar — trocar de grupo mostrava por um instante (ou
    // indefinidamente, se !group) os jogadores do grupo anterior.
    setGroupPlayers([]);
    if (!user || !group) return;
    return subscribeGroupPlayers(group.id, setGroupPlayers);
  }, [user, group]);

  function findPlayer(id: string): PlayerInfo | undefined {
    return resolvePlayer(groupPlayers, id);
  }

  return (
    <Ctx.Provider value={{ groupPlayers, findPlayer }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGroupPlayers() {
  return useContext(Ctx);
}
