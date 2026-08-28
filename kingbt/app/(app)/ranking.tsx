import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Platform, useWindowDimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useMemo, useCallback } from 'react';
import ViewShot from 'react-native-view-shot';
import { router } from 'expo-router';
import { goToPlayer } from '@/logic/nav';
import { FontFamily, Spacing, Radius, Type, type ThemeColors, Colors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar, Card, Icon } from '@/components';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { SkeletonRanking } from '@/components/SkeletonLoader';
import { TrendBadge } from '@/components/TrendBadge';
import { BottomSheet } from '@/components/BottomSheet';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useSettings } from '@/store/SettingsContext';
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


// Formata coeficiente/valor no padrão pt-BR (vírgula), até 2 casas, sem
// zeros à direita desnecessários — ex.: 3 -> "3", 0.5 -> "0,5", 1.362 -> "1,36".
function fmtCoef(n: number): string {
  return (Math.round(n * 100) / 100).toString().replace('.', ',');
}

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

/** Últimos 5 resultados do jogador, do mais antigo (esq.) ao mais recente (dir.). */
function FormBars({ form, Colors }: { form: boolean[]; Colors: ThemeColors }) {
  if (form.length === 0) return <View style={{ width: 77 }} />;
  return (
    <View style={{ flexDirection: 'row', gap: 3, width: 77, justifyContent: 'flex-end' }}>
      {form.map((won, i) => (
        <View
          key={i}
          style={{
            width: 13, height: 4, borderRadius: 2,
            backgroundColor: won ? Colors.teal : Colors.coral,
          }}
        />
      ))}
    </View>
  );
}

export default function RankingScreen() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const cmp = useMemo(() => makeCmpStyles(Colors), [Colors]);
  const modal = useMemo(() => makeModalStyles(Colors), [Colors]);
  const { state, refresh } = useCompetitions();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); }
    finally { setRefreshing(false); }
  }, [refresh]);
  const { myPlayerId, group } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const { scoringConfig } = useSettings();
  // Dados reais do grupo para PDF/imagem — sem equivalente de "local" no
  // schema do grupo ainda, então fica em branco em vez de mostrar um
  // endereço de outro grupo (era o mock GROUP.location fixo).
  const groupName = group?.name ?? 'King BT';
  const season = String(new Date().getFullYear());
  const roundsDone = state.competitions.filter(c => c.status === 'done').length;
  const groupLocation = '';
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
      ranking, mockPlayers, groupName, season,
      roundsDone, groupLocation,
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
    allGames,
    scoringConfig
  );

  const deltas = useMemo(
    () => computeRankingDeltas(filteredComps, groupPlayers.map(p => ({
      id: p.id, name: p.name, short: p.name.slice(0,3).toUpperCase(), color: p.color, handicap: p.handicap,
    })), scoringConfig),
    [filteredComps, groupPlayers, scoringConfig]
  );

  // Forma: últimos 5 resultados de cada jogador, em ordem cronológica.
  // Percorre as competições por data e, dentro delas, os jogos na ordem em
  // que foram registrados.
  const formByPlayer = useMemo(() => {
    const acc: Record<string, boolean[]> = {};
    [...filteredComps]
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
      .forEach(comp => {
        comp.matches.forEach(m => {
          if (m.scoreA == null || m.scoreB == null || m.scoreA === m.scoreB) return;
          const aWon = m.scoreA > m.scoreB;
          const sideA = m.teamA ?? (m.aId ? [m.aId] : []);
          const sideB = m.teamB ?? (m.bId ? [m.bId] : []);
          const push = (ids: string[], won: boolean) => ids.forEach(id => {
            (acc[id] ??= []).push(won);
          });
          push(sideA, aWon);
          push(sideB, !aWon);
        });
      });
    Object.keys(acc).forEach(id => { acc[id] = acc[id].slice(-5); });
    return acc;
  }, [filteredComps]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const first  = ranking[0];
  const second = ranking[1];
  const third  = ranking[2];

  return (
    <FadeScreen>
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >

        {/* Header com gradiente */}
        <LinearGradient
          colors={[Colors.surf2, Colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
        <View style={[styles.header, compact && styles.headerCompact]}>
          <View>
            <Text style={styles.title}>Ranking</Text>
            <Text style={styles.subtitle}>Temporada {season}</Text>
          </View>
          <View style={[{ flexDirection: 'row', gap: Spacing.xs }, compact && styles.headerActionsCompact]}>
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
              <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13,
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

        {/* Lista — linha primária com 4 elementos (posição · jogador+tendência ·
            forma · pontos). A tabela de 10 colunas a 28px e fonte 12 vive no
            RankingCard, que alimenta o export/compartilhamento, onde ela faz
            sentido; em 390px ela não era legível. */}
        {state.synced && <View style={styles.table}>
          {ranking.map((s, i) => {
            const pl = findPlayer(s.id);
            const isMe = s.id === MY_ID;
            const d = deltas[s.id];
            const trendDir = d?.dir ?? 'same';
            const trendDiff = d?.diff ?? 0;
            const isUp = trendDir === 'up';
            const isDown = trendDir === 'down';
            const aproveitamento = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
            const expanded = expandedId === s.id;

            return (
              <View key={s.id} style={[styles.rowWrap, isMe && styles.rowMe, expanded && styles.rowWrapExpanded]}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => setExpandedId(expanded ? null : s.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.posText, isMe && { color: Colors.gold }]}>{i + 1}</Text>

                  <Avatar name={pl?.name ?? '?'} color={pl?.color ?? '#888'} size={30} />

                  <View style={styles.nameBlock}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.playerName, isMe && { color: Colors.gold }]} numberOfLines={1}>
                        {pl?.name ?? s.id}
                      </Text>
                      {(isUp || isDown)
                        ? <TrendBadge direction={isUp ? 'up' : 'down'} diff={trendDiff} />
                        : <Text style={styles.trendSmall}>—</Text>
                      }
                    </View>
                    <Text style={styles.playerMeta}>{s.played}J · {aproveitamento}% aprov.</Text>
                  </View>

                  <FormBars form={formByPlayer[s.id] ?? []} Colors={Colors} />

                  <AnimatedNumber
                    value={s.points}
                    decimals={2}
                    duration={700}
                    style={styles.ptsText}
                    color={Colors.gold}
                  />
                </TouchableOpacity>

                {expanded && (
                  <View style={styles.expandPanel}>
                    <View style={styles.statGrid}>
                      {([
                        { label: 'VITÓRIAS', value: String(s.wins) },
                        { label: 'DERROTAS', value: String(s.losses) },
                        { label: 'SALDO',    value: `${s.sg > 0 ? '+' : ''}${s.sg}`, color: sgColor(s.sg, Colors) },
                        { label: 'GA',       value: s.ga >= 10 ? s.ga.toFixed(1) : s.ga.toFixed(2) },
                      ] as const).map(st => (
                        <View key={st.label} style={styles.statCell}>
                          <Text style={styles.statCellLabel}>{st.label}</Text>
                          <Text style={[styles.statCellValue, (st as any).color ? { color: (st as any).color } : null]}>
                            {st.value}
                          </Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.expandActions}>
                      {!isMe && MY_ID && (
                        <TouchableOpacity
                          style={styles.expandBtn}
                          onPress={() => router.push({ pathname: '/(app)/h2h', params: { playerId1: MY_ID, playerId2: s.id } })}
                        >
                          <Icon name="compare" size={15} color={Colors.gold} />
                          <Text style={styles.expandBtnText}>Comparar (H2H)</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.expandBtn}
                        onPress={() => pl && goToPlayer(s.id)}
                        disabled={!pl}
                      >
                        <Icon name="profile" size={15} color={Colors.gold} />
                        <Text style={styles.expandBtnText}>Ver perfil</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>}

        {/* Legenda */}
        {state.synced && <View style={styles.legend}>
          <Text style={styles.legendText}>
            Toque num jogador para ver V/D/Saldo/GA e comparar. As barrinhas são os últimos 5 jogos — verde é vitória.
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
            groupName={groupName}
            season={season}
            roundsDone={roundsDone}
            location={groupLocation}
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
            <Text style={{ color: Colors.teal }}>(V × {fmtCoef(scoringConfig.winCoef)})</Text>
            {' + '}
            <Text style={{ color: Colors.text }}>(J × {fmtCoef(scoringConfig.playedCoef)})</Text>
            {' + '}
            <Text style={{ color: Colors.goldBright }}>(GA × {fmtCoef(scoringConfig.gaCoef)})</Text>
          </Text>
          <Text style={modal.note}>GA = Games Pró ÷ Games Contra</Text>
          <View style={modal.divider} />
          {(() => {
            const me = ranking.find(r => r.id === MY_ID);
            if (!me) return null;
            const winPts = me.wins * scoringConfig.winCoef;
            const playedPts = me.played * scoringConfig.playedCoef;
            const gaPts = me.ga * scoringConfig.gaCoef;
            return (
              <View style={modal.example}>
                <Text style={modal.exTitle}>Seu exemplo:</Text>
                <Text style={modal.exText}>
                  ({me.wins}×{fmtCoef(scoringConfig.winCoef)}) + ({me.played}×{fmtCoef(scoringConfig.playedCoef)}) + ({fmtCoef(me.ga)}×{fmtCoef(scoringConfig.gaCoef)})
                </Text>
                <Text style={modal.exText}>
                  = {fmtCoef(winPts)} + {fmtCoef(playedPts)} + {fmtCoef(gaPts)} = <Text style={{ color: Colors.gold }}>{me.points.toFixed(2).replace('.', ',')} pts</Text>
                </Text>
              </View>
            );
          })()}
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
  1: { emoji: '👑', color: Colors.gold, glow: Colors.gold },
  2: { emoji: '👑', color: '#A8B8C8', glow: '#A8B8C8' },
  3: { emoji: '👑', color: '#CD7F32', glow: '#CD7F32' },
};

const PILLAR: Record<number, { h: number; topBorder: string; bg: string }> = {
  1: { h: 160, topBorder: Colors.gold, bg: '#1E1A10' },
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
  // Tela estreita: título e botões não cabem numa linha só — empilha o
  // título em cima e deixa a linha de ações quebrar em duas linhas.
  headerCompact: { flexDirection: 'column', alignItems: 'stretch', gap: Spacing.sm },
  headerActionsCompact: { flexWrap: 'wrap' },
  title: { fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.text },
  subtitle: { ...Type.body, color: Colors.muted, marginTop: 2 },
  formulaBtn: {
    backgroundColor: Colors.surf2, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderWidth: 1, borderColor: Colors.line,
  },
  formulaBtnText: { ...Type.bodyMed, color: Colors.teal },

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
    backgroundColor: Colors.gold + '20',
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 290,
    gap: 2,
  },

  legend: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  legendText: { ...Type.caption, color: Colors.faint, textAlign: 'center', lineHeight: 16 },

  table: { marginTop: Spacing.md, paddingHorizontal: Spacing.md, gap: Spacing.xs },
  rowWrap: {
    backgroundColor: Colors.surf, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line, overflow: 'hidden',
  },
  rowWrapExpanded: { borderColor: Colors.gold + '55' },
  rowMe: { borderColor: Colors.gold, borderWidth: 1.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.sm,
  },

  posText: { ...Type.bodyMed, fontFamily: FontFamily.numberBold, color: Colors.muted, width: 18, textAlign: 'center' },
  nameBlock: { flex: 1, overflow: 'hidden' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden' },
  playerName: { ...Type.bodyMed, color: Colors.text, flexShrink: 1 },
  playerMeta: { ...Type.caption, fontSize: 11, color: Colors.faint, marginTop: 1 },
  ptsText: { ...Type.title, fontFamily: FontFamily.numberBold, color: Colors.gold, textAlign: 'right', minWidth: 52 },
  trendSmall: { ...Type.caption, fontSize: 9, fontFamily: FontFamily.numberBold, color: Colors.faint },

  expandPanel: {
    borderTopWidth: 1, borderTopColor: Colors.line,
    padding: Spacing.sm + 2, gap: Spacing.sm,
    backgroundColor: Colors.surf2,
  },
  statGrid: { flexDirection: 'row' },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statCellLabel: { ...Type.label, color: Colors.faint },
  statCellValue: { ...Type.title, fontFamily: FontFamily.numberBold, color: Colors.text },
  expandActions: { flexDirection: 'row', gap: Spacing.sm },
  expandBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.gold + '55', borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
  },
  expandBtnText: { ...Type.bodyMed, color: Colors.gold },
});

const makeCmpStyles = (Colors: ThemeColors) => StyleSheet.create({
  playerOpt: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: Spacing.xs, borderRadius: Radius.sm },
  playerOptActive: { backgroundColor: Colors.gold + '22' },
  playerOptText: { ...Type.bodyMed, color: Colors.text, flex: 1 },
  compareCard: { backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm, marginTop: Spacing.sm },
  compareHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  compareName: { ...Type.bodyMed, color: Colors.text, marginTop: 4 },
  compareVs: { fontFamily: FontFamily.numberBold, fontSize: 17, color: Colors.faint },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  statVal: { flex: 1, fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.text },
  statLabel: { width: 64, textAlign: 'center', ...Type.caption, color: Colors.faint },
});

const makeModalStyles = (Colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    padding: Spacing.xl, gap: Spacing.sm,
  },
  title: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center', marginBottom: Spacing.xs },
  formula: { fontFamily: FontFamily.numberBold, fontSize: 18, color: Colors.text, textAlign: 'center' },
  note: { ...Type.body, color: Colors.muted, textAlign: 'center' },
  divider: { height: 1, backgroundColor: Colors.line, marginVertical: Spacing.xs },
  example: { gap: 3 },
  exTitle: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted },
  exText: { fontFamily: FontFamily.number, fontSize: 15, color: Colors.text },
  desempateTitle: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted },
  desempateItem: { ...Type.body, color: Colors.text },
  closeBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  closeBtnText: { ...Type.title, color: Colors.bg },
});
