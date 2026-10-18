import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Animated, RefreshControl, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useMemo, useCallback } from 'react';
import { FontFamily, Spacing, centeredContent, wideContent, SIDEBAR_WIDTH, Radius, Type, formatAccent, type ThemeColors } from '@/theme';
import { useIsWide } from '@/hooks/useIsWide';
import { makeShadows } from '@/theme/shadows';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/store/ThemeContext';
import { EmptyState, Skeleton, Icon, OptionModal, BottomSheet } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Competition, Format } from '@/logic/types';
import { competitionChampion as getChampion } from '@/logic/formats';
import { formatRelativeDate, parseStoredDate } from '@/logic/format';
import { eventView } from '@/logic/eventRegistration';
import { matchesStatus, filterBeforeStatus, countByStatus, type StatusFilter } from '@/logic/competitionFilters';
import { usePulseAnim } from '@/hooks/usePulseAnim';
import { FadeScreen } from '@/components/FadeScreen';

const FORMAT_LABEL: Record<string, string> = {
  avulso: 'Avulso', liga: 'Liga', grupos: 'Grupos + Eliminatórias',
  mata: 'Mata-Mata', super8: 'Super 8',
};
const STATUS_FILTERS = [
  { key: 'all',      label: 'Todas' },
  { key: 'upcoming', label: 'Agendadas' },
  { key: 'active',   label: 'Em andamento' },
  { key: 'done',   label: 'Encerradas' },
] as const;

const FORMAT_FILTERS: { key: Format | 'all'; label: string }[] = [
  { key: 'all',    label: 'Todos' },
  { key: 'avulso', label: 'Avulso' },
  { key: 'liga',   label: 'Liga' },
  { key: 'grupos', label: 'Grupos' },
  { key: 'mata',   label: 'Mata-mata' },
  { key: 'super8', label: 'Super 8' },
];

function formatDate(iso: string) {
  return formatRelativeDate(parseStoredDate(iso));
}

/** "25 de jul" — data curta absoluta, como na lista de eventos do Atlas. */
function shortDate(iso: string) {
  return parseStoredDate(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}


function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 10 }}>
      <View style={{ width: 5, height: 22, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ ...Type.sectionLabel, fontSize: 15, lineHeight: 20, letterSpacing: 1.4, color }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function CompCard({ comp, onDelete, onClone, isAdmin, highlight = false }: {
  comp: Competition; onDelete: (id: string) => void; onClone: (id: string) => void;
  isAdmin: boolean;
  /** Só o card ativo mais recente pulsa/anima. */
  highlight?: boolean;
}) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const shadows = useMemo(() => makeShadows(Colors), [Colors]);
  const { findPlayer } = useGroupPlayers();
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;
  const pct   = total > 0 ? done / total : 0;
  const isDone = comp.status === 'done';
  const isUpcoming = comp.status === 'upcoming';
  const ev = eventView(comp, null);
  const pill = isUpcoming
    ? (ev.full ? { t: 'Lotado', c: Colors.gold } : { t: 'Inscrições abertas', c: Colors.teal })
    : isDone ? { t: 'Encerrada', c: Colors.faint } : comp.status === 'setup' ? { t: 'Montando', c: Colors.teal } : { t: 'Em andamento', c: Colors.gold };
  const accent = isDone ? Colors.faint : formatAccent(Colors, comp.format);
  const champRaw = isDone ? getChampion(comp, id => findPlayer(id)?.name ?? id) : null;
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
            <View style={[styles.statusPill, { borderColor: pill.c + '66', backgroundColor: pill.c + '1A' }]}>
              <Text style={[styles.statusPillText, { color: pill.c }]}>{pill.t}</Text>
            </View>
            {/* O selo "ATIVA" saiu do card: toda competição aqui já está
                dentro da seção "Em andamento" — o selo repetia, em cada
                card, o que o cabeçalho da seção já diz uma vez. */}
            {/* Ações do card — antes só existiam via long-press de 600ms,
                invisível para quem não sabia que existia. */}
            {isAdmin && (
              <TouchableOpacity onPress={() => setShowActions(true)} hitSlop={10} style={{ padding: 2 }}>
                <Icon name="more" size={16} color={Colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.cardName}>{comp.name}</Text>
          <Text style={styles.cardWhen}>{shortDate(comp.date)}{comp.time ? ` · ${comp.time}` : ''}</Text>
          <Text style={styles.cardMetaText}>
            {isUpcoming
              ? (ev.vagas != null ? `${ev.taken}/${ev.vagas} vagas ocupadas` : `${ev.taken} ${ev.taken === 1 ? 'confirmado' : 'confirmados'}`)
              : `${allPlayerIds.length} jogadores`}
          </Text>

          {champ ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <Icon name="crown" size={16} color={Colors.gold} />
              <Text style={{ ...Type.title, color: Colors.gold, flex: 1 }}>{champ.name}</Text>
              <Text style={styles.dateText}>{formatDate(comp.date)}</Text>
              <TouchableOpacity onPress={() => onClone(comp.id)} hitSlop={8} style={{ padding: 4 }}>
                <Icon name="clone" size={16} color={Colors.muted} />
              </TouchableOpacity>
            </View>
          ) : isUpcoming ? null : (
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
            { key: 'repeat', label: 'Repetir na próxima semana', icon: 'calendar' },
            { key: 'delete', label: 'Apagar',      icon: 'trash', color: Colors.coral },
          ]}
          onSelect={(k) => {
            setShowActions(false);
            if (k === 'clone') onClone(comp.id);
            else if (k === 'repeat') router.push({ pathname: '/competitions/new', params: { from: comp.id } });
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

/** `embedded`: dentro da aba Competições da Arena — sem o nome do grupo nem o título (a Arena já mostra). */
export function CompetitionsHub({ embedded = false }: { embedded?: boolean } = {}) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { state, dispatch, refresh } = useCompetitions();
  const { group, isAdmin } = useAuth();
  const { groupPlayers } = useGroupPlayers();
  const wide = useIsWide();
  const { width: winWidth } = useWindowDimensions();
  // Colunas de cards no computador: 3 quando há espaço (conteúdo ≥ ~1150px ao lado do menu), senão 2.
  const gridCols = winWidth - SIDEBAR_WIDTH >= 1200 ? 3 : 2;

  // Handicap por jogador — usado só pra equilibrar o sorteio ao clonar/revanche um Super 8 duplas rotativas.
  const playerHandicaps: Record<string, number> = {};
  groupPlayers.forEach(p => {
    if (p.handicap != null) playerHandicaps[p.id] = p.handicap;
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); }
    finally { setRefreshing(false); }
  }, [refresh]);

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formatFilter, setFormatFilter] = useState<Format | 'all'>('all');
  const [showFormatSheet, setShowFormatSheet] = useState(false);
  const [showStatusSheet, setShowStatusSheet] = useState(false);

  // A regra de filtro e a contagem de cada status moram em logic/competitionFilters.ts (com testes). A contagem sai do que
  // vale antes do status (formato e busca): é o número que a pessoa verá ao escolher aquele status.
  const beforeStatus = filterBeforeStatus(state.competitions, { format: formatFilter, search });
  const statusCounts = countByStatus(beforeStatus);
  const filtered = beforeStatus.filter(c => matchesStatus(c, statusFilter));
  const statusLabel = STATUS_FILTERS.find(f => f.key === statusFilter)?.label ?? 'Todas';

  // Agendadas primeiro (eventos com inscrição aberta), depois as em andamento e as encerradas.
  const upcomingList = filtered.filter(c => c.status === 'upcoming');
  const active = filtered.filter(c => c.status === 'active' || c.status === 'setup');
  const done   = filtered.filter(c => c.status === 'done');
  const listData = [...upcomingList, ...active, ...done];
  // Computador: cada seção vira UMA linha da lista, com os cards em grade de 2 colunas.
  const sectionRows = ([
    { label: 'Agendadas', color: Colors.gold, items: upcomingList },
    { label: 'Em andamento', color: Colors.gold, items: active },
    { label: 'Encerradas', color: Colors.teal, items: done },
  ] as const).filter(sec => sec.items.length > 0).map(sec => ({ ...sec, id: 'sec_' + sec.label }));
  // Um único card pulsa: o ativo mais recente. `filtered` já vem ordenado por
  // data desc do CompetitionsContext, então é o primeiro de `active`.
  const highlightId = active[0]?.id;

  const hasFilter = statusFilter !== 'all' || formatFilter !== 'all' || search.trim().length > 0;

  return (
    <FadeScreen>
    <SafeAreaView style={styles.container} edges={[]}>
      <FlatList
        data={(wide ? sectionRows : listData) as any[]}
        keyExtractor={(c: any) => c.id}
        contentContainerStyle={[styles.list, wide && styles.listWide]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        windowSize={7}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
        ListHeaderComponent={
          <View>
            {!embedded && !!group?.name && <Text style={styles.groupTitle} numberOfLines={1}>{group.name}</Text>}
            {!embedded && <Text style={styles.screenTitle}>Competições</Text>}

            {/* Skeleton loading */}
            {!state.synced && (
              <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }}>
                {[1,2,3].map(i => <Skeleton key={i} variant="comp" />)}
              </View>
            )}

            {/* Uma linha de controles: seletor de status (abre uma folha com a contagem de cada um), busca sempre à vista e
                filtro de formato. Antes eram 4 opções num quadro que rolava na horizontal: em celular estreito "Em andamento"
                aparecia cortado e "Encerradas" ficava escondido, sem nenhum sinal de que existia. */}
            <View style={styles.controlRow}>
              <TouchableOpacity
                onPress={() => setShowStatusSheet(true)}
                style={[styles.statusBtn, statusFilter !== 'all' && styles.statusBtnActive]}
                accessibilityRole="button"
                accessibilityLabel={`Filtrar por status: ${statusLabel}`}
              >
                <Text style={[styles.statusBtnText, statusFilter !== 'all' && { color: Colors.gold }]} numberOfLines={1}>{statusLabel}</Text>
                <Icon name="chevronDown" size={14} color={statusFilter !== 'all' ? Colors.gold : Colors.muted} />
              </TouchableOpacity>

              <View style={styles.searchField}>
                <Icon name="search" size={16} color={Colors.muted} />
                <TextInput
                  style={styles.searchFieldInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar"
                  placeholderTextColor={Colors.faint}
                  returnKeyType="search"
                  autoCorrect={false}
                  accessibilityLabel="Buscar competição"
                />
                {search.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearch('')}
                    style={styles.searchClear}
                    accessibilityRole="button"
                    accessibilityLabel="Limpar a busca"
                  >
                    <Icon name="close" size={14} color={Colors.coral} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={() => setShowFormatSheet(true)}
                style={[styles.iconBtn, formatFilter !== 'all' && styles.iconBtnActive]}
                accessibilityRole="button"
                accessibilityLabel={formatFilter !== 'all' ? 'Filtrar por formato (filtro ativo)' : 'Filtrar por formato'}
              >
                <Icon name="filter" size={18} color={formatFilter !== 'all' ? Colors.gold : Colors.muted} />
                {formatFilter !== 'all' && <View style={styles.filterDot} />}
              </TouchableOpacity>
            </View>

          </View>
        }
        renderItem={({ item, index }: { item: any; index: number }) => {
          if (wide) {
            const sec = item as (typeof sectionRows)[number];
            return (
              <View>
                <SectionHeader label={sec.label} color={sec.color} />
                <View style={styles.grid}>
                  {sec.items.map(c => (
                    <View key={c.id} style={{ width: gridCols === 3 ? '32.4%' : '49.2%' }}>
                      <CompCard
                        comp={c}
                        onDelete={isAdmin ? (id) => dispatch({ type: 'DELETE', compId: id }) : () => {}}
                        onClone={isAdmin ? (id) => dispatch({ type: 'CLONE', compId: id, playerHandicaps }) : () => {}}
                        isAdmin={isAdmin}
                        highlight={c.id === highlightId}
                      />
                    </View>
                  ))}
                </View>
              </View>
            );
          }
          const firstOfSection = index === 0 || listData[index - 1]?.status !== item.status;
          const section = item.status === 'upcoming' ? { label: 'Agendadas', color: Colors.gold }
            : item.status === 'done' ? { label: 'Encerradas', color: Colors.teal }
            : { label: 'Em andamento', color: Colors.gold };
          return (
            <View>
              {firstOfSection && <SectionHeader label={section.label} color={section.color} />}
              <CompCard
                comp={item}
                onDelete={isAdmin ? (id) => dispatch({ type: 'DELETE', compId: id }) : () => {}}
                onClone={isAdmin ? (id) => dispatch({ type: 'CLONE', compId: id, playerHandicaps }) : () => {}}
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
                  : '/competitions/new')}
              />
            )
          )
        }
      />

      {/* Status: as 4 opções com a contagem de cada uma. */}
      <BottomSheet visible={showStatusSheet} onClose={() => setShowStatusSheet(false)} height={340}>
        <View style={{ paddingHorizontal: Spacing.md, gap: Spacing.xs }}>
          <Text style={styles.sheetTitle}>Status</Text>
          {STATUS_FILTERS.map(f => {
            const selected = statusFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.sheetOption, selected && styles.sheetOptionActive]}
                onPress={() => { setStatusFilter(f.key); setShowStatusSheet(false); }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.sheetOptionText, { flex: 1 }, selected && { color: Colors.gold }]}>{f.label}</Text>
                <Text style={[styles.sheetCount, selected && { color: Colors.gold }]}>{statusCounts[f.key]}</Text>
                {selected && <Icon name="check" size={16} color={Colors.gold} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>

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
  container: { flex: 1, backgroundColor: 'transparent' },
  list: { ...centeredContent, padding: Spacing.md, paddingTop: 0 },
  listWide: { maxWidth: wideContent.maxWidth, padding: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  screenTitle: { ...Type.screenTitle, color: Colors.text, marginBottom: Spacing.md, marginLeft: 2 },
  groupTitle: { fontFamily: FontFamily.bodyMed, fontSize: 14, letterSpacing: 0.4, color: Colors.gold, marginLeft: 2, marginBottom: Spacing.xs },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logo: { width: 52, height: 52 },
  headerGroup: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },

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
  offlineText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },

  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surf2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'transparent',
  },
  iconBtnActive: { borderColor: Colors.gold },

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

  // Linha única de controles: seletor de status + campo de busca + filtro de formato.
  controlRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    marginBottom: Spacing.md, marginTop: Spacing.xs,
  },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, flexShrink: 0,
    height: 44, paddingHorizontal: Spacing.md, borderRadius: Radius.full,
    backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line,
  },
  statusBtnActive: { borderColor: Colors.gold },
  statusBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, lineHeight: 18, color: Colors.text },
  searchField: {
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    height: 44, paddingLeft: Spacing.md, paddingRight: Spacing.xs, borderRadius: Radius.full,
    backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line,
  },
  searchFieldInput: { flex: 1, minWidth: 0, ...Type.body, fontSize: 14, color: Colors.text, paddingVertical: 0 },
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
  sheetCount: { ...Type.body, color: Colors.muted, minWidth: 20, textAlign: 'right' },

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
    ...Type.sectionLabel, fontSize: 11, flex: 1,
  },
  cardBody: {
    flex: 1,
    padding: 16, paddingHorizontal: 16,
  },
  cardName: { fontFamily: FontFamily.titleBold, fontSize: 21, lineHeight: 27, color: Colors.text },
  cardWhen: { fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.gold, marginTop: 6 },
  cardMetaText: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: Colors.muted, marginTop: 4 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  statusPillText: { fontFamily: FontFamily.title, fontSize: 12, lineHeight: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 4, backgroundColor: Colors.surf2, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 4 },
  dateText: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.faint },

  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm, marginTop: Spacing.lg },
  emptyText: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.muted },
  emptyHint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
