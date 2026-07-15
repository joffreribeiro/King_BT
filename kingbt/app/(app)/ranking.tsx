import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useMemo } from 'react';
import ViewShot from 'react-native-view-shot';
import { router } from 'expo-router';
import { goToPlayer } from '@/logic/nav';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, Card } from '@/components';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { SkeletonRanking } from '@/components/SkeletonLoader';
import { TrendBadge } from '@/components/TrendBadge';
import { BottomSheet } from '@/components/BottomSheet';
import { GROUP } from '@/mocks/data';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { sgColor } from '@/components/competition/helpers';
import { computeRankingDeltas } from '@/logic/rankingDelta';
import { FadeScreen } from '@/components/FadeScreen';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { generateRankingHtml } from '@/logic/rankingHtml';
import type { PlayerInfo } from '@/store/GroupPlayersContext';
import RankingCard from '@/components/RankingCard';
import { PodiumHQ } from '@/components/PodiumHQ';


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
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const cmp = useMemo(() => makeCmpStyles(Colors), [Colors]);
  const modal = useMemo(() => makeModalStyles(Colors), [Colors]);
  const { state } = useCompetitions();
  const { myPlayerId } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  // Tela estreita (celular): esconde V/D/J/GP/GC — o subtítulo do jogador já
  // resume J e % de aproveitamento, então nada de essencial se perde.
  const { width: screenWidth } = useWindowDimensions();
  const compact = screenWidth < 480;
  const [showFormula, setShowFormula] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const MY_ID = myPlayerId;
  const [period, setPeriod] = useState<'mes' | 'ano' | 'geral'>('geral');
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharingImg, setSharingImg] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

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

  async function handleShareImage() {
    if (!viewShotRef.current) return;
    try {
      setSharingImg(true);
      const uri = await (viewShotRef.current as any).capture();
      setSharingImg(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartilhar ranking' });
      }
    } catch {
      setSharingImg(false);
      Alert.alert('Erro', 'Não foi possível gerar a imagem.');
    }
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
    groupPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, handicap: p.handicap })),
    allGames
  );

  const deltas = useMemo(
    () => computeRankingDeltas(filteredComps, groupPlayers.map(p => ({
      id: p.id, name: p.name, short: p.name.slice(0,3).toUpperCase(), color: p.color, handicap: p.handicap,
    }))),
    [filteredComps, groupPlayers]
  );

  const first  = ranking[0];
  const second = ranking[1];
  const third  = ranking[2];

  return (
    <FadeScreen>
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header com gradiente */}
        <LinearGradient
          colors={[Colors.surf2, Colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Ranking</Text>
            <Text style={styles.subtitle}>Temporada 2026</Text>
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
            <TouchableOpacity
              style={[styles.formulaBtn, { borderColor: Colors.teal + '66' }]}
              onPress={handleShareImage}
              disabled={sharingImg}
            >
              <Text style={[styles.formulaBtnText, { color: Colors.teal }]}>
                {sharingImg ? '⏳' : '📤'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        </LinearGradient>

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

        {/* Pódio HQ */}
        {ranking.length >= 3 && (() => {
          const p1 = findPlayer(first.id);
          const p2 = findPlayer(second.id);
          const p3 = findPlayer(third.id);
          if (!p1 || !p2 || !p3) return null;
          return (
            <PodiumHQ
              first={{  name: p1.name, points: first.points,  color: p1.color }}
              second={{ name: p2.name, points: second.points, color: p2.color }}
              third={{  name: p3.name, points: third.points,  color: p3.color }}
            />
          );
        })()}

        {/* Skeleton enquanto carrega */}
        {!state.synced && <SkeletonRanking />}

        {/* Tabela */}
        {state.synced && <View style={styles.table}>
          <View style={[styles.row, styles.rowHeader]}>
            <Text style={[styles.c0, styles.th]}>#</Text>
            <Text style={[styles.cName, styles.th]}>JOGADOR</Text>
            <Text style={[styles.cStat, styles.th]}>V</Text>
            <Text style={[styles.cStat, styles.th]}>D</Text>
            {!compact && <>
              <Text style={[styles.cStat, styles.th]}>J</Text>
              <Text style={[styles.cStat, styles.th]}>GP</Text>
              <Text style={[styles.cStat, styles.th]}>GC</Text>
            </>}
            <Text style={[styles.cStatWide, styles.th]}>SG</Text>
            <Text style={[styles.cStat, styles.th]}>GA</Text>
            <Text style={[styles.cPts, styles.th]}>PTS</Text>
          </View>

          {ranking.map((s, i) => {
            const pl = findPlayer(s.id);
            const isMe = s.id === MY_ID;
            const d = deltas[s.id];
            const trendDir = d?.dir ?? 'same';
            const trendDiff = d?.diff ?? 0;
            const isUp = trendDir === 'up';
            const isDown = trendDir === 'down';
            const aproveitamento = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;

            return (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.row,
                  i < ranking.length - 1 && styles.rowBorder,
                  isMe && styles.rowMe,
                  isUp && styles.rowUp,
                  isDown && styles.rowDown,
                ]}
                onPress={() => pl && goToPlayer(s.id)}
                disabled={!pl}
                activeOpacity={0.7}
              >
                {/* Trend border strip */}
                {(isUp || isDown) && (
                  <View style={[styles.trendBorder, { backgroundColor: isUp ? Colors.teal : Colors.coral }]} />
                )}

                <Text style={[styles.c0, styles.posText, isMe && { color: Colors.gold }]}>{i + 1}</Text>

                <View style={[styles.cName, styles.rowPlayer]}>
                  <Avatar name={pl?.name ?? '?'} color={pl?.color ?? '#888'} size={22} />
                  <View style={styles.nameBlock}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.playerName, isMe && { color: Colors.gold }, { flexShrink: 1 }]} numberOfLines={1}>
                        {pl?.name ?? s.id}
                      </Text>
                      {!isMe && MY_ID && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            router.push({ pathname: '/(app)/h2h', params: { playerId1: MY_ID, playerId2: s.id } });
                          }}
                          style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.gold + '18', borderRadius: Radius.full, paddingHorizontal: 5, paddingVertical: 1 }}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                          <Text style={{ fontSize: 9 }}>⚔️</Text>
                          <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.gold }}>vs</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.playerMeta}>{s.played}J · {aproveitamento}% aprov.</Text>
                  </View>
                </View>

                <Text style={[styles.cStat, styles.statText]}>{s.wins}</Text>
                <Text style={[styles.cStat, styles.statText]}>{s.losses}</Text>
                {!compact && <>
                  <Text style={[styles.cStat, styles.statText]}>{s.played}</Text>
                  <Text style={[styles.cStat, styles.statText]}>{s.gamesPro}</Text>
                  <Text style={[styles.cStat, styles.statText]}>{s.gamesCon}</Text>
                </>}
                <Text style={[styles.cStatWide, styles.statText, { color: sgColor(s.sg, Colors) }]}>
                  {s.sg > 0 ? '+' : ''}{s.sg}
                </Text>
                <Text style={[styles.cStat, styles.statText]}>{s.ga >= 10 ? s.ga.toFixed(1) : s.ga.toFixed(2)}</Text>
                <View style={[styles.cPts, { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }]}>
                  <AnimatedNumber
                    value={s.points}
                    decimals={2}
                    duration={700}
                    style={styles.ptsText}
                    color={Colors.gold}
                  />
                  {(isUp || isDown)
                    ? <TrendBadge direction={isUp ? 'up' : 'down'} diff={trendDiff} />
                    : <Text style={[styles.trendSmall, { width: 16, textAlign: 'right', color: Colors.faint }]}>—</Text>
                  }
                </View>
              </TouchableOpacity>
            );
          })}
        </View>}

        {/* Legenda */}
        {state.synced && <View style={styles.legend}>
          <Text style={styles.legendText}>
            V: Vitórias · D: Derrotas{!compact ? ' · J: Partidas · GP: Games Pró · GC: Games Contra' : ''} · SG: Saldo de Games · GA: Game Average (GP ÷ GC) · PTS: Pontuação
          </Text>
        </View>}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Card oculto para captura de imagem */}
      <View style={{ position: 'absolute', top: -9999, left: -9999 }}>
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
          <RankingCard
            ranking={ranking}
            players={groupPlayers.map(p => ({ id: p.id, name: p.name, color: p.color, short: p.name.slice(0, 3).toUpperCase(), title: '', titleEmoji: '', guest: p.guest ?? false }))}
            groupName={GROUP.name}
            season={GROUP.season}
            roundsDone={GROUP.roundsDone}
            location={GROUP.location}
            date={new Date().toLocaleDateString('pt-BR')}
          />
        </ViewShot>
      </View>

      {/* Modal comparar jogadores */}
      <BottomSheet visible={showCompare} onClose={() => setShowCompare(false)} height={520}>
          <View style={{ paddingHorizontal: Spacing.md }}>
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
                          <Avatar name={pl?.name ?? '?'} color={pl?.color ?? '#888'} size={22} />
                          <Text style={[cmp.playerOptText, selected && { color: Colors.gold }]} numberOfLines={1}>
                            {(pl?.name ?? r.id).split(' ')[0]}
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
      </BottomSheet>

      {/* PDF BottomSheet */}
      <BottomSheet visible={showExport} onClose={() => setShowExport(false)} height={220}>
        <View style={{ paddingHorizontal: Spacing.md, gap: Spacing.md }}>
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
      </BottomSheet>

      {/* Fórmula BottomSheet */}
      <BottomSheet visible={showFormula} onClose={() => setShowFormula(false)} height={400}>
        <View style={{ paddingHorizontal: Spacing.md, gap: Spacing.sm }}>
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
      </BottomSheet>
    </SafeAreaView>
    </FadeScreen>
  );
}

// Coroas SVG-like via emoji diferenciadas por posição
const CROWN: Record<number, { emoji: string; color: string; glow: string }> = {
  1: { emoji: '👑', color: '#F3C544', glow: '#F3C544' },
  2: { emoji: '👑', color: '#A8B8C8', glow: '#A8B8C8' },
  3: { emoji: '👑', color: '#CD7F32', glow: '#CD7F32' },
};

const PILLAR: Record<number, { h: number; topBorder: string; bg: string }> = {
  1: { h: 160, topBorder: '#F3C544', bg: '#1E1A10' },
  2: { h: 110, topBorder: '#A8B8C8', bg: '#161820' },
  3: { h: 80,  topBorder: '#CD7F32', bg: '#1E1208' },
};

function PodiumSlot({ player, pos, isMe, findPlayer }: {
  player: ReturnType<typeof buildRanking>[0];
  pos: number; isMe: boolean; center?: boolean;
  findPlayer: (id: string) => PlayerInfo | undefined;
}) {
  const { colors: Colors } = useTheme();
  const pod = useMemo(() => makePodStyles(Colors), [Colors]);
  const pl = findPlayer(player.id);
  const firstName = (pl?.name ?? '?').split(' ')[0].toUpperCase();
  const crown = CROWN[pos];
  const pillar = PILLAR[pos];
  const isFirst = pos === 1;

  return (
    <TouchableOpacity
      style={[pod.col, isFirst && { zIndex: 2 }]}
      onPress={() => pl && goToPlayer(player.id)}
      disabled={!pl}
      activeOpacity={0.8}
    >
      {/* Coroa */}
      <Text style={[pod.crown, {
        fontSize: isFirst ? 30 : 22,
        color: crown.color,
        textShadowColor: crown.glow,
        textShadowRadius: isFirst ? 12 : 6,
        textShadowOffset: { width: 0, height: 0 },
      }]}>{crown.emoji}</Text>

      {/* Pilar — conteúdo dentro */}
      <View style={[pod.pillar, {
        height: pillar.h,
        borderTopColor: pillar.topBorder,
        backgroundColor: pillar.bg,
        shadowColor: pillar.topBorder,
        elevation: isFirst ? 14 : 6,
      }]}>
        {/* Glow dourado no topo (brilho atrás) */}
        <View style={[pod.topGlow, { backgroundColor: pillar.topBorder + '30' }]} />

        {/* Posição */}
        <Text style={[pod.posNum, {
          color: crown.color,
          fontSize: isFirst ? 30 : 22,
          textShadowColor: crown.glow + 'AA',
          textShadowRadius: 8,
          textShadowOffset: { width: 0, height: 0 },
        }]}>{pos}º</Text>

        {/* Nome — branco */}
        <Text style={[pod.name, { fontSize: isFirst ? 14 : 11 }]} numberOfLines={1}>
          {firstName}
        </Text>

        {/* Pontuação — dourado */}
        <Text style={[pod.pts, {
          color: crown.color,
          fontSize: isFirst ? 26 : 19,
          textShadowColor: crown.glow + '88',
          textShadowRadius: 6,
          textShadowOffset: { width: 0, height: 0 },
        }]}>{player.points.toFixed(2)}</Text>

        {isMe && <View style={pod.youDot} />}
      </View>
    </TouchableOpacity>
  );
}

const makePodStyles = (Colors: ThemeColors) => StyleSheet.create({
  col: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  crown: { marginBottom: -4 },
  pillar: {
    width: '100%',
    borderTopWidth: 3,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 4,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 32,
  },
  posNum: { fontFamily: FontFamily.titleBold, letterSpacing: 0.5 },
  name: {
    fontFamily: FontFamily.titleBold,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.8,
    maxWidth: 110,
  },
  pts: { fontFamily: FontFamily.numberBold, textAlign: 'center' },
  youDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.gold, marginTop: 2 },
});

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  headerGradient: { borderRadius: 0 },
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

  podiumWrap: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#08070A',
    borderWidth: 1,
    borderColor: '#2A2010',
  },
  podiumGlow: {
    position: 'absolute',
    top: 10,
    left: '25%',
    right: '25%',
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3C54420',
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 290,
    gap: 2,
  },

  legend: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  legendText: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint, textAlign: 'center', lineHeight: 16 },

  table: { marginTop: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 7 },
  rowHeader: { paddingVertical: 5 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  rowMe: { backgroundColor: Colors.gold + '14', borderLeftWidth: 3, borderLeftColor: Colors.gold },
  rowUp: { borderColor: Colors.teal + '33' },
  rowDown: { borderColor: Colors.coral + '26' },

  trendBorder: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
  },

  c0: { width: 22 },
  cName: { flex: 1 },
  cStat: { width: 30, textAlign: 'center' },
  cStatWide: { width: 36, textAlign: 'center' },
  // width igual ao View de PTS na linha de dados (número + selo de tendência);
  // alignItems não funciona em Text, por isso o cabeçalho ficava desalinhado
  cPts: { width: 80, textAlign: 'right' },

  th: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.faint, letterSpacing: 0.3 },
  posText: { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.muted },
  rowPlayer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameBlock: { flex: 1, overflow: 'hidden' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 3, overflow: 'hidden' },
  playerName: { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.text, flexShrink: 1 },
  playerMeta: { fontSize: 9, color: Colors.faint, fontFamily: FontFamily.body, marginTop: 1 },
  youBadge: {
    backgroundColor: Colors.gold + '33', borderRadius: Radius.full,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  youText: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.gold },
  statText: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.text, textAlign: 'center' },
  ptsText: { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.gold, textAlign: 'right' },
  trendSmall: { fontFamily: FontFamily.numberBold, fontSize: 9, fontWeight: '700', textAlign: 'right' },
});

const makeCmpStyles = (Colors: ThemeColors) => StyleSheet.create({
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

const makeModalStyles = (Colors: ThemeColors) => StyleSheet.create({
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
