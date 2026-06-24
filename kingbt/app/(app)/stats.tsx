import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { computeFormatStats, type FormatStat } from '@/logic/formatStats';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { useGroupPlayers } from '@/store/GroupPlayersContext';

function generateInsight(stats: FormatStat[]): string {
  if (stats.length === 0) return 'Dispute partidas para gerar insights.';
  if (stats.length === 1) return `Você disputou apenas ${stats[0].label} até agora. Explore outros formatos!`;

  const [best, second] = stats;
  const diff = best.pct - second.pct;

  if (diff > 15) {
    return `Você é muito mais forte no ${best.label} (${best.pct}%) do que em ${second.label} (${second.pct}%). Foco no formato principal!`;
  }
  if (best.pct >= 70) {
    return `Performance excelente! Aproveitamento de ${best.pct}% no ${best.label}. Continue assim!`;
  }
  return `Performance consistente em todos os formatos. Aproveitamento geral equilibrado.`;
}

export default function StatsScreen() {
  const { state } = useCompetitions();
  const { myPlayerId } = useAuth();
  const { groupPlayers } = useGroupPlayers();
  const MY_ID = myPlayerId ?? '';

  const formatStats = useMemo(
    () => computeFormatStats(state.competitions, MY_ID),
    [state.competitions, MY_ID]
  );

  const totalWins    = formatStats.reduce((s, f) => s + f.wins, 0);
  const totalPlayed  = formatStats.reduce((s, f) => s + f.played, 0);
  const totalLosses  = totalPlayed - totalWins;
  const overallPct   = totalPlayed > 0 ? totalWins / totalPlayed : 0;

  // Rating atual
  const allGames = state.competitions.flatMap(extractPlayerGames);
  const ranking  = buildRanking(
    groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color, handicap: p.handicap })),
    allGames
  );
  const myRank = ranking.find(r => r.id === MY_ID);
  const myPos  = ranking.findIndex(r => r.id === MY_ID) + 1;

  const insight = generateInsight(formatStats);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate("/(app)/profile")}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Análise por Formato</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Rating card */}
        <View style={s.ratingCard}>
          <View style={s.ratingLeft}>
            <Text style={s.ratingLabel}>RATING KING BT</Text>
            <Text style={s.ratingValue}>{myRank?.points.toFixed(2) ?? '—'}</Text>
          </View>
          <View style={s.ratingRight}>
            <Text style={s.ratingPosLabel}>POSIÇÃO</Text>
            <Text style={s.ratingPos}>{myPos > 0 ? `${myPos}°` : '—'}</Text>
          </View>
        </View>

        {/* Overall summary */}
        <View style={s.summaryCard}>
          <View style={s.summaryHeader}>
            <Text style={s.summaryLabel}>GERAL</Text>
            <Text style={s.summaryMatchCount}>{totalPlayed} partidas</Text>
          </View>
          <View style={s.summaryBody}>
            <View style={{ flex: 1 }}>
              <View style={s.progressTrack}>
                <View style={[
                  s.progressBar,
                  {
                    width: `${overallPct * 100}%` as any,
                    backgroundColor: overallPct > 0.65 ? Colors.teal : Colors.gold,
                  },
                ]} />
              </View>
              <Text style={s.progressPercent}>{Math.round(overallPct * 100)}% aproveitamento</Text>
            </View>
            <View style={s.summaryRecord}>
              <Text style={s.recordWins}>{totalWins}–{totalLosses}</Text>
              <Text style={s.recordLabel}>V–D</Text>
            </View>
          </View>
        </View>

        {/* Format cards */}
        {formatStats.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 32 }}>📊</Text>
            <Text style={s.emptyTitle}>Sem dados ainda</Text>
            <Text style={s.emptySub}>Dispute competições para ver sua análise por formato.</Text>
          </View>
        ) : (
          <>
            <Text style={s.sectionLabel}>POR FORMATO</Text>
            {formatStats.map(f => (
              <View
                key={f.format}
                style={[
                  s.formatCard,
                  { backgroundColor: `${f.color}14`, borderColor: `${f.color}38` },
                ]}
              >
                <View style={s.formatHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.formatName}>{f.label}</Text>
                    <Text style={s.formatMatchCount}>{f.played} partidas · {f.wins}V {f.played - f.wins}D</Text>
                  </View>
                  <View style={s.formatStats}>
                    <Text style={[s.formatRate, { color: f.color }]}>{f.pct}%</Text>
                    <Text style={[s.formatRecord, { color: f.color }]}>{f.wins}–{f.played - f.wins}</Text>
                  </View>
                </View>
                <View style={s.formatProgressTrack}>
                  <View style={[
                    s.formatProgressBar,
                    { width: `${f.pct}%` as any, backgroundColor: f.color },
                  ]} />
                </View>
              </View>
            ))}

            {/* Insight */}
            <View style={s.insightCard}>
              <Text style={s.insightLabel}>💡 INSIGHT</Text>
              <Text style={s.insightText}>{insight}</Text>
            </View>

            {/* Mini ranking de formatos */}
            <Text style={[s.sectionLabel, { marginTop: Spacing.md }]}>SEU PODIUM DE FORMATOS</Text>
            {formatStats.slice(0, 3).map((f, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <View key={f.format} style={s.podiumRow}>
                  <Text style={s.podiumMedal}>{medals[i] ?? '🏅'}</Text>
                  <Text style={[s.podiumFormat, { color: f.color }]}>{f.label}</Text>
                  <View style={s.podiumBar}>
                    <View style={[s.podiumFill, { width: `${f.pct}%` as any, backgroundColor: f.color }]} />
                  </View>
                  <Text style={[s.podiumPct, { color: f.color }]}>{f.pct}%</Text>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  back:  { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text, flex: 1 },
  scroll: { padding: Spacing.md, gap: Spacing.sm },

  // Rating card
  ratingCard: {
    flexDirection: 'row',
    backgroundColor: '#16140F',
    borderWidth: 1, borderColor: 'rgba(243,197,68,0.2)',
    borderRadius: 14, padding: 16,
    marginBottom: 4,
  },
  ratingLeft:    { flex: 1 },
  ratingLabel:   { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.faint, letterSpacing: 1.5, marginBottom: 4 },
  ratingValue:   { fontFamily: FontFamily.titleBold, fontSize: 36, color: Colors.gold, letterSpacing: -1 },
  ratingRight:   { alignItems: 'flex-end', justifyContent: 'center' },
  ratingPosLabel:{ fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.faint, letterSpacing: 1.5, marginBottom: 4 },
  ratingPos:     { fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.text },

  // Summary
  summaryCard: {
    backgroundColor: '#16140F', borderWidth: 1,
    borderColor: 'rgba(243,197,68,0.18)', borderRadius: 12, padding: 11,
  },
  summaryHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel:      { fontFamily: FontFamily.numberBold, fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: Colors.faint },
  summaryMatchCount: { fontFamily: FontFamily.numberBold, fontSize: 9, fontWeight: '700', color: Colors.gold },
  summaryBody:       { flexDirection: 'row', gap: 12, alignItems: 'center' },
  progressTrack:     { height: 6, backgroundColor: '#221C12', borderRadius: 3, overflow: 'hidden', flex: 1, marginBottom: 4 },
  progressBar:       { height: 6, borderRadius: 3 },
  progressPercent:   { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.gold },
  summaryRecord:     { alignItems: 'flex-end' },
  recordWins:        { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.teal },
  recordLabel:       { fontFamily: FontFamily.number, fontSize: 9, color: Colors.faint },

  sectionLabel: {
    fontFamily: FontFamily.numberBold, fontSize: 9,
    color: Colors.faint, letterSpacing: 1.5, marginBottom: 4, marginTop: 4,
  },

  // Format card
  formatCard: { borderWidth: 1, borderRadius: 11, padding: 10 },
  formatHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 7,
  },
  formatName:         { fontFamily: FontFamily.title, fontSize: 13, color: Colors.text, fontWeight: '700' },
  formatMatchCount:   { fontFamily: FontFamily.body, fontSize: 10, color: Colors.muted, marginTop: 2 },
  formatStats:        { alignItems: 'flex-end' },
  formatRate:         { fontFamily: FontFamily.numberBold, fontSize: 13, fontWeight: '700' },
  formatRecord:       { fontFamily: FontFamily.number, fontSize: 10, fontWeight: '600', marginTop: 1 },
  formatProgressTrack:{ height: 4, backgroundColor: '#3a3228', borderRadius: 2, overflow: 'hidden' },
  formatProgressBar:  { height: 4, borderRadius: 2 },

  // Insight
  insightCard: {
    backgroundColor: 'rgba(243,197,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(243,197,68,0.15)',
    borderRadius: 11, padding: 12, marginTop: 4,
  },
  insightLabel: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.gold, fontWeight: '700', marginBottom: 5, letterSpacing: 0.5 },
  insightText:  { fontFamily: FontFamily.body, fontSize: 12, color: Colors.text, lineHeight: 18 },

  // Podium
  podiumRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  podiumMedal:  { fontSize: 18, width: 28 },
  podiumFormat: { fontFamily: FontFamily.bodyMed, fontSize: 12, width: 72 },
  podiumBar:    { flex: 1, height: 4, backgroundColor: '#221C12', borderRadius: 2, overflow: 'hidden' },
  podiumFill:   { height: 4, borderRadius: 2 },
  podiumPct:    { fontFamily: FontFamily.numberBold, fontSize: 12, width: 38, textAlign: 'right' },

  empty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  emptySub:   { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
