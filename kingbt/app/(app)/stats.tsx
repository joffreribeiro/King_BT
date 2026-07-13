import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo, useState } from 'react';
import Svg, { Polyline, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop, Path } from 'react-native-svg';
import { router } from 'expo-router';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { computeFormatStats, generateFormatInsight, type FormatStat } from '@/logic/formatStats';
import { computeSituationStats, type SituationStat } from '@/logic/situationStats';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { computeStreakHistory, type StreakHistory } from '@/logic/streak';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { MatchDetailModal, type MatchDetail } from '@/components/MatchDetailModal';

const SW = Dimensions.get('window').width;

function PointsTimeline({ data }: { data: { label: string; pts: number; pos: number }[] }) {
  const { colors: Colors } = useTheme();
  const tl = useMemo(() => makeTlStyles(Colors), [Colors]);
  const [selected, setSelected] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <View style={tl.empty}>
        <Text style={tl.emptyIcon}>📈</Text>
        <Text style={tl.emptyTxt}>Participe de mais competições{'\n'}para ver sua evolução</Text>
      </View>
    );
  }

  const W = SW - 48;
  const H = 140;
  const PAD = { top: 16, bottom: 32, left: 28, right: 12 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxPts = Math.max(...data.map(d => d.pts), 1);
  const minPts = Math.min(...data.map(d => d.pts), 0);
  const range  = maxPts - minPts || 1;

  const pts = data.map((d, i) => ({
    x: PAD.left + (i / (data.length - 1)) * chartW,
    y: PAD.top + chartH - ((d.pts - minPts) / range) * chartH,
    ...d,
  }));

  // Linha SVG
  const linePoints = pts.map(p => `${p.x},${p.y}`).join(' ');

  // Área preenchida (path fechado)
  const areaPath = `M${pts[0].x},${PAD.top + chartH} ` +
    pts.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${pts[pts.length-1].x},${PAD.top + chartH} Z`;

  const trend = data.length > 1 ? data[data.length-1].pts - data[0].pts : 0;
  const trendColor = trend > 0 ? Colors.teal : trend < 0 ? Colors.coral : Colors.muted;
  const trendLabel = trend > 0 ? `+${trend.toFixed(2)}` : trend.toFixed(2);

  return (
    <View style={tl.wrap}>
      {/* Cabeçalho */}
      <View style={tl.header}>
        <Text style={tl.title}>EVOLUÇÃO DE PONTOS</Text>
        <View style={[tl.trendBadge, { backgroundColor: trendColor + '22' }]}>
          <Text style={[tl.trendTxt, { color: trendColor }]}>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '—'} {trendLabel}
          </Text>
        </View>
      </View>

      {/* Gráfico SVG */}
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={Colors.gold} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={Colors.gold} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines horizontais */}
        {[0, 0.5, 1].map((t, i) => {
          const y = PAD.top + chartH * (1 - t);
          const val = (minPts + range * t).toFixed(1);
          return (
            <Line key={i} x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
              stroke={Colors.line} strokeWidth="1" />
          );
        })}

        {/* Labels eixo Y */}
        {[0, 0.5, 1].map((t, i) => {
          const y = PAD.top + chartH * (1 - t);
          const val = (minPts + range * t).toFixed(0);
          return (
            <SvgText key={i} x={PAD.left - 4} y={y + 4} fontSize="8"
              fill={Colors.faint} textAnchor="end">{val}</SvgText>
          );
        })}

        {/* Área preenchida */}
        <Path d={areaPath} fill="url(#areaGrad)" />

        {/* Linha principal */}
        <Polyline points={linePoints} fill="none"
          stroke={Colors.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Pontos */}
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={selected === i ? 7 : 4}
            fill={selected === i ? Colors.gold : Colors.bg}
            stroke={Colors.gold} strokeWidth="2"
            onPress={() => setSelected(selected === i ? null : i)}
          />
        ))}

        {/* Labels eixo X */}
        {pts.map((p, i) => (
          <SvgText key={i} x={p.x} y={H - 6} fontSize="8"
            fill={selected === i ? Colors.gold : Colors.faint}
            textAnchor="middle">{p.label}</SvgText>
        ))}

        {/* Tooltip do ponto selecionado */}
        {selected !== null && (() => {
          const p = pts[selected];
          const bx = Math.min(Math.max(p.x - 40, 0), W - 88);
          const by = p.y - 44;
          return (
            <>
              <Line x1={p.x} y1={p.y} x2={p.x} y2={PAD.top + chartH}
                stroke={Colors.gold} strokeWidth="1" strokeDasharray="3,3" />
              <Path d={`M${bx},${by} h80 a4,4 0 0 1 4,4 v24 a4,4 0 0 1 -4,4 h-80 a4,4 0 0 1 -4,-4 v-24 a4,4 0 0 1 4,-4 z`}
                fill={Colors.surf2} />
              <SvgText x={bx + 40} y={by + 14} fontSize="10" fill={Colors.gold}
                textAnchor="middle" fontWeight="700">{p.pts.toFixed(2)} pts</SvgText>
              <SvgText x={bx + 40} y={by + 26} fontSize="8" fill={Colors.muted}
                textAnchor="middle">{p.pos}° lugar</SvgText>
            </>
          );
        })()}
      </Svg>

      {/* Legenda min/max */}
      <View style={tl.legend}>
        <View style={tl.legendItem}>
          <Text style={tl.legendDot}>●</Text>
          <Text style={tl.legendTxt}>Mínimo: <Text style={{ color: Colors.coral }}>{minPts.toFixed(2)}</Text></Text>
        </View>
        <View style={tl.legendItem}>
          <Text style={tl.legendDot}>●</Text>
          <Text style={tl.legendTxt}>Máximo: <Text style={{ color: Colors.teal }}>{maxPts.toFixed(2)}</Text></Text>
        </View>
        <View style={tl.legendItem}>
          <Text style={tl.legendTxt}>{data.length} comps</Text>
        </View>
      </View>
    </View>
  );
}

const makeTlStyles = (Colors: ThemeColors) => StyleSheet.create({
  wrap:        { backgroundColor: Colors.surf, borderRadius: Radius.md, padding: Spacing.md, gap: 8 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title:       { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.faint, letterSpacing: 1.5 },
  trendBadge:  { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  trendTxt:    { fontFamily: FontFamily.numberBold, fontSize: 11 },
  legend:      { flexDirection: 'row', gap: Spacing.md, paddingTop: 4 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:   { fontSize: 8, color: Colors.gold },
  legendTxt:   { fontFamily: FontFamily.body, fontSize: 10, color: Colors.muted },
  empty:       { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyIcon:   { fontSize: 32 },
  emptyTxt:    { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, textAlign: 'center' },
});

function StreakSection({ history, recentMatches }: { history: StreakHistory; recentMatches: MatchDetail[] }) {
  const { colors: Colors } = useTheme();
  const st = useMemo(() => makeStreakStyles(Colors), [Colors]);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetail | null>(null);
  // Mais recente primeiro (esquerda).
  const recent = [...recentMatches.slice(-18)].reverse();
  if (recent.length === 0) return null;

  const currentColor = history.current > 0 ? Colors.teal : history.current < 0 ? Colors.coral : Colors.muted;
  const currentLabel = history.current > 0
    ? `${history.current} vitória${history.current > 1 ? 's' : ''} seguida${history.current > 1 ? 's' : ''}`
    : history.current < 0
      ? `${Math.abs(history.current)} derrota${Math.abs(history.current) > 1 ? 's' : ''} seguida${Math.abs(history.current) > 1 ? 's' : ''}`
      : 'sem jogos recentes';

  return (
    <View style={st.card}>
      <View style={st.header}>
        <Text style={st.label}>SEQUÊNCIA DE RESULTADOS</Text>
        <Text style={[st.current, { color: currentColor }]}>{currentLabel}</Text>
      </View>
      <View style={st.strip}>
        {recent.map((g, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            onPress={() => setSelectedMatch(g)}
            style={[st.chip, {
              backgroundColor: g.won ? `${Colors.teal}33` : `${Colors.coral}33`,
              borderColor: g.won ? `${Colors.teal}66` : `${Colors.coral}66`,
            }]}
          >
            <Text style={[st.chipTxt, { color: g.won ? Colors.teal : Colors.coral }]}>{g.won ? 'V' : 'D'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      <Text style={st.max}>
        Melhor sequência: <Text style={{ color: Colors.gold, fontFamily: FontFamily.bodyMed }}>{history.max} vitória{history.max !== 1 ? 's' : ''} seguidas</Text>
      </Text>
    </View>
  );
}

const makeStreakStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surf, borderWidth: 1,
    borderColor: Colors.line, borderRadius: 12, padding: 11, gap: 8,
  },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:   { fontFamily: FontFamily.numberBold, fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: Colors.faint },
  current: { fontFamily: FontFamily.numberBold, fontSize: 11, fontWeight: '700' },
  strip:   { flexDirection: 'row', gap: 3 },
  chip:    { flex: 1, height: 32, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipTxt: { fontFamily: FontFamily.numberBold, fontSize: 12, fontWeight: '700' },
  max:     { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
});

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
          <View style={su.track}>
            <View style={[su.bar, { width: `${s.pct}%` as any, backgroundColor: Colors.gold }]} />
          </View>
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
  track:     { height: 4, backgroundColor: Colors.surf2, borderRadius: 2, overflow: 'hidden' },
  bar:       { height: 4, borderRadius: 2 },
});

export default function StatsScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { state } = useCompetitions();
  const { myPlayerId } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const MY_ID = myPlayerId ?? '';

  const formatStats = useMemo(
    () => computeFormatStats(state.competitions, MY_ID),
    [state.competitions, MY_ID]
  );

  const streakHistory = useMemo(
    () => computeStreakHistory(state.competitions, MY_ID),
    [state.competitions, MY_ID]
  );

  const recentMatchesDetailed = useMemo(() => {
    const list: MatchDetail[] = [];
    state.competitions.forEach(comp => {
      comp.matches.forEach(m => {
        if (m.scoreA == null || m.scoreB == null) return;
        const inA = m.aId === MY_ID || m.teamA?.includes(MY_ID);
        const inB = m.bId === MY_ID || m.teamB?.includes(MY_ID);
        if (!inA && !inB) return;

        const won = inA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
        const gA = m.sets?.length ? m.sets.reduce((sum, x) => sum + x.a, 0) : m.scoreA;
        const gB = m.sets?.length ? m.sets.reduce((sum, x) => sum + x.b, 0) : m.scoreB;
        const myScore = inA ? gA : gB;
        const oppScore = inA ? gB : gA;

        let opponent = '?', partner: string | null = null;
        if (m.teamA && m.teamB) {
          const myTeam  = inA ? m.teamA : m.teamB;
          const oppTeam = inA ? m.teamB : m.teamA;
          opponent = oppTeam.map(pid => findPlayer(pid)?.name.split(' ')[0] ?? pid).join(' / ');
          const pid = myTeam.find(id => id !== MY_ID);
          if (pid) partner = findPlayer(pid)?.name.split(' ')[0] ?? pid;
        } else {
          const oppId = inA ? m.bId : m.aId;
          if (oppId) {
            const oppComp = comp.competitors.find(c => c.id === oppId);
            opponent = oppComp?.name ?? findPlayer(oppId)?.name ?? oppId;
          }
        }

        list.push({ won, myScore, oppScore, opponent, partner, compName: comp.name, date: m.playedAt ?? comp.date ?? '' });
      });
    });
    // Do mais antigo pro mais recente — StreakSection pega os últimos N (mais recentes) via slice(-N).
    return list.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  }, [state.competitions, MY_ID, findPlayer]);

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

  // Histórico de pontos — uma entrada por competição em que participei
  const pointsHistory = useMemo(() => {
    const compsWithMe = state.competitions
      .filter(c => c.status !== 'upcoming' && c.matches.some(m => {
        const ids = [...(m.teamA ?? []), ...(m.teamB ?? []), m.aId, m.bId].filter(Boolean);
        return ids.includes(MY_ID) && m.scoreA != null;
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return compsWithMe.map((comp, idx) => {
      // Calcula pontos acumulados até essa competição
      const compsUpTo = compsWithMe.slice(0, idx + 1);
      const games = compsUpTo.flatMap(extractPlayerGames);
      const rank = buildRanking(
        groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color, handicap: p.handicap })),
        games
      );
      const me = rank.find(r => r.id === MY_ID);
      const pos = rank.findIndex(r => r.id === MY_ID) + 1;
      return {
        label: comp.name.length > 8 ? comp.name.slice(0, 8) + '…' : comp.name,
        pts: me?.points ?? 0,
        pos,
        date: comp.date,
        wins: me?.wins ?? 0,
      };
    });
  }, [state.competitions, MY_ID, groupPlayers]);

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

        {/* Timeline de pontos */}
        <PointsTimeline data={pointsHistory} />

        {/* Sequência de resultados */}
        <StreakSection history={streakHistory} recentMatches={recentMatchesDetailed} />

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

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  back:  { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text, flex: 1 },
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
    backgroundColor: Colors.surf, borderWidth: 1,
    borderColor: 'rgba(243,197,68,0.18)', borderRadius: 12, padding: 11,
  },
  summaryHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel:      { fontFamily: FontFamily.numberBold, fontSize: 8, fontWeight: '700', letterSpacing: 1.5, color: Colors.faint },
  summaryMatchCount: { fontFamily: FontFamily.numberBold, fontSize: 9, fontWeight: '700', color: Colors.gold },
  summaryBody:       { flexDirection: 'row', gap: 12, alignItems: 'center' },
  progressTrack:     { height: 6, backgroundColor: Colors.surf2, borderRadius: 3, overflow: 'hidden', flex: 1, marginBottom: 4 },
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
  formatProgressTrack:{ height: 4, backgroundColor: Colors.surf2, borderRadius: 2, overflow: 'hidden' },
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
  podiumBar:    { flex: 1, height: 4, backgroundColor: Colors.surf2, borderRadius: 2, overflow: 'hidden' },
  podiumFill:   { height: 4, borderRadius: 2 },
  podiumPct:    { fontFamily: FontFamily.numberBold, fontSize: 12, width: 38, textAlign: 'right' },

  empty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  emptySub:   { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
