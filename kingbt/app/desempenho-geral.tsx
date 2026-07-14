import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
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
import { computeNamedRivalries, mergeNamedRivalries, reduceNamedRivalries, type NamedRivalryMaps, type NamedRivalryStats } from '@/logic/rivalries';
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
  isTeam: boolean;
  gender: string;
}

interface GroupLoadResult extends GroupPerf {
  recentMatches: RecentMatch[];
  formatStats: FormatStat[];
  situationStats: SituationStat[];
  rivalryMaps: NamedRivalryMaps;
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
  const [last20, setLast20] = useState<RecentMatch[]>([]);
  const [streak, setStreak] = useState({ current: 0, max: 0 });
  const [formatStats, setFormatStats] = useState<FormatStat[]>([]);
  const [situationStats, setSituationStats] = useState<SituationStat[]>([]);
  const [rivalries, setRivalries] = useState<NamedRivalryStats | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<RecentMatch | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

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
                recentMatches: [], formatStats: [], situationStats: [], rivalryMaps: { partners: {}, rivals: {} },
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
                  isTeam: !!(m.teamA && m.teamB), gender: comp.gender,
                });
              });
            });

            const rivalryMaps = computeNamedRivalries(
              playerId, competitions, (pid) => findPlayer(pid)?.name ?? pid,
            );

            return {
              groupId: g.id, name: g.name, played, wins, myPos, total, points, percentile,
              recentMatches: groupRecent, formatStats: groupFormatStats, situationStats: groupSituationStats,
              rivalryMaps,
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
        setRecentMatches([...allMatches.slice(-20)].reverse());
        setLast20([...allMatches.slice(-20)].reverse());
        setStreak(computeMergedStreak(allMatches));
        setFormatStats(mergeFormatStats(valid.map(r => r.formatStats)));
        setSituationStats(mergeSituationStats(valid.map(r => r.situationStats)));
        setRivalries(reduceNamedRivalries(mergeNamedRivalries(valid.map(r => r.rivalryMaps))));
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

  // Últimos 20 jogos (todos os grupos) — quebra por formato
  const l20Wins = last20.filter(m => m.won).length;
  const l20Losses = last20.length - l20Wins;
  const catOf = (m: RecentMatch) => (!m.isTeam ? 'Simples' : m.gender === 'misto' ? 'Mista' : 'Duplas');
  const l20Breakdown = ['Simples', 'Duplas', 'Mista'].map(label => {
    const games = last20.filter(m => catOf(m) === label);
    return { label, wins: games.filter(m => m.won).length, losses: games.filter(m => !m.won).length, total: games.length };
  }).filter(f => f.total > 0);

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

            {/* Últimos 20 jogos (todos os grupos) */}
            {last20.length > 0 && (
              <View style={s.summaryCard}>
                <Text style={s.l20Title}>Últimos {last20.length} jogos</Text>
                {l20Breakdown.map(f => (
                  <TouchableOpacity key={f.label} style={s.l20Row} activeOpacity={0.7} onPress={() => setSelectedCat(f.label)}>
                    <Text style={s.l20Label}>{f.label}</Text>
                    <View style={s.l20Bar}>
                      <View style={[s.l20BarWin, { flex: f.wins || 0.001 }]}>
                        {f.wins > 0 && <Text style={s.l20BarNum}>{f.wins}</Text>}
                      </View>
                      <View style={[s.l20BarLoss, { flex: f.losses || 0.001 }]}>
                        {f.losses > 0 && <Text style={s.l20BarNum}>{f.losses}</Text>}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
                <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm }}>
                  <View style={s.l20Box}>
                    <Text style={s.l20Icon}>✅</Text>
                    <Text style={[s.l20Num, { color: Colors.teal }]}>{l20Wins}</Text>
                    <Text style={s.l20Lbl}>Vitórias</Text>
                  </View>
                  <View style={s.l20Box}>
                    <Text style={s.l20Icon}>❌</Text>
                    <Text style={[s.l20Num, { color: Colors.coral }]}>{l20Losses}</Text>
                    <Text style={s.l20Lbl}>Derrotas</Text>
                  </View>
                  <View style={s.l20Box}>
                    <Text style={s.l20Icon}>📊</Text>
                    <Text style={[s.l20Num, { color: Colors.gold }]}>
                      {last20.length > 0 ? Math.round((l20Wins / last20.length) * 100) : 0}%
                    </Text>
                    <Text style={s.l20Lbl}>Aproveit.</Text>
                  </View>
                </View>
              </View>
            )}

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

        {/* Rivalidades — agregadas por nome em todos os grupos */}
        {rivalries && (rivalries.biggestPartner || rivalries.bestPartner || rivalries.biggestRival || rivalries.carrasco || rivalries.fregues) && (() => {
          const rows = [
            { emoji: '🎾', label: 'Maior Parceiro',          sub: 'Com quem mais jogou',   stat: rivalries.biggestPartner, detail: (x: any) => `${x.played} jogo${x.played !== 1 ? 's' : ''} juntos` },
            { emoji: '🤝', label: 'Parceiro Mais Eficiente', sub: 'Com quem mais venceu',   stat: rivalries.bestPartner,    detail: (x: any) => `${x.wins}V / ${x.played - x.wins}D · ${Math.round(x.pct * 100)}%` },
            { emoji: '⚔️', label: 'Maior Rival',             sub: 'Quem mais enfrentou',   stat: rivalries.biggestRival,   detail: (x: any) => `${x.played} confronto${x.played !== 1 ? 's' : ''}` },
            { emoji: '👹', label: 'Carrasco',                sub: 'Quem mais te venceu',   stat: rivalries.carrasco,       detail: (x: any) => `${x.wins} derrota${x.wins !== 1 ? 's' : ''}` },
            { emoji: '😅', label: 'Freguês',                 sub: 'Quem você mais venceu', stat: rivalries.fregues,        detail: (x: any) => `${x.wins} vitória${x.wins !== 1 ? 's' : ''}` },
          ].filter(r => r.stat);
          return (
            <>
              <Text style={s.sectionLabel}>RIVALIDADES</Text>
              <View style={s.summaryCard}>
                {rows.map(({ emoji, label, sub, stat, detail }, i) => (
                  <View key={label} style={[s.rivalryRow, i < rows.length - 1 && s.rivalryBorder]}>
                    <Text style={s.rivalryEmoji}>{emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rivalryLabel}>{label}</Text>
                      <Text style={s.rivalrySub}>{sub}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', maxWidth: 130 }}>
                      <Text style={s.rivalryName} numberOfLines={1}>{stat!.name.split(' ')[0]}</Text>
                      <Text style={s.rivalryDetail} numberOfLines={1}>{detail(stat)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          );
        })()}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />

      {/* Lista de jogos da categoria clicada (Últimos 20 jogos) */}
      <Modal visible={!!selectedCat} transparent animationType="fade" onRequestClose={() => setSelectedCat(null)}>
        <TouchableOpacity style={s.catOverlay} activeOpacity={1} onPress={() => setSelectedCat(null)}>
          <TouchableOpacity style={s.catBox} activeOpacity={1}>
            <Text style={s.catTitle}>{selectedCat} · últimos 20 jogos</Text>
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {last20.filter(m => catOf(m) === selectedCat).map(m => (
                <View key={m.id} style={s.catRow}>
                  <View style={[s.catBadge, { backgroundColor: m.won ? Colors.teal + '33' : Colors.coral + '33' }]}>
                    <Text style={[s.catBadgeTxt, { color: m.won ? Colors.teal : Colors.coral }]}>{m.won ? 'V' : 'D'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.catOpp} numberOfLines={1}>
                      vs {m.opponent}{m.partner ? ` · com ${m.partner}` : ''}
                    </Text>
                    <Text style={s.catSub} numberOfLines={1}>{[m.groupName, m.date?.slice(0, 10)].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Text style={[s.catScore, { color: m.won ? Colors.teal : Colors.coral }]}>{m.myScore}–{m.oppScore}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.catCloseBtn} onPress={() => setSelectedCat(null)}>
              <Text style={s.catCloseTxt}>Fechar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

  l20Title:   { fontFamily: FontFamily.titleBold, fontSize: 14, color: Colors.text, marginBottom: Spacing.sm },
  l20Row:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
  l20Label:   { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, width: 60 },
  l20Bar:     { flex: 1, flexDirection: 'row', height: 18, borderRadius: 4, overflow: 'hidden' },
  l20BarWin:  { backgroundColor: Colors.teal + 'CC', alignItems: 'center', justifyContent: 'center' },
  l20BarLoss: { backgroundColor: Colors.coral + 'CC', alignItems: 'center', justifyContent: 'center' },
  l20BarNum:  { fontFamily: FontFamily.numberBold, fontSize: 12, color: '#fff', paddingHorizontal: 6 },
  l20Box:     { flex: 1, alignItems: 'center', backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.sm, gap: 2 },
  l20Icon:    { fontSize: 18 },
  l20Num:     { fontFamily: FontFamily.titleBold, fontSize: 22 },
  l20Lbl:     { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },

  catOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  catBox:      { backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', maxWidth: 380 },
  catTitle:    { fontFamily: FontFamily.titleBold, fontSize: 15, color: Colors.text, marginBottom: Spacing.sm },
  catRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.line },
  catBadge:    { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catBadgeTxt: { fontFamily: FontFamily.numberBold, fontSize: 12, fontWeight: '700' },
  catOpp:      { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  catSub:      { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  catScore:    { fontFamily: FontFamily.numberBold, fontSize: 15 },
  catCloseBtn: { marginTop: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  catCloseTxt: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.gold },

  rivalryRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8 },
  rivalryBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  rivalryEmoji:  { fontSize: 22 },
  rivalryLabel:  { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  rivalrySub:    { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  rivalryName:   { fontFamily: FontFamily.titleBold, fontSize: 13, color: Colors.text },
  rivalryDetail: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },

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
