import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { Competition, Substitution } from '@/logic/types';
import { resolveCompetition, extractPlayerGames, buildCompetition } from '@/logic/formats';
import { computeRivalries } from '@/logic/rivalries';
import { MOCK_COMPETITIONS } from '@/mocks/competitions';
import { subscribeCompetitions, createCompetition, updateCompetition as fsUpdateComp, deleteCompetition as fsDeleteComp, updateLiveScore } from '@/firebase/competitions';
import { createFeedItem } from '@/firebase/feed';
import { Timestamp } from 'firebase/firestore';
import { buildRanking } from '@/logic/scoring';
import { enqueue } from './syncQueue';
import { useAuth } from './AuthContext';
import { useGroupPlayers } from './GroupPlayersContext';

type State = {
  competitions: Competition[];
  synced: boolean;
};

type Action =
  | { type: 'SET'; competitions: Competition[] }
  | { type: 'ADD'; comp: Competition }
  | { type: 'CLONE'; compId: string }
  | { type: 'SAVE_SCORE'; compId: string; matchId: string; scoreA: number; scoreB: number; sets?: { a: number; b: number }[] }
  | { type: 'CORRECT_SCORE'; compId: string; matchId: string; scoreA: number; scoreB: number; sets?: { a: number; b: number }[] }
  | { type: 'CLEAR_SCORE'; compId: string; matchId: string }
  | { type: 'UPDATE_LIVE_SCORE'; compId: string; matchId: string; gamesA: number; gamesB: number; setsA: number; setsB: number }
  | { type: 'CLEAR_LIVE_SCORE'; compId: string; matchId: string }
  | { type: 'DELETE'; compId: string }
  | { type: 'RENAME'; compId: string; name: string }
  | { type: 'SUBSTITUTE_PLAYER'; compId: string; sub: Substitution }
  | { type: 'UPDATE'; comp: Competition };

function applyScore(comp: Competition, matchId: string, scoreA: number, scoreB: number, sets?: { a: number; b: number }[]): Competition {
  const updated = {
    ...comp,
    matches: comp.matches.map(m =>
      m.id === matchId ? { ...m, scoreA, scoreB, ...(sets ? { sets } : {}) } : m
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
    case 'CLONE': {
      const src = state.competitions.find(c => c.id === action.compId);
      if (!src) return state;
      const cloned = buildCompetition({
        name: src.name,
        format: src.format,
        unit: src.unit,
        competitors: src.competitors,
        config: src.config,
        ...(src.location ? { location: src.location } : {}),
      });
      return { ...state, competitions: [cloned, ...state.competitions] };
    }
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
          c.id !== action.compId ? c : applyScore(c, action.matchId, action.scoreA, action.scoreB, action.sets)
        ),
      };
    case 'SUBSTITUTE_PLAYER': {
      const comp = state.competitions.find(c => c.id === action.compId);
      if (!comp) return state;
      const fromIdx = comp.matches.findIndex(m => m.id === action.sub.fromMatchId);
      const updatedMatches = comp.matches.map((m, i) => {
        if (i < fromIdx || m.scoreA != null) return m;
        return {
          ...m,
          aId: m.aId === action.sub.originalId ? action.sub.substituteId : m.aId,
          bId: m.bId === action.sub.originalId ? action.sub.substituteId : m.bId,
          teamA: m.teamA?.map(id => id === action.sub.originalId ? action.sub.substituteId : id),
          teamB: m.teamB?.map(id => id === action.sub.originalId ? action.sub.substituteId : id),
        };
      });
      const updated = {
        ...comp,
        matches: updatedMatches,
        substitutions: [...(comp.substitutions ?? []), action.sub],
      };
      return { ...state, competitions: state.competitions.map(c => c.id === comp.id ? updated : c) };
    }
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
    case 'UPDATE_LIVE_SCORE':
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : {
            ...c,
            matches: c.matches.map(m =>
              m.id !== action.matchId ? m : {
                ...m,
                liveScore: { gamesA: action.gamesA, gamesB: action.gamesB, setsA: action.setsA, setsB: action.setsB, updatedAt: new Date().toISOString() },
              }
            ),
          }
        ),
      };
    case 'CLEAR_LIVE_SCORE':
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : {
            ...c,
            matches: c.matches.map(m =>
              m.id !== action.matchId ? m : { ...m, liveScore: null }
            ),
          }
        ),
      };
    case 'UPDATE':
      return { ...state, competitions: state.competitions.map(c => c.id === action.comp.id ? action.comp : c) };
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
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const [state, dispatch] = useReducer(reducer, {
    competitions: [],
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

    if (action.type === 'CLONE') {
      const src = state.competitions.find(c => c.id === action.compId);
      if (src) {
        const cloned = buildCompetition({
          name: src.name,
          format: src.format,
          unit: src.unit,
          competitors: src.competitors,
          config: src.config,
          ...(src.location ? { location: src.location } : {}),
        });
        const { id, ...data } = cloned;
        try { await createCompetition(group.id, data); }
        catch { console.error('[KingBT] Sync error: CLONE'); }
      }
    }

    if (action.type === 'UPDATE_LIVE_SCORE' || action.type === 'CLEAR_LIVE_SCORE') {
      const comp = state.competitions.find(c => c.id === action.compId);
      if (comp) {
        const updatedMatches = comp.matches.map(m => {
          if (m.id !== action.matchId) return m;
          if (action.type === 'CLEAR_LIVE_SCORE') return { ...m, liveScore: null };
          return {
            ...m,
            liveScore: { gamesA: action.gamesA, gamesB: action.gamesB, setsA: action.setsA, setsB: action.setsB, updatedAt: new Date().toISOString() },
          };
        });
        try { await updateLiveScore(group.id, comp.id, updatedMatches); } catch { /* silent */ }
      }
    }

    if (action.type === 'SAVE_SCORE' || action.type === 'CORRECT_SCORE') {
      const comp = state.competitions.find(c => c.id === action.compId);
      if (comp) {
        const updated = applyScore(comp, action.matchId, action.scoreA, action.scoreB, action.sets);
        try { await fsUpdateComp(group.id, updated); }
        catch {
          await enqueue({ type: 'UPDATE_COMP', payload: { groupId: group.id, data: updated } });
        }
      }
    }

    // Gerar feed item apenas no SAVE_SCORE (primeiro registro, não correção)
    if (action.type === 'SAVE_SCORE') {
      const comp = state.competitions.find(c => c.id === action.compId);
      if (comp) {
        const match = comp.matches.find(m => m.id === action.matchId);
        if (match) {
          const resolvePlayerName = (id: string) =>
            findPlayer(id)?.name ?? id;

          const nameA = match.teamA
            ? match.teamA.map(resolvePlayerName).join(' / ')
            : (comp.competitors.find(c => c.id === match.aId)?.name ?? '?');
          const nameB = match.teamB
            ? match.teamB.map(resolvePlayerName).join(' / ')
            : (comp.competitors.find(c => c.id === match.bId)?.name ?? '?');

          try {
            await createFeedItem(group.id, {
              type: 'match_result',
              compId: comp.id,
              compName: comp.name,
              matchId: match.id,
              format: comp.format,
              sideA: {
                ids: match.teamA ?? (match.aId ? [match.aId] : []),
                name: nameA,
                score: action.scoreA,
              },
              sideB: {
                ids: match.teamB ?? (match.bId ? [match.bId] : []),
                name: nameB,
                score: action.scoreB,
              },
              timestamp: Timestamp.now(),
              reactions: { '👑': [], '🔥': [], '💪': [] },
              comments: [],
            });
          } catch { console.error('[KingBT] Feed error: match_result'); }

          // Detectar subida de posição no ranking e gerar rank_change
          try {
            const rankPlayers = groupPlayers.map(p => ({
              id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color,
            }));
            const allGamesBefore = state.competitions.flatMap(extractPlayerGames);
            const rankBefore = buildRanking(rankPlayers, allGamesBefore);

            const updatedComp = applyScore(comp, action.matchId, action.scoreA, action.scoreB);
            const compsAfter = state.competitions.map(c => c.id === comp.id ? updatedComp : c);
            const allGamesAfter = compsAfter.flatMap(extractPlayerGames);
            const rankAfter = buildRanking(rankPlayers, allGamesAfter);

            const involvedIds = [
              ...(match.teamA ?? []),
              ...(match.teamB ?? []),
              ...(match.aId ? [match.aId] : []),
              ...(match.bId ? [match.bId] : []),
            ].filter((v, i, a) => v && a.indexOf(v) === i) as string[];

            // Expandir ids de competitors para member ids
            const playerIds = involvedIds.flatMap(id => {
              const competitor = comp.competitors.find(c => c.id === id);
              return competitor ? competitor.members : [id];
            }).filter((v, i, a) => a.indexOf(v) === i);

            for (const pid of playerIds) {
              const oldPos = rankBefore.findIndex(r => r.id === pid) + 1;
              const newPos = rankAfter.findIndex(r => r.id === pid) + 1;
              if (oldPos > 0 && newPos > 0 && newPos < oldPos) {
                const pl = groupPlayers.find(p => p.id === pid);
                if (pl) {
                  await createFeedItem(group.id, {
                    type: 'rank_change',
                    compId: comp.id,
                    compName: comp.name,
                    timestamp: Timestamp.now(),
                    reactions: { '👑': [], '🔥': [], '💪': [] },
                    comments: [],
                    playerId: pid,
                    playerName: pl.name,
                    oldPos,
                    newPos,
                    newPoints: rankAfter.find(r => r.id === pid)?.points ?? 0,
                  });
                }
              }
            }
          } catch { console.error('[KingBT] Feed error: rank_change'); }

          // Detectar milestones de rivalidade
          try {
            const updatedComp = applyScore(comp, action.matchId, action.scoreA, action.scoreB);
            const compsAfter  = state.competitions.map(c => c.id === comp.id ? updatedComp : c);

            // Expandir IDs dos lados da partida para player IDs reais
            const sideAIds = match.teamA ?? (match.aId ? [match.aId] : []);
            const sideBIds = match.teamB ?? (match.bId ? [match.bId] : []);
            const expandId = (id: string) => {
              const comp2 = state.competitions.find(c => c.id === action.compId);
              const competitor = comp2?.competitors.find(c => c.id === id);
              return competitor ? competitor.members : [id];
            };
            const allSideA = sideAIds.flatMap(expandId);
            const allSideB = sideBIds.flatMap(expandId);
            const allPlayers = [...new Set([...allSideA, ...allSideB])];

            for (const pid of allPlayers) {
              // rivalidades ANTES do novo jogo
              const rivalsBefore = computeRivalries(pid, state.competitions);
              // rivalidades DEPOIS do novo jogo
              const rivalsAfter  = computeRivalries(pid, compsAfter);

              const pl = groupPlayers.find(p => p.id === pid);
              if (!pl) continue;

              // 1. Sequência quebrada: alguém que tinha ≥3V seguidas foi derrotado
              const oppIds = allSideA.includes(pid) ? allSideB : allSideA;
              const aWonAfter = action.scoreA > action.scoreB;
              const pidInA = allSideA.includes(pid);
              const pidWon = pidInA ? aWonAfter : !aWonAfter;

              if (!pidWon) {
                // Calcular sequência que tinha antes
                const prevMatches = state.competitions.flatMap(c => c.matches)
                  .filter(m => m.scoreA != null && m.scoreB != null)
                  .filter(m => (m.teamA ?? [m.aId]).includes(pid) || (m.teamB ?? [m.bId]).includes(pid));
                let prevStreak = 0;
                for (let i = prevMatches.length - 1; i >= 0; i--) {
                  const pm = prevMatches[i];
                  const inA2 = (pm.teamA ?? [pm.aId]).includes(pid);
                  const won2 = inA2 ? pm.scoreA! > pm.scoreB! : pm.scoreB! > pm.scoreA!;
                  if (won2) prevStreak++; else break;
                }
                if (prevStreak >= 3) {
                  const breakerName = oppIds.map(id => groupPlayers.find(p => p.id === id)?.name.split(' ')[0] ?? id).join(' / ');
                  await createFeedItem(group.id, {
                    type: 'rivalry_milestone',
                    compId: comp.id,
                    compName: comp.name,
                    timestamp: Timestamp.now(),
                    reactions: { '👑': [], '🔥': [], '💪': [] },
                    comments: [],
                    milestoneType: 'streak_broken',
                    milestoneEmoji: '💥',
                    milestoneTitle: `Sequência quebrada!`,
                    milestoneDesc: `${pl.name} tinha ${prevStreak} vitórias seguidas e foi parado por ${breakerName}`,
                    involvedIds: [pid, ...oppIds],
                  });
                }
              }

              // 2. Primeira vitória sobre alguém (new_first_win_over)
              if (pidWon) {
                for (const oppId of oppIds) {
                  // Contar vitórias do pid sobre oppId ANTES
                  let winsBefore = 0;
                  for (const c2 of state.competitions) {
                    for (const m2 of c2.matches) {
                      if (m2.scoreA == null) continue;
                      const pidInA2 = (m2.teamA ?? [m2.aId]).includes(pid);
                      const pidInB2 = (m2.teamB ?? [m2.bId]).includes(pid);
                      const oppInA2 = (m2.teamA ?? [m2.aId]).includes(oppId);
                      const oppInB2 = (m2.teamB ?? [m2.bId]).includes(oppId);
                      if (!(pidInA2 || pidInB2) || !(oppInA2 || oppInB2)) continue;
                      if ((pidInA2 && oppInA2) || (pidInB2 && oppInB2)) continue; // mesmo lado
                      const pidWon2 = pidInA2 ? m2.scoreA > m2.scoreB! : m2.scoreB! > m2.scoreA!;
                      if (pidWon2) winsBefore++;
                    }
                  }
                  if (winsBefore === 0) {
                    const oppPl = groupPlayers.find(p => p.id === oppId);
                    if (oppPl) {
                      await createFeedItem(group.id, {
                        type: 'rivalry_milestone',
                        compId: comp.id,
                        compName: comp.name,
                        timestamp: Timestamp.now(),
                        reactions: { '👑': [], '🔥': [], '💪': [] },
                        comments: [],
                        milestoneType: 'first_win_over',
                        milestoneEmoji: '🏆',
                        milestoneTitle: `Primeira vitória histórica!`,
                        milestoneDesc: `${pl.name} venceu ${oppPl.name} pela primeira vez`,
                        involvedIds: [pid, oppId],
                      });
                    }
                  }
                }
              }

              // 3. Novo carrasco: alguém atingiu 3 vitórias sobre pid
              const carrascoAfter = rivalsAfter.carrasco;
              const carrascoBefore = rivalsBefore.carrasco;
              if (
                carrascoAfter &&
                carrascoAfter.wins >= 3 &&
                carrascoAfter.wins !== (carrascoBefore?.id === carrascoAfter.id ? carrascoBefore.wins : 0) &&
                carrascoAfter.wins % 3 === 0 // dispara a cada múltiplo de 3
              ) {
                const carrascoPlayer = groupPlayers.find(p => p.id === carrascoAfter.id);
                if (carrascoPlayer) {
                  await createFeedItem(group.id, {
                    type: 'rivalry_milestone',
                    compId: comp.id,
                    compName: comp.name,
                    timestamp: Timestamp.now(),
                    reactions: { '👑': [], '🔥': [], '💪': [] },
                    comments: [],
                    milestoneType: 'new_carrasco',
                    milestoneEmoji: '👹',
                    milestoneTitle: `Carrasco confirmado!`,
                    milestoneDesc: `${carrascoPlayer.name} já venceu ${pl.name} ${carrascoAfter.wins} vezes`,
                    involvedIds: [carrascoAfter.id, pid],
                  });
                }
              }
            }
          } catch { console.error('[KingBT] Feed error: rivalry_milestone'); }
        }
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

    if (action.type === 'SUBSTITUTE_PLAYER') {
      const comp = state.competitions.find(c => c.id === action.compId);
      if (comp) {
        const fromIdx = comp.matches.findIndex(m => m.id === action.sub.fromMatchId);
        const updatedMatches = comp.matches.map((m, i) => {
          if (i < fromIdx || m.scoreA != null) return m;
          return {
            ...m,
            aId: m.aId === action.sub.originalId ? action.sub.substituteId : m.aId,
            bId: m.bId === action.sub.originalId ? action.sub.substituteId : m.bId,
            teamA: m.teamA?.map(id => id === action.sub.originalId ? action.sub.substituteId : id),
            teamB: m.teamB?.map(id => id === action.sub.originalId ? action.sub.substituteId : id),
          };
        });
        const updated = {
          ...comp,
          matches: updatedMatches,
          substitutions: [...(comp.substitutions ?? []), action.sub],
        };
        try { await fsUpdateComp(group.id, updated); }
        catch { console.error('[KingBT] Sync error: SUBSTITUTE_PLAYER'); }
      }
    }

    if (action.type === 'UPDATE') {
      try { await fsUpdateComp(group.id, action.comp); }
      catch { console.error('[KingBT] Sync error: UPDATE'); }
    }

    if (action.type === 'DELETE') {
      const comp = state.competitions.find(c => c.id === action.compId);
      if (comp) {
        try {
          await fsDeleteComp(group.id, comp.id);
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
