import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { fetchCompetitionsOnce } from '@/firebase/competitions';
import { computeFormatStats, mergeFormatStats, generateFormatInsight, type FormatStat } from '@/logic/formatStats';
import { computeSituationStats, mergeSituationStats, type SituationStat } from '@/logic/situationStats';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { MatchDetailModal } from '@/components/MatchDetailModal';

interface GroupPerf {
  groupId: string;
  name: string;
  played: number;
  wins: number;
  myPos: number;
  total: number;
  points: number;
  percentile: number;
}

interface RecentMatch {
  id: string;
  groupName: string;
  compName: string;
  opponent: string;
  partner: string | null;
  myScore: number;
  oppScore: number;
  won: boolean;
  date: string;
}

interface GroupLoadResult extends GroupPerf {
  recentMatches: RecentMatch[];
  formatStats: FormatStat[];
  situationStats: SituationStat[];
}

function computeMergedStreak(matches: { won: boolean; date: string }[]): { current: number; max: number } {
  const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
  let current = 0;
  const lastWon = sorted[sorted.length - 1]?.won;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].won === lastWon) { if (sorted[i].won) current++; else current--; }
    else break;
  }
  let max = 0, streak = 0;
  for (const g of sorted) { if (g.won) { streak++; max = Math.max(max, streak); } else streak = 0; }
  return { current, max };
}

export default function DesempenhoGeralScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { user, getMyGroups } = useAuth();

  const [loading, setLoading] = useState(true);
  const [perGroup, setPerGroup] = useState<GroupPerf[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [streak, setStreak] = useState({ current: 0, max: 0 });
  const [formatStats, setFormatStats] = useState<FormatStat[]>([]);
  const [situationStats, setSituationStats] = useState<SituationStat[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<RecentMatch | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) { setLoading(false); return; }
      setLoading(true);
      try {
        const groups = await getMyGroups();
        const results = await Promise.all(groups.map(async (g): Promise<GroupLoadResult | null> => {
          try {
            const playerSnap = await getDocs(query(
              collection(db, 'groups', g.id, 'players'),
              where('uid', '==', user.uid),
              limit(1),
            ));
            const playerId = playerSnap.docs[0]?.id;
            if (!playerId) {
              return {
                groupId: g.id, name: g.name, played: 0, wins: 0, myPos: 0, total: 0, points: 0, percentile: 0,
                recentMatches: [], formatStats: [], situationStats: [],
              };
            }

            const [competitions, allPlayersSnap] = await Promise.all([
              fetchCompetitionsOnce(g.id),
              getDocs(collection(db, 'groups', g.id, 'players')),
            ]);
            const allPlayers = allPlayersSnap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; name: string; color: string; handicap?: number }));
            const findPlayer = (id: string) => allPlayers.find(p => p.id === id);

            const groupFormatStats = computeFormatStats(competitions, playerId);
            const played = groupFormatStats.reduce((acc, f) => acc + f.played, 0);
            const wins = groupFormatStats.reduce((acc, f) => acc + f.wins, 0);
            const groupSituationStats = computeSituationStats(competitions, playerId);

            const games = competitions.flatMap(extractPlayerGames);
            const ranking = buildRanking(
              allPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, handicap: p.handicap })),
              games
            );
            const myPos = ranking.findIndex(r => r.id === playerId) + 1;
            const total = ranking.length;
            const points = myPos > 0 ? ranking[myPos - 1].points : 0;
            const percentile = total > 1 && myPos > 0 ? Math.round(((total - myPos) / (total - 1)) * 100) : 0;

            const groupRecent: RecentMatch[] = [];
            competitions.forEach(comp => {
              comp.matches.forEach(m => {
                if (m.scoreA == null || m.scoreB == null) return;
                const inA = m.teamA ? m.teamA.includes(playerId) : m.aId === playerId;
                const inB = m.teamB ? m.teamB.includes(playerId) : m.bId === playerId;
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
                  const pid = myTeam.find(pid => pid !== playerId);
                  if (pid) partner = findPlayer(pid)?.name.split(' ')[0] ?? pid;
                } else {
                  const oppId = inA ? m.bId : m.aId;
                  if (oppId) {
                    const oppComp = comp.competitors.find(c => c.id === oppId);
                    opponent = oppComp?.name ?? findPlayer(oppId)?.name ?? oppId;
                  }
                }

                groupRecent.push({
                  id: `${g.id}_${m.id}`, groupName: g.name, compName: comp.name,
                  opponent, partner, myScore, oppScore, won, date: m.playedAt ?? comp.date ?? '',
                });
              });
            });

            return {
              groupId: g.id, name: g.name, played, wins, myPos, total, points, percentile,
              recentMatches: groupRecent, formatStats: groupFormatStats, situationStats: groupSituationStats,
            };
          } catch {
            return null;
          }
        }));

        if (cancelled) return;
        const valid = results.filter(Boolean) as GroupLoadResult[];
        setPerGroup(valid.map(({ recentMatches: _rm, formatStats: _fs, situationStats: _ss, ...rest }) => rest));

        const allMatches = valid.flatMap(r => r.recentMatches).sort((a, b) => a.date.localeCompare(b.date));
        // Mais recente primeiro (esquerda).
        setRecentMatches([...allMatches.slice(-12)].reverse());
        setStreak(computeMergedStreak(allMatches));
        setFormatStats(mergeFormatStats(valid.map(r => r.formatStats)));
        setSituationStats(mergeSituationStats(valid.map(r => r.situationStats)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  const totalPlayed = perGroup.reduce((acc, g) => acc + g.played, 0);
  const totalWins    = perGroup.reduce((acc, g) => acc + g.wins, 0);
  const totalLosses  = totalPlayed - totalWins;
  const overallPct    = totalPlayed > 0 ? totalWins / totalPlayed : 0;
  const groupsWithGames = perGroup.filter(g => g.played > 0).sort((a, b) => b.played - a.played);
  const situationWithData = situationStats.filter(st => st.played > 0);
  const insight = generateFormatInsight(formatStats);

  const streakColor = streak.current > 0 ? Colors.teal : streak.current < 0 ? Colors.coral : Colors.muted;
  const streakLabel = streak.current > 0
    ? `${streak.current} vitória${streak.current > 1 ? 's' : ''} seguida${streak.current > 1 ? 's' : ''}`
    : streak.current < 0
      ? `${Math.abs(streak.current)} derrota${Math.abs(streak.current) > 1 ? 's' : ''} seguida${Math.abs(streak.current) > 1 ? 's' : ''}`
      : 'sem jogos recentes';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Desempenho Geral</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.hint}>Soma do seu desempenho em todos os grupos que você participa.</Text>

        {loading ? (
          <View style={{ paddingVertical: Spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={Colors.gold} />
          </View>
        ) : totalPlayed === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 32 }}>📊</Text>
            <Text style={s.emptyTitle}>Sem dados ainda</Text>
            <Text style={s.emptySub}>Nenhuma partida encontrada nos seus grupos.</Text>
          </View>
        ) : (
          <>
            <View style={s.summaryCard}>
              <View style={s.summaryHeader}>
                <Text style={s.summaryLabel}>GERAL · TODOS OS GRUPOS</Text>
                <Text style={s.summaryMatchCount}>{totalPlayed} partidas</Text>
              </View>
              <View style={s.summaryBody}>
                <View style={{ flex: 1 }}>
                  <View style={s.progressTrack}>
                    <View style={[
                      s.progressBar,
                      { width: `${overallPct * 100}%` as any, backgroundColor: overallPct > 0.65 ? Colors.teal : Colors.gold },
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

            {/* Sequência de resultados */}
            {recentMatches.length > 0 && (
              <View style={s.streakCard}>
                <View style={s.streakHeader}>
                  <Text style={s.summaryLabel}>SEQUÊNCIA DE RESULTADOS</Text>
                  <Text style={[s.streakCurrent, { color: streakColor }]}>{streakLabel}</Text>
                </View>
                <View style={s.formRow}>
                  {recentMatches.map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.formChip, { backgroundColor: m.won ? `${Colors.teal}33` : `${Colors.coral}33`, borderColor: m.won ? `${Colors.teal}66` : `${Colors.coral}66` }]}
                      onPress={() => setSelectedMatch(m)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.formChipTxt, { color: m.won ? Colors.teal : Colors.coral }]}>{m.won ? 'V' : 'D'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={s.streakMax}>
                  Melhor sequência: <Text style={{ color: Colors.gold, fontFamily: FontFamily.bodyMed }}>{streak.max} vitória{streak.max !== 1 ? 's' : ''} seguidas</Text>
                </Text>
              </View>
            )}

            {/* Por grupo */}
            <Text style={s.sectionLabel}>POR GRUPO</Text>
            {groupsWithGames.map(g => {
              const pct = g.played > 0 ? Math.round((g.wins / g.played) * 100) : 0;
              return (
                <View key={g.groupId} style={s.groupCard}>
                  <View style={s.groupHeader}>
                    <Text style={s.groupName} numberOfLines={1}>{g.name}</Text>
                    {g.myPos > 0 && <Text style={s.groupRank}>{g.myPos}º de {g.total}</Text>}
                    <Text style={[s.groupPct, { color: Colors.gold }]}>{pct}%</Text>
                  </View>
                  <Text style={s.groupCount}>
                    {g.played} partidas · {g.wins}V {g.played - g.wins}D · rating {g.points.toFixed(2)}
                    {g.total > 1 ? ` · acima de ${g.percentile}% do grupo` : ''}
                  </Text>
                  <View style={s.groupProgressTrack}>
                    <View style={[s.groupProgressBar, { width: `${pct}%` as any, backgroundColor: Colors.gold }]} />
                  </View>
                </View>
              );
            })}

            {/* Por formato */}
            {formatStats.length > 0 && (
              <>
                <Text style={s.sectionLabel}>POR FORMATO</Text>
                {formatStats.map(f => (
                  <View key={f.format} style={[s.formatCard, { backgroundColor: `${f.color}14`, borderColor: `${f.color}38` }]}>
                    <View style={s.formatHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.formatName}>{f.label}</Text>
                        <Text style={s.formatCount}>{f.played} partidas · {f.wins}V {f.played - f.wins}D</Text>
                      </View>
                      <Text style={[s.formatPct, { color: f.color }]}>{f.pct}%</Text>
                    </View>
                    <View style={s.groupProgressTrack}>
                      <View style={[s.groupProgressBar, { width: `${f.pct}%` as any, backgroundColor: f.color }]} />
                    </View>
                  </View>
                ))}

                <View style={s.insightCard}>
                  <Text style={s.insightLabel}>💡 INSIGHT</Text>
                  <Text style={s.insightText}>{insight}</Text>
                </View>

                <Text style={[s.sectionLabel, { marginTop: Spacing.md }]}>SEU PÓDIUM DE FORMATOS</Text>
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

            {/* Aproveitamento por situação */}
            {situationWithData.length > 0 && (
              <>
                <Text style={s.sectionLabel}>APROVEITAMENTO POR SITUAÇÃO</Text>
                {situationWithData.map(st => (
                  <View key={st.key} style={s.situationRow}>
                    <View style={s.situationHeader}>
                      <Text style={s.situationLabel}>{st.label}</Text>
                      <Text style={s.situationCount}>{st.played} · {st.wins}V {st.played - st.wins}D</Text>
                      <Text style={[s.situationPct, { color: Colors.gold }]}>{st.pct}%</Text>
                    </View>
                    <View style={s.groupProgressTrack}>
                      <View style={[s.groupProgressBar, { width: `${st.pct}%` as any, backgroundColor: Colors.gold }]} />
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
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
  scroll: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },

  hint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, lineHeight: 19, marginBottom: 4 },

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
    color: Colors.faint, letterSpacing: 1.5, marginBottom: 4, marginTop: 8,
  },

  streakCard: {
    backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line,
    borderRadius: 12, padding: 11, gap: 8,
  },
  streakHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakCurrent: { fontFamily: FontFamily.numberBold, fontSize: 11, fontWeight: '700' },
  streakMax:     { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },

  formRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  formChip: { flexGrow: 1, flexBasis: 32, height: 32, borderRadius: Radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  formChipTxt: { fontFamily: FontFamily.numberBold, fontSize: 12, fontWeight: '700' },

  groupCard: { borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.surf, borderRadius: 11, padding: 10, marginBottom: 6 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4 },
  groupName: { flex: 1, fontFamily: FontFamily.title, fontSize: 13, color: Colors.text, fontWeight: '700' },
  groupRank: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.muted },
  groupPct:  { fontFamily: FontFamily.numberBold, fontSize: 13, fontWeight: '700' },
  groupCount: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.muted, marginBottom: 6 },
  groupProgressTrack: { height: 4, backgroundColor: Colors.surf2, borderRadius: 2, overflow: 'hidden' },
  groupProgressBar:   { height: 4, borderRadius: 2 },

  formatCard: { borderWidth: 1, borderRadius: 11, padding: 10, marginBottom: 6 },
  formatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, gap: 6 },
  formatName:  { fontFamily: FontFamily.title, fontSize: 13, color: Colors.text, fontWeight: '700' },
  formatCount: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.muted, marginTop: 2 },
  formatPct:   { fontFamily: FontFamily.numberBold, fontSize: 13, fontWeight: '700' },

  insightCard: {
    backgroundColor: 'rgba(243,197,68,0.08)', borderWidth: 1, borderColor: 'rgba(243,197,68,0.15)',
    borderRadius: 11, padding: 12, marginTop: 4,
  },
  insightLabel: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.gold, fontWeight: '700', marginBottom: 5, letterSpacing: 0.5 },
  insightText:  { fontFamily: FontFamily.body, fontSize: 12, color: Colors.text, lineHeight: 18 },

  podiumRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.line },
  podiumMedal:  { fontSize: 18, width: 28 },
  podiumFormat: { fontFamily: FontFamily.bodyMed, fontSize: 12, width: 72 },
  podiumBar:    { flex: 1, height: 4, backgroundColor: Colors.surf2, borderRadius: 2, overflow: 'hidden' },
  podiumFill:   { height: 4, borderRadius: 2 },
  podiumPct:    { fontFamily: FontFamily.numberBold, fontSize: 12, width: 38, textAlign: 'right' },

  situationRow:    { backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line, borderRadius: 11, padding: 10, gap: 6, marginBottom: 6 },
  situationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  situationLabel:  { flex: 1, fontFamily: FontFamily.title, fontSize: 13, color: Colors.text, fontWeight: '700' },
  situationCount:  { fontFamily: FontFamily.body, fontSize: 10, color: Colors.muted },
  situationPct:    { fontFamily: FontFamily.numberBold, fontSize: 13, fontWeight: '700', width: 40, textAlign: 'right' },

  empty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  emptySub:   { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
