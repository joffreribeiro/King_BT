import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { FontFamily, Spacing, centeredContent, Radius, Type, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { computeFormatStats, generateFormatInsight } from '@/logic/formatStats';
import { computeSituationStats, type SituationStat } from '@/logic/situationStats';
import { buildRanking } from '@/logic/scoring';
import { formatRating } from '@/logic/format';
import { extractPlayerGames } from '@/logic/formats';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useSettings } from '@/store/SettingsContext';
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
            <Text style={su.rowCount}>{s.played} {s.played === 1 ? 'jogo' : 'jogos'} · {s.wins}V {s.played - s.wins}D</Text>
            <Text style={[su.rowPct, { color: Colors.gold }]}>{s.pct}%</Text>
          </View>
          <ProgressBar pct={s.pct} color={Colors.gold} height={6} />
        </View>
      ))}
    </>
  );
}

const makeSituationStyles = (Colors: ThemeColors) => StyleSheet.create({
  sectionLabel: { ...Type.sectionLabel, color: Colors.muted, textTransform: 'uppercase', marginBottom: Spacing.sm, marginTop: Spacing.sm },
  row:       { backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, padding: Spacing.md, gap: 10, marginBottom: Spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel:  { flex: 1, fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  rowCount:  { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  rowPct:    { fontFamily: FontFamily.numberBold, fontSize: 18, width: 52, textAlign: 'right' },
});

export default function StatsScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { state } = useCompetitions();
  const { myPlayerId } = useAuth();
  const { groupPlayers } = useGroupPlayers();
  const { scoringConfig } = useSettings();
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
    allGames,
    scoringConfig
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
    <SafeAreaView style={s.container} edges={[]}>
      <ScreenHeader title="Análise por Formato" onBack={() => router.navigate("/(app)/profile")} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Rating card */}
        <View style={s.ratingCard}>
          <View style={s.ratingLeft}>
            <Text style={s.ratingLabel}>RATING KING BT</Text>
            <Text style={s.ratingValue}>{myRank ? formatRating(myRank.points) : '—'}</Text>
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
            <Text style={s.summaryMatchCount}>{totalPlayed} {totalPlayed === 1 ? 'partida' : 'partidas'}</Text>
          </View>
          <View style={s.summaryBody}>
            <View style={{ flex: 1 }}>
              <View style={{ marginBottom: 4 }}>
                <ProgressBar pct={overallPct * 100} color={overallPct > 0.65 ? Colors.teal : Colors.gold} height={8} />
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
                    <Text style={s.formatMatchCount}>{f.played} {f.played === 1 ? 'partida' : 'partidas'} · {f.wins}V {f.played - f.wins}D</Text>
                  </View>
                  <View style={s.formatStats}>
                    <Text style={[s.formatRate, { color: f.color }]}>{f.pct}%</Text>
                    <Text style={[s.formatRecord, { color: f.color }]}>{f.wins}–{f.played - f.wins}</Text>
                  </View>
                </View>
                <ProgressBar pct={f.pct} color={f.color} height={6} />
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
                    <ProgressBar pct={f.pct} color={f.color} height={6} />
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
  // Transparente: o favo de mel é desenhado atrás pelo layout das abas (app/(app)/_layout.tsx).
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { ...centeredContent, padding: Spacing.md, gap: Spacing.md },

  // Rating card
  percentileCard: { backgroundColor: Colors.surf, borderRadius: Radius.md, padding: Spacing.md, gap: 10, borderWidth: 1, borderColor: Colors.line },
  percentileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  percentileTitle: { ...Type.sectionLabel, color: Colors.muted },
  percentileValue: { fontFamily: FontFamily.numberBold, fontSize: 28, color: Colors.gold },
  percentileDesc: { fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, color: Colors.muted },
  percentileBar: { height: 10, backgroundColor: Colors.surf2, borderRadius: 5, overflow: 'visible', marginTop: 6, position: 'relative' },
  percentileFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 5 },
  percentileMarker: { position: 'absolute', top: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.gold, marginLeft: -9, borderWidth: 3, borderColor: Colors.surf },
  percentileFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  percentileFooterTxt: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  ratingCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surf,
    borderWidth: 1, borderColor: Colors.gold + '33',
    borderRadius: Radius.md, padding: Spacing.md,
  },
  ratingLeft:    { flex: 1 },
  ratingLabel:   { ...Type.sectionLabel, color: Colors.muted, marginBottom: 6 },
  ratingValue:   { fontFamily: FontFamily.titleBold, fontSize: 44, lineHeight: 50, color: Colors.gold, letterSpacing: -1 },
  ratingRight:   { alignItems: 'flex-end', justifyContent: 'center' },
  ratingPosLabel:{ ...Type.sectionLabel, color: Colors.muted, marginBottom: 6 },
  ratingPos:     { fontFamily: FontFamily.titleBold, fontSize: 34, lineHeight: 40, color: Colors.text },

  // Summary
  summaryCard: {
    backgroundColor: Colors.surf, borderWidth: 1,
    borderColor: Colors.gold + '2E', borderRadius: Radius.md, padding: Spacing.md,
  },
  summaryHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  summaryLabel:      { ...Type.sectionLabel, color: Colors.muted },
  summaryMatchCount: { fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.gold },
  summaryBody:       { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  progressPercent:   { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.gold, marginTop: 4 },
  summaryRecord:     { alignItems: 'flex-end' },
  recordWins:        { fontFamily: FontFamily.numberBold, fontSize: 24, color: Colors.teal },
  recordLabel:       { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },

  sectionLabel: { ...Type.sectionLabel, color: Colors.muted, textTransform: 'uppercase', marginBottom: Spacing.sm, marginTop: Spacing.sm },

  // Format card
  formatCard: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  formatHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  formatName:         { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  formatMatchCount:   { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, marginTop: 3 },
  formatStats:        { alignItems: 'flex-end' },
  formatRate:         { fontFamily: FontFamily.numberBold, fontSize: 24 },
  formatRecord:       { fontFamily: FontFamily.number, fontSize: 14, marginTop: 2 },

  // Insight
  insightCard: {
    backgroundColor: Colors.gold + '14',
    borderWidth: 1, borderColor: Colors.gold + '26',
    borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.xs,
  },
  insightLabel: { ...Type.sectionLabel, color: Colors.gold, marginBottom: 8 },
  insightText:  { fontFamily: FontFamily.body, fontSize: 15, color: Colors.text, lineHeight: 22 },

  // Podium
  podiumRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  podiumMedal:  { fontSize: 24, width: 34 },
  podiumFormat: { fontFamily: FontFamily.bodyMed, fontSize: 16, width: 90 },
  podiumPct:    { fontFamily: FontFamily.numberBold, fontSize: 17, width: 56, textAlign: 'right' },

  empty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 18, color: Colors.text },
  emptySub:   { fontFamily: FontFamily.body, fontSize: 15, lineHeight: 21, color: Colors.muted, textAlign: 'center' },
});
