import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { PLAYERS } from '@/mocks/data';
import type { Competition, Format } from '@/logic/types';
import { standings } from '@/logic/formats';

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
  avulso: '#38BDF8', liga: '#54B981', grupos: '#6B7FD7', mata: '#E5483D', super8: '#F472B6',
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

function formatDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const today = new Date();
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}

function competitionChampion(comp: Competition): { name: string } | null {
  if (comp.status !== 'done') return null;
  if (comp.format === 'liga') {
    const st = standings(comp.competitors.map((c: any) => c.id), comp.matches);
    if (!st.length) return null;
    const winner = comp.competitors.find((c: any) => c.id === st[0].id);
    return winner ? { name: winner.name } : null;
  }
  if (comp.format === 'mata' || comp.format === 'grupos') {
    const finalMatch = comp.matches.filter(m => m.stage === 'ko' && !m.third).sort((a, b) => (b.koRound ?? 0) - (a.koRound ?? 0))[0];
    if (!finalMatch || finalMatch.scoreA == null) return null;
    const winnerId = finalMatch.scoreA > finalMatch.scoreB! ? finalMatch.aId : finalMatch.bId;
    const winner = comp.competitors.find((c: any) => c.id === winnerId);
    return winner ? { name: winner.name } : null;
  }
  if (comp.format === 'avulso' || comp.format === 'super8') {
    const scores: Record<string, number> = {};
    comp.matches.forEach(m => {
      if (m.scoreA == null) return;
      const aWon = m.scoreA > m.scoreB!;
      (m.teamA ?? []).forEach((id: string) => { scores[id] = (scores[id] ?? 0) + (aWon ? 1 : 0); });
      (m.teamB ?? []).forEach((id: string) => { scores[id] = (scores[id] ?? 0) + (!aWon ? 1 : 0); });
    });
    const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    const pl = PLAYERS.find(p => p.id === top[0]);
    return pl ? { name: pl.name } : null;
  }
  return null;
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

function CompCard({ comp, onDelete }: { comp: Competition; onDelete: (id: string) => void }) {
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;
  const pct   = total > 0 ? done / total : 0;
  const isActive = comp.status === 'active';
  const accent = FORMAT_ACCENT[comp.format] ?? Colors.gold;
  const champ = !isActive ? competitionChampion(comp) : null;

  function handleLongPress() {
    const doDelete = () => onDelete(comp.id);
    if (Platform.OS === 'web') {
      if (window.confirm(`Apagar "${comp.name}"?`)) doDelete();
    } else {
      Alert.alert('Apagar competição?', `"${comp.name}" será removida permanentemente.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => router.push({ pathname: '/competitions/[id]', params: { id: comp.id } })}
      onLongPress={handleLongPress}
      delayLongPress={600}
    >
      <View style={[styles.compCard, {
        shadowColor: accent,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: isActive ? 0.18 : 0,
        shadowRadius: 12,
        elevation: isActive ? 4 : 0,
      }]}>
        <View style={{ width: 4, backgroundColor: accent, borderRadius: 2, alignSelf: 'stretch' }} />

        <View style={{ flex: 1, padding: Spacing.sm, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={[styles.fmtIcon, { backgroundColor: FORMAT_ICON_BG[comp.format] ?? '#1a1a1a' }]}>
              <Text style={[styles.fmtIconText, { color: FORMAT_ICON_COLOR[comp.format] ?? '#ffffff' }]}>{FORMAT_ICON[comp.format]}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.cardName}>{comp.name}</Text>
              <View style={styles.cardMeta}>
                <Badge label={isActive ? 'EM ANDAMENTO' : 'ENCERRADA'} variant={isActive ? 'gold' : 'teal'} small />
                <Text style={styles.cardMetaText}>{FORMAT_LABEL[comp.format]} · {comp.competitors.length} jogadores</Text>
              </View>
            </View>
          </View>
          {champ ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14 }}>👑</Text>
              <Text style={{ fontFamily: FontFamily.title, fontSize: 13, color: Colors.gold }}>{champ.name}</Text>
              <Text style={styles.dateText}>{formatDate(comp.date)}</Text>
            </View>
          ) : (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: accent }]} />
              </View>
              <Text style={styles.progressText}>{done}/{total} jogos</Text>
              <Text style={styles.dateText}>{formatDate(comp.date)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HubScreen() {
  const { state, dispatch } = useCompetitions();
  const { group, isAdmin } = useAuth();
  const me = PLAYERS[0];

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={listData}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Image
                  source={require('../../assets/kingbt-logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <View>
                  <Text style={styles.headerGroup}>Grupo</Text>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {group?.name ?? 'King BT'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                {!state.synced && (
                  <View style={styles.syncDot}>
                    <View style={styles.syncDotInner} />
                  </View>
                )}
                <TouchableOpacity onPress={() => { setShowSearch(v => !v); if (showSearch) setSearch(''); }}>
                  <View style={[styles.iconBtn, showSearch && styles.iconBtnActive]}>
                    <Text style={styles.iconBtnText}>⌕</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/(app)/profile')}>
                  <Avatar name={me.name} color={me.color} size={40} />
                </TouchableOpacity>
              </View>
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
              <CompCard comp={item} onDelete={isAdmin ? (id) => dispatch({ type: 'DELETE', compId: id }) : () => {}} />
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
        ListEmptyComponent={
          <Card style={styles.empty}>
            {hasFilter ? (
              <>
                <Text style={styles.emptyText}>Nenhum resultado.</Text>
                <TouchableOpacity onPress={() => { setStatusFilter('all'); setFormatFilter('all'); setSearch(''); }}>
                  <Text style={[styles.emptyHint, { color: Colors.teal }]}>Limpar filtros</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.emptyText}>Nenhuma competição ainda.</Text>
                <Text style={styles.emptyHint}>Toque em "+ Criar competição" para começar.</Text>
              </>
            )}
          </Card>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.md, paddingTop: Spacing.sm },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
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
    backgroundColor: Colors.surf,
    borderRadius: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.line,
  },
  fmtIcon: {
    width: 40, height: 40, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  fmtIconText: { fontSize: 18 },
  cardName: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  cardMetaText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: Colors.line, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },
  progressText: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.muted },
  dateText: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.faint },

  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm, marginTop: Spacing.lg },
  emptyText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.muted },
  emptyHint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, textAlign: 'center' },
});
