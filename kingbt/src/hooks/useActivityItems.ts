import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useFeed } from '@/store/FeedContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { buildDoneItems } from '@/logic/feedDone';
import { honorFeedItems } from '@/logic/honors';
import { useSettings } from '@/store/SettingsContext';
import type { FeedItem } from '@/firebase/feed';

/**
 * Atividade do grupo: o feed gravado + os cards de campeão/finalizado das
 * competições encerradas. Nenhum jogo avulso do feed aparece.
 * Um card derivado é substituído pelo documento real assim que ele existe
 * (alguém reagiu/comentou), então nunca aparece duplicado.
 */
export function useActivityItems() {
  const feed = useFeed();
  const { state } = useCompetitions();
  const scoringConfig = state.scoringConfig;
  const { findPlayer } = useGroupPlayers();
  const { honors } = useSettings();

  const items = useMemo(() => {
    // Jogo a jogo não aparece em nenhum formato; o resultado entra pelos cards de fim de competição.
    const real = feed.items.filter(it => it.type !== 'match_result');
    const realIds = new Set(real.map(it => it.id));

    const derived: FeedItem[] = buildDoneItems(state.competitions, id => findPlayer(id)?.name ?? id, scoringConfig)
      .filter(d => !realIds.has(d.id))
      .map(d => ({
        id: d.id,
        type: d.kind,
        compId: d.compId,
        compName: d.compName,
        format: d.format,
        playerName: d.championName,
        involvedIds: d.championIds,
        timestamp: Timestamp.fromDate(d.date),
        reactions: { '👑': [], '🔥': [], '💪': [] },
        comments: [],
        derived: true,
      }));

    // Honrarias do admin viram um card no feed (montado na tela, sem gravar nada).
    for (const h of honorFeedItems(honors, id => findPlayer(id)?.name ?? '')) {
      derived.push({
        id: h.id, type: 'honor', compId: '', compName: '', playerId: h.playerId, playerName: h.playerName,
        involvedIds: [h.playerId], milestoneEmoji: h.icon, milestoneTitle: h.title, milestoneDesc: h.desc,
        timestamp: Timestamp.fromDate(h.date), reactions: {}, comments: [], derived: true,
      });
    }

    const ms = (it: FeedItem) => it.timestamp?.toMillis?.() ?? 0;
    return [...real, ...derived].sort((a, b) => ms(b) - ms(a));
  }, [feed.items, state.competitions, scoringConfig, findPlayer, honors]);

  return { items, loaded: feed.loaded, error: feed.error, refresh: feed.refresh };
}
