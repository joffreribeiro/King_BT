import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { PLAYERS, SEASON_STATS, SESSION4_GAMES, GROUP } from '@/mocks/data';

const CURRENT_ID = 'p1';
const player = PLAYERS.find(p => p.id === CURRENT_ID)!;
const stats = SEASON_STATS.find(s => s.id === CURRENT_ID)!;
const pos = SEASON_STATS.findIndex(s => s.id === CURRENT_ID) + 1;

// Forma recente: últimos jogos da última sessão
function getRecentForm(): ('W' | 'L')[] {
  const form: ('W' | 'L')[] = [];
  for (const g of [...SESSION4_GAMES].reverse()) {
    if (!g.teamA.includes(CURRENT_ID) && !g.teamB.includes(CURRENT_ID)) continue;
    if (g.scoreA == null || g.scoreB == null) continue;
    const inA = g.teamA.includes(CURRENT_ID);
    const won = inA ? g.scoreA > g.scoreB : g.scoreB > g.scoreA;
    form.push(won ? 'W' : 'L');
    if (form.length >= 5) break;
  }
  return form.reverse();
}

const recentForm = getRecentForm();

function BreakdownBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.min(value / total, 1);
  return (
    <View style={bd.row}>
      <Text style={bd.label}>{label}</Text>
      <View style={bd.track}>
        <View style={[bd.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={bd.value}>{value}</Text>
    </View>
  );
}

const bd = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSoft, width: 72 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.line },
  fill: { height: 6, borderRadius: 3 },
  value: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.text, width: 32, textAlign: 'right' },
});

export default function ProfileScreen() {
  const winRate = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header do perfil */}
        <View style={styles.profileHeader}>
          <Avatar name={player.name} color={player.color} size={80} showCrown={pos === 1} />
          <Text style={styles.name}>{player.name}</Text>
          <Text style={styles.titleText}>{player.titleEmoji} {player.title}</Text>
          <View style={styles.posRow}>
            <Badge label={`${pos}° lugar`} variant="gold" />
            <Badge label={`${GROUP.roundsDone} rodadas`} variant="neutral" />
          </View>
        </View>

        {/* Pontuação destaque */}
        <Card elevated style={styles.ptsCard}>
          <Text style={styles.ptsLabel}>PONTUAÇÃO KING BT</Text>
          <Text style={styles.ptsVal}>{stats.points.toFixed(2)}</Text>
          <Text style={styles.ptsFormula}>
            ({stats.wins}×3) + ({stats.played}×0,5) + ({stats.ga.toFixed(2)}×2)
          </Text>
        </Card>

        {/* Stats principais */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Vitórias', val: stats.wins, color: Colors.teal },
            { label: 'Derrotas', val: stats.losses, color: Colors.coral },
            { label: 'Partidas', val: stats.played, color: Colors.text },
            { label: 'Win Rate', val: `${winRate}%`, color: Colors.gold },
            { label: 'Games Pró', val: stats.gp, color: Colors.teal },
            { label: 'Games Contra', val: stats.gc, color: Colors.coral },
            { label: 'Saldo (SG)', val: stats.sg >= 0 ? `+${stats.sg}` : `${stats.sg}`, color: stats.sg >= 0 ? Colors.teal : Colors.coral },
            { label: 'Game Avg', val: stats.ga.toFixed(2), color: Colors.gold },
          ].map(item => (
            <Card key={item.label} style={styles.statCell}>
              <Text style={[styles.statCellVal, { color: item.color }]}>{item.val}</Text>
              <Text style={styles.statCellLabel}>{item.label}</Text>
            </Card>
          ))}
        </View>

        {/* Forma recente */}
        <Card>
          <Text style={styles.sectionTitle}>Forma Recente</Text>
          <View style={styles.formRow}>
            {recentForm.length === 0
              ? <Text style={styles.formEmpty}>Sem dados recentes</Text>
              : recentForm.map((r, i) => (
                <View key={i} style={[styles.formChip, { backgroundColor: r === 'W' ? Colors.teal + '33' : Colors.coral + '33' }]}>
                  <Text style={[styles.formText, { color: r === 'W' ? Colors.teal : Colors.coral }]}>{r}</Text>
                </View>
              ))
            }
          </View>
        </Card>

        {/* Quebra dos pontos */}
        <Card>
          <Text style={styles.sectionTitle}>Quebra dos Pontos</Text>
          <BreakdownBar label="Vitórias" value={stats.wins * 3} total={stats.points} color={Colors.teal} />
          <BreakdownBar label="Partidas" value={Math.round(stats.played * 0.5 * 10) / 10} total={stats.points} color={Colors.text} />
          <BreakdownBar label="Game Avg" value={Math.round(stats.ga * 2 * 100) / 100} total={stats.points} color={Colors.gold} />
        </Card>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },

  profileHeader: { alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  name: { fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.text },
  titleText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.textSoft },
  posRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },

  ptsCard: { alignItems: 'center', gap: 4 },
  ptsLabel: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.textSoft, letterSpacing: 2 },
  ptsVal: { fontFamily: FontFamily.numberBold, fontSize: 52, color: Colors.gold, lineHeight: 60 },
  ptsFormula: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.textSoft },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCell: { width: '47%', alignItems: 'center', gap: 2, padding: Spacing.md },
  statCellVal: { fontFamily: FontFamily.numberBold, fontSize: 26 },
  statCellLabel: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSoft },

  sectionTitle: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text, marginBottom: Spacing.sm },
  formRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  formChip: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  formText: { fontFamily: FontFamily.numberBold, fontSize: 14 },
  formEmpty: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.textSoft },
});
