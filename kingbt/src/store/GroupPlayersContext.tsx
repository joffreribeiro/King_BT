import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeGroupPlayers, type GroupPlayer } from '@/firebase/groupPlayers';
import { useAuth } from './AuthContext';
import { PLAYERS } from '@/mocks/data';

export type PlayerInfo = { id: string; name: string; color: string };

type CtxType = {
  groupPlayers: GroupPlayer[];
  findPlayer: (id: string) => PlayerInfo | undefined;
};

const defaultFind = (id: string): PlayerInfo | undefined => {
  const p = PLAYERS.find(x => x.id === id);
  return p ? { id: p.id, name: p.name, color: p.color } : undefined;
};

const Ctx = createContext<CtxType>({ groupPlayers: [], findPlayer: defaultFind });

export function GroupPlayersProvider({ children }: { children: ReactNode }) {
  const { user, group } = useAuth();
  const [groupPlayers, setGroupPlayers] = useState<GroupPlayer[]>([]);

  useEffect(() => {
    if (!user || !group) return;
    return subscribeGroupPlayers(group.id, setGroupPlayers);
  }, [user, group]);

  function findPlayer(id: string): PlayerInfo | undefined {
    const gp = groupPlayers.find(p => p.id === id);
    if (gp) return { id: gp.id, name: gp.name, color: gp.color };
    const mp = PLAYERS.find(p => p.id === id);
    return mp ? { id: mp.id, name: mp.name, color: mp.color } : undefined;
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
