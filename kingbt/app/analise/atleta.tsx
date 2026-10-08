import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { gerarRelatorioAtletaHtml } from '@/logic/exportRelatorio';
import { notify } from '@/services/notify';
import { HexBackground } from '@/components/HexBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import { FontFamily, Spacing, centeredContent, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { listarAnalises, type BtAnalise } from '@/logic/btTracker';
import { analisesDoPeriodo, atletasConhecidos, resumoDoAtleta, PERIODOS, type Periodo } from '@/logic/btAtleta';
import {
  adversariosDe, analisesContra, campanhasDoAtleta, dicasContra, evolucaoDoAtleta, sugestoesDoAtleta, MINIMO_PARTIDAS_EVOLUCAO,
} from '@/logic/btAtletaAnalise';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import { listAnalisesFs } from '@/firebase/analises';
import { Chip } from '@/components/analise/Chip';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const { width: SW } = Dimensions.get('window');
const CHART_W = Math.min(SW, 640) - Spacing.md * 2 - 40;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function Numero({ rotulo, valor, sub, cor }: { rotulo: string; valor: string | number; sub?: string; cor?: string }) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={s.numero}>
      <Text style={[s.numeroValor, cor ? { color: cor } : null]}>{valor}</Text>
      <Text style={s.numeroRotulo}>{rotulo}</Text>
      {sub ? <Text style={s.numeroSub}>{sub}</Text> : null}
    </View>
  );
}

export default function AtletaScreen() {
  useRequireAuth();
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { group } = useAuth();
  const { state: { competitions } } = useCompetitions();
  const { findPlayer } = useGroupPlayers();
  const nomeDe = (id: string, salvo: string) => findPlayer(id)?.name ?? salvo;
  const [advId, setAdvId] = useState<string | null>(null);
  const [todas, setTodas] = useState<BtAnalise[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('tudo');
  const [atletaId, setAtletaId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Só as análises de competições do grupo atual (o aparelho guarda as de todos os grupos)
      const idsComp = new Set(competitions.map(c => c.id));
      let list = (await listarAnalises()).filter(a => idsComp.has(a.competitionId));
      if (group?.id) {
        try {
          const remote = await listAnalisesFs(group.id);
          const locais = new Set(list.map(a => a.matchId));
          list = [...list, ...remote.filter(a => !locais.has(a.matchId))];
        } catch { /* offline ou sem permissão: segue só com as do aparelho */ }
      }
      setTodas(list);
      setLoading(false);
    }
    load();
  }, [group?.id, competitions]);

  const analises = useMemo(() => analisesDoPeriodo(todas, periodo), [todas, periodo]);
  const atletas = useMemo(() => atletasConhecidos(analises), [analises]);
  const escolhido = atletaId && atletas.some(a => a.id === atletaId) ? atletaId : atletas[0]?.id ?? null;
  const resumo = useMemo(() => (escolhido ? resumoDoAtleta(analises, escolhido) : null), [analises, escolhido]);

  const sugestoes = useMemo(() => (resumo ? sugestoesDoAtleta(resumo) : []), [resumo]);
  const evolucao = useMemo(() => (resumo ? evolucaoDoAtleta(resumo) : null), [resumo]);
  const campanhas = useMemo(() => (resumo ? campanhasDoAtleta(resumo) : []), [resumo]);
  const adversarios = useMemo(() => (escolhido ? adversariosDe(analises, escolhido) : []), [analises, escolhido]);
  const adv = adversarios.find(a => a.id === advId) ?? null;
  const contra = useMemo(
    () => (adv && escolhido ? resumoDoAtleta(analisesContra(analises, adv.id, escolhido), adv.id) : null),
    [analises, adv, escolhido],
  );
  const [exportando, setExportando] = useState(false);
  async function exportarPdf() {
    if (!resumo) return;
    try {
      setExportando(true);
      const rotuloPeriodo = PERIODOS.find(p => p.key === periodo)?.label ?? '';
      const html = gerarRelatorioAtletaHtml(resumo, sugestoes, evolucao, periodo === 'tudo' ? 'Todas as partidas' : `Últimos ${rotuloPeriodo}`);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Análise do atleta — King BT' });
      }
    } catch {
      notify('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setExportando(false);
    }
  }
  const nomeCompeticao = (id: string) => competitions.find(c => c.id === id)?.name ?? 'Competição';

  const dadosGrafico = useMemo(
    () => (resumo?.lista ?? []).map(p => ({
      value: p.nota,
      label: formatDate(p.data),
      dataPointColor: p.venceu ? Colors.teal : Colors.coral,
    })),
    [resumo, Colors],
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <HexBackground />
      <StatusBar barStyle="light-content" />
      <ScreenHeader
        title="Análise do atleta"
        right={resumo ? (
          <TouchableOpacity style={s.pdfBtn} onPress={exportarPdf} disabled={exportando}>
            <Text style={s.pdfTxt}>{exportando ? '...' : '⬇ PDF'}</Text>
          </TouchableOpacity>
        ) : undefined}
      />

      {loading && <View style={s.center}><Text style={s.hint}>Carregando análises...</Text></View>}

      {!loading && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {PERIODOS.map(p => (
              <Chip key={p.key} small label={p.label} selected={periodo === p.key} onPress={() => setPeriodo(p.key)} />
            ))}
          </ScrollView>

          {atletas.length === 0 ? (
            <View style={s.center}>
              <Text style={{ fontSize: 40, textAlign: 'center' }}>📈</Text>
              <Text style={s.emptyTitle}>Nenhuma partida encerrada neste período</Text>
              <Text style={s.hint}>A análise do atleta soma as partidas já encerradas no scout.</Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                {atletas.map(a => (
                  <Chip key={a.id} label={`${nomeDe(a.id, a.nome).split(' ')[0]} · ${a.partidas}`} selected={escolhido === a.id} onPress={() => setAtletaId(a.id)} color={Colors.teal} />
                ))}
              </ScrollView>

              {resumo && (
                <>
                  <Text style={s.nome}>{nomeDe(resumo.id, resumo.nome)}</Text>
                  <View style={s.grade}>
                    <Numero rotulo="Partidas" valor={resumo.partidas} sub={`${resumo.vitorias}V · ${resumo.derrotas}D`} />
                    <Numero rotulo="Nota média" valor={resumo.notaMedia.toFixed(1)} cor={Colors.gold} />
                    <Numero
                      rotulo="Confirmação de saque"
                      valor={resumo.confirmacaoSaque.total > 0 ? `${resumo.confirmacaoSaque.pct}%` : '—'}
                      sub={`${resumo.confirmacaoSaque.n}/${resumo.confirmacaoSaque.total} games`}
                    />
                    <Numero rotulo="Winners" valor={resumo.winners} cor={Colors.teal} />
                    <Numero rotulo="Aces" valor={resumo.aces} cor={Colors.teal} />
                    <Numero rotulo="Forçou erro" valor={resumo.forcouErro} cor={Colors.teal} />
                    <Numero rotulo="Erros não forçados" valor={resumo.errosNaoForcados} cor={Colors.coral} />
                    <Numero rotulo="Erros de saque" valor={resumo.errosSaque} sub={`de ${resumo.saquesTotal} saques`} cor={Colors.coral} />
                    <Numero rotulo="Erros de devolução" valor={resumo.errosDevolucao} cor={Colors.coral} />
                  </View>

                  {sugestoes.length > 0 && (
                    <View style={s.bloco}>
                      <Text style={s.blocoTitulo}>O que treinar</Text>
                      {sugestoes.map(sg => (
                        <View key={sg.id} style={[s.sugestao, { borderLeftColor: sg.tipo === 'forte' ? Colors.teal : Colors.coral }]}>
                          <Text style={s.sugestaoTit}>{sg.titulo}</Text>
                          <Text style={s.sugestaoTxt}>{sg.texto}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={s.bloco}>
                    <Text style={s.blocoTitulo}>Evolução recente</Text>
                    {evolucao ? (
                      <>
                        <Text style={s.hint}>Últimas {evolucao.recentes} partidas × {evolucao.anteriores} anteriores</Text>
                        {evolucao.linhas.map(l => (
                          <View key={l.id} style={s.evoLinha}>
                            <Text style={[s.evoSeta, { color: l.tendencia === 'melhorou' ? Colors.teal : l.tendencia === 'piorou' ? Colors.coral : Colors.faint }]}>
                              {l.tendencia === 'melhorou' ? '▲' : l.tendencia === 'piorou' ? '▼' : '■'}
                            </Text>
                            <Text style={s.evoTxt}>{l.frase}</Text>
                          </View>
                        ))}
                      </>
                    ) : (
                      <Text style={s.hint}>Precisa de pelo menos {MINIMO_PARTIDAS_EVOLUCAO} partidas para comparar.</Text>
                    )}
                  </View>

                  {resumo.lista.length > 1 && (
                    <View style={s.bloco}>
                      <Text style={s.blocoTitulo}>Evolução da nota</Text>
                      <Text style={s.hint}>Cada ponto é uma partida · verde = vitória, vermelho = derrota</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <LineChart
                          data={dadosGrafico}
                          width={Math.max(CHART_W, dadosGrafico.length * 56)}
                          height={150}
                          maxValue={10}
                          noOfSections={5}
                          color={Colors.gold}
                          thickness={2}
                          dataPointsColor={Colors.gold}
                          rulesColor={Colors.line}
                          rulesType="dashed"
                          yAxisTextStyle={{ color: Colors.muted, fontSize: 9 }}
                          xAxisLabelTextStyle={{ color: Colors.muted, fontSize: 9 }}
                          spacing={56}
                          initialSpacing={16}
                        />
                      </ScrollView>
                    </View>
                  )}

                  {adversarios.length > 0 && (
                    <View style={s.bloco}>
                      <Text style={s.blocoTitulo}>Adversários</Text>
                      <Text style={s.hint}>Toque em um adversário para ver como jogar contra ele</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
                        {adversarios.map(a => (
                          <Chip key={a.id} small label={`${nomeDe(a.id, a.nome).split(' ')[0]} · ${a.vitorias}V ${a.derrotas}D`} selected={advId === a.id} onPress={() => setAdvId(advId === a.id ? null : a.id)} color={Colors.coral} />
                        ))}
                      </ScrollView>
                      {adv && contra && (
                        <View style={{ gap: Spacing.xs }}>
                          <Text style={s.sugestaoTit}>Como jogar contra {nomeDe(adv.id, adv.nome).split(' ')[0]} ({contra.partidas} {contra.partidas === 1 ? 'partida' : 'partidas'})</Text>
                          {dicasContra(contra).map((d, i) => <Text key={i} style={s.sugestaoTxt}>• {d}</Text>)}
                        </View>
                      )}
                    </View>
                  )}

                  {campanhas.length > 0 && (
                    <View style={s.bloco}>
                      <Text style={s.blocoTitulo}>Por competição</Text>
                      {campanhas.map(c => (
                        <View key={c.competitionId} style={s.campanha}>
                          <Text style={s.partidaTit} numberOfLines={1}>{nomeCompeticao(c.competitionId)}</Text>
                          <Text style={s.partidaSub}>{c.partidas.length} {c.partidas.length === 1 ? 'partida' : 'partidas'} · {c.vitorias}V {c.derrotas}D</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={s.bloco}>
                    <Text style={s.blocoTitulo}>Partidas</Text>
                    {[...resumo.lista].reverse().map(p => (
                      <TouchableOpacity
                        key={p.matchId}
                        style={s.partida}
                        activeOpacity={0.8}
                        onPress={() => router.push({ pathname: '/analise/[matchId]/relatorio', params: { matchId: p.matchId, compId: p.competitionId } })}
                      >
                        <View style={[s.resultado, { backgroundColor: p.venceu ? Colors.teal : Colors.coral }]}>
                          <Text style={s.resultadoTxt}>{p.venceu ? 'V' : 'D'}</Text>
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={s.partidaTit} numberOfLines={1}>
                            {p.parceiro ? `com ${p.parceiro} · ` : ''}contra {p.adversarios}
                          </Text>
                          <Text style={s.partidaSub}>{formatDate(p.data)} · {p.placar}</Text>
                        </View>
                        <Text style={s.partidaNota}>{p.nota.toFixed(1)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { ...centeredContent, padding: Spacing.md, gap: Spacing.md },
  chips: { flexDirection: 'row', gap: Spacing.xs, paddingVertical: 2 },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.text, textAlign: 'center' },
  hint: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, textAlign: 'center' },
  pdfBtn: { backgroundColor: Colors.surf2, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.line },
  pdfTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.teal },
  nome: { fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.text },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  numero: {
    flexGrow: 1, flexBasis: '30%', minWidth: 96, backgroundColor: Colors.surf, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line, padding: Spacing.sm, alignItems: 'center', gap: 2,
  },
  numeroValor: { fontFamily: FontFamily.numberBold, fontSize: 26, color: Colors.text },
  numeroRotulo: { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.muted, textAlign: 'center' },
  numeroSub: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint, textAlign: 'center' },
  bloco: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, padding: Spacing.md, gap: Spacing.sm },
  blocoTitulo: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.gold },
  partida: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.line },
  resultado: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  resultadoTxt: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.bg },
  partidaTit: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  partidaSub: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  sugestao: { borderLeftWidth: 3, paddingLeft: Spacing.sm, gap: 2 },
  sugestaoTit: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  sugestaoTxt: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  evoLinha: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  evoSeta: { fontFamily: FontFamily.numberBold, fontSize: 12, width: 14, marginTop: 1 },
  evoTxt: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  campanha: { paddingVertical: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.line, gap: 2 },
  partidaNota: { fontFamily: FontFamily.numberBold, fontSize: 18, color: Colors.gold },
});
