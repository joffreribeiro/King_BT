import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { notify } from '@/services/notify';
import { gerarRelatorioJogosHtml, gerarRelatorioPartidaHtml } from '@/logic/exportRelatorio';
import { HexBackground } from '@/components/HexBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { FontFamily, Spacing, centeredContent, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { listarAnalises, placardInicial, avancaPonto, formatGameScore, calcularEstatisticas, type BtAnalise } from '@/logic/btTracker';
import { GamesComTb } from '@/components/analise/GamesComTb';
import { tiebreaksDosSets } from '@/logic/btPlacarPonto';
import { useAuth } from '@/store/AuthContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { listAnalisesFs } from '@/firebase/analises';
import { resolverNomes } from '@/logic/btNomes';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useRequireAuth } from '@/hooks/useRequireAuth';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function AnaliseCard({ analise, onPdf }: { analise: BtAnalise; onPdf: (a: BtAnalise) => void }) {
  const { colors: Colors } = useTheme();
  const card = useMemo(() => makeCardStyles(Colors), [Colors]);
  const { jogadores, nomes, placarFinal, criadaEm, matchId, competitionId } = analise;
  const { findPlayer } = useGroupPlayers();
  const primeiro = (id: string) => (findPlayer(id)?.name ?? nomes[id])?.split(' ')[0] ?? id;
  const nA = [jogadores.a1, jogadores.a2].filter(Boolean).map(primeiro).join(' / ');
  const nB = [jogadores.b1, jogadores.b2].filter(Boolean).map(primeiro).join(' / ');

  // Placar: finalizada usa o placar salvo; em andamento recalcula pelos pontos (inclui os pontos do game)
  const tbs = useMemo(() => tiebreaksDosSets({ pontos: analise.pontos, rule: analise.rule, inicial: analise.inicial }), [analise]);
  const vivo = useMemo(() => {
    if (placarFinal || analise.pontos.length === 0) return null;
    let pl = placardInicial(analise.rule, analise.inicial);
    for (const p of analise.pontos) pl = avancaPonto(pl, p.vencedorDupla, p.sacador);
    return pl;
  }, [analise, placarFinal]);
  const histA = placarFinal ? placarFinal.gamesA : vivo ? [...vivo.historicGamesA, vivo.gamesA] : [];
  const histB = placarFinal ? placarFinal.gamesB : vivo ? [...vivo.historicGamesB, vivo.gamesB] : [];
  const stbs = placarFinal ? placarFinal.stb : vivo?.historicStb;
  const ptsVivo = vivo ? formatGameScore(vivo).split('x') : null;

  return (
    <TouchableOpacity
      style={card.wrap}
      activeOpacity={0.8}
      onPress={() => router.push({
        pathname: '/analise/[matchId]/relatorio',
        params: { matchId, compId: competitionId },
      })}
    >
      <View style={card.header}>
        <Text style={card.status}>{placarFinal ? 'Finalizada' : `Em andamento · ${analise.pontos.length} pontos`}</Text>
        <View style={card.headerDir}>
          <Text style={card.date}>{formatDate(criadaEm)}</Text>
          {analise.pontos.length > 0 && (
            <TouchableOpacity onPress={() => onPdf(analise)} hitSlop={8} accessibilityLabel="Gerar PDF deste jogo">
              <Text style={card.pdf}>⬇ PDF</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {histA.length > 0 ? (
        <View>
          <View style={card.linha}>
            <View style={{ flex: 1 }} />
            {histA.map((_, i) => <Text key={i} style={card.cab}>SET {i + 1}</Text>)}
            {ptsVivo && <Text style={[card.cab, { width: 52 }]}>PONTOS</Text>}
          </View>
          {(['A', 'B'] as const).map(d => {
            const meus = d === 'A' ? histA : histB;
            const outros = d === 'A' ? histB : histA;
            const cor = d === 'A' ? Colors.gold : Colors.teal;
            return (
              <View key={d} style={[card.linha, card.linhaDupla, { borderLeftColor: cor }]}>
                <Text style={card.nome} numberOfLines={1}>{d === 'A' ? nA : nB}</Text>
                {meus.map((g, i) => {
                  const tb = tbs[i];
                  const fechado = !vivo || i < vivo.historicGamesA.length;
                  const tbMeu = fechado && tb && !stbs?.[i] ? (d === 'A' ? tb.a : tb.b) : undefined;
                  return <GamesComTb key={i} games={g} tb={tbMeu} style={[card.game, fechado && g > (outros[i] ?? 0) && { color: cor }]} />;
                })}
                {ptsVivo && <Text style={card.pts}>{ptsVivo[d === 'A' ? 0 : 1]}</Text>}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={card.teams}>
          <Text style={[card.team, { color: Colors.gold }]} numberOfLines={1}>{nA}</Text>
          <Text style={card.vs}>×</Text>
          <Text style={[card.team, { color: Colors.teal }]} numberOfLines={1}>{nB}</Text>
        </View>
      )}
      <Text style={card.hint}>📊 Ver relatório completo</Text>
    </TouchableOpacity>
  );
}

const makeCardStyles = (Colors: ThemeColors) => StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surf, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line,
    padding: Spacing.md, gap: Spacing.xs,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  headerDir: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pdf: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.teal },
  linha: { flexDirection: 'row', alignItems: 'center' },
  linhaDupla: { backgroundColor: Colors.surf2, borderRadius: Radius.md, borderLeftWidth: 3, marginTop: 5, paddingLeft: 10, paddingRight: 4, paddingVertical: 8 },
  cab: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.faint, width: 44, textAlign: 'center' },
  nome: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  game: { fontFamily: FontFamily.numberBold, fontSize: 18, color: Colors.text, width: 44, textAlign: 'center' },
  pts: { fontFamily: FontFamily.numberBold, fontSize: 22, width: 52, textAlign: 'center', color: Colors.text },
  date: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  teams: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  team: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13 },
  vs: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.faint },
  hint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted, marginTop: 2 },
});

export default function AnaliseListScreen() {
  useRequireAuth();
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { group } = useAuth();
  const [bruto, setBruto] = useState<BtAnalise[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);
  const { state: { competitions } } = useCompetitions();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  // Nomes atuais do grupo (ou "Jogador removido" no lugar de id cru)
  const analises = useMemo(() => bruto.map(a => resolverNomes(a, id => findPlayer(id)?.name)), [bruto, groupPlayers]); // eslint-disable-line react-hooks/exhaustive-deps
  // Quantas análises da nuvem buscar; "Ver mais jogos" soma 50 e o resto da tela segue igual
  const [qtd, setQtd] = useState(50);
  const [temMais, setTemMais] = useState(false);

  /** Gera o PDF e abre o compartilhamento (mesmo caminho do relatório de uma partida). */
  async function compartilharPdf(html: string, titulo: string) {
    try {
      setExportando(true);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: titulo });
    } catch {
      notify('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setExportando(false);
    }
  }
  const pdfDoJogo = (a: BtAnalise) => compartilharPdf(gerarRelatorioPartidaHtml(a, calcularEstatisticas(a)), 'Relatório de Partida — King BT');
  const pdfDosJogos = () => compartilharPdf(gerarRelatorioJogosHtml(analises, group?.name ?? 'Grupo'), 'Jogos gravados pelo King Scout');

  useEffect(() => {
    async function load() {
      // O aparelho guarda as análises de TODOS os grupos; aqui entram só as de competições do grupo atual
      // (as da nuvem já são do grupo). Antes a lista misturava jogos de outros grupos.
      const idsComp = new Set(competitions.map(c => c.id));
      let list = (await listarAnalises()).filter(a => idsComp.has(a.competitionId));
      // Complementa com Firebase se estiver online
      if (group?.id) {
        try {
          const remote = await listAnalisesFs(group.id, qtd);
          setTemMais(remote.length >= qtd);
          const localIds = new Set(list.map(a => a.matchId));
          const novos = remote.filter(a => !localIds.has(a.matchId));
          list = [...list, ...novos];
        } catch { /* offline ou sem permissão */ }
      }
      // Ordena por mais recente primeiro
      list.sort((a, b) => b.criadaEm - a.criadaEm);
      setBruto(list);
      setLoading(false);
    }
    load();
  }, [group?.id, competitions, qtd]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <HexBackground />
      <StatusBar barStyle="light-content" />

      <ScreenHeader
        title="King Scout"
        subtitle="Jogos gravados ponto a ponto"
        below={
          // Linha própria: no cabeçalho os botões ocupavam o espaço e cortavam o título ("King Sc…")
          <View style={{ flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs }}>
            {analises.length > 0 && (
              <TouchableOpacity style={s.atletaBtn} onPress={pdfDosJogos} disabled={exportando}>
                <Text style={s.atletaTxt}>{exportando ? '...' : '⬇ Relatório dos jogos'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.atletaBtn} onPress={() => router.push('/analise/atleta' as never)}>
              <Text style={s.atletaTxt}>📈 Atletas</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {loading && (
        <View style={s.center}>
          <Text style={s.hint}>Carregando análises...</Text>
        </View>
      )}

      {!loading && analises.length === 0 && (
        <View style={s.center}>
          <Text style={{ fontSize: 40, textAlign: 'center' }}>📊</Text>
          <Text style={s.emptyTitle}>Nenhum jogo gravado ainda</Text>
          <Text style={s.hint}>
            Os jogos marcados ponto a ponto no King Scout aparecem aqui, com relatório e análise por atleta.
          </Text>
        </View>
      )}

      {!loading && analises.length > 0 && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {analises.map(a => <AnaliseCard key={a.matchId} analise={a} onPdf={pdfDoJogo} />)}
          {temMais && (
            <TouchableOpacity style={[s.atletaBtn, { alignSelf: 'center' }]} onPress={() => setQtd(q => q + 50)}>
              <Text style={s.atletaTxt}>Ver mais jogos</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  title: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.text },
  atletaBtn: { backgroundColor: Colors.surf2, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.line },
  atletaTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.teal },
  scroll: { ...centeredContent, padding: Spacing.md, gap: Spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 18, color: Colors.text, textAlign: 'center' },
  hint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
