import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import { PLAYERS } from '@/mocks/data';
import { useCompetitions } from '@/store/CompetitionsContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';

export default function RankingScreen() {
  const { state } = useCompetitions();

  const allGames = state.competitions.flatMap(extractPlayerGames);
  const ranking = buildRanking(
    PLAYERS.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color })),
    allGames
  );

  const PODIUM = [ranking[1], ranking[0], ranking[2]].filter(Boolean);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>RANKING GERAL</Text>
          <Text style={styles.subtitle}>
            {state.competitions.length} competições · Temporada 2026
          </Text>
        </View>

        {/* Pódio */}
        {ranking.length >= 3 && (
          <View style={styles.podium}>
            {PODIUM.map((s, i) => {
              const pl = PLAYERS.find(p => p.id === s.id)!;
              const pos = i === 0 ? 2 : i === 1 ? 1 : 3;
              const heights = [80, 110, 64];
              const isFirst = pos === 1;
              return (
                <View key={s.id} style={styles.podiumCol}>
                  <Avatar name={pl.name} color={pl.color} size={isFirst ? 60 : 46} showCrown={isFirst} />
                  <Text style={[styles.podiumName, isFirst && { color: Colors.gold }]} numberOfLines={1}>
                    {pl.name}
                  </Text>
                  <Text style={[styles.podiumPts, isFirst && styles.podiumPtsBig]}>
                    {s.points.toFixed(2)}
                  </Text>
                  <View style={[styles.podiumBlock, {
                    height: heights[i],
                    backgroundColor: isFirst ? Colors.gold + '28' : Colors.surf2,
                    borderTopColor: isFirst ? Colors.gold : Colors.line,
                  }]}>
                    <Text style={[styles.podiumPos, isFirst && { color: Colors.gold }]}>{pos}°</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Tabela */}
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <View style={[styles.row, styles.th]}>
            {['#', 'JOGADOR', 'V', 'J', 'GA', 'PTS'].map(h => (
              <Text key={h} style={[h === 'JOGADOR' ? styles.cName : h === '#' ? styles.c0 : h === 'PTS' ? styles.cPts : styles.cN, styles.thText]}>
                {h}
              </Text>
            ))}
          </View>
          {ranking.map((s, i) => {
            const pl = PLAYERS.find(p => p.id === s.id)!;
            return (
              <View key={s.id} style={[styles.row, i < ranking.length - 1 && styles.rowBorder]}>
                <Text style={[styles.c0, styles.posText]}>{i + 1}</Text>
                <View style={[styles.cName, styles.rowPlayer]}>
                  <Avatar name={pl.name} color={pl.color} size={26} />
                  <Text style={styles.playerName} numberOfLines={1}>{pl.name}</Text>
                </View>
                <Text style={[styles.cN, styles.numText]}>{s.wins}</Text>
                <Text style={[styles.cN, styles.numText]}>{s.played}</Text>
                <Text style={[styles.cN, styles.numText]}>{s.ga.toFixed(2)}</Text>
                <Text style={[styles.cPts, styles.ptsText]}>{s.points.toFixed(2)}</Text>
              </View>
            );
          })}
        </Card>

        {/* Fórmula */}
        <Card style={styles.formula}>
          <Text style={styles.formulaTitle}>⭐ Fórmula King BT</Text>
          <Text style={styles.formulaEq}>
            <Text style={{ color: Colors.gold }}>Pts</Text>
            {' = '}
            <Text style={{ color: Colors.teal }}>(V×3)</Text>
            {' + '}
            <Text style={{ color: Colors.text }}>(J×0,5)</Text>
            {' + '}
            <Text style={{ color: Colors.goldBright }}>(GA×2)</Text>
          </Text>
          <Text style={styles.formulaNote}>GA = GamesPró ÷ GamesContra</Text>
          <Text style={styles.desempate}>
            Desempate: Pts → GA → SG (GP−GC) → Vitórias → Confronto Direto
          </Text>
        </Card>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  titleBlock: { alignItems: 'center', paddingTop: Spacing.sm },
  title: { fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.gold, letterSpacing: 2 },
  subtitle: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: 4 },

  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: Spacing.sm, marginVertical: Spacing.md },
  podiumCol: { alignItems: 'center', width: 96, gap: 5 },
  podiumName: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.text, textAlign: 'center' },
  podiumPts: { fontFamily: FontFamily.numberBold, fontSize: 14, color: Colors.muted },
  podiumPtsBig: { fontSize: 20, color: Colors.gold },
  podiumBlock: { width: '100%', borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', borderTopWidth: 2 },
  podiumPos: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.muted },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 10 },
  th: { backgroundColor: Colors.surf2, paddingVertical: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  c0: { width: 28 },
  cName: { flex: 1 },
  cN: { width: 36, textAlign: 'center' },
  cPts: { width: 52, textAlign: 'right' },
  thText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.faint, letterSpacing: 0.5 },
  posText: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.muted },
  rowPlayer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  playerName: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  numText: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.text, textAlign: 'center' },
  ptsText: { fontFamily: FontFamily.numberBold, fontSize: 14, color: Colors.gold, textAlign: 'right' },

  formula: { gap: Spacing.sm },
  formulaTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text },
  formulaEq: { fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.text, textAlign: 'center', paddingVertical: Spacing.xs },
  formulaNote: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted, textAlign: 'center' },
  desempate: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.sm },
});
