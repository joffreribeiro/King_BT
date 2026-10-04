import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMemo, useState, useCallback } from 'react';
import { FontFamily, Spacing, Radius, Type, centeredContent, wideContent, type ThemeColors } from '@/theme';
import { useIsWide } from '@/hooks/useIsWide';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useFeed } from '@/store/FeedContext';
import { useActivityItems } from '@/hooks/useActivityItems';
import { computeStreak } from '@/logic/streak';
import { feedLine } from '@/logic/homeSummary';
import { EventCard } from '@/components/EventCard';
import { StreakBanner } from '@/components/StreakBanner';
import { HomeSummary } from '@/components/HomeSummary';
import { AnnouncementsBanner } from '@/components/AnnouncementsBanner';
import { FadeScreen } from '@/components/FadeScreen';
import { Icon, Avatar } from '@/components';

/** "terça-feira, 29 de setembro" — com a inicial maiúscula. */
function todayLabel(): string {
  const s = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function timeAgo(ts: any): string {
  const t = ts?.toDate?.()?.getTime?.();
  if (!t) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

/**
 * Tela inicial: o que exige ação sua (próxima partida, pendências), onde você
 * está no ranking e o que acabou de acontecer no grupo. A lista completa de
 * competições fica na aba Competições; a atividade completa, em Atividade.
 */
export default function HomeScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { user, myPlayerId } = useAuth();
  const { state, refresh } = useCompetitions();
  const { groupPlayers } = useGroupPlayers();
  const { refresh: refreshFeed } = useFeed();
  const { items, loaded } = useActivityItems();
  const wide = useIsWide();

  const me = groupPlayers.find(p => p.id === myPlayerId);
  const firstName = (me?.name ?? user?.displayName ?? '').trim().split(/\s+/)[0];
  const streak = useMemo(() => computeStreak(state.competitions, myPlayerId ?? ''), [state.competitions, myPlayerId]);
  // O card de campeão repete o de "finalizado" — na Home basta um.
  const recent = items.filter(it => it.type !== 'champion').slice(0, 3);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([refresh(), refreshFeed()]); }
    finally { setRefreshing(false); }
  }, [refresh, refreshFeed]);

  return (
    <FadeScreen>
      <SafeAreaView style={s.container} edges={[]}>
        <ScrollView
          contentContainerStyle={[s.content, wide && s.contentWide]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        >
          <View style={s.hello}>
            {me && <Avatar name={me.name} color={me.color} size={56} />}
            <View style={{ flex: 1 }}>
              <Text style={s.date}>{todayLabel()}</Text>
              <Text style={s.greeting}>Bem-vindo ao KINGBT{firstName ? <>, <Text style={{ color: Colors.gold, textTransform: 'uppercase' }}>{firstName}</Text></> : ''}</Text>
              <Text style={s.group}>Play com respeito, evolua sempre</Text>
            </View>
          </View>

          {/* Computador: duas colunas (o que pede ação à esquerda; sequência e atividade à direita). */}
          <View style={wide ? s.cols : undefined}>
          <View style={wide ? s.colMain : undefined}>
          <AnnouncementsBanner />
          <EventCard />
          <HomeSummary />
          </View>
          <View style={wide ? s.colSide : undefined}>
          <StreakBanner streak={streak} onPress={() => router.push({ pathname: '/(app)/arena', params: { tab: 'ranking' } })} />

          {recent.length > 0 && (
            <>
              <View style={s.sectionRow}>
                <Text style={s.label}>ACONTECENDO NO GRUPO</Text>
                <TouchableOpacity onPress={() => router.push({ pathname: '/(app)/arena', params: { tab: 'feed' } })} hitSlop={8} style={s.seeAll}>
                  <Text style={s.seeAllText}>Ver tudo</Text>
                  <Icon name="chevronRight" size={14} color={Colors.gold} />
                </TouchableOpacity>
              </View>
              <View style={s.card}>
                {recent.map((it, i) => {
                  const l = feedLine(it);
                  return (
                    <TouchableOpacity
                      key={it.id}
                      style={[s.post, i > 0 && s.postDivider]}
                      onPress={() => router.push({ pathname: '/(app)/arena', params: { tab: 'feed' } })}
                      activeOpacity={0.75}
                    >
                      <View style={s.emoji}><Text style={{ fontSize: 18 }}>{l.emoji}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.postTitle} numberOfLines={2}>{l.title}</Text>
                        {!!l.sub && <Text style={s.postSub} numberOfLines={1}>{l.sub}</Text>}
                      </View>
                      <Text style={s.time}>{timeAgo(it.timestamp)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
          {!loaded && recent.length === 0 && <Text style={s.hint}>Carregando atividade…</Text>}
          </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </FadeScreen>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { ...centeredContent, padding: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xl },

  contentWide: { maxWidth: wideContent.maxWidth, padding: Spacing.lg, paddingTop: Spacing.md },
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.lg },
  colMain: { flex: 3, minWidth: 0 },
  colSide: { flex: 2, minWidth: 0 },

  hello: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md, paddingHorizontal: 2 },
  date: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'right' },
  greeting: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 26, lineHeight: 31, color: Colors.text, marginTop: 1 },
  group: { fontFamily: FontFamily.bodyMed, fontSize: 15, lineHeight: 20, color: Colors.text, marginTop: 3 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm, marginBottom: Spacing.sm },
  label: { ...Type.sectionLabel, color: Colors.muted, marginLeft: 2 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.gold },

  card: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line },
  post: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 14, paddingHorizontal: 16 },
  postDivider: { borderTopWidth: 1, borderTopColor: Colors.line },
  emoji: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surf2,
    borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center',
  },
  postTitle: { fontFamily: FontFamily.bodyMed, fontSize: 15, lineHeight: 20, color: Colors.text },
  postSub: { ...Type.body, fontSize: 12, color: Colors.muted, marginTop: 2 },
  time: { ...Type.body, fontSize: 12, color: Colors.faint },
  hint: { ...Type.body, color: Colors.faint, textAlign: 'center', marginTop: Spacing.md },
});
