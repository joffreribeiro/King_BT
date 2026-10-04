import { currentSeasonComps } from '@/logic/seasons';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, useWindowDimensions } from 'react-native';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FontFamily, Spacing, Radius, wideContent, SIDEBAR_WIDTH, type ThemeColors } from '@/theme';
import { useIsWide } from '@/hooks/useIsWide';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useSettings } from '@/store/SettingsContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { formatRating } from '@/logic/format';
import { CATEGORIES, type Category } from '@/logic/playerAbout';
import { categoryCounts, filterAthletes, type AthleteRow, type AthleteSort } from '@/logic/athletes';
import Avatar from './Avatar';
import { Icon } from './icons';

/**
 * Atletas: todos os jogadores do grupo, como no Atlas. Filtro por categoria,
 * busca por nome, ordem A–Z ou por ranking, e "Confrontar" para comparar com
 * um jogador (mesma comparação lado a lado do perfil).
 */

export function AtletasSection() {
  const { colors: Colors } = useTheme();
  const wide = useIsWide();
  const { width: winWidth } = useWindowDimensions();
  // Colunas no computador: 3 quando há espaço ao lado do menu, senão 2 (celular: 1).
  const cols = !wide ? 1 : winWidth - SIDEBAR_WIDTH >= 1200 ? 3 : 2;
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { myPlayerId } = useAuth();
  const { state } = useCompetitions();
  const { groupPlayers } = useGroupPlayers();
  const { scoringConfig, seasons } = useSettings();

  const [category, setCategory] = useState<Category | 'todas'>('todas');
  // A ordem por ranking vive na aba Ranking; aqui a lista é sempre alfabética.
  const sort: AthleteSort = 'az';
  const [query, setQuery] = useState('');

  // Posição no ranking da temporada em andamento (a mesma conta da seção Ranking).
  const rows: AthleteRow[] = useMemo(() => {
    const ranking = buildRanking(
      groupPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, handicap: p.handicap })),
      currentSeasonComps(state.competitions, seasons).flatMap(extractPlayerGames),
      scoringConfig,
      { groupMinimum: true },
    );
    const rank = new Map(ranking.map((r, i) => [r.id, { pos: r.provisional ? 0 : i + 1, points: r.points, played: r.played }]));
    return groupPlayers.map(p => {
      const r = rank.get(p.id);
      const played = r?.played ?? 0;
      return {
        id: p.id, name: p.name, color: p.color, guest: !!p.guest,
        category: p.about?.category, position: played > 0 ? (r?.pos ?? 0) : 0, points: r?.points ?? 0, played,
      };
    });
  }, [groupPlayers, state.competitions, seasons, scoringConfig]);

  const counts = useMemo(() => categoryCounts(rows), [rows]);
  const list = useMemo(() => filterAthletes(rows, { category, query, sort }), [rows, category, query, sort]);

  const openProfile = (id: string) => router.push({ pathname: '/player/[id]', params: { id } });
  const confront = (id: string) => router.push({ pathname: '/(app)/h2h', params: { playerId1: myPlayerId ?? '', playerId2: id } });

  const header = (
    <View style={s.header}>
      <View style={s.searchBox}>
        <Icon name="search" size={16} color={Colors.muted} />
        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar atleta"
          placeholderTextColor={Colors.faint}
          autoCorrect={false}
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Limpar busca">
            <Icon name="close" size={14} color={Colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.chipRow}>
        {(['todas', ...CATEGORIES] as const).map(c => (
          <TouchableOpacity key={c} style={[s.chip, category === c && s.chipOn]} onPress={() => setCategory(c)} activeOpacity={0.8}>
            <Text style={[s.chipText, category === c && s.chipTextOn]}>{c === 'todas' ? 'Todas' : c}</Text>
            <Text style={[s.chipCount, category === c && s.chipTextOn]}>{counts[c] ?? 0}</Text>
          </TouchableOpacity>
        ))}
      </View>

    </View>
  );

  return (
    <FlatList
      data={list}
      // Computador: grade de 2 colunas. numColumns não muda em uso, por isso a `key` remonta a lista.
      key={`cols-${cols}`}
      numColumns={cols}
      columnWrapperStyle={wide ? { gap: Spacing.sm } : undefined}
      keyExtractor={r => r.id}
      contentContainerStyle={[s.list, wide && s.listWide]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      ListEmptyComponent={<Text style={s.empty}>Nenhum atleta encontrado.</Text>}
      renderItem={({ item }) => {
        const mine = item.id === myPlayerId;
        return (
          <TouchableOpacity style={[s.row, wide && { flex: 1 }]} onPress={() => openProfile(item.id)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Abrir perfil de ${item.name}`}>
            <Text style={[s.pos, item.position === 0 && { color: Colors.faint }]}>{item.position > 0 ? `#${item.position}` : '#—'}</Text>
            <Avatar name={item.name} color={item.color} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.name} numberOfLines={1}>{item.name}{mine ? '  (você)' : ''}</Text>
              <Text style={s.sub} numberOfLines={1}>
                {item.guest ? 'Convidado' : item.category ? `Categoria ${item.category}` : 'Sem categoria'}
                {item.played > 0 ? ` · ${formatRating(item.points)} pts` : ''}
              </Text>
            </View>
            {!mine && !!myPlayerId && (
              <TouchableOpacity style={s.confront} onPress={() => confront(item.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Confrontar ${item.name}`}>
                <Text style={s.confrontText}>⚔️ Confrontar</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  list: { paddingHorizontal: Spacing.md, paddingBottom: 140 },
  listWide: { ...wideContent, paddingHorizontal: Spacing.lg },
  header: { gap: Spacing.sm + 2, marginBottom: Spacing.md },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: Spacing.md, borderRadius: Radius.full, backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line },
  search: { flex: 1, fontFamily: FontFamily.body, fontSize: 15, color: Colors.text, paddingVertical: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: Radius.full, backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line },
  chipOn: { backgroundColor: Colors.gold + '26', borderColor: Colors.gold },
  chipText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  chipCount: { fontFamily: FontFamily.numberBold, fontSize: 12, color: Colors.faint },
  chipTextOn: { fontFamily: FontFamily.title, color: Colors.gold },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line },
  pos: { width: 44, fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.gold },
  name: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  sub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  confront: { minHeight: 40, paddingHorizontal: 12, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.gold + '66', backgroundColor: Colors.gold + '14' },
  confrontText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.gold },
  empty: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted, textAlign: 'center', paddingVertical: Spacing.xl },
});
