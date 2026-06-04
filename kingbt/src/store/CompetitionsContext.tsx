import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { Competition } from '@/logic/types';
import { resolveCompetition } from '@/logic/formats';
import { MOCK_COMPETITIONS } from '@/mocks/competitions';
import { subscribeCompetitions, createCompetition, updateCompetition as fsUpdateComp } from '@/firebase/competitions';
import { useAuth } from './AuthContext';

type State = {
  competitions: Competition[];
  synced: boolean; // true quando veio do Firestore
};

type Action =
  | { type: 'SET'; competitions: Competition[] }
  | { type: 'ADD'; comp: Competition }
  | { type: 'SAVE_SCORE'; compId: string; matchId: string; scoreA: number; scoreB: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET':
      return { competitions: action.competitions, synced: true };
    case 'ADD':
      return { ...state, competitions: [action.comp, ...state.competitions] };
    case 'SAVE_SCORE':
      return {
        ...state,
        competitions: state.competitions.map(c => {
          if (c.id !== action.compId) return c;
          const updated = {
            ...c,
            matches: c.matches.map(m =>
              m.id === action.matchId
                ? { ...m, scoreA: action.scoreA, scoreB: action.scoreB }
                : m
            ),
          };
          resolveCompetition(updated);
          const scoreable = updated.matches.filter(
            m => (m.aId != null && m.bId != null) || (m.teamA && m.teamB)
          );
          updated.status = scoreable.length > 0 && scoreable.every(m => m.scoreA != null)
            ? 'done' : 'active';
          return updated;
        }),
      };
  }
}

type CtxType = {
  state: State;
  dispatch: React.Dispatch<Action>;
};

const Ctx = createContext<CtxType | null>(null);

export function CompetitionsProvider({ children }: { children: ReactNode }) {
  const { user, group } = useAuth();
  const [state, dispatch] = useReducer(reducer, {
    competitions: [...MOCK_COMPETITIONS],
    synced: false,
  });

  // Se autenticado com grupo → escuta Firestore em tempo real
  useEffect(() => {
    if (!user || !group) return;
    const unsub = subscribeCompetitions(group.id, (comps) => {
      dispatch({ type: 'SET', competitions: comps });
    });
    return unsub;
  }, [user, group]);

  // Intercepta ADD para salvar no Firestore se autenticado
  const wrappedDispatch: React.Dispatch<Action> = async (action) => {
    dispatch(action);
    if (!user || !group) return;

    if (action.type === 'ADD') {
      const { id, ...data } = action.comp;
      await createCompetition(group.id, data);
    }

    if (action.type === 'SAVE_SCORE') {
      const comp = state.competitions.find(c => c.id === action.compId);
      if (comp) {
        const updated = {
          ...comp,
          matches: comp.matches.map(m =>
            m.id === action.matchId
              ? { ...m, scoreA: action.scoreA, scoreB: action.scoreB }
              : m
          ),
        };
        resolveCompetition(updated);
        await fsUpdateComp(group.id, updated);
      }
    }
  };

  return (
    <Ctx.Provider value={{ state, dispatch: wrappedDispatch }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCompetitions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCompetitions must be inside CompetitionsProvider');
  return ctx;
}
