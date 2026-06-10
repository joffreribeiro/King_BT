import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { Competition } from '@/logic/types';
import { resolveCompetition } from '@/logic/formats';
import { MOCK_COMPETITIONS } from '@/mocks/competitions';
import { subscribeCompetitions, createCompetition, updateCompetition as fsUpdateComp } from '@/firebase/competitions';
import { useAuth } from './AuthContext';

type State = {
  competitions: Competition[];
  synced: boolean;
};

type Action =
  | { type: 'SET'; competitions: Competition[] }
  | { type: 'ADD'; comp: Competition }
  | { type: 'SAVE_SCORE'; compId: string; matchId: string; scoreA: number; scoreB: number }
  | { type: 'CORRECT_SCORE'; compId: string; matchId: string; scoreA: number; scoreB: number }
  | { type: 'CLEAR_SCORE'; compId: string; matchId: string }
  | { type: 'DELETE'; compId: string }
  | { type: 'RENAME'; compId: string; name: string };

function applyScore(comp: Competition, matchId: string, scoreA: number, scoreB: number): Competition {
  const updated = {
    ...comp,
    matches: comp.matches.map(m =>
      m.id === matchId ? { ...m, scoreA, scoreB } : m
    ),
  };
  resolveCompetition(updated);
  const scoreable = updated.matches.filter(
    m => (m.aId != null && m.bId != null) || (m.teamA && m.teamB)
  );
  updated.status = scoreable.length > 0 && scoreable.every(m => m.scoreA != null)
    ? 'done' : 'active';
  return updated;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET':
      return { competitions: action.competitions, synced: true };
    case 'ADD':
      return { ...state, competitions: [action.comp, ...state.competitions] };
    case 'DELETE':
      return { ...state, competitions: state.competitions.filter(c => c.id !== action.compId) };
    case 'RENAME':
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : { ...c, name: action.name }
        ),
      };
    case 'SAVE_SCORE':
    case 'CORRECT_SCORE':
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : applyScore(c, action.matchId, action.scoreA, action.scoreB)
        ),
      };
    case 'CLEAR_SCORE': {
      return {
        ...state,
        competitions: state.competitions.map(c => {
          if (c.id !== action.compId) return c;
          const updated = { ...c, matches: c.matches.map(m =>
            m.id === action.matchId ? { ...m, scoreA: null, scoreB: null } : m
          )};
          resolveCompetition(updated);
          const scoreable = updated.matches.filter(m => (m.aId != null && m.bId != null) || (m.teamA && m.teamB));
          updated.status = scoreable.length > 0 && scoreable.every(m => m.scoreA != null) ? 'done' : 'active';
          return updated;
        }),
      };
    }
  }
}

type CtxType = {
  state: State;
  dispatch: React.Dispatch<Action>;
  addCompetition: (comp: Competition) => Promise<string>;
};

const Ctx = createContext<CtxType | null>(null);

export function CompetitionsProvider({ children }: { children: ReactNode }) {
  const { user, group, isAdmin } = useAuth();
  const [state, dispatch] = useReducer(reducer, {
    competitions: [...MOCK_COMPETITIONS],
    synced: false,
  });

  useEffect(() => {
    if (!user || !group) return;
    const unsub = subscribeCompetitions(group.id, (comps) => {
      dispatch({ type: 'SET', competitions: comps });
    });
    return unsub;
  }, [user, group]);

  const wrappedDispatch: React.Dispatch<Action> = async (action) => {
    if (action.type === 'DELETE' && !isAdmin) return;
    if (action.type === 'CORRECT_SCORE' && !isAdmin) return;
    if (action.type === 'RENAME' && !isAdmin) return;

    dispatch(action);

    if (!user || !group) return;

    if (action.type === 'ADD') {
      const { id, ...data } = action.comp;
      await createCompetition(group.id, data);
    }

    if (action.type === 'SAVE_SCORE' || action.type === 'CORRECT_SCORE') {
      const comp = state.competitions.find(c => c.id === action.compId);
      if (comp) {
        const updated = applyScore(comp, action.matchId, action.scoreA, action.scoreB);
        try { await fsUpdateComp(group.id, updated); }
        catch { console.error('[KingBT] Sync error: SAVE_SCORE'); }
      }
    }

    if (action.type === 'CLEAR_SCORE') {
      const comp = state.competitions.find(c => c.id === action.compId);
      if (comp) {
        const cleared = { ...comp, matches: comp.matches.map(m =>
          m.id === action.matchId ? { ...m, scoreA: null, scoreB: null } : m
        )};
        resolveCompetition(cleared);
        try { await fsUpdateComp(group.id, cleared); }
        catch { console.error('[KingBT] Sync error: CLEAR_SCORE'); }
      }
    }

    if (action.type === 'RENAME') {
      const comp = state.competitions.find(c => c.id === action.compId);
      if (comp) {
        try { await fsUpdateComp(group.id, { ...comp, name: action.name }); }
        catch { console.error('[KingBT] Sync error: RENAME'); }
      }
    }

    if (action.type === 'DELETE') {
      const comp = state.competitions.find(c => c.id === action.compId);
      if (comp) {
        try {
          const { id } = comp;
          const { updateDoc, doc } = await import('firebase/firestore');
          const { db } = await import('@/firebase/config');
          await updateDoc(doc(db, 'groups', group.id, 'competitions', id), { status: 'done' });
        } catch { console.error('[KingBT] Sync error: DELETE'); }
      }
    }
  };

  async function addCompetition(comp: Competition): Promise<string> {
    dispatch({ type: 'ADD', comp });
    if (!user || !group) return comp.id;
    const { id, ...data } = comp;
    const firestoreId = await createCompetition(group.id, data);
    return firestoreId;
  }

  return (
    <Ctx.Provider value={{ state, dispatch: wrappedDispatch, addCompetition }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCompetitions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCompetitions must be inside CompetitionsProvider');
  return ctx;
}
