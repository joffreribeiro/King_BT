import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import { PLAYERS } from '@/mocks/data';
import { useCompetitions } from '@/store/CompetitionsContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';

const MY_ID = 'p1';

export default function RankingScreen() {
  const { state } = useCompetitions();
  const [showFormula, setShowFormula] = useState(false);

  const allGames = state.competitions.flatMap(extractPlayerGames);
  const ranking = buildRanking(
    PLAYERS.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color })),
    allGames
  );

  const first  = ranking[0];
  const second = ranking[1];
  const third  = ranking[2];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Ranking</Text>
            <Text style={styles.subtitle}>Temporada 2026 · BT na Quadra</Text>
          </View>
          <TouchableOpacity style={styles.formulaBtn} onPress={() => setShowFormula(true)}>
            <Text style={styles.formulaBtnText}>Como pontua?</Text>
          </TouchableOpacity>
        </View>

        {/* Pódio */}
        {ranking.length >= 3 && (
          <View style={styles.podium}>
            {/* 2° lugar — esquerda */}
            <PodiumSlot player={second} pos={2} rank={ranking.findIndex(r => r.id === second.id) + 1} isMe={second.id === MY_ID} />

            {/* 1° lugar — centro (maior) */}
            <PodiumSlot player={first} pos={1} rank={1} isMe={first.id === MY_ID} center />

            {/* 3° lugar — direita */}
            <PodiumSlot player={third} pos={3} rank={ranking.findIndex(r => r.id === third.id) + 1} isMe={third.id === MY_ID} />
          </View>
        )}

        {/* Tabela */}
        <View style={styles.table}>
          {/* Cabeçalho */}
          <View style={[styles.row, styles.rowHeader]}>
            <Text style={[styles.c0, styles.th]}>#</Text>
            <Text style={[styles.cName, styles.th]}>JOGADOR</Text>
            <Text style={[styles.cStat, styles.th]}>V</Text>
            <Text style={[styles.cStat, styles.th]}>D</Text>
            <Text style={[styles.cStat, styles.th]}>SG</Text>
            <Text style={[styles.cStat, styles.th]}>GA</Text>
            <Text style={[styles.cPts, styles.th]}>PTS</Text>
          </View>

          {ranking.map((s, i) => {
            const pl = PLAYERS.find(p => p.id === s.id)!;
            const isMe = s.id === MY_ID;
            const sgColor = s.sg > 0 ? Colors.teal : s.sg < 0 ? Colors.coral : Colors.muted;

            return (
              <View
                key={s.id}
                style={[styles.row, i < ranking.length - 1 && styles.rowBorder, isMe && styles.rowMe]}
              >
                <Text style={[styles.c0, styles.posText, isMe && { color: Colors.gold }]}>{i + 1}</Text>

                <View style={[styles.cName, styles.rowPlayer]}>
                  <Avatar name={pl.name} color={pl.color} size={30} />
                  <View style={styles.nameBlock}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.playerName, isMe && { color: Colors.gold }]} numberOfLines={1}>
                        {pl.name}
                      </Text>
                      {isMe && <View style={styles.youBadge}><Text style={styles.youText}>você</Text></View>}
                    </View>
                  </View>
                </View>

                <Text style={[styles.cStat, styles.statText]}>{s.wins}</Text>
                <Text style={[styles.cStat, styles.statText]}>{s.losses}</Text>
                <Text style={[styles.cStat, styles.statText, { color: sgColor }]}>
                  {s.sg > 0 ? '+' : ''}{s.sg}
                </Text>
                <Text style={[styles.cStat, styles.statText]}>{s.ga.toFixed(2)}</Text>
                <Text style={[styles.cPts, styles.ptsText]}>{s.points.toFixed(2)}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Modal fórmula */}
      <Modal visible={showFormula} transparent animationType="slide">
        <TouchableOpacity style={modal.overlay} onPress={() => setShowFormula(false)} activeOpacity={1}>
          <View style={modal.sheet}>
            <Text style={modal.title}>Como pontua?</Text>
            <Text style={modal.formula}>
              <Text style={{ color: Colors.gold }}>Pts</Text>
              {' = '}
              <Text style={{ color: Colors.teal }}>(V × 3)</Text>
              {' + '}
              <Text style={{ color: Colors.text }}>(J × 0,5)</Text>
              {' + '}
              <Text style={{ color: Colors.goldBright }}>(GA × 2)</Text>
            </Text>
            <Text style={modal.note}>GA = Games Pró ÷ Games Contra</Text>

            <View style={modal.divider} />

            <View style={modal.example}>
              <Text style={modal.exTitle}>Exemplo — Joffre:</Text>
              <Text style={modal.exText}>(11×3) + (15×0,5) + (1,36×2)</Text>
              <Text style={modal.exText}>= 33 + 7,5 + 2,72 = <Text style={{ color: Colors.gold }}>43,21 pts</Text></Text>
            </View>

            <View style={modal.divider} />

            <Text style={modal.desempateTitle}>Critérios de desempate</Text>
            {['1° Pontuação King BT', '2° Game Average (GA)', '3° Saldo de Games (SG)', '4° Nº de Vitórias', '5° Confronto Direto'].map(d => (
              <Text key={d} style={modal.desempateItem}>{d}</Text>
            ))}

            <TouchableOpacity style={modal.closeBtn} onPress={() => setShowFormula(false)}>
              <Text style={modal.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function PodiumSlot({ player, pos, rank, isMe, center = false }: {
  player: ReturnType<typeof buildRanking>[0];
  pos: number; rank: number; isMe: boolean; center?: boolean;
}) {
  const pl = PLAYERS.find(p => p.id === player.id)!;
  const size = center ? 64 : 50;
  const bgColor = pos === 1 ? Colors.gold + '33' : Colors.surf2;
  const borderColor = pos === 1 ? Colors.gold : Colors.surf2;

  return (
    <View style={[pod.col, center && pod.colCenter]}>
      <Avatar name={pl.name} color={pl.color} size={size} showCrown={pos === 1} />
      <Text style={[pod.name, center && pod.nameCenter, isMe && { color: Colors.gold }]} numberOfLines={1}>
        {pl.name}
      </Text>
      <Text style={[pod.pts, center && pod.ptsCenter]}>{player.points.toFixed(2)}</Text>
      <View style={[pod.block, { backgroundColor: bgColor, borderTopColor: borderColor }]}>
        <Text style={[pod.pos, pos === 1 && { color: Colors.gold }]}>{pos}</Text>
      </View>
    </View>
  );
}

const pod = StyleSheet.create({
  col: { alignItems: 'center', width: 100, gap: 4, paddingTop: Spacing.xl },
  colCenter: { paddingTop: 0 },
  name: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.text, textAlign: 'center' },
  nameCenter: { fontSize: 14 },
  pts: { fontFamily: FontFamily.numberBold, fontSize: 14, color: Colors.muted },
  ptsCenter: { fontSize: 20, color: Colors.gold },
  block: {
    width: '100%', height: 56, borderTopWidth: 2,
    borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center',
  },
  pos: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.muted },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  title: { fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: 2 },
  formulaBtn: {
    backgroundColor: Colors.surf2, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderWidth: 1, borderColor: Colors.line,
  },
  formulaBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.teal },

  podium: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    paddingHorizontal: Spacing.md, gap: 0,
  },

  table: { marginTop: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 11 },
  rowHeader: { paddingVertical: 7 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  rowMe: { backgroundColor: Colors.gold + '0A' },

  c0: { width: 26 },
  cName: { flex: 1 },
  cStat: { width: 38, textAlign: 'center' },
  cPts: { width: 50, textAlign: 'right' },

  th: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.faint, letterSpacing: 0.5 },
  posText: { fontFamily: FontFamily.numberBold, fontSize: 14, color: Colors.muted },
  rowPlayer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  nameBlock: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  playerName: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  youBadge: {
    backgroundColor: Colors.gold + '33', borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  youText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold },
  statText: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.text, textAlign: 'center' },
  ptsText: { fontFamily: FontFamily.numberBold, fontSize: 14, color: Colors.gold, textAlign: 'right' },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.xl, gap: Spacing.sm,
  },
  title: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center', marginBottom: Spacing.xs },
  formula: { fontFamily: FontFamily.numberBold, fontSize: 18, color: Colors.text, textAlign: 'center' },
  note: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, textAlign: 'center' },
  divider: { height: 1, backgroundColor: Colors.line, marginVertical: Spacing.xs },
  example: { gap: 3 },
  exTitle: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted },
  exText: { fontFamily: FontFamily.number, fontSize: 14, color: Colors.text },
  desempateTitle: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted },
  desempateItem: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.text },
  closeBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  closeBtnText: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },
});
