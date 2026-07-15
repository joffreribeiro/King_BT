import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { computeFormatStats, generateFormatInsight, type FormatStat } from '@/logic/formatStats';
import { computeSituationStats, type SituationStat } from '@/logic/situationStats';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { ScreenHeader, ProgressBar } from '@/components';

function SituationSection({ stats }: { stats: SituationStat[] }) {
  const { colors: Colors } = useTheme();
  const su = useMemo(() => makeSituationStyles(Colors), [Colors]);
  const withData = stats.filter(s => s.played > 0);
  if (withData.length === 0) return null;

  return (
    <>
      <Text style={su.sectionLabel}>APROVEITAMENTO POR SITUAÇÃO</Text>
      {withData.map(s => (
        <View key={s.key} style={su.row}>
          <View style={su.rowHeader}>
            <Text style={su.rowLabel}>{s.label}</Text>
            <Text style={su.rowCount}>{s.played} · {s.wins}V {s.played - s.wins}D</Text>
            <Text style={[su.rowPct, { color: Colors.gold }]}>{s.pct}%</Text>
          </View>
          <ProgressBar pct={s.pct} color={Colors.gold} height={4} />
        </View>
      ))}
    </>
  );
}

const makeSituationStyles = (Colors: ThemeColors) => StyleSheet.create({
  sectionLabel: {
    fontFamily: FontFamily.numberBold, fontSize: 9,
    color: Colors.faint, letterSpacing: 1.5, marginBottom: 4, marginTop: 4,
  },
  row:       { backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line, borderRadius: 11, padding: 10, gap: 6, marginBottom: 6 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel:  { flex: 1, fontFamily: FontFamily.title, fontSize: 13, color: Colors.text, fontWeight: '700' },
  rowCount:  { fontFamily: FontFamily.body, fontSize: 10, color: Colors.muted },
  rowPct:    { fontFamily: FontFamily.numberBold, fontSize: 13, fontWeight: '700', width: 40, textAlign: 'right' },
});

export default function StatsScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { state } = useCompetitions();
  const { myPlayerId } = useAuth();
  const { groupPlayers } = useGroupPlayers();
  const MY_ID = myPlayerId ?? '';

  const formatStats = useMemo(
    () => computeFormatStats(state.competitions, MY_ID),
    [state.competitions, MY_ID]
  );

  const situationStats = useMemo(
    () => computeSituationStats(state.competitions, MY_ID),
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
  const total  = ranking.length;
  // Percentil: quanto % dos jogadores estão ABAIXO de você
  const percentile = total > 1 && myPos > 0
    ? Math.round(((total - myPos) / (total - 1)) * 100)
    : 0;

  const insight = generateFormatInsight(formatStats);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScreenHeader title="Análise por Formato" onBack={() => router.navigate("/(app)/profile")} />

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

        {/* Percentil no grupo */}
        {total > 1 && myPos > 0 && (
          <View style={s.percentileCard}>
            <View style={s.percentileHeader}>
              <Text style={s.percentileTitle}>SEU PERCENTIL NO GRUPO</Text>
              <Text style={s.percentileValue}>{percentile}%</Text>
            </View>
            <Text style={s.percentileDesc}>
              Você está acima de <Text style={{ color: Colors.gold, fontFamily: FontFamily.bodyMed }}>{total - myPos} de {total - 1}</Text> jogadores do grupo
            </Text>
            <View style={s.percentileBar}>
              <View style={[s.percentileFill, { width: `${percentile}%` as any }]} />
              <View style={[s.percentileMarker, { left: `${percentile}%` as any }]} />
            </View>
            <View style={s.percentileFooter}>
              <Text style={s.percentileFooterTxt}>0%</Text>
              <Text style={[s.percentileFooterTxt, { color: Colors.gold }]}>{percentile}% →</Text>
              <Text style={s.percentileFooterTxt}>100%</Text>
            </View>
          </View>
        )}

        {/* Overall summary */}
        <View style={s.summaryCard}>
          <View style={s.summaryHeader}>
            <Text style={s.summaryLabel}>GERAL</Text>
            <Text style={s.summaryMatchCount}>{totalPlayed} partidas</Text>
          </View>
          <View style={s.summaryBody}>
            <View style={{ flex: 1 }}>
              <View style={{ marginBottom: 4 }}>
                <ProgressBar pct={overallPct * 100} color={overallPct > 0.65 ? Colors.teal : Colors.gold} height={6} />
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
                <ProgressBar pct={f.pct} color={f.color} height={4} />
              </View>
            ))}

            {/* Aproveitamento por situação */}
            <SituationSection stats={situationStats} />

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
                  <View style={{ flex: 1 }}>
                    <ProgressBar pct={f.pct} color={f.color} height={4} />
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

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.sm },

  // Rating card
  percentileCard: { backgroundColor: Colors.surf, borderRadius: Radius.md, padding: Spacing.md, gap: 8, marginBottom: 4, borderWidth: 1, borderColor: Colors.line },
  percentileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  percentileTitle: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.faint, letterSpacing: 1.5 },
  percentileValue: { fontFamily: FontFamily.numberBold, fontSize: 22, color: Colors.gold },
  percentileDesc: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  percentileBar: { height: 8, backgroundColor: Colors.surf2, borderRadius: 4, overflow: 'visible', marginTop: 4, position: 'relative' },
  percentileFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 4 },
  percentileMarker: { position: 'absolute', top: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.gold, marginLeft: -7, borderWidth: 2, borderColor: Colors.bg },
  percentileFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  percentileFooterTxt: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  ratingCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surf,
    borderWidth: 1, borderColor: Colors.gold + '33',
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
    backgroundColor: Colors.surf, borderWidth: 1,
    borderColor: Colors.gold + '2E', borderRadius: 12, padding: 11,
  },
  summaryHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel:      { fontFamily: FontFamily.numberBold, fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: Colors.faint },
  summaryMatchCount: { fontFamily: FontFamily.numberBold, fontSize: 9, fontWeight: '700', color: Colors.gold },
  summaryBody:       { flexDirection: 'row', gap: 12, alignItems: 'center' },
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

  // Insight
  insightCard: {
    backgroundColor: Colors.gold + '14',
    borderWidth: 1, borderColor: Colors.gold + '26',
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
  podiumPct:    { fontFamily: FontFamily.numberBold, fontSize: 12, width: 38, textAlign: 'right' },

  empty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  emptySub:   { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
