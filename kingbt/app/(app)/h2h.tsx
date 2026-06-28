import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useMemo, useState, useRef } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';

type Tab = 'geral' | 'historico' | 'stats';

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

export default function H2HScreen() {
  const { playerId1, playerId2 } = useLocalSearchParams<{ playerId1: string; playerId2: string }>();
  const { state } = useCompetitions();
  const { findPlayer } = useGroupPlayers();
  const [tab, setTab] = useState<Tab>('geral');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  function changeTab(newTab: Tab) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setTab(newTab);
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
  }

  const p1 = findPlayer(playerId1 ?? '');
  const p2 = findPlayer(playerId2 ?? '');

  const stats = useMemo(() => {
    let wins1 = 0, wins2 = 0;
    let gp1 = 0, gc1 = 0; // games pro/contra player1
    const matches: { compName: string; scoreA: number; scoreB: number; p1Side: 'A' | 'B'; date?: string | null; id: string }[] = [];

    state.competitions.forEach(comp => {
      comp.matches.forEach(m => {
        if (m.scoreA == null || m.scoreB == null) return;

        const p1InA = m.aId === playerId1 || m.teamA?.includes(playerId1 ?? '');
        const p1InB = m.bId === playerId1 || m.teamB?.includes(playerId1 ?? '');
        const p2InA = m.aId === playerId2 || m.teamA?.includes(playerId2 ?? '');
        const p2InB = m.bId === playerId2 || m.teamB?.includes(playerId2 ?? '');

        // Estão juntos no mesmo time — ignorar
        if ((p1InA && p2InA) || (p1InB && p2InB)) return;

        const directMatch =
          (p1InA && p2InB) || (p1InB && p2InA);

        if (!directMatch) return;

        const p1Side: 'A' | 'B' = p1InA ? 'A' : 'B';
        const p1Score = p1Side === 'A' ? m.scoreA : m.scoreB;
        const p2Score = p1Side === 'A' ? m.scoreB : m.scoreA;

        if (p1Score > p2Score) wins1++; else wins2++;

        // Usa games reais quando disponíveis, fallback para sets
        const rawGa = m.sets?.length ? m.sets.reduce((s, x) => s + x.a, 0) : m.scoreA;
        const rawGb = m.sets?.length ? m.sets.reduce((s, x) => s + x.b, 0) : m.scoreB;
        const p1Games = p1Side === 'A' ? rawGa : rawGb;
        const p2Games = p1Side === 'A' ? rawGb : rawGa;
        gp1 += p1Games;
        gc1 += p2Games;

        matches.push({
          id: m.id,
          compName: comp.name,
          scoreA: p1Score,
          scoreB: p2Score,
          p1Side,
          date: m.playedAt,
        });
      });
    });

    const total = wins1 + wins2;
    const wr1 = total > 0 ? Math.round((wins1 / total) * 100) : 0;
    const wr2 = total > 0 ? 100 - wr1 : 0;
    const ga = gc1 > 0 ? (gp1 / gc1) : gp1 > 0 ? 9.99 : 0;

    const sorted = [...matches].sort((a, b) =>
      (b.date ?? '').localeCompare(a.date ?? '')
    );

    return { wins1, wins2, wr1, wr2, gp1, gc1, ga, total, matches: sorted };
  }, [state.competitions, playerId1, playerId2]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'geral', label: 'Geral' },
    { key: 'historico', label: 'Histórico' },
    { key: 'stats', label: 'Stats' },
  ];

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.replace('/(app)/ranking')} style={s.backBtn}>
          <Text style={s.backTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Head-to-Head</Text>
        <View style={{ width: 64 }} />
      </View>

      {/* Players */}
      <View style={s.playersRow}>
        <View style={s.playerCard}>
          <Avatar name={p1?.name ?? '?'} color={p1?.color ?? Colors.gold} size={52} />
          <Text style={s.playerName} numberOfLines={1}>{p1?.name ?? '?'}</Text>
        </View>

        <View style={s.vsBadge}>
          <Text style={s.vsText}>⚔️</Text>
          <Text style={s.vsLabel}>VS</Text>
        </View>

        <View style={s.playerCard}>
          <Avatar name={p2?.name ?? '?'} color={p2?.color ?? Colors.teal} size={52} />
          <Text style={s.playerName} numberOfLines={1}>{p2?.name ?? '?'}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, tab === t.key && s.tabActive]}
            onPress={() => changeTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Animated.ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} style={{ opacity: fadeAnim }}>

        {/* ── GERAL ── */}
        {tab === 'geral' && (
          <View style={s.section}>
            {stats.total === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>🏓</Text>
                <Text style={s.emptyText}>Nenhum confronto direto encontrado</Text>
              </View>
            ) : (
              <>
                {/* Win rate bar */}
                <View style={s.wrCard}>
                  <View style={s.wrRow}>
                    <Text style={[s.wrNum, { color: Colors.teal }]}>{stats.wins1}</Text>
                    <Text style={s.wrLabel}>vitórias</Text>
                    <View style={s.wrBarWrap}>
                      <View style={[s.wrBar, { flex: stats.wr1, backgroundColor: Colors.teal }]} />
                      <View style={[s.wrBar, { flex: stats.wr2, backgroundColor: Colors.coral }]} />
                    </View>
                    <Text style={s.wrLabel}>vitórias</Text>
                    <Text style={[s.wrNum, { color: Colors.coral }]}>{stats.wins2}</Text>
                  </View>
                  <View style={s.wrPctRow}>
                    <Text style={[s.wrPct, { color: Colors.teal }]}>{stats.wr1}%</Text>
                    <Text style={s.wrTotal}>{stats.total} jogos</Text>
                    <Text style={[s.wrPct, { color: Colors.coral }]}>{stats.wr2}%</Text>
                  </View>
                </View>

                {/* Últimas 5 */}
                <Text style={s.sectionTitle}>ÚLTIMAS PARTIDAS</Text>
                {stats.matches.slice(0, 5).map((m, i) => {
                  const won = m.scoreA > m.scoreB;
                  return (
                    <View key={m.id + i} style={s.matchRow}>
                      <View style={[s.matchResult, { backgroundColor: won ? Colors.teal + '22' : Colors.coral + '22' }]}>
                        <Text style={[s.matchResultTxt, { color: won ? Colors.teal : Colors.coral }]}>
                          {won ? 'V' : 'D'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.matchComp} numberOfLines={1}>{m.compName}</Text>
                        {m.date && <Text style={s.matchDate}>{timeAgo(m.date)}</Text>}
                      </View>
                      <Text style={[s.matchScore, { color: won ? Colors.teal : Colors.coral }]}>
                        {m.scoreA}–{m.scoreB}
                      </Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* ── HISTÓRICO ── */}
        {tab === 'historico' && (
          <View style={s.section}>
            {stats.matches.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>📋</Text>
                <Text style={s.emptyText}>Nenhuma partida registrada</Text>
              </View>
            ) : (
              stats.matches.map((m, i) => {
                const won = m.scoreA > m.scoreB;
                return (
                  <View key={m.id + i} style={[s.histRow, i < stats.matches.length - 1 && s.histRowBorder]}>
                    <View style={[s.histBadge, { backgroundColor: won ? Colors.teal + '22' : Colors.coral + '22' }]}>
                      <Text style={[s.histBadgeTxt, { color: won ? Colors.teal : Colors.coral }]}>
                        {won ? 'V' : 'D'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.histComp} numberOfLines={1}>{m.compName}</Text>
                      {m.date && <Text style={s.histDate}>{timeAgo(m.date)}</Text>}
                    </View>
                    <Text style={[s.histScore, { color: won ? Colors.teal : Colors.coral }]}>
                      {m.scoreA}–{m.scoreB}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── STATS ── */}
        {tab === 'stats' && (
          <View style={s.section}>
            {stats.total === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>📊</Text>
                <Text style={s.emptyText}>Sem dados suficientes</Text>
              </View>
            ) : (
              <>
                <View style={s.statsGrid}>
                  <View style={s.statCard}>
                    <Text style={s.statValue}>{stats.gp1}</Text>
                    <Text style={s.statLabel}>Games Pró</Text>
                    <Text style={s.statSub}>({p1?.name?.split(' ')[0]})</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={s.statValue}>{stats.gc1}</Text>
                    <Text style={s.statLabel}>Games Contra</Text>
                    <Text style={s.statSub}>({p2?.name?.split(' ')[0]})</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={[s.statValue, { color: stats.ga >= 1 ? Colors.teal : Colors.coral }]}>
                      {stats.ga.toFixed(2)}
                    </Text>
                    <Text style={s.statLabel}>GA</Text>
                    <Text style={s.statSub}>GP ÷ GC</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={s.statValue}>{stats.total}</Text>
                    <Text style={s.statLabel}>Jogos</Text>
                    <Text style={s.statSub}>total</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={[s.statValue, { color: Colors.teal }]}>{stats.wins1}</Text>
                    <Text style={s.statLabel}>Vitórias</Text>
                    <Text style={s.statSub}>({p1?.name?.split(' ')[0]})</Text>
                  </View>
                  <View style={s.statCard}>
                    <Text style={[s.statValue, { color: Colors.gold }]}>{stats.wr1}%</Text>
                    <Text style={s.statLabel}>Win Rate</Text>
                    <Text style={s.statSub}>aproveitamento</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        <View style={{ height: Spacing.xl }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  backTxt: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.teal },
  headerTitle: { fontFamily: FontFamily.titleBold, fontSize: 17, color: Colors.text },

  playersRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm },
  playerCard: { flex: 1, alignItems: 'center', gap: 8, backgroundColor: Colors.surf, borderRadius: Radius.md, padding: Spacing.md },
  playerName: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text, textAlign: 'center' },
  vsBadge: { alignItems: 'center', gap: 2 },
  vsText: { fontSize: 22 },
  vsLabel: { fontFamily: FontFamily.titleBold, fontSize: 11, color: Colors.muted, letterSpacing: 2 },

  tabs: { flexDirection: 'row', marginHorizontal: Spacing.md, backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: 3, marginBottom: Spacing.sm },
  tab: { flex: 1, paddingVertical: 7, borderRadius: Radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.surf },
  tabLabel: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.faint },
  tabLabelActive: { color: Colors.gold },

  scroll: { paddingHorizontal: Spacing.md },
  section: { gap: Spacing.sm },

  wrCard: { backgroundColor: Colors.surf, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  wrRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  wrNum: { fontFamily: FontFamily.numberBold, fontSize: 24, width: 32, textAlign: 'center' },
  wrLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  wrBarWrap: { flex: 1, flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  wrBar: { height: 8 },
  wrPctRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wrPct: { fontFamily: FontFamily.numberBold, fontSize: 13 },
  wrTotal: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },

  sectionTitle: { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.muted, letterSpacing: 1, marginTop: Spacing.sm },

  matchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surf, borderRadius: Radius.sm, padding: Spacing.sm },
  matchResult: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  matchResultTxt: { fontFamily: FontFamily.numberBold, fontSize: 12 },
  matchComp: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.text },
  matchDate: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  matchScore: { fontFamily: FontFamily.numberBold, fontSize: 16 },

  histRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  histRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  histBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  histBadgeTxt: { fontFamily: FontFamily.numberBold, fontSize: 13 },
  histComp: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  histDate: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  histScore: { fontFamily: FontFamily.numberBold, fontSize: 18 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.surf, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: FontFamily.numberBold, fontSize: 28, color: Colors.text },
  statLabel: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted },
  statSub: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },

  empty: { alignItems: 'center', paddingVertical: 48, gap: Spacing.sm },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, textAlign: 'center' },
});
