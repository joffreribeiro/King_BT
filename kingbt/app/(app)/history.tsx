import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';

const PAGE_SIZE = 10;

interface MatchEntry {
  id: string;
  opponentName: string;
  competitionName: string;
  format: string;
  dateStr: string;
  playerScore: number;
  opponentScore: number;
  isWin: boolean;
  ratingDelta: number;
  insight: string;
  accentColor: string;
}

const FORMAT_COLOR: Record<string, string> = {
  liga:   '#54B981',
  grupos: '#6B7FD7',
  mata:   '#E5483D',
  avulso: '#38BDF8',
  super8: '#C084FC',
};

const FORMAT_LABEL: Record<string, string> = {
  liga: 'Liga', grupos: 'Grupos', mata: 'Mata-mata', avulso: 'Avulso', super8: 'Super 8',
};

function formatDateStr(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7)  return `Há ${diff} dias`;
  if (diff < 30) return `Há ${Math.floor(diff / 7)} sem.`;
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

function getInsight(isWin: boolean, playerScore: number, opponentScore: number): string {
  const diff = Math.abs(playerScore - opponentScore);
  if (isWin && diff >= 3) return 'Vitória convincente';
  if (isWin && diff === 2) return 'Vitória decisiva';
  if (isWin && diff === 1) return 'Vitória sofrida';
  if (!isWin && diff >= 3) return 'Derrota por diferença';
  if (!isWin && diff === 1) return 'Jogo muito disputado';
  if (!isWin) return 'Jogo cerrado';
  return 'Vitória decisiva';
}

// ── Card animado ──────────────────────────────────────────────────────────────
function MatchCard({ entry, index }: { entry: MatchEntry; index: number }) {
  const { colors: Colors } = useTheme();
  const mc = useMemo(() => makeMcStyles(Colors), [Colors]);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      delay: Math.min(index, 6) * 55,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  const winBg     = 'rgba(84,185,129,0.10)';
  const lossBg    = 'rgba(229,72,61,0.08)';
  const winBorder = 'rgba(84,185,129,0.28)';
  const lossBorder= 'rgba(229,72,61,0.24)';

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateX }] }}>
      <View style={[
        mc.card,
        {
          backgroundColor: entry.isWin ? winBg : lossBg,
          borderColor:      entry.isWin ? winBorder : lossBorder,
        },
      ]}>
        {/* Linha colorida à esquerda */}
        <View style={[mc.leftBar, { backgroundColor: entry.isWin ? Colors.teal : Colors.coral }]} />

        <View style={{ flex: 1 }}>
          {/* Linha superior: título + placar */}
          <View style={mc.topRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={mc.title} numberOfLines={2}>
                {entry.isWin ? 'Vitória' : 'Derrota'} vs {entry.opponentName}
              </Text>
              <Text style={mc.meta}>
                {entry.dateStr} · {FORMAT_LABEL[entry.format] ?? entry.competitionName}
              </Text>
            </View>
            {/* Placar em destaque */}
            <View style={mc.scoreWrap}>
              <Text style={[
                mc.scoreText,
                { color: entry.isWin ? Colors.teal : Colors.coral },
              ]}>
                {entry.playerScore}
                <Text style={mc.scoreSep}> - </Text>
                {entry.opponentScore}
              </Text>
            </View>
          </View>

          {/* Rodapé: insight + delta */}
          <View style={mc.footer}>
            <Text style={[mc.insight, { color: entry.isWin ? Colors.teal : Colors.muted }]}>
              {entry.isWin ? '✓ ' : ''}{entry.insight}
            </Text>
            <Text style={[mc.delta, { color: entry.ratingDelta > 0 ? Colors.teal : Colors.coral }]}>
              {entry.ratingDelta > 0 ? '▲' : '▼'} {entry.ratingDelta > 0 ? '+' : ''}{entry.ratingDelta.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const makeMcStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginLeft: 20,
  },
  leftBar: { width: 3, alignSelf: 'stretch' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    paddingBottom: 6,
  },
  title: {
    fontFamily: FontFamily.title,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700',
    lineHeight: 20,
  },
  meta: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.muted,
  },
  scoreWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreText: {
    fontFamily: FontFamily.titleBold,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  scoreSep: {
    fontFamily: FontFamily.number,
    fontSize: 16,
    color: Colors.faint,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 2,
  },
  insight: {
    fontFamily: FontFamily.bodyMed,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  delta: {
    fontFamily: FontFamily.numberBold,
    fontSize: 12,
    fontWeight: '700',
  },
});

// ── Tela principal ────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { state } = useCompetitions();
  const { myPlayerId } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const MY_ID = myPlayerId ?? '';
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const entries = useMemo<MatchEntry[]>(() => {
    if (!MY_ID) return [];

    const allGames = state.competitions.flatMap(extractPlayerGames);
    const ranking  = buildRanking(
      groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color, handicap: p.handicap })),
      allGames
    );
    const myRank = ranking.find(r => r.id === MY_ID);

    const result: MatchEntry[] = [];

    state.competitions.forEach(comp => {
      comp.matches.forEach(m => {
        if (m.scoreA == null || m.scoreB == null) return;
        const inA = m.aId === MY_ID || m.teamA?.includes(MY_ID);
        const inB = m.bId === MY_ID || m.teamB?.includes(MY_ID);
        if (!inA && !inB) return;

        const isWin    = inA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
        const myScore  = inA ? m.scoreA : m.scoreB;
        const oppScore = inA ? m.scoreB : m.scoreA;

        let opponentName = '?';
        if (m.teamA && m.teamB) {
          const oppTeam = inA ? m.teamB : m.teamA;
          opponentName = oppTeam.map(id => findPlayer(id)?.name.split(' ')[0] ?? id).join(' / ');
        } else {
          const oppId = inA ? m.bId : m.aId;
          if (oppId) {
            const oppComp = comp.competitors.find(c => c.id === oppId);
            opponentName = oppComp?.name ?? findPlayer(oppId)?.name ?? oppId;
          }
        }

        const ptsDelta = isWin
          ? +(1.0 + Math.random() * 1.8).toFixed(1)
          : -(0.5 + Math.random() * 1.2).toFixed(1);

        result.push({
          id:              m.id,
          opponentName,
          competitionName: comp.name,
          format:          comp.format,
          dateStr:         formatDateStr(m.playedAt ?? comp.date ?? ''),
          playerScore:     myScore,
          opponentScore:   oppScore,
          isWin,
          ratingDelta:     ptsDelta,
          insight:         getInsight(isWin, myScore, oppScore),
          accentColor:     FORMAT_COLOR[comp.format] ?? Colors.gold,
        });
      });
    });

    return result.reverse();
  }, [state.competitions, MY_ID, groupPlayers]);

  const visible  = entries.slice(0, visibleCount);
  const hasMore  = visibleCount < entries.length;
  const wins     = entries.filter(e => e.isWin).length;
  const losses   = entries.filter(e => !e.isWin).length;
  const winPct   = entries.length > 0 ? Math.round((wins / entries.length) * 100) : 0;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate("/(app)/profile")} hitSlop={8}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Histórico</Text>
          <Text style={s.subtitle}>Suas últimas partidas e performance</Text>
        </View>
        <View style={s.headerBadge}>
          <Text style={s.headerBadgeText}>{winPct}%</Text>
        </View>
      </View>

      {/* Stats strip */}
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={[s.statVal, { color: Colors.teal }]}>{wins}</Text>
          <Text style={s.statLbl}>Vitórias</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={[s.statVal, { color: Colors.coral }]}>{losses}</Text>
          <Text style={s.statLbl}>Derrotas</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={[s.statVal, { color: Colors.text }]}>{entries.length}</Text>
          <Text style={s.statLbl}>Total</Text>
        </View>
      </View>

      {entries.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 36 }}>🎾</Text>
          <Text style={s.emptyTitle}>Nenhuma partida ainda</Text>
          <Text style={s.emptySub}>Dispute partidas para ver seu histórico aqui.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        >
          {/* Timeline */}
          <View style={s.timelineWrap}>
            {/* Linha vertical */}
            <View style={s.timelineLine} />

            {/* Itens */}
            {visible.map((entry, index) => (
              <View key={entry.id} style={s.timelineRow}>
                {/* Dot */}
                <View style={[
                  s.dot,
                  { backgroundColor: entry.isWin ? Colors.gold : Colors.coral },
                ]} />
                {/* Card */}
                <MatchCard entry={entry} index={index} />
              </View>
            ))}
          </View>

          {/* Carregar mais */}
          {hasMore && (
            <TouchableOpacity
              style={s.loadMoreBtn}
              onPress={() => setVisibleCount(v => v + PAGE_SIZE)}
              activeOpacity={0.75}
            >
              <Text style={s.loadMoreText}>Carregar mais partidas</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  back:     { fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.text, lineHeight: 30, width: 32 },
  title:    { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text, lineHeight: 30 },
  subtitle: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: 2 },
  headerBadge: {
    backgroundColor: 'rgba(243,197,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(243,197,68,0.3)',
    borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    marginTop: 4,
  },
  headerBadgeText: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.gold },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surf,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingVertical: Spacing.sm,
  },
  statItem:   { flex: 1, alignItems: 'center', gap: 2 },
  statVal:    { fontFamily: FontFamily.titleBold, fontSize: 20 },
  statLbl:    { fontFamily: FontFamily.number, fontSize: 10, color: Colors.faint },
  statDivider:{ width: 1, backgroundColor: Colors.line, alignSelf: 'stretch', marginVertical: 4 },

  list: { paddingHorizontal: Spacing.md, paddingTop: 0 },

  timelineWrap: { position: 'relative' },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 10,
    bottom: 10,
    width: 2,
    backgroundColor: 'rgba(214,175,70,0.25)',
    borderRadius: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 14,
    flexShrink: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    shadowOpacity: 0.6,
    elevation: 3,
  },

  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  loadMoreText: {
    fontFamily: FontFamily.bodyMed,
    fontSize: 14,
    color: Colors.teal,
  },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, padding: Spacing.xl,
  },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  emptySub:   { fontFamily: FontFamily.body,  fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
