import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import { GROUP } from '@/mocks/data';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { generateRankingHtml } from '@/logic/rankingHtml';
import type { PlayerInfo } from '@/store/GroupPlayersContext';


function h2hBetween(
  state: ReturnType<typeof import('@/store/CompetitionsContext').useCompetitions>['state'],
  idA: string,
  idB: string
) {
  let wA = 0, wB = 0;
  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreB == null) return;
      const aInA = m.aId === idA || m.teamA?.includes(idA);
      const bInA = m.aId === idB || m.teamA?.includes(idB);
      const aInB = m.bId === idA || m.teamB?.includes(idA);
      const bInB = m.bId === idB || m.teamB?.includes(idB);
      const together = (aInA && bInA) || (aInB && bInB);
      if (together) return;
      const aWonGame = m.scoreA > m.scoreB;
      if ((aInA && !aInB) && (bInB && !bInA)) {
        if (aWonGame) wA++; else wB++;
      } else if ((aInB && !aInA) && (bInA && !bInB)) {
        if (!aWonGame) wA++; else wB++;
      }
    });
  });
  return { wA, wB };
}

export default function RankingScreen() {
  const { state } = useCompetitions();
  const { myPlayerId } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const [showFormula, setShowFormula] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const MY_ID = myPlayerId;
  const [period, setPeriod] = useState<'mes' | 'ano' | 'geral'>('geral');
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);

  function getHtml() {
    const mockPlayers = groupPlayers.map(p => ({
      id: p.id, name: p.name, color: p.color,
      title: '', titleEmoji: '', guest: p.guest ?? false,
    }));
    return generateRankingHtml(
      ranking, mockPlayers, GROUP.name, GROUP.season,
      GROUP.roundsDone, GROUP.location,
      new Date().toLocaleDateString('pt-BR'),
    );
  }

  async function shareAsPDF() {
    try {
      setExporting(true);
      const { uri } = await Print.printToFileAsync({ html: getHtml(), base64: false, width: 800, height: 1200 });
      setExporting(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Ranking King BT' });
      }
    } catch {
      setExporting(false);
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    }
  }

  const filteredComps = state.competitions.filter(c => {
    if (period === 'geral') return true;
    const d = new Date(c.date + 'T12:00:00');
    const now = new Date();
    if (period === 'mes') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return d.getFullYear() === now.getFullYear();
  });
  const allGames = filteredComps.flatMap(extractPlayerGames);
  const ranking = buildRanking(
    groupPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color })),
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
          <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
            <TouchableOpacity style={styles.formulaBtn} onPress={() => setShowCompare(true)}>
              <Text style={styles.formulaBtnText}>Comparar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.formulaBtn} onPress={() => setShowFormula(true)}>
              <Text style={styles.formulaBtnText}>Como pontua?</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.formulaBtn, { borderColor: Colors.gold + '66' }]} onPress={() => setShowExport(true)}>
              <Text style={[styles.formulaBtnText, { color: Colors.gold }]}>PDF</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filtro de período */}
        <View style={{ flexDirection: 'row', backgroundColor: Colors.surf2, borderRadius: Radius.md, margin: Spacing.md, marginTop: 0, padding: 3 }}>
          {(['mes', 'ano', 'geral'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={{ flex: 1, paddingVertical: 7, borderRadius: Radius.sm, alignItems: 'center',
                backgroundColor: period === p ? Colors.surf : 'transparent' }}
              onPress={() => setPeriod(p)}
            >
              <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 12,
                color: period === p ? Colors.gold : Colors.faint }}>
                {{ mes: 'Este mês', ano: 'Este ano', geral: 'Geral' }[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pódio */}
        {ranking.length >= 3 && (
          <View style={styles.podium}>
            <PodiumSlot player={second} pos={2} isMe={second.id === MY_ID} findPlayer={findPlayer} />
            <PodiumSlot player={first}  pos={1} isMe={first.id  === MY_ID} center findPlayer={findPlayer} />
            <PodiumSlot player={third}  pos={3} isMe={third.id  === MY_ID} findPlayer={findPlayer} />
          </View>
        )}

        {/* Tabela */}
        <View style={styles.table}>
          <View style={[styles.row, styles.rowHeader]}>
            <Text style={[styles.c0, styles.th]}>#</Text>
            <Text style={[styles.cName, styles.th]}>JOGADOR</Text>
            <Text style={[styles.cStat, styles.th]}>V</Text>
            <Text style={[styles.cStat, styles.th]}>D</Text>
            <Text style={[styles.cStat, styles.th]}>J</Text>
            <Text style={[styles.cStat, styles.th]}>GP</Text>
            <Text style={[styles.cStat, styles.th]}>GC</Text>
            <Text style={[styles.cStatWide, styles.th]}>SG</Text>
            <Text style={[styles.cStat, styles.th]}>GA</Text>
            <Text style={[styles.cPts, styles.th]}>PTS</Text>
          </View>

          {ranking.map((s, i) => {
            const pl = findPlayer(s.id);
            const isMe = s.id === MY_ID;
            const sgColor = s.sg > 0 ? Colors.teal : s.sg < 0 ? Colors.coral : Colors.muted;

            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.row, i < ranking.length - 1 && styles.rowBorder, isMe && styles.rowMe]}
                onPress={() => router.push({ pathname: '/player/[id]', params: { id: s.id } })}
                activeOpacity={0.7}
              >
                <Text style={[styles.c0, styles.posText, isMe && { color: Colors.gold }]}>{i + 1}</Text>

                <View style={[styles.cName, styles.rowPlayer]}>
                  <Avatar name={pl?.name ?? '?'} color={pl?.color ?? '#888'} size={28} />
                  <View style={styles.nameBlock}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.playerName, isMe && { color: Colors.gold }]} numberOfLines={1}>
                        {pl?.name ?? s.id}
                      </Text>
                      {isMe && <View style={styles.youBadge}><Text style={styles.youText}>você</Text></View>}
                    </View>
                  </View>
                </View>

                <Text style={[styles.cStat, styles.statText]}>{s.wins}</Text>
                <Text style={[styles.cStat, styles.statText]}>{s.losses}</Text>
                <Text style={[styles.cStat, styles.statText]}>{s.played}</Text>
                <Text style={[styles.cStat, styles.statText]}>{s.gamesPro}</Text>
                <Text style={[styles.cStat, styles.statText]}>{s.gamesCon}</Text>
                <Text style={[styles.cStatWide, styles.statText, { color: sgColor }]}>
                  {s.sg > 0 ? '+' : ''}{s.sg}
                </Text>
                <Text style={[styles.cStat, styles.statText]}>{s.ga.toFixed(2)}</Text>
                <Text style={[styles.cPts, styles.ptsText]}>{s.points.toFixed(2)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legenda */}
        <View style={styles.legend}>
          <Text style={styles.legendText}>V: Vitórias · D: Derrotas · J: Partidas · GP: Games Pró · GC: Games Contra · SG: Saldo de Games · GA: Game Average (GP ÷ GC)</Text>
        </View>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Modal comparar jogadores */}
      <Modal visible={showCompare} transparent animationType="slide">
        <TouchableOpacity style={modal.overlay} onPress={() => setShowCompare(false)} activeOpacity={1}>
          <View style={modal.sheet}>
            <Text style={modal.title}>Comparar jogadores</Text>
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              {([compareA, compareB] as const).map((sel, side) => (
                <View key={side} style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted, marginBottom: 4, textAlign: 'center' }}>
                    Jogador {side + 1}
                  </Text>
                  <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                    {ranking.map(r => {
                      const pl = findPlayer(r.id);
                      const selected = sel === r.id;
                      return (
                        <TouchableOpacity
                          key={r.id}
                          style={[cmp.playerOpt, selected && cmp.playerOptActive]}
                          onPress={() => side === 0 ? setCompareA(r.id) : setCompareB(r.id)}
                        >
                          <Avatar name={pl.name} color={pl.color} size={22} />
                          <Text style={[cmp.playerOptText, selected && { color: Colors.gold }]} numberOfLines={1}>
                            {pl.name.split(' ')[0]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ))}
            </View>

            {compareA && compareB && compareA !== compareB && (() => {
              const pA = ranking.find(r => r.id === compareA)!;
              const pB = ranking.find(r => r.id === compareB)!;
              const plA = findPlayer(compareA);
              const plB = findPlayer(compareB);
              const { wA, wB } = h2hBetween(state, compareA, compareB);
              const stats: { label: string; a: string | number; b: string | number }[] = [
                { label: 'Pontos', a: pA.points.toFixed(2), b: pB.points.toFixed(2) },
                { label: 'Vitórias', a: pA.wins, b: pB.wins },
                { label: 'Derrotas', a: pA.losses, b: pB.losses },
                { label: 'GA', a: pA.ga.toFixed(2), b: pB.ga.toFixed(2) },
                { label: 'H2H', a: `${wA}V`, b: `${wB}V` },
              ];
              return (
                <View style={cmp.compareCard}>
                  <View style={cmp.compareHeader}>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                      <Avatar name={plA?.name ?? '?'} color={plA?.color ?? '#888'} size={36} />
                      <Text style={cmp.compareName} numberOfLines={1}>{(plA?.name ?? '?').split(' ')[0]}</Text>
                    </View>
                    <Text style={cmp.compareVs}>vs</Text>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                      <Avatar name={plB?.name ?? '?'} color={plB?.color ?? '#888'} size={36} />
                      <Text style={cmp.compareName} numberOfLines={1}>{(plB?.name ?? '?').split(' ')[0]}</Text>
                    </View>
                  </View>
                  {stats.map(st => (
                    <View key={st.label} style={cmp.statRow}>
                      <Text style={[cmp.statVal, { textAlign: 'right' }]}>{st.a}</Text>
                      <Text style={cmp.statLabel}>{st.label}</Text>
                      <Text style={[cmp.statVal, { textAlign: 'left' }]}>{st.b}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            <TouchableOpacity style={modal.closeBtn} onPress={() => setShowCompare(false)}>
              <Text style={modal.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal fórmula */}
      {/* Modal exportar PDF */}
      <Modal visible={showExport} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md }}>
            <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text, textAlign: 'center' }}>Exportar Ranking</Text>
            <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' }}>
              Gera PDF com o layout oficial do Ranking Geral King BT.
            </Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' }}
                onPress={() => setShowExport(false)}
              >
                <Text style={{ fontFamily: FontFamily.body, color: Colors.muted }}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' }}
                onPress={shareAsPDF}
                disabled={exporting}
              >
                <Text style={{ fontFamily: FontFamily.title, color: Colors.bg }}>
                  {exporting ? '⏳ Gerando...' : '📄 Gerar e Compartilhar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

const MEDAL = {
  1: { color: '#F3C544', bg: '#F3C54422', blockH: 130, avatarSize: 72 },
  2: { color: '#C7D4E0', bg: '#C7D4E018', blockH: 92,  avatarSize: 54 },
  3: { color: '#D89A6A', bg: '#D89A6A18', blockH: 64,  avatarSize: 46 },
} as Record<number, { color: string; bg: string; blockH: number; avatarSize: number }>;

function PodiumSlot({ player, pos, isMe, center = false, findPlayer }: {
  player: ReturnType<typeof buildRanking>[0];
  pos: number; isMe: boolean; center?: boolean;
  findPlayer: (id: string) => PlayerInfo | undefined;
}) {
  const pl = findPlayer(player.id);
  const medal = MEDAL[pos];

  return (
    <TouchableOpacity
      style={pod.col}
      onPress={() => router.push({ pathname: '/player/[id]', params: { id: player.id } })}
      activeOpacity={0.8}
    >
      <Avatar name={pl?.name ?? '?'} color={pl?.color ?? '#888'} size={medal.avatarSize} showCrown={pos === 1} />
      <Text style={[pod.name, pos === 1 && pod.nameCenter, isMe && { color: Colors.gold }]} numberOfLines={1}>
        {(pl?.name ?? '?').split(' ')[0]}
      </Text>
      <Text style={[pod.pts, { color: medal.color, fontSize: pos === 1 ? 20 : 14 }]}>
        {player.points.toFixed(2)}
      </Text>
      <View style={[pod.block, {
        height: medal.blockH,
        backgroundColor: medal.bg,
        borderTopColor: medal.color,
        shadowColor: medal.color,
        shadowOffset: { width: 0, height: pos === 1 ? 8 : 0 },
        shadowOpacity: pos === 1 ? 0.4 : 0,
        shadowRadius: 16,
        elevation: pos === 1 ? 10 : 0,
      }]}>
        <Text style={[pod.pos, { color: medal.color, fontSize: pos === 1 ? 32 : 24 }]}>{pos}</Text>
      </View>
    </TouchableOpacity>
  );
}

const pod = StyleSheet.create({
  col: { alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  name: {
    fontFamily: FontFamily.bodyMed, fontSize: 12,
    color: Colors.text, textAlign: 'center', maxWidth: 90,
    marginTop: 4,
  },
  nameCenter: { fontSize: 15, fontFamily: FontFamily.title },
  pts: { fontFamily: FontFamily.numberBold, textAlign: 'center', marginBottom: 4 },
  block: {
    width: '100%', borderTopWidth: 3,
    borderTopLeftRadius: 6, borderTopRightRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  pos: { fontFamily: FontFamily.titleBold },
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    height: 280,
    gap: 0,
  },

  legend: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  legendText: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint, textAlign: 'center', lineHeight: 16 },

  table: { marginTop: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 11 },
  rowHeader: { paddingVertical: 7 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  rowMe: { backgroundColor: Colors.gold + '14', borderLeftWidth: 3, borderLeftColor: Colors.gold },

  c0: { width: 22 },
  cName: { flex: 1 },
  cStat: { width: 30, textAlign: 'center' },
  cStatWide: { width: 36, textAlign: 'center' },
  cPts: { width: 44, textAlign: 'right' },

  th: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.faint, letterSpacing: 0.5 },
  posText: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.muted },
  rowPlayer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameBlock: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  playerName: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.text },
  youBadge: {
    backgroundColor: Colors.gold + '33', borderRadius: Radius.full,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  youText: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.gold },
  statText: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.text, textAlign: 'center' },
  ptsText: { fontFamily: FontFamily.numberBold, fontSize: 12, color: Colors.gold, textAlign: 'right' },
});

const cmp = StyleSheet.create({
  playerOpt: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: Spacing.xs, borderRadius: Radius.sm },
  playerOptActive: { backgroundColor: Colors.gold + '22' },
  playerOptText: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.text, flex: 1 },
  compareCard: { backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm, marginTop: Spacing.sm },
  compareHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  compareName: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.text, marginTop: 4 },
  compareVs: { fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.faint },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statVal: { flex: 1, fontFamily: FontFamily.numberBold, fontSize: 14, color: Colors.text },
  statLabel: { width: 64, textAlign: 'center', fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
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
