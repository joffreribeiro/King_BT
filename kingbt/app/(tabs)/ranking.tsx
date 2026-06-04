import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import { PLAYERS, SEASON_STATS, GROUP } from '@/mocks/data';

function getPlayer(id: string) {
  return PLAYERS.find(p => p.id === id)!;
}

const PODIUM_ORDER = [SEASON_STATS[1], SEASON_STATS[0], SEASON_STATS[2]]; // 2°, 1°, 3°
const TABLE = SEASON_STATS;

export default function RankingScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Título */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>RANKING GERAL</Text>
          <Text style={styles.subtitle}>Temporada {GROUP.season} · {GROUP.roundsDone} rodadas</Text>
          <Text style={styles.updated}>Atualizado em 02/06/2026</Text>
        </View>

        {/* Pódio */}
        <View style={styles.podium}>
          {PODIUM_ORDER.map((s, i) => {
            const pl = getPlayer(s.id);
            const pos = i === 0 ? 2 : i === 1 ? 1 : 3;
            const heights = [88, 116, 72];
            const isFirst = pos === 1;
            return (
              <View key={s.id} style={styles.podiumCol}>
                <Avatar name={pl.name} color={pl.color} size={isFirst ? 64 : 48} showCrown={isFirst} />
                <Text style={[styles.podiumName, isFirst && styles.podiumNameBig]}>{pl.name}</Text>
                <Text style={[styles.podiumPts, isFirst && styles.podiumPtsBig]}>{s.points.toFixed(2)}</Text>
                <View style={[styles.podiumBlock, { height: heights[i], backgroundColor: isFirst ? Colors.gold + '33' : Colors.surface2 }]}>
                  <Text style={[styles.podiumPos, isFirst && { color: Colors.gold }]}>{pos}°</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Tabela */}
        <Card style={styles.table}>
          {/* Cabeçalho */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.col0, styles.th]}>POS</Text>
            <Text style={[styles.colName, styles.th]}>JOGADOR</Text>
            <Text style={[styles.colStat, styles.th]}>V</Text>
            <Text style={[styles.colStat, styles.th]}>J</Text>
            <Text style={[styles.colStat, styles.th]}>GA</Text>
            <Text style={[styles.colPts, styles.th]}>PTS</Text>
          </View>

          {TABLE.map((s, i) => {
            const pl = getPlayer(s.id);
            const isMe = s.id === 'p1';
            return (
              <View
                key={s.id}
                style={[styles.tableRow, i < TABLE.length - 1 && styles.rowBorder, isMe && styles.rowHighlight]}
              >
                <Text style={[styles.col0, styles.posText, isMe && styles.posTextMe]}>{i + 1}°</Text>
                <View style={[styles.colName, styles.rowName]}>
                  <Avatar name={pl.name} color={pl.color} size={28} />
                  <View>
                    <Text style={[styles.playerName, isMe && { color: Colors.gold }]}>{pl.name}</Text>
                    <Text style={styles.playerTitle}>{pl.titleEmoji} {pl.title}</Text>
                  </View>
                </View>
                <Text style={[styles.colStat, styles.statText]}>{s.wins}</Text>
                <Text style={[styles.colStat, styles.statText]}>{s.played}</Text>
                <Text style={[styles.colStat, styles.statText]}>{s.ga.toFixed(2)}</Text>
                <Text style={[styles.colPts, styles.ptsText]}>{s.points.toFixed(2)}</Text>
              </View>
            );
          })}
        </Card>

        {/* Fórmula */}
        <Card style={styles.formula}>
          <Text style={styles.formulaTitle}>⭐ Como é calculado?</Text>
          <Text style={styles.formulaEq}>
            <Text style={{ color: Colors.gold }}>Pts</Text>
            {' = '}
            <Text style={{ color: Colors.teal }}>(V×3)</Text>
            {' + '}
            <Text style={{ color: Colors.text }}>(J×0,5)</Text>
            {' + '}
            <Text style={{ color: Colors.coral }}>(GA×2)</Text>
          </Text>
          <Text style={styles.formulaNote}>GA = Games Pró ÷ Games Contra</Text>
          <View style={styles.formulaExample}>
            <Text style={styles.formulaExTitle}>Exemplo — Joffre:</Text>
            <Text style={styles.formulaExText}>(11×3) + (15×0,5) + (1,36×2) = 33 + 7,5 + 2,72 = <Text style={{ color: Colors.gold }}>43,21</Text></Text>
          </View>
          <Text style={styles.desempate}>Desempate: Pts → GA → Saldo (GP−GC) → Vitórias → Confronto Direto</Text>
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
  title: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.gold, letterSpacing: 2 },
  subtitle: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.text, marginTop: 4 },
  updated: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSoft },

  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: Spacing.sm, marginVertical: Spacing.md },
  podiumCol: { alignItems: 'center', width: 100, gap: 6 },
  podiumName: { fontFamily: FontFamily.title, fontSize: 12, color: Colors.text, textAlign: 'center' },
  podiumNameBig: { fontSize: 14, color: Colors.gold },
  podiumPts: { fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.textSoft },
  podiumPtsBig: { fontSize: 22, color: Colors.gold },
  podiumBlock: { width: '100%', borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  podiumPos: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.textSoft },

  table: { padding: 0, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 10 },
  tableHeader: { backgroundColor: Colors.surface2, paddingVertical: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  rowHighlight: { backgroundColor: Colors.gold + '11' },

  col0: { width: 30 },
  colName: { flex: 1 },
  colStat: { width: 32, textAlign: 'center' },
  colPts: { width: 48, textAlign: 'right' },

  th: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.textSoft, letterSpacing: 0.5 },
  posText: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.textSoft },
  posTextMe: { color: Colors.gold },

  rowName: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  playerName: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.text },
  playerTitle: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSoft },

  statText: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.text, textAlign: 'center' },
  ptsText: { fontFamily: FontFamily.numberBold, fontSize: 14, color: Colors.gold, textAlign: 'right' },

  formula: { gap: Spacing.sm },
  formulaTitle: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  formulaEq: { fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.text, textAlign: 'center', paddingVertical: Spacing.sm },
  formulaNote: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSoft, textAlign: 'center' },
  formulaExample: { backgroundColor: Colors.surface2, borderRadius: Radius.sm, padding: Spacing.sm, gap: 4 },
  formulaExTitle: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.textSoft },
  formulaExText: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.text },
  desempate: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSoft, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.sm },
});
