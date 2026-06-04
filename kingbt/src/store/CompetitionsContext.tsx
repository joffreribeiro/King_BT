import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { Competition } from '@/logic/types';
import { resolveCompetition } from '@/logic/formats';
import { MOCK_COMPETITIONS } from '@/mocks/competitions';

type State = { competitions: Competition[] };

type Action =
  | { type: 'ADD'; comp: Competition }
  | { type: 'SAVE_SCORE'; compId: string; matchId: string; scoreA: number; scoreB: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD':
      return { competitions: [action.comp, ...state.competitions] };
    case 'SAVE_SCORE':
      return {
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
          updated.status = scoreable.length > 0 && scoreable.every(m => m.scoreA != null && m.scoreB != null)
            ? 'done'
            : 'active';
          return updated;
        }),
      };
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function CompetitionsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { competitions: [...MOCK_COMPETITIONS] });
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useCompetitions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCompetitions must be inside CompetitionsProvider');
  return ctx;
}
