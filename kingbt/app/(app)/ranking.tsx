import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { CATEGORIES, type Category } from '@/logic/playerAbout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useMemo, useCallback } from 'react';
import ViewShot from 'react-native-view-shot';
import { router } from 'expo-router';
import { goToPlayer } from '@/logic/nav';
import { notify } from '@/services/notify';
import { FontFamily, Spacing, Radius, Type, wideContent, type ThemeColors } from '@/theme';
import { useIsWide } from '@/hooks/useIsWide';
import { useTheme } from '@/store/ThemeContext';
import { Avatar, Icon } from '@/components';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { SkeletonRanking } from '@/components/SkeletonLoader';
import { TrendBadge } from '@/components/TrendBadge';
import { BottomSheet } from '@/components/BottomSheet';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useSettings } from '@/store/SettingsContext';
import { buildRanking } from '@/logic/scoring';
import { minGamesOf } from '@/logic/scoringConfig';
import { formatRating, formatGA } from '@/logic/format';
import { extractPlayerGames } from '@/logic/formats';
import { sgColor } from '@/components/competition/helpers';
import { computeRankingDeltas } from '@/logic/rankingDelta';
import { FadeScreen } from '@/components/FadeScreen';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { generateRankingHtml } from '@/logic/rankingHtml';
import RankingCard from '@/components/RankingCard';
import { PodiumHQ } from '@/components/PodiumHQ';
import { SeasonsSheet } from '@/components/SeasonsSheet';
import { endSeason, undoLastSeason } from '@/firebase/seasons';
import {
  competitionsForPeriod, currentSeasonComps, currentSeasonNumber, unfinishedInSeason,
  type RankingPeriod, type SeasonRow,
} from '@/logic/seasons';


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

/** `embedded`: dentro da aba Arena — sem o título "Ranking" (a Arena já mostra a seção) e sem o recuo do topo. */
export default function RankingScreen({ embedded = false }: { embedded?: boolean } = {}) {
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
  const { myPlayerId, group, isAdmin } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const { scoringConfig, seasons } = useSettings();
  // Dados reais do grupo para PDF/imagem — sem equivalente de "local" no
  // schema do grupo ainda, então fica em branco em vez de mostrar um
  // endereço de outro grupo (era o mock GROUP.location fixo).
  const groupName = group?.name ?? 'King BT';
  const seasonNo = currentSeasonNumber(seasons);
  const season = String(seasonNo);
  const roundsDone = state.competitions.filter(c => c.status === 'done').length;
  const groupLocation = '';
  const [showFormula, setShowFormula] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const MY_ID = myPlayerId;
  const [period, setPeriod] = useState<RankingPeriod>('temporada');
  const [category, setCategory] = useState<Category | 'todas'>('todas');
  const [showSeasons, setShowSeasons] = useState(false);
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
      classified, mockPlayers, groupName, season,
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
      notify('Erro', 'Não foi possível gerar a imagem.');
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
      notify('Erro', 'Não foi possível gerar o PDF.');
    }
  }

  const filteredComps = competitionsForPeriod(state.competitions, period, seasons);
  const allGames = filteredComps.flatMap(extractPlayerGames);
  const fullRanking = buildRanking(
    groupPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, handicap: p.handicap })),
    allGames,
    scoringConfig,
    // Mínimo de jogos do grupo: no mês todo mundo joga pouco, então só vale na temporada e no acumulado.
    { groupMinimum: period !== 'mes' },
  );
  // Ranking por categoria: só quem declarou aquela categoria (o jogador escolhe no perfil);
  // a posição passa a contar dentro da categoria.
  const categoryOf = new Map(groupPlayers.map(p => [p.id, p.about?.category]));
  const categoryCount = (c: Category) => fullRanking.filter(r => categoryOf.get(r.id) === c).length;
  const shownCategories = CATEGORIES.filter(c => categoryCount(c) > 0 || c === category);
  const ranking = category === 'todas' ? fullRanking : fullRanking.filter(r => categoryOf.get(r.id) === category);

  const seasonComps = useMemo(() => currentSeasonComps(state.competitions, seasons), [state.competitions, seasons]);
  const seasonRanking = useMemo(() => buildRanking(
    groupPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, handicap: p.handicap })),
    seasonComps.flatMap(extractPlayerGames),
    scoringConfig,
    { groupMinimum: true },
  ).filter(r => r.played > 0), [groupPlayers, seasonComps, scoringConfig]);
  const unfinishedCount = useMemo(() => unfinishedInSeason(state.competitions, seasons).length, [state.competitions, seasons]);

  async function handleEndSeason() {
    if (!group) throw new Error('sem grupo');
    const rows: SeasonRow[] = seasonRanking.map(r => ({
      id: r.id, name: findPlayer(r.id)?.name ?? r.id,
      points: Math.round(r.points * 100) / 100, played: r.played, wins: r.wins, losses: r.losses,
      gamesPro: r.gamesPro, gamesCon: r.gamesCon,
    }));
    await endSeason(group.id, rows, seasonNo);
    setPeriod('temporada');
  }

  async function handleUndoSeason() {
    if (!group || seasons.length === 0) throw new Error('nada a desfazer');
    const ok = await undoLastSeason(group.id, seasons[seasons.length - 1].number);
    if (!ok) throw new Error('mudou');
  }

  const deltas = useMemo(
    () => computeRankingDeltas(filteredComps, groupPlayers.map(p => ({
      id: p.id, name: p.name, short: p.name.slice(0,3).toUpperCase(), color: p.color, handicap: p.handicap,
    })), scoringConfig, period !== 'mes'),
    [filteredComps, groupPlayers, scoringConfig, period]
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

  // Pódio e posições só contam quem atingiu o mínimo de jogos; os demais ficam "em classificação", abaixo.
  const classified = ranking.filter(r => !r.provisional);
  const minGames = minGamesOf(scoringConfig);
  const first  = classified[0];
  const second = classified[1];
  const third  = classified[2];
  const wide = useIsWide();

  return (
    <FadeScreen>
    <SafeAreaView style={styles.container} edges={embedded ? [] : ['top']}>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={wide ? styles.wideContent : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        {/* Computador: filtros e pódio à esquerda, tabela à direita. */}
        <View style={wide ? styles.cols : undefined}>
        <View style={wide ? styles.colLeft : undefined}>

        {/* Header — título + contexto numa linha só, sem o pódio gigante
            acima disto empurrando a tabela para fora da primeira dobra. */}
        <View style={styles.header}>
          {!embedded && <Text style={styles.title}>Ranking</Text>}
          <Text style={styles.subtitle}>
            {period === 'acumulado' ? `KING BT · ACUMULADO · ${seasons.length + 1} ${seasons.length === 0 ? 'TEMPORADA' : 'TEMPORADAS'}` : `KING BT · TEMPORADA ${seasonNo}${period === 'mes' ? ' · ESTE MÊS' : ''}`}
          </Text>
        </View>

        {/* Filtro de período — mesmos botões dos outros filtros do app (Atletas, Conquistas) */}
        <View style={styles.periodRow}>
          {(['mes', 'temporada', 'acumulado'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.periodChip, period === p && styles.periodChipOn]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: period === p }}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextOn]}>
                {{ mes: 'Este mês', temporada: 'Temporada', acumulado: 'Acumulado' }[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filtro de categoria (A, B, C, D...) — só aparece quando alguém já declarou a categoria no perfil */}
        {shownCategories.length > 0 && (
          <View style={styles.catRow}>
            {(['todas', ...shownCategories] as const).map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.catChip, category === c && styles.periodChipOn]}
                onPress={() => setCategory(c)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: category === c }}
              >
                <Text style={[styles.periodText, category === c && styles.periodTextOn]}>{c === 'todas' ? 'Todas' : c}</Text>
                {c !== 'todas' && <Text style={styles.catCount}>{categoryCount(c)}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {category !== 'todas' && ranking.length === 0 && (
          <Text style={styles.catEmpty}>Ninguém na categoria {category} ainda.</Text>
        )}

        {/* Pódio HQ */}
        {classified.length >= 3 && (() => {
          const p1 = findPlayer(first.id);
          const p2 = findPlayer(second.id);
          const p3 = findPlayer(third.id);
          if (!p1 || !p2 || !p3) return null;
          const trendOf = (id: string) => {
            const d = deltas[id];
            return d && d.dir !== 'same' ? { dir: d.dir as 'up' | 'down', diff: d.diff } : undefined;
          };
          return (
            <PodiumHQ
              first={{  name: p1.name, points: first.points,  color: p1.color, trend: trendOf(first.id) }}
              second={{ name: p2.name, points: second.points, color: p2.color, trend: trendOf(second.id) }}
              third={{  name: p3.name, points: third.points,  color: p3.color, trend: trendOf(third.id) }}
            />
          );
        })()}

        </View>
        <View style={wide ? styles.colRight : undefined}>
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
            const firstProvisional = !!s.provisional && (i === 0 || !ranking[i - 1].provisional);

            return (
              <View key={s.id}>
              {firstProvisional && (
                <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 4 }}>
                  <Text style={styles.subtitle}>EM CLASSIFICAÇÃO</Text>
                  <Text style={[styles.playerMeta, { marginTop: 2 }]}>Jogaram menos de {minGames} jogos. Entram na posição ao completar.</Text>
                </View>
              )}
              <View style={[styles.rowWrap, isMe && styles.rowMe, expanded && styles.rowWrapExpanded]}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => setExpandedId(expanded ? null : s.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.posText, isMe && { color: Colors.gold }]}>{s.provisional ? '–' : i + 1}</Text>

                  <Avatar name={pl?.name ?? '?'} color={pl?.color ?? '#888'} size={40} />

                  <View style={styles.nameBlock}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.playerName, isMe && { color: Colors.gold }]} numberOfLines={1}>
                        {pl?.name ?? s.id}
                      </Text>
                    </View>
                    <Text style={styles.playerMeta}>{s.played} {s.played === 1 ? 'jogo' : 'jogos'} · {aproveitamento}% aprov.{s.provisional ? ` · faltam ${minGames - s.played}` : ''}</Text>
                  </View>

                  <FormBars form={formByPlayer[s.id] ?? []} Colors={Colors} />

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <AnimatedNumber
                      value={s.points}
                      decimals={2}
                      duration={700}
                      style={styles.ptsText}
                      color={Colors.gold}
                    />
                    {(isUp || isDown)
                      ? <TrendBadge direction={isUp ? 'up' : 'down'} diff={trendDiff} />
                      : <Text style={styles.trendSmall}>—</Text>
                    }
                  </View>
                </TouchableOpacity>

                {expanded && (
                  <View style={styles.expandPanel}>
                    <View style={styles.statGrid}>
                      {([
                        { label: 'VITÓRIAS', value: String(s.wins) },
                        { label: 'DERROTAS', value: String(s.losses) },
                        { label: 'GP',       value: String(s.gamesPro) },
                        { label: 'SALDO',    value: `${s.sg > 0 ? '+' : ''}${s.sg}`, color: sgColor(s.sg, Colors) },
                        { label: 'GA',       value: formatGA(s.ga) },
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
          <TouchableOpacity style={styles.utilBtn} onPress={() => setShowSeasons(true)}>
            <Icon name="calendar" size={15} color={Colors.muted} />
            <Text style={styles.utilBtnText}>Temporadas</Text>
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
        </View>
        </View>
      </ScrollView>

      {/* Card oculto para captura de imagem */}
      <View style={{ position: 'absolute', top: -9999, left: -9999 }}>
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
          <RankingCard
            ranking={classified}
            players={groupPlayers.map(p => ({ id: p.id, name: p.name, color: p.color }))}
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
                { label: 'Pontos', a: formatRating(pA.points), b: formatRating(pB.points) },
                { label: 'Vitórias', a: pA.wins, b: pB.wins },
                { label: 'Derrotas', a: pA.losses, b: pB.losses },
                { label: 'GA', a: formatGA(pA.ga), b: formatGA(pB.ga) },
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

      <SeasonsSheet
        visible={showSeasons}
        onClose={() => setShowSeasons(false)}
        seasons={seasons}
        currentNumber={seasonNo}
        isAdmin={isAdmin}
        currentPlayers={seasonRanking.length}
        unfinishedCount={unfinishedCount}
        onEnd={handleEndSeason}
        onUndo={handleUndoSeason}
      />

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
            {!!scoringConfig.eventCoef && (
              <>
                {' + '}
                <Text style={{ color: Colors.faint }}>(Eventos × {fmtCoef(scoringConfig.eventCoef)})</Text>
              </>
            )}
          </Text>
          <Text style={modal.note}>{scoringConfig.gaSmoothing ? `GA = (Games Pró + ${scoringConfig.gaSmoothing}) ÷ (Games Contra + ${scoringConfig.gaSmoothing})` : 'GA = Games Pró ÷ Games Contra'}</Text>
          <View style={modal.divider} />
          {(() => {
            const me = ranking.find(r => r.id === MY_ID);
            if (!me) return null;
            const winPts = me.wins * scoringConfig.winCoef;
            const playedPts = me.played * scoringConfig.playedCoef;
            const gaPts = me.ga * scoringConfig.gaCoef;
            const hasEvents = !!scoringConfig.eventCoef;
            const eventsPts = (me.events ?? 0) * (scoringConfig.eventCoef ?? 0);
            return (
              <View style={modal.example}>
                <Text style={modal.exTitle}>Seu exemplo:</Text>
                <Text style={modal.exText}>
                  ({me.wins}×{fmtCoef(scoringConfig.winCoef)}) + ({me.played}×{fmtCoef(scoringConfig.playedCoef)}) + ({fmtCoef(me.ga)}×{fmtCoef(scoringConfig.gaCoef)})
                  {hasEvents && ` + (${me.events ?? 0}×${fmtCoef(scoringConfig.eventCoef!)})`}
                </Text>
                <Text style={modal.exText}>
                  = {fmtCoef(winPts)} + {fmtCoef(playedPts)} + {fmtCoef(gaPts)}
                  {hasEvents && ` + ${fmtCoef(eventsPts)}`}
                  {' = '}<Text style={{ color: Colors.gold }}>{formatRating(me.points)} pts</Text>
                </Text>
              </View>
            );
          })()}
          <View style={modal.divider} />
          <Text style={modal.desempateTitle}>Critérios de desempate</Text>
          {[
            '1° Pontuação King BT',
            '2° Confronto Direto',
            '3° Saldo de Games (SG)',
            '4° Game Average (GA)',
            '5° Nº de Vitórias',
            '6° Ordem alfabética',
          ].map(d => (
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
  container: { flex: 1, backgroundColor: 'transparent' },

  // Título em Type.h1 (era 28px, próprio desta tela) + contexto de grupo
  // numa segunda linha só — o resto do cromo saiu daqui.
  wideContent: { ...wideContent, padding: Spacing.lg },
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.lg },
  colLeft: { width: 420 },
  colRight: { flex: 1, minWidth: 0 },
  header: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { ...Type.screenTitle, color: Colors.text },
  subtitle: { ...Type.sectionLabel, color: Colors.gold, marginTop: 2 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginHorizontal: Spacing.md },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 40, borderRadius: Radius.full, backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line },
  catCount: { fontFamily: FontFamily.numberBold, fontSize: 12, color: Colors.faint },
  catEmpty: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, textAlign: 'center', marginHorizontal: Spacing.md },
  periodRow: { flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.md },
  periodChip: { flex: 1, minHeight: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line },
  periodChipOn: { backgroundColor: Colors.gold + '26', borderColor: Colors.gold },
  periodText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  periodTextOn: { fontFamily: FontFamily.title, color: Colors.gold },
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
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4,
  },

  posText: { fontFamily: FontFamily.numberBold, fontSize: 17, color: Colors.muted, width: 26, textAlign: 'center' },
  nameBlock: { flex: 1, overflow: 'hidden' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden' },
  playerName: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text, flexShrink: 1 },
  playerMeta: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, marginTop: 2 },
  gapTrack: { height: 4, borderRadius: 2, backgroundColor: Colors.line, marginTop: 6, overflow: 'hidden' },
  gapFill: { height: '100%', borderRadius: 2 },
  ptsText: { fontFamily: FontFamily.numberBold, fontSize: 19, color: Colors.gold, textAlign: 'right', minWidth: 64 },
  trendSmall: { ...Type.caption, fontSize: 9, fontFamily: FontFamily.numberBold, color: Colors.faint },

  expandPanel: {
    borderTopWidth: 1, borderTopColor: Colors.line,
    padding: Spacing.sm + 2, gap: Spacing.sm,
    backgroundColor: Colors.surf2,
  },
  statGrid: { flexDirection: 'row' },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statCellLabel: { ...Type.label, fontSize: 11, lineHeight: 14, color: Colors.muted },
  statCellValue: { fontFamily: FontFamily.numberBold, fontSize: 17, color: Colors.text },
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
