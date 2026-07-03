import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar } from '@/components';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useCompetitions } from '@/store/CompetitionsContext';

// ── Tipos ──────────────────────────────────────────────────────────────────────

type NotifType =
  | 'result_new'
  | 'comp_started'
  | 'achievement_unlock'
  | 'player_ranked_up'
  | 'invite';

interface AppNotif {
  id: string;
  type: NotifType;
  title: string;
  description: string;
  read: boolean;
  createdAt: Date;
  actionCompId?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

const NOTIF_META: Record<NotifType, { icon: string; color: string }> = {
  result_new:        { icon: '🎾', color: Colors.gold },
  comp_started:      { icon: '🏆', color: Colors.teal },
  achievement_unlock:{ icon: '🏅', color: Colors.teal },
  player_ranked_up:  { icon: '📈', color: Colors.gold },
  invite:            { icon: '📬', color: '#6B91F0' },
};

// ── Item de Notificação ────────────────────────────────────────────────────────

function NotifItem({ notif, onPress }: { notif: AppNotif; onPress: () => void }) {
  const meta = NOTIF_META[notif.type];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[ns.item, !notif.read && ns.itemUnread]}
    >
      {!notif.read && <View style={ns.unreadDot} />}
      <View style={[ns.iconWrap, { backgroundColor: meta.color + '18' }]}>
        <Text style={ns.icon}>{meta.icon}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[ns.title, !notif.read && { color: Colors.text }]} numberOfLines={1}>
          {notif.title}
        </Text>
        <Text style={ns.desc} numberOfLines={2}>{notif.description}</Text>
        <Text style={ns.time}>{timeAgo(notif.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Tela Principal ─────────────────────────────────────────────────────────────

type Tab = 'notif' | 'invites';

export default function NotificationsScreen() {
  const { myPlayerId } = useAuth();
  const { findPlayer } = useGroupPlayers();
  const { state } = useCompetitions();
  const [tab, setTab] = useState<Tab>('notif');
  const [refreshing, setRefreshing] = useState(false);

  // Gera notificações a partir dos dados reais da competição
  const [notifs, setNotifs] = useState<AppNotif[]>(() => {
    const list: AppNotif[] = [];

    // Resultados recentes (últimas 5 partidas com placar)
    state.competitions.forEach(comp => {
      comp.matches
        .filter(m => m.scoreA != null && m.playedAt)
        .sort((a, b) => (b.playedAt ?? '').localeCompare(a.playedAt ?? ''))
        .slice(0, 3)
        .forEach(m => {
          list.push({
            id: `result_${m.id}`,
            type: 'result_new',
            title: `Novo resultado: ${comp.name}`,
            description: `Placar registrado: ${m.scoreA}–${m.scoreB}`,
            read: false,
            createdAt: m.playedAt ? new Date(m.playedAt) : new Date(Date.now() - Math.random() * 86400000),
            actionCompId: comp.id,
          });
        });
    });

    // Competições ativas
    state.competitions
      .filter(c => c.status === 'active')
      .slice(0, 2)
      .forEach(comp => {
        list.push({
          id: `comp_${comp.id}`,
          type: 'comp_started',
          title: `Competição em andamento`,
          description: `${comp.name} está acontecendo agora`,
          read: false,
          createdAt: new Date(comp.date + 'T12:00:00'),
          actionCompId: comp.id,
        });
      });

    // Ordena por data DESC e limita
    return list
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20);
  });

  const unread = useMemo(() => notifs.filter(n => !n.read).length, [notifs]);

  function markRead(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <SafeAreaView style={ns.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={ns.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={ns.headerTitle}>Notificações</Text>
          {unread > 0 && (
            <View style={ns.badge}>
              <Text style={ns.badgeTxt}>{unread}</Text>
            </View>
          )}
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
            <Text style={ns.markAll}>Marcar todas lidas</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={ns.tabs}>
        <TouchableOpacity
          style={[ns.tab, tab === 'notif' && ns.tabActive]}
          onPress={() => setTab('notif')}
          activeOpacity={0.7}
        >
          <Text style={[ns.tabLabel, tab === 'notif' && ns.tabLabelActive]}>
            Notificações{unread > 0 ? ` (${unread})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[ns.tab, tab === 'invites' && ns.tabActive]}
          onPress={() => setTab('invites')}
          activeOpacity={0.7}
        >
          <Text style={[ns.tabLabel, tab === 'invites' && ns.tabLabelActive]}>Convites</Text>
        </TouchableOpacity>
      </View>

      {/* Conteúdo */}
      {tab === 'notif' && (
        <ScrollView
          contentContainerStyle={ns.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        >
          {notifs.length === 0 ? (
            <View style={ns.empty}>
              <Text style={ns.emptyIcon}>🔔</Text>
              <Text style={ns.emptyText}>Nenhuma notificação</Text>
              <Text style={ns.emptySub}>As atualizações do grupo aparecerão aqui</Text>
            </View>
          ) : (
            notifs.map(n => (
              <NotifItem
                key={n.id}
                notif={n}
                onPress={() => {
                  markRead(n.id);
                  if (n.actionCompId) {
                    router.push({ pathname: '/competitions/[id]', params: { id: n.actionCompId } });
                  }
                }}
              />
            ))
          )}
          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      )}

      {tab === 'invites' && (
        <ScrollView
          contentContainerStyle={ns.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        >
          <View style={ns.empty}>
            <Text style={ns.emptyIcon}>📬</Text>
            <Text style={ns.emptyText}>Nenhum convite pendente</Text>
            <Text style={ns.emptySub}>Convites para competições aparecerão aqui</Text>
          </View>
          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const ns = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  headerTitle: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.text },
  badge: {
    backgroundColor: Colors.coral, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeTxt: { fontFamily: FontFamily.numberBold, fontSize: 11, color: '#fff' },
  markAll: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.teal },

  tabs: {
    flexDirection: 'row', marginHorizontal: Spacing.md,
    backgroundColor: Colors.surf2, borderRadius: Radius.md,
    padding: 3, marginBottom: Spacing.sm,
  },
  tab: { flex: 1, paddingVertical: 7, borderRadius: Radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.surf },
  tabLabel: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.faint },
  tabLabelActive: { color: Colors.gold },

  scroll: { paddingHorizontal: Spacing.md },

  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line,
    position: 'relative',
  },
  itemUnread: { backgroundColor: Colors.surf + '80' },
  unreadDot: {
    position: 'absolute', top: Spacing.sm + 6, left: -Spacing.md / 2,
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  icon: { fontSize: 18 },
  title: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  desc: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.faint, lineHeight: 17 },
  time: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },

  empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyIcon: { fontSize: 44 },
  emptyText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  emptySub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', maxWidth: 240 },
});
