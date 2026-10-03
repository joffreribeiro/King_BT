import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/store/AuthContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { matchGames } from '@/logic/setOutcome';
import { useChallenges } from '@/hooks/useChallenges';
import { useSettings } from '@/store/SettingsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { personalNotifs } from '@/logic/personalNotifs';

export type NotifType =
  | 'result_new'
  | 'comp_started'
  | 'achievement_unlock'
  | 'player_ranked_up'
  | 'invite'
  | 'challenge_in'
  | 'challenge_reply'
  | 'challenge_game'
  | 'score_confirm'
  | 'honor'
  | 'announcement';

export interface AppNotif {
  id: string;
  type: NotifType;
  title: string;
  description: string;
  read: boolean;
  createdAt: Date;
  actionCompId?: string;
  /** Rota do app a abrir ao tocar (quando não é uma competição). */
  actionRoute?: string;
}

/**
 * Antes a lista de notificações era derivada dentro da própria tela, com o
 * "lido" num `useState` local — ou seja, o sino do cabeçalho não tinha como
 * saber se havia algo não lido, e sair da tela zerava as marcações. Aqui a
 * derivação é a mesma de antes, mas o conjunto de ids já lidos vive no
 * AsyncStorage (por grupo), de modo que a marcação sobrevive à navegação.
 */
const readKey = (groupId?: string) => `kingbt:notifsRead:${groupId ?? 'none'}`;

/**
 * Store de módulo: o sino do cabeçalho e a tela de notificações montam o hook
 * separadamente, então guardar as lidas num estado por instância deixaria o
 * badge aceso mesmo depois de "Marcar todas lidas". Assim as duas leem e
 * escrevem no mesmo conjunto.
 */
const store = {
  groupId: undefined as string | undefined,
  readIds: new Set<string>(),
  loaded: false,
  listeners: new Set<() => void>(),
  set(groupId: string | undefined, ids: Set<string>, loaded: boolean) {
    store.groupId = groupId;
    store.readIds = ids;
    store.loaded = loaded;
    store.listeners.forEach(fn => fn());
  },
};

export function useNotifications() {
  const { group, myPlayerId } = useAuth();
  const { state } = useCompetitions();
  const { challenges } = useChallenges();
  const { honors, announcements } = useSettings();
  const { findPlayer } = useGroupPlayers();
  const groupId = group?.id;
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender(n => n + 1);
    store.listeners.add(listener);
    return () => { store.listeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (store.groupId === groupId && store.loaded) return;
    let alive = true;
    store.set(groupId, new Set(), false);
    AsyncStorage.getItem(readKey(groupId))
      .then(raw => {
        if (alive) store.set(groupId, new Set<string>(raw ? JSON.parse(raw) : []), true);
      })
      .catch(() => { if (alive) store.set(groupId, new Set(), true); });
    return () => { alive = false; };
  }, [groupId]);

  const readIds = store.readIds;
  const loaded = store.loaded;

  const persist = useCallback((next: Set<string>) => {
    store.set(groupId, next, true);
    AsyncStorage.setItem(readKey(groupId), JSON.stringify([...next])).catch(() => {});
  }, [groupId]);

  // Mesma derivação que existia na tela de notificações.
  const base = useMemo<Omit<AppNotif, 'read'>[]>(() => {
    const list: Omit<AppNotif, 'read'>[] = [];

    state.competitions.forEach(comp => {
      comp.matches
        .filter(m => m.scoreA != null && m.playedAt)
        .sort((a, b) => (b.playedAt ?? '').localeCompare(a.playedAt ?? ''))
        .slice(0, 3)
        .forEach(m => {
          const { a: gA, b: gB } = matchGames(m, comp.config?.winRule);
          list.push({
            id: `result_${m.id}`,
            type: 'result_new',
            title: `Novo resultado: ${comp.name}`,
            description: `Placar registrado: ${gA}–${gB}`,
            createdAt: m.playedAt ? new Date(m.playedAt) : new Date(),
            actionCompId: comp.id,
          });
        });
    });

    state.competitions
      .filter(c => c.status === 'active')
      .slice(0, 2)
      .forEach(comp => {
        list.push({
          id: `comp_${comp.id}`,
          type: 'comp_started',
          title: 'Competição em andamento',
          description: `${comp.name} está acontecendo agora`,
          createdAt: new Date(comp.date + 'T12:00:00'),
          actionCompId: comp.id,
        });
      });

    // Avisos pessoais (desafios, placar a confirmar, honrarias, comunicados) têm prioridade sobre o resto.
    const personal = personalNotifs({
      myId: myPlayerId, challenges, honors, announcements, competitions: state.competitions,
      nameOf: id => findPlayer(id)?.name ?? 'Jogador',
    });

    const byDate = (a: { createdAt: Date }, b: { createdAt: Date }) => b.createdAt.getTime() - a.createdAt.getTime();
    return [...personal.sort(byDate).slice(0, 20), ...list.sort(byDate).slice(0, 20)].sort(byDate);
  }, [state.competitions, myPlayerId, challenges, honors, announcements, findPlayer]);

  const notifs = useMemo<AppNotif[]>(
    () => base.map(n => ({ ...n, read: readIds.has(n.id) })),
    [base, readIds]
  );

  // Enquanto o storage não respondeu, não acusa não-lidas — evita o sino
  // piscar um badge que some meio segundo depois.
  const unread = loaded ? notifs.filter(n => !n.read).length : 0;

  const markRead = useCallback((id: string) => {
    persist(new Set([...readIds, id]));
  }, [persist, readIds]);

  const markAllRead = useCallback(() => {
    persist(new Set([...readIds, ...base.map(n => n.id)]));
  }, [persist, readIds, base]);

  return { notifs, unread, markRead, markAllRead };
}
