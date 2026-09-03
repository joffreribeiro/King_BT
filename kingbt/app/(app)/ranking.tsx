import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useMemo, useCallback } from 'react';
import ViewShot from 'react-native-view-shot';
import { router } from 'expo-router';
import { goToPlayer } from '@/logic/nav';
import { FontFamily, Spacing, Radius, Type, type ThemeColors, Colors, PODIUM_COLORS } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
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

        {/* Header — título + contexto numa linha só, sem o pódio gigante
            acima disto empurrando a tabela para fora da primeira dobra. */}
        <View style={styles.header}>
          <Text style={styles.title}>Ranking</Text>
          <Text style={styles.subtitle}>KING BT · TEMPORADA {season}</Text>
        </View>

        {/* Filtro de período — alvo de 44px */}
        <View style={{ flexDirection: 'row', backgroundColor: Colors.surf2, borderRadius: Radius.md, marginHorizontal: Spacing.md, padding: 4 }}>
          {(['mes', 'ano', 'geral'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={{ flex: 1, paddingVertical: 12, borderRadius: Radius.sm, alignItems: 'center',
                backgroundColor: period === p ? Colors.gold : 'transparent' }}
              onPress={() => setPeriod(p)}
            >
              <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13,
                color: period === p ? Colors.bg : Colors.faint }}>
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
                    {/* Distância proporcional ao líder — a pontuação sozinha
                        exigia fazer a conta de cabeça para saber quanto falta. */}
                    <View style={styles.gapTrack}>
                      <View style={[styles.gapFill, {
                        width: `${first.points > 0 ? Math.max(4, Math.round((s.points / first.points) * 100)) : 100}%`,
                        backgroundColor: isMe ? Colors.gold : Colors.goldDeep,
                      }]} />
                    </View>
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

        {/* Utilitários — exportar/explicar, não ler; ficam depois do
            conteúdo em vez de disputar a faixa que é do ranking. */}
        <View style={styles.utilRow}>
          <TouchableOpacity style={styles.utilBtn} onPress={() => setShowCompare(true)}>
            <Icon name="compare" size={15} color={Colors.muted} />
            <Text style={styles.utilBtnText}>Comparar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.utilBtn} onPress={() => setShowFormula(true)}>
            <Icon name="chart" size={15} color={Colors.muted} />
            <Text style={styles.utilBtnText}>Como pontua?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.utilBtnSquare}
            onPress={() => setShowExport(true)}
            accessibilityRole="button"
            accessibilityLabel="Exportar ranking em PDF"
          >
            <Icon name="clone" size={16} color={Colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.utilBtnSquare}
            onPress={handleShareImage}
            disabled={sharingImg}
            accessibilityRole="button"
            accessibilityLabel={sharingImg ? 'Gerando imagem do ranking' : 'Compartilhar ranking como imagem'}
          >
            <Icon name="share" size={16} color={Colors.muted} />
          </TouchableOpacity>
        </View>

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
              style={{ flex: 2, flexDirection: 'row', gap: 7, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' }}
              onPress={shareAsPDF}
              disabled={exporting}
            >
              {!exporting && <Icon name="clone" size={15} color={Colors.bg} />}
              <Text style={{ fontFamily: FontFamily.title, color: Colors.bg }}>
                {exporting ? 'Gerando...' : 'Gerar e Compartilhar'}
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

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Título em Type.h1 (era 28px, próprio desta tela) + contexto de grupo
  // numa segunda linha só — o resto do cromo saiu daqui.
  header: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { ...Type.h1, color: Colors.text },
  subtitle: { fontFamily: FontFamily.numberBold, fontSize: 10, letterSpacing: 1, color: Colors.faint, marginTop: 2 },
  utilRow: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.md, marginTop: Spacing.md },
  utilBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 44, borderRadius: Radius.full,
    backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line,
  },
  utilBtnText: { ...Type.body, color: Colors.muted },
  utilBtnSquare: {
    width: 44, height: 44, borderRadius: Radius.full,
    backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
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
  gapTrack: { height: 3, borderRadius: 2, backgroundColor: Colors.line, marginTop: 5, overflow: 'hidden' },
  gapFill: { height: '100%', borderRadius: 2 },
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
