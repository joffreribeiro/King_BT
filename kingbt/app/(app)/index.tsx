import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, Platform, TextInput, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card, EmptyState } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Competition, Format } from '@/logic/types';
import { competitionChampion as getChampion } from '@/logic/formats';
import { computeStreak } from '@/logic/streak';
import { StreakBanner } from '@/components/StreakBanner';
import { usePulseAnim } from '@/hooks/usePulseAnim';
import { FadeScreen } from '@/components/FadeScreen';

const FORMAT_LABEL: Record<string, string> = {
  avulso: 'Avulso', liga: 'Liga', grupos: 'Grupos + Eliminatórias',
  mata: 'Mata-Mata', super8: 'Super 8',
};
const FORMAT_ICON: Record<string, string> = {
  liga: '≡', grupos: '⊞', mata: '⇌', avulso: '✕', super8: '◈',
};
const FORMAT_ICON_BG: Record<string, string> = {
  liga: '#1a2e1a', grupos: '#1a1a2e', mata: '#2e1a1a', avulso: '#1a2a2e', super8: '#2a1a2e',
};
const FORMAT_ICON_COLOR: Record<string, string> = {
  liga: '#54B981', grupos: '#6B7FD7', mata: '#E5483D', avulso: '#2DD4BF', super8: '#C084FC',
};
const FORMAT_ACCENT: Record<string, string> = {
  avulso: '#38BDF8', liga: '#6B7FD7', grupos: '#6B7FD7', mata: '#E5483D', super8: '#C084FC',
};

const STATUS_FILTERS = [
  { key: 'all',    label: 'Todas' },
  { key: 'active', label: 'Em andamento' },
  { key: 'done',   label: 'Encerradas' },
] as const;
type StatusFilter = typeof STATUS_FILTERS[number]['key'];

const FORMAT_FILTERS: { key: Format | 'all'; label: string }[] = [
  { key: 'all',    label: 'Todos' },
  { key: 'avulso', label: 'Avulso' },
  { key: 'liga',   label: 'Liga' },
  { key: 'grupos', label: 'Grupos' },
  { key: 'mata',   label: 'Mata-mata' },
  { key: 'super8', label: 'Super 8' },
];

function Skeleton({ width = '100%' as number | string, height = 16, radius = 8 }: {
  width?: number | string; height?: number; radius?: number;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={{ width: width as any, height, borderRadius: radius, backgroundColor: Colors.surf2, opacity }} />;
}

function SkeletonCard() {
  return (
    <View style={{ backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, marginHorizontal: Spacing.md }}>
      <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
        <Skeleton width={36} height={36} radius={8} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={10} />
        </View>
      </View>
      <Skeleton height={1} radius={1} />
      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
        <Skeleton width="30%" height={10} />
        <Skeleton width="20%" height={10} />
      </View>
    </View>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const today = new Date();
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}


function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 }}>
      <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontFamily: FontFamily.number, fontSize: 11, color, letterSpacing: 1.2, fontWeight: '700' }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function CompCard({ comp, onDelete, onClone }: {
  comp: Competition; onDelete: (id: string) => void; onClone: (id: string) => void;
}) {
  const { findPlayer } = useGroupPlayers();
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;
  const pct   = total > 0 ? done / total : 0;
  const isActive = comp.status === 'active';
  const isDone = comp.status === 'done';
  const accent = isDone ? '#6E6452' : (FORMAT_ACCENT[comp.format] ?? Colors.gold);
  const champRaw = !isActive ? getChampion(comp, id => findPlayer(id)?.name ?? id) : null;
  const champ = champRaw
    ? { name: (champRaw as any).name ?? findPlayer(champRaw.members[0])?.name ?? champRaw.members[0] }
    : null;

  function handleLongPress() {
    const doDelete = () => onDelete(comp.id);
    const doClone  = () => onClone(comp.id);
    if (Platform.OS === 'web') {
      if (window.confirm(`Apagar "${comp.name}"?`)) doDelete();
    } else {
      Alert.alert(comp.name, 'O que deseja fazer?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: '🔁 Criar igual', onPress: doClone },
        { text: '🗑 Apagar', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  const pulseAnim = usePulseAnim(2000);
  const shadowOpacity = isActive
    ? pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.45] })
    : new Animated.Value(0);

  // Player bubbles
  const ids = new Set<string>();
  comp.matches.forEach(m => {
    (m.teamA ?? (m.aId ? [m.aId] : [])).forEach(id => ids.add(id));
    (m.teamB ?? (m.bId ? [m.bId] : [])).forEach(id => ids.add(id));
  });
  if (comp.competitors.length > 0) comp.competitors.forEach(c => ids.add(c.id));
  const players = [...ids].slice(0, 12).map(id => {
    const c = comp.competitors.find(x => x.id === id);
    const p = findPlayer(id);
    return { id, color: c?.color ?? p?.color ?? Colors.gold, short: c?.short ?? p?.name?.slice(0, 2).toUpperCase() ?? '?' };
  });

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => router.push({ pathname: '/competitions/[id]', params: { id: comp.id } })}
      onLongPress={handleLongPress}
      delayLongPress={600}
    >
      <Animated.View style={[
        styles.compCard,
        { borderColor: isDone ? 'rgba(110,100,82,0.20)' : `${accent}33` },
        {
          shadowColor: accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity,
          shadowRadius: 16,
          elevation: isActive ? 6 : 0,
          opacity: isDone ? 0.85 : 1,
        },
      ]}>
        {/* Header strip with gradient */}
        <LinearGradient
          colors={[`${accent}30`, `${accent}10`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.cardHeader, { borderBottomColor: `${accent}1F` }]}
        >
          <View style={[styles.fmtIconContainer, { backgroundColor: `${accent}2E` }]}>
            <Text style={[styles.fmtIconText, { color: accent }]}>{FORMAT_ICON[comp.format]}</Text>
          </View>
          <Text style={[styles.formatLabel, { color: accent }]}>{FORMAT_LABEL[comp.format]?.toUpperCase()}</Text>
          <Badge label={isActive ? 'EM ANDAMENTO' : 'ENCERRADA'} variant={isActive ? 'gold' : 'teal'} small />
        </LinearGradient>

        {/* Card body */}
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{comp.name}</Text>
          <Text style={styles.cardMetaText}>{formatDate(comp.date)} · {comp.competitors.length} jogadores</Text>

          {/* Player bubbles */}
          {players.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {players.map(p => (
                <View key={p.id} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: p.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.bg }}>{p.short}</Text>
                </View>
              ))}
            </View>
          )}

          {champ ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 14 }}>👑</Text>
              <Text style={{ fontFamily: FontFamily.title, fontSize: 13, color: Colors.gold, flex: 1 }}>{champ.name}</Text>
              <Text style={styles.dateText}>{formatDate(comp.date)}</Text>
              <TouchableOpacity onPress={() => onClone(comp.id)} hitSlop={8} style={{ padding: 4 }}>
                <Text style={{ fontSize: 15 }}>🔁</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: accent }]} />
              </View>
              <Text style={[styles.progressLabel, { color: accent }]}>{Math.round(pct * 100)}%</Text>
              <Text style={styles.dateText}>{done}/{total} jogos</Text>
              {isActive && (
                <TouchableOpacity
                  onPress={e => { e.stopPropagation?.(); router.push({ pathname: '/court', params: { compId: comp.id } }); }}
                  hitSlop={8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.teal + '22', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.teal + '44' }}
                >
                  <Text style={{ fontSize: 11 }}>🏓</Text>
                  <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.teal }}>Quadra</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function HubScreen() {
  const { state, dispatch } = useCompetitions();
  const { group, isAdmin, myPlayerId } = useAuth();
  const { groupPlayers } = useGroupPlayers();
  const me = groupPlayers.find(p => p.id === myPlayerId);

  const myStreak = computeStreak(state.competitions, myPlayerId ?? '');

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formatFilter, setFormatFilter] = useState<Format | 'all'>('all');
  const [showSearch, setShowSearch]   = useState(false);

  const filtered = state.competitions.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (formatFilter !== 'all' && c.format !== formatFilter) return false;
    if (search.trim() && !c.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const active = filtered.filter(c => c.status === 'active');
  const done   = filtered.filter(c => c.status === 'done');
  const listData = [...active, ...done];

  const hasFilter = statusFilter !== 'all' || formatFilter !== 'all' || search.trim().length > 0;

  return (
    <FadeScreen>
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={listData}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Search toggle */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }}>
              <TouchableOpacity onPress={() => { setShowSearch(v => !v); if (showSearch) setSearch(''); }}>
                <View style={[styles.iconBtn, showSearch && styles.iconBtnActive]}>
                  <Text style={styles.iconBtnText}>⌕</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Offline indicator */}
            {!state.synced && (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineText}>⟳  Sincronizando com o servidor…</Text>
              </View>
            )}

            {/* Search bar */}
            {showSearch && (
              <View style={styles.searchBar}>
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar competição..."
                  placeholderTextColor={Colors.faint}
                  autoFocus
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
                    <Text style={styles.searchClearText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Streak banner */}
            <StreakBanner
              streak={myStreak}
              onPress={() => router.push('/(app)/ranking')}
            />

            {/* Filter chips — status */}
            <View style={styles.filterRow}>
              {STATUS_FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, statusFilter === f.key && styles.chipActive]}
                  onPress={() => setStatusFilter(f.key)}
                >
                  <Text style={[styles.chipText, statusFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Filter chips — format */}
            <View style={[styles.filterRow, { marginBottom: Spacing.md }]}>
              {FORMAT_FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, formatFilter === f.key && styles.chipActive]}
                  onPress={() => setFormatFilter(f.key)}
                >
                  <Text style={[styles.chipText, formatFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Botão criar */}
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => router.push('/competitions/new/format')}
              activeOpacity={0.85}
            >
              <Text style={styles.createBtnText}>+ Criar competição</Text>
            </TouchableOpacity>

            {active.length > 0 && <SectionHeader label="Em andamento" color={Colors.gold} />}
          </View>
        }
        renderItem={({ item, index }) => {
          const isFirstDone = item.status === 'done' && (index === 0 || listData[index - 1]?.status === 'active');
          return (
            <View>
              {isFirstDone && <SectionHeader label="Encerradas" color={Colors.teal} />}
              <CompCard
                comp={item}
                onDelete={isAdmin ? (id) => dispatch({ type: 'DELETE', compId: id }) : () => {}}
                onClone={isAdmin ? (id) => dispatch({ type: 'CLONE', compId: id }) : () => {}}
              />
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
        ListEmptyComponent={
          !state.synced ? (
            <View style={{ gap: Spacing.sm, paddingTop: Spacing.xs }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            hasFilter ? (
              <EmptyState
                icon="racket"
                title="Nenhum resultado"
                subtitle="Nenhuma competição corresponde aos filtros aplicados."
                ctaLabel="Limpar filtros"
                onCta={() => { setStatusFilter('all'); setFormatFilter('all'); setSearch(''); }}
              />
            ) : (
              <EmptyState
                icon="racket"
                title="Sem competições ativas"
                subtitle="Crie a primeira e comece a disputar o ranking!"
                ctaLabel="+ Nova Competição"
                onCta={() => router.push('/competitions/new/format')}
              />
            )
          )
        }
      />
    </SafeAreaView>
    </FadeScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.md, paddingTop: Spacing.sm },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 140,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logo: { width: 52, height: 52 },
  headerGroup: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  headerTitle: {
    fontFamily: FontFamily.titleBold,
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 0.5,
    maxWidth: 200,
  },

  syncDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.gold + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  syncDotInner: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: Colors.gold,
  },

  offlineBanner: {
    backgroundColor: Colors.surf2,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  offlineText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },

  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surf2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  iconBtnActive: { borderColor: Colors.gold },
  iconBtnText: { fontSize: 20, color: Colors.muted },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surf, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontFamily: FontFamily.body, fontSize: 15, color: Colors.text,
  },
  searchClear: { padding: Spacing.xs },
  searchClearText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral },

  filterRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: Spacing.xs, marginBottom: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surf2,
    borderWidth: 1, borderColor: Colors.line,
  },
  chipActive: { backgroundColor: Colors.gold + '22', borderColor: Colors.gold },
  chipText: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted },
  chipTextActive: { color: Colors.gold },

  createBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  createBtnText: {
    fontFamily: FontFamily.title,
    fontSize: 16,
    color: Colors.bg,
  },

  compCard: {
    backgroundColor: '#16140F',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.line,
    marginBottom: 0,
  },
  cardHeader: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
  },
  fmtIconContainer: {
    width: 24, height: 24, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  fmtIconText: { fontSize: 13 },
  formatLabel: {
    fontSize: 9, fontWeight: '700',
    fontFamily: FontFamily.numberBold,
    letterSpacing: 1, flex: 1,
  },
  cardBody: {
    padding: 10, paddingHorizontal: 12,
  },
  cardName: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  cardMetaText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 6 },
  progressTrack: { flex: 1, height: 4, borderRadius: 3, backgroundColor: '#221C12', overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 3 },
  progressLabel: { fontSize: 9, fontWeight: '700', fontFamily: FontFamily.numberBold },
  dateText: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.faint },

  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm, marginTop: Spacing.lg },
  emptyText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.muted },
  emptyHint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
