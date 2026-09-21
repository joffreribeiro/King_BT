import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { Competition, Match, Substitution, LiveScore, SetScore } from '@/logic/types';
import type { Unsubscribe } from 'firebase/firestore';
import { applySubstitution } from '@/logic/substitution';
import { extractPlayerGames, buildCompetition } from '@/logic/formats';
import { applyScore, withMatches, clearScore } from '@/logic/competitionOps';
import { computeRivalries } from '@/logic/rivalries';
import {
  subscribeCompetitions, createCompetition, deleteCompetition as fsDeleteComp,
  mutateCompetition,
  setLiveScore, clearLiveScore, setDraftSets, clearDraftSets, deleteLiveMatch, subscribeLiveMatches as fsSubscribeLiveMatches,
  fetchCompetitionsOnce,
} from '@/firebase/competitions';
import { createFeedItem, deleteFeedItemsByMatch } from '@/firebase/feed';
import { Timestamp } from 'firebase/firestore';
import { buildRanking } from '@/logic/scoring';
import { enqueue } from './syncQueue';
import { useAuth } from './AuthContext';
import { useGroupPlayers } from './GroupPlayersContext';
import { useSettings } from './SettingsContext';
import type { ScoringConfig } from '@/logic/scoringConfig';

type State = {
  competitions: Competition[];
  synced: boolean;
  // Fórmula de pontuação do grupo ativo. Mora no estado porque
  // resolveCompetition — que define quem classifica dos grupos para o
  // mata-mata — roda dentro do reducer, e o reducer é puro.
  scoringConfig: ScoringConfig;
};

type Action =
  | { type: 'SET'; competitions: Competition[] }
  | { type: 'SET_SCORING_CONFIG'; cfg: ScoringConfig }
  | { type: 'ADD'; comp: Competition }
  | { type: 'CLONE'; compId: string; playerHandicaps?: Record<string, number> }
  | { type: 'SAVE_SCORE'; compId: string; matchId: string; scoreA: number; scoreB: number; sets?: { a: number; b: number }[] }
  | { type: 'CORRECT_SCORE'; compId: string; matchId: string; scoreA: number; scoreB: number; sets?: { a: number; b: number }[] }
  | { type: 'CLEAR_SCORE'; compId: string; matchId: string }
  | { type: 'UPDATE_LIVE_SCORE'; compId: string; matchId: string; gamesA: number; gamesB: number; setsA: number; setsB: number; scorerUid?: string; scorerName?: string }
  | { type: 'CLEAR_LIVE_SCORE'; compId: string; matchId: string }
  | { type: 'SAVE_DRAFT'; compId: string; matchId: string; draftSets: { a: number; b: number }[] }
  | { type: 'CLEAR_DRAFT'; compId: string; matchId: string }
  // Sincronização interna vinda da subcoleção liveMatches (ver
  // subscribeLiveMatches) — nunca despachada pelo usuário, só atualiza o
  // liveScore/draftSets em memória de um match. Sempre via dispatch puro,
  // nunca wrappedDispatch (não é ação admin-gated nem grava no Firestore).
  | { type: 'SYNC_LIVE_MATCH'; compId: string; matchId: string; liveScore: LiveScore | null; draftSets: SetScore[] | null }
  | { type: 'DELETE'; compId: string }
  | { type: 'DELETE_MATCH'; compId: string; matchId: string }
  | { type: 'EDIT_MATCH_PLAYERS'; compId: string; matchId: string; teamA: string[]; teamB: string[] }
  | { type: 'RENAME'; compId: string; name: string }
  | { type: 'SUBSTITUTE_PLAYER'; compId: string; sub: Substitution }
  | { type: 'SET_STATUS'; compId: string; status: Competition['status'] }
  | { type: 'ADD_MATCH'; compId: string; match: Match }
  | { type: 'START_UPCOMING'; compId: string; competitors: Competition['competitors'] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET':
      return { ...state, competitions: action.competitions, synced: true };
    case 'SET_SCORING_CONFIG':
      return { ...state, scoringConfig: action.cfg };
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
        playerHandicaps: action.playerHandicaps,
        ...(src.location ? { location: src.location } : {}),
      });
      return { ...state, competitions: [cloned, ...state.competitions] };
    }
    case 'DELETE':
      return { ...state, competitions: state.competitions.filter(c => c.id !== action.compId) };
    case 'DELETE_MATCH':
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : withMatches(c, c.matches.filter(m => m.id !== action.matchId), state.scoringConfig)
        ),
      };
    case 'EDIT_MATCH_PLAYERS':
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : withMatches(c, c.matches.map(m =>
            m.id !== action.matchId ? m : { ...m, teamA: action.teamA, teamB: action.teamB }
          ), state.scoringConfig)
        ),
      };
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
          c.id !== action.compId ? c : applyScore(c, action.matchId, action.scoreA, action.scoreB, action.sets, state.scoringConfig)
        ),
      };
    case 'SUBSTITUTE_PLAYER': {
      const comp = state.competitions.find(c => c.id === action.compId);
      if (!comp) return state;
      const updated = {
        ...comp,
        matches: applySubstitution(comp.matches, action.sub),
        substitutions: [...(comp.substitutions ?? []), action.sub],
      };
      return { ...state, competitions: state.competitions.map(c => c.id === comp.id ? updated : c) };
    }
    case 'CLEAR_SCORE': {
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : clearScore(c, action.matchId, state.scoringConfig)
        ),
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
                liveScore: { gamesA: action.gamesA, gamesB: action.gamesB, setsA: action.setsA, setsB: action.setsB, updatedAt: new Date().toISOString(), scorerUid: action.scorerUid ?? null, scorerName: action.scorerName ?? null },
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
    case 'SAVE_DRAFT':
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : {
            ...c,
            matches: c.matches.map(m =>
              m.id !== action.matchId ? m : { ...m, draftSets: action.draftSets }
            ),
          }
        ),
      };
    case 'CLEAR_DRAFT':
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : {
            ...c,
            matches: c.matches.map(m =>
              m.id !== action.matchId ? m : { ...m, draftSets: null }
            ),
          }
        ),
      };
    case 'SET_STATUS':
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : { ...c, status: action.status }
        ),
      };
    case 'ADD_MATCH':
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : { ...c, matches: [...c.matches, action.match], status: 'active' }
        ),
      };
    case 'START_UPCOMING':
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : { ...c, status: 'active', competitors: action.competitors }
        ),
      };
    case 'SYNC_LIVE_MATCH':
      return {
        ...state,
        competitions: state.competitions.map(c =>
          c.id !== action.compId ? c : {
            ...c,
            matches: c.matches.map(m =>
              m.id !== action.matchId ? m : { ...m, liveScore: action.liveScore, draftSets: action.draftSets }
            ),
          }
        ),
      };
  }
}

type CtxType = {
  state: State;
  dispatch: React.Dispatch<Action>;
  addCompetition: (comp: Competition) => Promise<string>;
  /** Puxa as competições do servidor uma vez (pull-to-refresh) — o listener em
   * tempo real já mantém tudo sincronizado; isso serve mais como reconexão
   * explícita e feedback visual pro usuário do que uma correção de dados. */
  refresh: () => Promise<void>;
  /** Assina o placar ao vivo/rascunho de UMA competição (subcoleção
   * liveMatches) — chamar de qualquer tela que renderize liveScore/draftSets
   * (Quadra ao Vivo, tela da competição, King Scout, atalho do dashboard),
   * já que isso não vem mais junto do listener geral de competições. */
  subscribeLiveMatches: (compId: string) => Unsubscribe;
};

const Ctx = createContext<CtxType | null>(null);

export function CompetitionsProvider({ children }: { children: ReactNode }) {
  const { user, group, isAdmin } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const { scoringConfig } = useSettings();
  // Nasce com o valor JÁ disponível de useSettings() (não DEFAULT_SCORING
  // fixo) — useReducer só lê este argumento na primeira renderização, então
  // se ele começasse em DEFAULT_SCORING, existia uma janela entre o mount
  // e o useEffect logo abaixo rodar onde os updates otimistas locais
  // (SAVE_SCORE, CLEAR_SCORE, etc.) calculavam pontos/saldo com a fórmula
  // errada, mesmo com a fórmula real já disponível no hook.
  const [state, dispatch] = useReducer(reducer, {
    competitions: [],
    synced: false,
    scoringConfig,
  });

  // Espelha no reducer a fórmula do grupo, que o SettingsContext escuta em
  // tempo real no doc do grupo.
  useEffect(() => {
    dispatch({ type: 'SET_SCORING_CONFIG', cfg: scoringConfig });
  }, [scoringConfig]);

  useEffect(() => {
    if (!user || !group) return;
    const unsub = subscribeCompetitions(group.id, (comps) => {
      dispatch({ type: 'SET', competitions: comps });
    });
    return unsub;
  }, [user, group]);

  // Ações destrutivas ou que reescrevem um resultado já registrado só passam
  // para admin do grupo (`isAdmin` do AuthContext já inclui o super admin).
  // CLEAR_SCORE entrou aqui depois: apagar o placar de um jogo registrado é
  // tão destrutivo quanto corrigi-lo, e estava aberto a qualquer membro.
  const ADMIN_ONLY: Action['type'][] = [
    'DELETE', 'DELETE_MATCH', 'EDIT_MATCH_PLAYERS',
    'CORRECT_SCORE', 'CLEAR_SCORE', 'RENAME',
  ];

  const wrappedDispatch: React.Dispatch<Action> = async (action) => {
    if (ADMIN_ONLY.includes(action.type) && !isAdmin) return;

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
          playerHandicaps: action.playerHandicaps,
          ...(src.location ? { location: src.location } : {}),
        });
        const { id, ...data } = cloned;
        try { await createCompetition(group.id, data); }
        catch { console.error('[KingBT] Sync error: CLONE'); }
      }
    }

    if (action.type === 'SAVE_DRAFT') {
      try { await setDraftSets(group.id, action.compId, action.matchId, action.draftSets); } catch { /* silent */ }
    }

    if (action.type === 'CLEAR_DRAFT') {
      try { await clearDraftSets(group.id, action.compId, action.matchId); } catch { /* silent */ }
    }

    if (action.type === 'UPDATE_LIVE_SCORE') {
      try {
        await setLiveScore(group.id, action.compId, action.matchId, {
          gamesA: action.gamesA, gamesB: action.gamesB, setsA: action.setsA, setsB: action.setsB,
          updatedAt: new Date().toISOString(),
          scorerUid: action.scorerUid ?? null, scorerName: action.scorerName ?? null,
        });
      } catch { /* silent */ }
    }

    if (action.type === 'CLEAR_LIVE_SCORE') {
      try { await clearLiveScore(group.id, action.compId, action.matchId); } catch { /* silent */ }
    }

    if (action.type === 'SAVE_SCORE' || action.type === 'CORRECT_SCORE') {
      {
        // A mudança é aplicada sobre a competição do SERVIDOR, não sobre o
        // estado local: dois aparelhos marcando jogos diferentes da mesma
        // competição deixavam de se sobrescrever só assim.
        try {
          await mutateCompetition(group.id, action.compId, (servidor) =>
            applyScore(servidor, action.matchId, action.scoreA, action.scoreB, action.sets, scoringConfig),
          );
        } catch {
          // Sem rede a transação não roda — guarda a intenção (não o documento
          // inteiro), para reaplicá-la sobre o servidor quando voltar.
          await enqueue({
            type: 'APPLY_SCORE',
            payload: {
              groupId: group.id, compId: action.compId, matchId: action.matchId,
              scoreA: action.scoreA, scoreB: action.scoreB,
              sets: action.sets ?? null, cfg: scoringConfig,
            },
          });
        }
        // Placar final salvo — o doc de placar ao vivo/rascunho não serve
        // mais pra nada. Fire-and-forget: um resto órfão não afeta nada (o
        // jogo já tem scoreA/scoreB, então liveScore/draftSets nem chegam a
        // ser exibidos — ver ScoreboardCard).
        deleteLiveMatch(group.id, action.compId, action.matchId).catch(() => {});
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
              // Games por set gravados direto no post — assim o placar do feed
              // continua correto mesmo que a competição seja apagada depois.
              sets: action.sets ?? null,
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
            const rankBefore = buildRanking(rankPlayers, allGamesBefore, scoringConfig);

            const updatedComp = applyScore(comp, action.matchId, action.scoreA, action.scoreB, undefined, scoringConfig);
            const compsAfter = state.competitions.map(c => c.id === comp.id ? updatedComp : c);
            const allGamesAfter = compsAfter.flatMap(extractPlayerGames);
            const rankAfter = buildRanking(rankPlayers, allGamesAfter, scoringConfig);

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
            const updatedComp = applyScore(comp, action.matchId, action.scoreA, action.scoreB, undefined, scoringConfig);
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
      try {
        await mutateCompetition(group.id, action.compId, (servidor) =>
          clearScore(servidor, action.matchId, scoringConfig),
        );
      } catch { console.error('[KingBT] Sync error: CLEAR_SCORE'); }
    }

    if (action.type === 'RENAME') {
      try {
        await mutateCompetition(group.id, action.compId, (servidor) => ({ ...servidor, name: action.name }));
      } catch { console.error('[KingBT] Sync error: RENAME'); }
    }

    if (action.type === 'SUBSTITUTE_PLAYER') {
      try {
        await mutateCompetition(group.id, action.compId, (servidor) => ({
          ...servidor,
          matches: applySubstitution(servidor.matches, action.sub),
          substitutions: [...(servidor.substitutions ?? []), action.sub],
        }));
      } catch (e) { console.error('[KingBT] Sync error: SUBSTITUTE_PLAYER', e); }
    }

    if (action.type === 'SET_STATUS') {
      try {
        await mutateCompetition(group.id, action.compId, (servidor) => ({ ...servidor, status: action.status }));
      } catch { console.error('[KingBT] Sync error: SET_STATUS'); }
    }

    if (action.type === 'ADD_MATCH') {
      try {
        // O jogo entra na lista do SERVIDOR. Numa sessão avulsa é comum duas
        // pessoas adicionarem jogos ao mesmo tempo; partindo da lista local,
        // uma apagava o jogo da outra.
        await mutateCompetition(group.id, action.compId, (servidor) => ({
          ...servidor,
          matches: [...servidor.matches, action.match],
          status: 'active',
        }));
      } catch { console.error('[KingBT] Sync error: ADD_MATCH'); }
    }

    if (action.type === 'START_UPCOMING') {
      try {
        await mutateCompetition(group.id, action.compId, (servidor) => ({
          ...servidor, status: 'active', competitors: action.competitors,
        }));
      } catch { console.error('[KingBT] Sync error: START_UPCOMING'); }
    }

    if (action.type === 'DELETE_MATCH' || action.type === 'EDIT_MATCH_PLAYERS') {
      {
        try {
          await mutateCompetition(group.id, action.compId, (servidor) =>
            action.type === 'DELETE_MATCH'
              ? withMatches(servidor, servidor.matches.filter(m => m.id !== action.matchId), scoringConfig)
              : withMatches(servidor, servidor.matches.map(m =>
                  m.id !== action.matchId ? m : { ...m, teamA: action.teamA, teamB: action.teamB }
                ), scoringConfig),
          );
        } catch {
          await enqueue({
            type: action.type === 'DELETE_MATCH' ? 'DELETE_MATCH' : 'EDIT_MATCH_PLAYERS',
            payload: {
              groupId: group.id, compId: action.compId, matchId: action.matchId,
              teamA: action.type === 'EDIT_MATCH_PLAYERS' ? action.teamA : null,
              teamB: action.type === 'EDIT_MATCH_PLAYERS' ? action.teamB : null,
              cfg: scoringConfig,
            },
          });
        }
        // O post do resultado sai junto com o jogo — senão o feed segue
        // anunciando um placar que não existe mais na competição. Falha aqui
        // não desfaz a exclusão do jogo: o post vira só um resto a limpar.
        if (action.type === 'DELETE_MATCH') {
          try { await deleteFeedItemsByMatch(group.id, action.compId, action.matchId); }
          catch { console.error('[KingBT] Sync error: DELETE_MATCH feed'); }
        }
      }
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

  async function refresh() {
    if (!group) return;
    const comps = await fetchCompetitionsOnce(group.id);
    dispatch({ type: 'SET', competitions: comps });
  }

  function subscribeLiveMatchesForComp(compId: string): Unsubscribe {
    if (!group) return () => {};
    return fsSubscribeLiveMatches(group.id, compId, (matchId, data) => {
      dispatch({ type: 'SYNC_LIVE_MATCH', compId, matchId, liveScore: data.liveScore, draftSets: data.draftSets });
    });
  }

  return (
    <Ctx.Provider value={{ state, dispatch: wrappedDispatch, addCompetition, refresh, subscribeLiveMatches: subscribeLiveMatchesForComp }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCompetitions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCompetitions must be inside CompetitionsProvider');
  return ctx;
}
