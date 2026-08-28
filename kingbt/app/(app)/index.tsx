import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Alert, Platform, TextInput, Animated, RefreshControl, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FontFamily, Spacing, Radius, Type, formatAccent, type ThemeColors } from '@/theme';
import { makeShadows } from '@/theme/shadows';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/store/ThemeContext';
import { Avatar, Badge, Card, EmptyState, Skeleton, Icon, OptionModal, BottomSheet, NextMatchCard } from '@/components';
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


function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 10 }}>
      <View style={{ width: 5, height: 20, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ ...Type.label, color }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const BUBBLE: ViewStyle = {
  width: 28, height: 28, borderRadius: 14,
  alignItems: 'center', justifyContent: 'center',
  borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.3)',
};

/**
 * Bolha de inicial do jogador. Só anima no card em destaque: numa lista de 20
 * competições, 8 bolhas por card viravam 160 springs simultâneos — e o
 * FlatList remonta o card a cada reciclagem de scroll, refazendo tudo.
 */
function AvatarBubble({ color, short, delay, animate }: {
  color: string; short: string; delay: number; animate: boolean;
}) {
  const { colors: Colors } = useTheme();
  const reduced = useReducedMotion();
  const shouldAnimate = animate && !reduced;
  const opacity = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  const scale   = useRef(new Animated.Value(shouldAnimate ? 0.6 : 1)).current;

  useEffect(() => {
    if (!shouldAnimate) return;
    const anim = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, delay, useNativeDriver: true, tension: 80, friction: 6 }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [shouldAnimate]);

  const label = <Text style={{ ...Type.caption, fontFamily: FontFamily.numberBold, color: Colors.bg }}>{short}</Text>;

  if (!shouldAnimate) {
    return <View style={[BUBBLE, { backgroundColor: color }]}>{label}</View>;
  }
  return (
    <Animated.View style={[BUBBLE, { backgroundColor: color, opacity, transform: [{ scale }] }]}>
      {label}
    </Animated.View>
  );
}

function CompCard({ comp, onDelete, onClone, isAdmin, highlight = false }: {
  comp: Competition; onDelete: (id: string) => void; onClone: (id: string) => void;
  isAdmin: boolean;
  /** Só o card ativo mais recente pulsa/anima — ver comentário em `badgePulse`. */
  highlight?: boolean;
}) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const shadows = useMemo(() => makeShadows(Colors), [Colors]);
  const { findPlayer } = useGroupPlayers();
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;
  const pct   = total > 0 ? done / total : 0;
  const isActive = comp.status === 'active';
  const isDone = comp.status === 'done';
  const accent = isDone ? Colors.faint : formatAccent(Colors, comp.format);
  const champRaw = !isActive ? getChampion(comp, id => findPlayer(id)?.name ?? id) : null;
  const champ = champRaw
    ? { name: (champRaw as any).name ?? findPlayer(champRaw.members[0])?.name ?? champRaw.members[0] }
    : null;

  // Ações do card: mesmo OptionModal nas duas plataformas — o antigo caminho
  // web caía num window.confirm() nativo, que quebrava a identidade visual e
  // não oferecia "criar igual". A confirmação de exclusão é um segundo modal.
  const [showActions, setShowActions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reduced = useReducedMotion();
  // Só o card em destaque (o ativo mais recente) pulsa. Antes TODO card montava
  // um loop de badge + um de sombra + um spring por bolha de avatar: numa lista
  // de 20 competições eram 40+ loops permanentes, e com tudo pulsando nada
  // chamava atenção de fato.
  const animate = highlight && !reduced;
  const pulseAnim = usePulseAnim(2000);
  const shadowOpacity = animate
    ? pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.45] })
    : undefined;

  const badgePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
        Animated.timing(badgePulse, { toValue: 1,   duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animate]);

  // Player bubbles
  // Quando a competição usa competidores nomeados (duplas/times), aId/bId dos
  // matches referenciam o id do competidor (ex.: "d0"), não um jogador — nesse
  // caso os jogadores reais já vêm do loop de competitors.members abaixo.
  const usesCompetitors = comp.competitors.length > 0;
  const ids = new Set<string>();
  comp.matches.forEach(m => {
    (m.teamA ?? (!usesCompetitors && m.aId ? [m.aId] : [])).forEach(id => ids.add(id));
    (m.teamB ?? (!usesCompetitors && m.bId ? [m.bId] : [])).forEach(id => ids.add(id));
  });
  if (usesCompetitors) comp.competitors.forEach(c => c.members.forEach(mid => ids.add(mid)));
  const allPlayerIds = [...ids];
  const players = allPlayerIds.slice(0, 8).map(id => {
    const c = comp.competitors.find(x => x.members.includes(id));
    const p = findPlayer(id);
    return { id, color: p?.color ?? c?.color ?? Colors.gold, short: p?.name?.slice(0, 2).toUpperCase() ?? c?.short ?? '?' };
  });
  const extraPlayers = allPlayerIds.length > 8 ? allPlayerIds.length - 8 : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => router.push({ pathname: '/competitions/[id]', params: { id: comp.id } })}
      onLongPress={isAdmin ? () => setShowActions(true) : undefined}
      delayLongPress={600}
    >
      <Animated.View style={[
        styles.compCard,
        animate
          ? { shadowColor: Colors.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity, shadowRadius: 16, elevation: 8 }
          : shadows.md,
      ]}>
        {/* Faixa de formato — substitui os dois LinearGradient + borda dourada.
            Um card = surf + borda line; a cor identifica o formato. */}
        <View style={[styles.accentStrip, { backgroundColor: accent }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={[styles.formatLabel, { color: accent }]}>{FORMAT_LABEL[comp.format]?.toUpperCase()}</Text>
            {isActive && (
              <Animated.View style={animate ? { opacity: badgePulse } : undefined}>
                <Badge label="ATIVA" variant="gold" small />
              </Animated.View>
            )}
            {/* Ações do card — antes só existiam via long-press de 600ms,
                invisível para quem não sabia que existia. */}
            {isAdmin && (
              <TouchableOpacity onPress={() => setShowActions(true)} hitSlop={10} style={{ padding: 2 }}>
                <Icon name="more" size={16} color={Colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.cardName}>{comp.name}</Text>
          <Text style={styles.cardMetaText}>{formatDate(comp.date)} · {allPlayerIds.length} jogadores</Text>

          {players.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
              {players.map((p, idx) => (
                <AvatarBubble key={p.id} color={p.color} short={p.short} delay={idx * 50} animate={animate} />
              ))}
              {extraPlayers > 0 && (
                <View style={[BUBBLE, { backgroundColor: Colors.surf2, borderColor: Colors.line }]}>
                  <Text style={{ ...Type.caption, fontFamily: FontFamily.numberBold, color: Colors.muted }}>+{extraPlayers}</Text>
                </View>
              )}
            </View>
          )}

          {champ ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Icon name="crown" size={16} color={Colors.gold} />
              <Text style={{ ...Type.title, color: Colors.gold, flex: 1 }}>{champ.name}</Text>
              <Text style={styles.dateText}>{formatDate(comp.date)}</Text>
              <TouchableOpacity onPress={() => onClone(comp.id)} hitSlop={8} style={{ padding: 4 }}>
                <Icon name="clone" size={16} color={Colors.muted} />
              </TouchableOpacity>
            </View>
          ) : (
            /* Progresso: barra + contador. O percentual saiu — dizia a mesma
               coisa que "6/12 jogos", duas vezes na mesma linha. */
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: accent }]} />
              </View>
              <Text style={styles.dateText}>{done}/{total} jogos</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {showActions && (
        <OptionModal
          title={comp.name}
          message="O que deseja fazer?"
          options={[
            { key: 'clone',  label: 'Criar igual', icon: 'clone' },
            { key: 'delete', label: 'Apagar',      icon: 'trash', color: Colors.coral },
          ]}
          onSelect={(k) => {
            setShowActions(false);
            if (k === 'clone') onClone(comp.id);
            else setConfirmDelete(true);
          }}
          onClose={() => setShowActions(false)}
        />
      )}

      {confirmDelete && (
        <OptionModal
          title="Apagar competição"
          message={`"${comp.name}" e todos os seus jogos serão apagados. Não dá para desfazer.`}
          options={[{ key: 'confirm', label: 'Apagar definitivamente', icon: 'trash', color: Colors.coral }]}
          onSelect={() => { setConfirmDelete(false); onDelete(comp.id); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </TouchableOpacity>
  );
}

export default function HubScreen() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { state, dispatch, refresh } = useCompetitions();
  const { group, isAdmin, myPlayerId } = useAuth();
  const { groupPlayers } = useGroupPlayers();
  const me = groupPlayers.find(p => p.id === myPlayerId);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); }
    finally { setRefreshing(false); }
  }, [refresh]);

  const myStreak = computeStreak(state.competitions, myPlayerId ?? '');

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formatFilter, setFormatFilter] = useState<Format | 'all'>('all');
  const [showSearch, setShowSearch]   = useState(false);
  const [showFormatSheet, setShowFormatSheet] = useState(false);

  const filtered = state.competitions.filter(c => {
    if (c.isFriendly) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (formatFilter !== 'all' && c.format !== formatFilter) return false;
    if (search.trim() && !c.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const active = filtered.filter(c => c.status === 'active');
  const done   = filtered.filter(c => c.status === 'done');
  const listData = [...active, ...done];
  // Um único card pulsa: o ativo mais recente. `filtered` já vem ordenado por
  // data desc do CompetitionsContext, então é o primeiro de `active`.
  const highlightId = active[0]?.id;

  const hasFilter = statusFilter !== 'all' || formatFilter !== 'all' || search.trim().length > 0;

  return (
    <FadeScreen>
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={listData}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        windowSize={7}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        ListHeaderComponent={
          <View>
            {/* Skeleton loading */}
            {!state.synced && (
              <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }}>
                {[1,2,3].map(i => <Skeleton key={i} variant="comp" />)}
              </View>
            )}

            {/* Streak banner */}
            <StreakBanner
              streak={myStreak}
              onPress={() => router.push('/(app)/ranking')}
            />

            {/* Atalho para a ação mais frequente: marcar o próximo placar. */}
            <NextMatchCard />

            {/* Uma linha de controles em vez das duas fileiras de chips + 2
                botões que ocupavam a tela antes da primeira competição.
                A busca substitui o segmented ao abrir, em vez de empilhar. */}
            <View style={styles.controlRow}>
              {showSearch ? (
                <View style={[styles.searchBar, { flex: 1, marginBottom: 0 }]}>
                  <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Buscar competição..."
                    placeholderTextColor={Colors.faint}
                    autoFocus
                    returnKeyType="search"
                  />
                  <TouchableOpacity
                    onPress={() => { setSearch(''); setShowSearch(false); }}
                    style={styles.searchClear}
                  >
                    <Icon name="close" size={14} color={Colors.coral} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.segmented}>
                  {STATUS_FILTERS.map(f => (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.segment, statusFilter === f.key && styles.segmentActive]}
                      onPress={() => setStatusFilter(f.key)}
                    >
                      <Text style={[styles.segmentText, statusFilter === f.key && styles.segmentTextActive]} numberOfLines={1}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {!showSearch && (
                <TouchableOpacity onPress={() => setShowSearch(true)} style={styles.iconBtn}>
                  <Icon name="search" size={18} color={Colors.muted} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => setShowFormatSheet(true)}
                style={[styles.iconBtn, formatFilter !== 'all' && styles.iconBtnActive]}
              >
                <Icon name="filter" size={18} color={formatFilter !== 'all' ? Colors.gold : Colors.muted} />
                {formatFilter !== 'all' && <View style={styles.filterDot} />}
              </TouchableOpacity>
            </View>

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
                isAdmin={isAdmin}
                highlight={item.id === highlightId}
              />
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
        ListEmptyComponent={
          // O skeleton de carregamento já aparece no header (CompSkeleton,
          // acima dos filtros) — nada aqui pra não empilhar dois estilos
          // de skeleton diferentes ao mesmo tempo.
          !state.synced ? null : (
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
                // Sem competição ativa, o histórico é o que ainda tem conteúdo —
                // e é uma tela que só existia no menu lateral.
                subtitle={state.competitions.length > 0
                  ? 'Nenhuma em andamento. Veja o que já rolou ou crie a próxima.'
                  : 'Crie a primeira e comece a disputar o ranking!'}
                ctaLabel={state.competitions.length > 0 ? 'Ver histórico' : '+ Nova Competição'}
                onCta={() => router.push(state.competitions.length > 0
                  ? '/(app)/history'
                  : '/competitions/new/format')}
              />
            )
          )
        }
      />

      {/* Formato saiu da tela: 6 chips permanentes viraram um sheet sob demanda. */}
      <BottomSheet visible={showFormatSheet} onClose={() => setShowFormatSheet(false)} height={380}>
        <View style={{ paddingHorizontal: Spacing.md, gap: Spacing.xs }}>
          <Text style={styles.sheetTitle}>Formato</Text>
          {FORMAT_FILTERS.map(f => {
            const selected = formatFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.sheetOption, selected && styles.sheetOptionActive]}
                onPress={() => { setFormatFilter(f.key); setShowFormatSheet(false); }}
              >
                {f.key !== 'all' && (
                  <View style={[styles.sheetSwatch, { backgroundColor: formatAccent(Colors, f.key) }]} />
                )}
                <Text style={[styles.sheetOptionText, selected && { color: Colors.gold }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>
    </SafeAreaView>
    </FadeScreen>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
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
    ...Type.title, fontFamily: FontFamily.body, color: Colors.text,
  },
  searchClear: { padding: Spacing.xs },
  searchClearText: { ...Type.body, color: Colors.coral },

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
  chipText: { ...Type.bodyMed, color: Colors.muted },
  chipTextActive: { color: Colors.gold },

  // Linha única de controles: segmented (ou busca) + lupa + filtro.
  controlRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    marginBottom: Spacing.md, marginTop: Spacing.xs,
  },
  segmented: {
    flex: 1, flexDirection: 'row',
    backgroundColor: Colors.surf, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.line, padding: 3,
  },
  segment: { flex: 1, paddingVertical: 6, borderRadius: Radius.full, alignItems: 'center' },
  segmentActive: { backgroundColor: Colors.gold + '22' },
  segmentText: { ...Type.caption, color: Colors.muted },
  segmentTextActive: { color: Colors.gold, fontFamily: FontFamily.bodyMed },
  filterDot: {
    position: 'absolute', top: 6, right: 6,
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold,
  },

  sheetTitle: { ...Type.h2, color: Colors.text, marginBottom: Spacing.xs },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  sheetOptionActive: { backgroundColor: Colors.gold + '18' },
  sheetOptionText: { ...Type.title, color: Colors.text },
  sheetSwatch: { width: 4, height: 20, borderRadius: 2 },

  createRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  createBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  createBtnText: {
    ...Type.h2,
    color: Colors.bg,
  },
  createBtnSecondary: {
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnSecondaryText: {
    ...Type.h2,
    color: Colors.gold,
  },

  filterLabel: {
    ...Type.label,
    color: Colors.text,
    marginBottom: 6,
    marginTop: 4,
    opacity: 0.45,
  },

  compCard: {
    backgroundColor: Colors.surf,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.line,
    marginBottom: 0,
    // Faixa de acento à esquerda ocupando a altura toda do card.
    flexDirection: 'row',
  },
  accentStrip: { width: 3, alignSelf: 'stretch' },
  cardTopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 6,
  },
  formatLabel: {
    ...Type.label, flex: 1,
  },
  cardBody: {
    flex: 1,
    padding: 12, paddingHorizontal: 14,
  },
  cardName: { ...Type.h2, color: Colors.text },
  cardMetaText: { ...Type.caption, color: Colors.muted, marginTop: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 4, backgroundColor: Colors.surf2, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 4 },
  dateText: { ...Type.caption, fontFamily: FontFamily.number, color: Colors.faint },

  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm, marginTop: Spacing.lg },
  emptyText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.muted },
  emptyHint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
