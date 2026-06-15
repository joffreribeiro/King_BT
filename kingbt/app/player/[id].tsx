import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <View style={bar.row}>
      <Text style={bar.label}>{label}</Text>
      <View style={bar.track}>
        <View style={[bar.fill, { width: `${Math.min(value / Math.max(max, 1), 1) * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={bar.val}>{typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}</Text>
    </View>
  );
}
const bar = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, width: 80 },
  track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: Colors.line },
  fill: { height: 5, borderRadius: 3 },
  val: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.text, width: 40, textAlign: 'right' },
});

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useCompetitions();
  const { groupPlayers } = useGroupPlayers();

  const player = groupPlayers.find(p => p.id === id);
  if (!player) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/ranking')}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={{ color: Colors.coral, padding: Spacing.md }}>Jogador não encontrado.</Text>
      </SafeAreaView>
    );
  }

  const allGames = state.competitions.flatMap(extractPlayerGames);
  const ranking = buildRanking(
    groupPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, handicap: p.handicap })),
    allGames
  );
  const me = ranking.find(r => r.id === id) ?? ranking[0];
  const myPos = ranking.findIndex(r => r.id === id) + 1;
  const winRate = me.played > 0 ? Math.round((me.wins / me.played) * 100) : 0;
  const wPts  = me.wins * 3;
  const jPts  = Math.round(me.played * 0.5 * 10) / 10;
  const gaPts = Math.round(me.ga * 2 * 100) / 100;

  // Match history — find all matches involving this player
  const matchHistory: Array<{
    compName: string;
    opponents: string;
    scoreA: number;
    scoreB: number;
    won: boolean;
    date?: string;
  }> = [];

  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreB == null) return;
      const inA = m.teamA ? m.teamA.includes(id!) : m.aId === id;
      const inB = m.teamB ? m.teamB.includes(id!) : m.bId === id;
      if (!inA && !inB) return;

      const myScore = inA ? m.scoreA : m.scoreB;
      const oppScore = inA ? m.scoreB : m.scoreA;
      const won = myScore > oppScore;

      let opponents = '?';
      if (m.teamA && m.teamB) {
        const oppTeam = inA ? m.teamB : m.teamA;
        opponents = oppTeam.map(pid => groupPlayers.find(p => p.id === pid)?.name.split(' ')[0] ?? pid).join(' / ');
      } else {
        const oppId = inA ? m.bId : m.aId;
        if (oppId) {
          const oppComp = comp.competitors.find(c => c.id === oppId);
          opponents = oppComp?.name ?? groupPlayers.find(p => p.id === oppId)?.name ?? oppId;
        }
      }

      matchHistory.push({
        compName: comp.name,
        opponents,
        scoreA: myScore,
        scoreB: oppScore,
        won,
        date: comp.date,
      });
    });
  });
  matchHistory.reverse();

  // Head-to-head stats (against each other player)
  const h2h: Record<string, { wins: number; losses: number }> = {};
  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreB == null) return;
      const inA = m.aId === id;
      const inB = m.bId === id;
      if (!inA && !inB) return;
      const oppId = inA ? m.bId : m.aId;
      if (!oppId) return;
      const myScore = inA ? m.scoreA : m.scoreB;
      const oppScore = inA ? m.scoreB : m.scoreA;
      if (!h2h[oppId]) h2h[oppId] = { wins: 0, losses: 0 };
      if (myScore > oppScore) h2h[oppId].wins++;
      else h2h[oppId].losses++;
    });
  });
  const h2hList = Object.entries(h2h)
    .map(([oppId, r]) => ({ oppId, ...r, total: r.wins + r.losses }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total);

  // Competitions history
  const competitionHistory = state.competitions
    .filter(comp => {
      if (comp.format === 'avulso' || comp.format === 'super8')
        return comp.matches.some(m => m.teamA?.includes(id!) || m.teamB?.includes(id!));
      return comp.competitors.some(c => c.members.includes(id!) || c.id === id);
    })
    .map(comp => {
      let wins = 0, losses = 0;
      comp.matches.forEach(m => {
        if (m.scoreA == null || m.scoreB == null) return;
        const inA = m.teamA ? m.teamA.includes(id!) : m.aId === id;
        const inB = m.teamB ? m.teamB.includes(id!) : m.bId === id;
        if (!inA && !inB) return;
        const ms = inA ? m.scoreA : m.scoreB;
        const os = inA ? m.scoreB : m.scoreA;
        if (ms > os) wins++; else losses++;
      });
      return { comp, wins, losses };
    })
    .filter(x => x.wins + x.losses > 0)
    .reverse();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Back */}
        <TouchableOpacity style={styles.backRow} onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/ranking')}>
          <Text style={styles.backText}>←  Ranking</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.heroBanner}>
          <View style={[styles.heroBg, { backgroundColor: player.color + '22' }]} />
          <View style={styles.heroInner}>
            <Avatar name={player.name} color={player.color} size={88} showCrown={myPos === 1} />
            <Text style={styles.name}>{player.name}</Text>
            <Text style={styles.titleText}>{(player as any).titleEmoji} {(player as any).title}</Text>
            <View style={styles.badges}>
              <Badge label={`${myPos}° lugar`} variant="gold" />
              <Badge label={`${winRate}% aproveit.`} variant="teal" />
            </View>
          </View>
        </View>

        {/* Pontuação */}
        <Card elevated style={styles.ptsCard}>
          <Text style={styles.ptsLabel}>PONTUAÇÃO KING BT</Text>
          <Text style={styles.ptsVal}>{me.points.toFixed(2)}</Text>
          <Text style={styles.ptsEq}>
            ({me.wins}×3) + ({me.played}×0,5) + ({me.ga.toFixed(2)}×2)
          </Text>
        </Card>

        {/* Grid stats */}
        <View style={styles.grid}>
          {[
            { l: 'Vitórias',      v: me.wins,                        c: Colors.teal },
            { l: 'Derrotas',      v: me.losses,                      c: Colors.coral },
            { l: 'Partidas',      v: me.played,                      c: Colors.text },
            { l: 'Game Avg',      v: me.ga.toFixed(2),               c: Colors.gold },
            { l: 'Games Pró',    v: me.gamesPro,                     c: Colors.teal },
            { l: 'Games Contra', v: me.gamesCon,                     c: Colors.coral },
            { l: 'Saldo',         v: (me.sg >= 0 ? '+' : '') + me.sg, c: me.sg >= 0 ? Colors.teal : Colors.coral },
            { l: 'Win Rate',      v: `${winRate}%`,                   c: Colors.goldBright },
          ].map(item => (
            <View key={item.l} style={[styles.cell, { borderLeftWidth: 3, borderLeftColor: item.c + '88' }]}>
              <Text style={[styles.cellVal, { color: item.c }]}>{item.v}</Text>
              <Text style={styles.cellLabel}>{item.l}</Text>
            </View>
          ))}
        </View>

        {/* Quebra de pontos */}
        <Card>
          <Text style={styles.sectionTitle}>Quebra dos Pontos</Text>
          <Bar label="Vitórias ×3"   value={wPts}  max={me.points} color={Colors.teal} />
          <Bar label="Partidas ×0,5" value={jPts}  max={me.points} color={Colors.text} />
          <Bar label="GA ×2"         value={gaPts} max={me.points} color={Colors.gold} />
        </Card>

        {/* Forma recente */}
        {(() => {
          const recentGames = state.competitions
            .flatMap(c => c.matches)
            .filter(m => m.scoreA != null && m.scoreB != null)
            .filter(m => (m.teamA ?? [m.aId]).includes(id!) || (m.teamB ?? [m.bId]).includes(id!))
            .slice(-6);
          if (recentGames.length === 0) return null;
          const results = recentGames.map(m => {
            const inA = (m.teamA ?? [m.aId]).includes(id!);
            return inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
          });
          return (
            <Card>
              <Text style={styles.sectionTitle}>Forma recente</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {results.map((w, i) => (
                  <View key={i} style={{
                    width: 32, height: 32, borderRadius: 8,
                    backgroundColor: w ? Colors.teal + '33' : Colors.coral + '33',
                    borderWidth: 1, borderColor: w ? Colors.teal + '66' : Colors.coral + '66',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 12, color: w ? Colors.teal : Colors.coral }}>
                      {w ? 'V' : 'D'}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          );
        })()}

        {/* Head-to-head */}
        {h2hList.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Confronto direto</Text>
            {h2hList.map(h => {
              const opp = groupPlayers.find(p => p.id === h.oppId);
              const oppName = opp?.name ?? h.oppId;
              const oppColor = opp?.color ?? Colors.muted;
              const rate = h.total > 0 ? Math.round((h.wins / h.total) * 100) : 0;
              return (
                <TouchableOpacity
                  key={h.oppId}
                  style={h2hRow.row}
                  onPress={() => router.push({ pathname: '/player/[id]', params: { id: h.oppId } })}
                  activeOpacity={0.7}
                >
                  <Avatar name={oppName} color={oppColor} size={28} />
                  <Text style={h2hRow.name} numberOfLines={1}>{oppName}</Text>
                  <Text style={[h2hRow.wins, { color: Colors.teal }]}>{h.wins}V</Text>
                  <Text style={h2hRow.sep}> · </Text>
                  <Text style={[h2hRow.wins, { color: Colors.coral }]}>{h.losses}D</Text>
                  <Text style={h2hRow.rate}>{rate}%</Text>
                </TouchableOpacity>
              );
            })}
          </Card>
        )}

        {/* Competições */}
        {competitionHistory.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Competições</Text>
            {competitionHistory.map((item, i) => (
              <TouchableOpacity
                key={item.comp.id}
                style={[compHist.row, i < competitionHistory.length - 1 && compHist.border]}
                onPress={() => router.push({ pathname: '/competitions/[id]', params: { id: item.comp.id } })}
                activeOpacity={0.7}
              >
                <View style={compHist.info}>
                  <Text style={compHist.name} numberOfLines={1}>{item.comp.name}</Text>
                  <Text style={compHist.meta}>{item.comp.format.toUpperCase()} · {item.comp.date}</Text>
                </View>
                <Text style={[compHist.record, { color: item.wins > item.losses ? Colors.teal : Colors.muted }]}>
                  {item.wins}V–{item.losses}D
                </Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Histórico de partidas */}
        {matchHistory.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Histórico de partidas</Text>
            {matchHistory.map((h, i) => (
              <View key={i} style={[hist.row, i < matchHistory.length - 1 && hist.border]}>
                <View style={[hist.result, { backgroundColor: h.won ? Colors.teal + '33' : Colors.coral + '33' }]}>
                  <Text style={[hist.resultText, { color: h.won ? Colors.teal : Colors.coral }]}>
                    {h.won ? 'V' : 'D'}
                  </Text>
                </View>
                <View style={hist.info}>
                  <Text style={hist.opp} numberOfLines={1}>vs {h.opponents}</Text>
                  <Text style={hist.comp} numberOfLines={1}>{h.compName}</Text>
                </View>
                <Text style={[hist.score, { color: h.won ? Colors.teal : Colors.coral }]}>
                  {h.scoreA}–{h.scoreB}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {matchHistory.length === 0 && (
          <Card style={{ alignItems: 'center', padding: Spacing.lg }}>
            <Text style={{ fontFamily: FontFamily.body, fontSize: 14, color: Colors.faint }}>
              Nenhuma partida registrada ainda.
            </Text>
          </Card>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const h2hRow = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  name: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  wins: { fontFamily: FontFamily.numberBold, fontSize: 13 },
  sep: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint },
  rate: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted, width: 36, textAlign: 'right' },
});

const hist = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  result: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  resultText: { fontFamily: FontFamily.numberBold, fontSize: 12 },
  info: { flex: 1, gap: 2 },
  opp: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  comp: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  score: { fontFamily: FontFamily.numberBold, fontSize: 15 },
});

const compHist = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  info: { flex: 1, gap: 2 },
  name: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  meta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  record: { fontFamily: FontFamily.numberBold, fontSize: 14 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  backText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.teal },

  heroBanner: { position: 'relative', overflow: 'hidden', borderRadius: Radius.lg, marginBottom: Spacing.sm },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  heroInner: { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.sm },
  name: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text },
  titleText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  badges: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },

  ptsCard: { alignItems: 'center', gap: 4 },
  ptsLabel: { fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted, letterSpacing: 2 },
  ptsVal: { fontFamily: FontFamily.titleBold, fontSize: 52, color: Colors.gold, lineHeight: 60 },
  ptsEq: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cell: { width: '47%', alignItems: 'center', gap: 2, padding: Spacing.md, backgroundColor: Colors.surf, borderRadius: Radius.md },
  cellVal: { fontFamily: FontFamily.titleBold, fontSize: 26 },
  cellLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  sectionTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text, marginBottom: Spacing.sm },
});
