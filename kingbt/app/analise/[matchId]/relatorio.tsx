import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import {
  carregarAnalise, calcularEstatisticas, salvarAnalise,
  placardInicial, avancaPonto,
  type BtAnalise, type BtEstatisticas,
} from '@/logic/btTracker';
import { loadAnaliseFs } from '@/firebase/analises';
import { useAuth } from '@/store/AuthContext';
import { BarChart, PieChart, LineChart } from 'react-native-gifted-charts';

const { width: SW } = Dimensions.get('window');
const CHART_W = SW - Spacing.md * 2 - 2;

// ─── Abas ────────────────────────────────────────────────────────────────────

const ABAS = ['Resumo', 'Stats', 'Saques', 'Finalizações', 'Dinâmica', 'Log'] as const;
type Aba = typeof ABAS[number];

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function TabBar({ aba, onSelect }: { aba: Aba; onSelect: (a: Aba) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tb.scroll} contentContainerStyle={tb.content}>
      {ABAS.map(a => (
        <TouchableOpacity key={a} style={[tb.tab, aba === a && tb.tabActive]} onPress={() => onSelect(a)}>
          <Text style={[tb.txt, aba === a && tb.txtActive]}>{a}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const tb = StyleSheet.create({
  scroll: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  content: { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: Spacing.xs },
  tab: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.gold },
  txt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.faint },
  txtActive: { color: Colors.gold },
});

function StatRow({ label, valA, valB, pctA, pctB }: { label: string; valA: number | string; valB: number | string; pctA?: number; pctB?: number }) {
  return (
    <View style={sr.row}>
      <Text style={[sr.val, { color: Colors.gold }]}>{valA}{pctA !== undefined ? ` (${pctA}%)` : ''}</Text>
      <Text style={sr.label}>{label}</Text>
      <Text style={[sr.val, { color: Colors.teal }]}>{valB}{pctB !== undefined ? ` (${pctB}%)` : ''}</Text>
    </View>
  );
}

const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.line },
  val: { width: 80, fontFamily: FontFamily.number, fontSize: 14, textAlign: 'center' },
  label: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, textAlign: 'center' },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sc.wrap}>
      <Text style={sc.title}>{title}</Text>
      {children}
    </View>
  );
}

const sc = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  title: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.gold, marginBottom: 4 },
});

// ─── Abas de conteúdo ─────────────────────────────────────────────────────────

function AbaResumo({ analise, stats }: { analise: BtAnalise; stats: BtEstatisticas }) {
  const { dupla } = stats;
  const totalPontos = dupla.A.pontosTotal;
  const pA = totalPontos > 0 ? Math.round((dupla.A.pontosGanhos / totalPontos) * 100) : 0;
  const pB = 100 - pA;

  const nA = `${analise.nomes[analise.jogadores.a1] ?? 'A1'} / ${analise.nomes[analise.jogadores.a2] ?? 'A2'}`;
  const nB = `${analise.nomes[analise.jogadores.b1] ?? 'B1'} / ${analise.nomes[analise.jogadores.b2] ?? 'B2'}`;

  return (
    <ScrollView contentContainerStyle={p.scroll}>
      {/* Placar final */}
      <View style={rs.scoreCard}>
        <View style={rs.scoreTeam}>
          <Text style={rs.scoreName} numberOfLines={2}>{nA}</Text>
          <Text style={[rs.scoreNum, { color: Colors.gold }]}>
            {analise.placarFinal?.setsA ?? dupla.A.pontosGanhos}
          </Text>
        </View>
        <View style={rs.scoreCenter}>
          <Text style={rs.scoreSep}>×</Text>
          <Text style={rs.scoreLabel}>sets</Text>
        </View>
        <View style={rs.scoreTeam}>
          <Text style={rs.scoreName} numberOfLines={2}>{nB}</Text>
          <Text style={[rs.scoreNum, { color: Colors.teal }]}>
            {analise.placarFinal?.setsB ?? dupla.B.pontosGanhos}
          </Text>
        </View>
      </View>

      {/* Games por set */}
      {analise.placarFinal?.gamesA && (
        <View style={rs.setsRow}>
          {analise.placarFinal.gamesA.map((g, i) => (
            <View key={i} style={rs.setChip}>
              <Text style={[rs.setScore, { color: Colors.gold }]}>{g}</Text>
              <Text style={rs.setSlash}>-</Text>
              <Text style={[rs.setScore, { color: Colors.teal }]}>{analise.placarFinal!.gamesB[i]}</Text>
            </View>
          ))}
        </View>
      )}

      <Section title="Pontos">
        <StatRow label="Pontos ganhos" valA={dupla.A.pontosGanhos} valB={dupla.B.pontosGanhos} pctA={pA} pctB={pB} />
        <StatRow label="40×40 vitorias" valA={dupla.A.quarentaQuarentaVitorias} valB={dupla.B.quarentaQuarentaVitorias} />
        <StatRow label="Winners" valA={dupla.A.winners} valB={dupla.B.winners} />
        <StatRow label="Aces" valA={dupla.A.aces} valB={dupla.B.aces} />
        <StatRow label="Forçou erro" valA={dupla.A.forcouErro} valB={dupla.B.forcouErro} />
        <StatRow label="Erros N. Forçados" valA={dupla.A.errosNaoForcados} valB={dupla.B.errosNaoForcados} />
        <StatRow label="Erros de Saque" valA={dupla.A.errosSaque} valB={dupla.B.errosSaque} />
        <StatRow label="Erros de Dev." valA={dupla.A.errosDevolucao} valB={dupla.B.errosDevolucao} />
      </Section>

      {/* Legenda duplas */}
      <View style={rs.legend}>
        <View style={rs.legendItem}>
          <View style={[rs.legendDot, { backgroundColor: Colors.gold }]} />
          <Text style={rs.legendTxt} numberOfLines={1}>{nA}</Text>
        </View>
        <View style={rs.legendItem}>
          <View style={[rs.legendDot, { backgroundColor: Colors.teal }]} />
          <Text style={rs.legendTxt} numberOfLines={1}>{nB}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const rs = StyleSheet.create({
  scoreCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.line, marginBottom: Spacing.md,
  },
  scoreTeam: { flex: 1, alignItems: 'center', gap: 6 },
  scoreName: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted, textAlign: 'center' },
  scoreNum: { fontFamily: FontFamily.numberBold, fontSize: 52 },
  scoreCenter: { alignItems: 'center', gap: 2 },
  scoreSep: { fontFamily: FontFamily.number, fontSize: 24, color: Colors.faint },
  scoreLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  setsRow: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'center', marginBottom: Spacing.md },
  setChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surf2, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.line,
  },
  setScore: { fontFamily: FontFamily.number, fontSize: 16 },
  setSlash: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.faint },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg, marginTop: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, maxWidth: 120 },
});

function AbaStats({ analise, stats }: { analise: BtAnalise; stats: BtEstatisticas }) {
  const jogs = analise.jogadores;
  const ids = [jogs.a1, jogs.a2, jogs.b1, jogs.b2].filter(Boolean);

  return (
    <ScrollView contentContainerStyle={p.scroll}>
      <Section title="Por atleta">
        {/* Cabeçalho */}
        <View style={[sr.row, { backgroundColor: Colors.surf2 }]}>
          <Text style={[sr.val, { color: Colors.muted, fontSize: 10 }]}>Pts</Text>
          <Text style={[sr.label, { color: Colors.muted, fontSize: 10 }]}>Atleta</Text>
          <Text style={[sr.val, { color: Colors.muted, fontSize: 10 }]}>W</Text>
          <Text style={[sr.val, { color: Colors.muted, fontSize: 10 }]}>Ace</Text>
          <Text style={[sr.val, { color: Colors.muted, fontSize: 10 }]}>ENF</Text>
        </View>
        {ids.map(id => {
          const e = stats.jogadores[id];
          if (!e) return null;
          const dupla = [jogs.a1, jogs.a2].includes(id) ? 'A' : 'B';
          const cor = dupla === 'A' ? Colors.gold : Colors.teal;
          return (
            <View key={id} style={sr.row}>
              <Text style={[sr.val, { color: cor }]}>{e.pontosGanhos}</Text>
              <Text style={[sr.label, { color: Colors.text }]} numberOfLines={1}>
                {analise.nomes[id]?.split(' ')[0] ?? id}
              </Text>
              <Text style={[sr.val, { color: Colors.text, fontSize: 12 }]}>{e.winners}</Text>
              <Text style={[sr.val, { color: Colors.text, fontSize: 12 }]}>{e.aces}</Text>
              <Text style={[sr.val, { color: Colors.coral, fontSize: 12 }]}>{e.errosNaoForcados}</Text>
            </View>
          );
        })}
        <Text style={p.hint}>W = Winners · Ace = Aces · ENF = Erros Não Forçados</Text>
      </Section>
    </ScrollView>
  );
}

function AbaSaques({ analise, stats }: { analise: BtAnalise; stats: BtEstatisticas }) {
  const jogs = analise.jogadores;
  const ids = [jogs.a1, jogs.a2, jogs.b1, jogs.b2].filter(Boolean);

  return (
    <ScrollView contentContainerStyle={p.scroll}>
      {ids.map(id => {
        const e = stats.jogadores[id];
        if (!e || Object.keys(e.saquesPorPosicao).length === 0) return null;
        const nome = analise.nomes[id]?.split(' ')[0] ?? id;
        const dupla = [jogs.a1, jogs.a2].includes(id) ? 'A' : 'B';
        const cor = dupla === 'A' ? Colors.gold : Colors.teal;

        const posicoes = Object.keys(e.saquesPorPosicao);
        const barData = posicoes.map(pos => {
          const sp = e.saquesPorPosicao[pos];
          return {
            value: sp.acertos,
            label: pos.replace('Direita-', 'D').replace('Esquerda-', 'E').replace('-Lob', 'L'),
            frontColor: cor,
          };
        });

        return (
          <Section key={id} title={`${nome} — Saques`}>
            <BarChart
              data={barData}
              width={CHART_W - 40}
              barWidth={24}
              spacing={12}
              hideRules
              xAxisLabelTextStyle={{ color: Colors.muted, fontSize: 9, fontFamily: FontFamily.body }}
              yAxisTextStyle={{ color: Colors.muted, fontSize: 9 }}
              noOfSections={4}
              barBorderRadius={4}
            />
            {posicoes.map(pos => {
              const sp = e.saquesPorPosicao[pos];
              const pct = sp.acertos + sp.erros > 0 ? Math.round((sp.acertos / (sp.acertos + sp.erros)) * 100) : 0;
              return (
                <View key={pos} style={saq.row}>
                  <Text style={saq.pos}>{pos}</Text>
                  <Text style={saq.val}>{sp.acertos}✓ {sp.erros}✗</Text>
                  <Text style={[saq.pct, { color: pct >= 70 ? Colors.teal : pct >= 50 ? Colors.gold : Colors.coral }]}>
                    {pct}%
                  </Text>
                </View>
              );
            })}
          </Section>
        );
      })}
    </ScrollView>
  );
}

const saq = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.line },
  pos: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  val: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.text, width: 70, textAlign: 'right' },
  pct: { fontFamily: FontFamily.number, fontSize: 12, width: 44, textAlign: 'right' },
});

function AbaFinalizacoes({ analise, stats }: { analise: BtAnalise; stats: BtEstatisticas }) {
  const jogs = analise.jogadores;
  const ids = [jogs.a1, jogs.a2, jogs.b1, jogs.b2].filter(Boolean);

  const PIE_COLORS = [Colors.gold, Colors.teal, Colors.coral, '#A78BFA', '#34D399', '#FB923C'];

  return (
    <ScrollView contentContainerStyle={p.scroll}>
      {ids.map(id => {
        const fins = stats.finalizacoesPorJogador[id] ?? {};
        const total = Object.values(fins).reduce((s, v) => s + v, 0);
        if (total === 0) return null;
        const nome = analise.nomes[id]?.split(' ')[0] ?? id;

        const pieData = Object.entries(fins).map(([key, val], i) => ({
          value: val,
          color: PIE_COLORS[i % PIE_COLORS.length],
          text: key,
        }));

        return (
          <Section key={id} title={`${nome} — Finalizações`}>
            <View style={{ alignItems: 'center' }}>
              <PieChart
                data={pieData}
                donut
                radius={70}
                innerRadius={40}
                centerLabelComponent={() => (
                  <Text style={{ fontFamily: FontFamily.number, fontSize: 18, color: Colors.text }}>{total}</Text>
                )}
              />
            </View>
            <View style={fin.legend}>
              {pieData.map((d, i) => (
                <View key={i} style={fin.item}>
                  <View style={[fin.dot, { backgroundColor: d.color }]} />
                  <Text style={fin.lbl}>{d.text} ({d.value})</Text>
                </View>
              ))}
            </View>
          </Section>
        );
      })}
    </ScrollView>
  );
}

const fin = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  lbl: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
});

function AbaDinamica({ stats }: { stats: BtEstatisticas }) {
  const { dinamica } = stats;
  if (dinamica.length === 0) {
    return (
      <View style={p.empty}>
        <Text style={p.emptyTxt}>Nenhum ponto registrado.</Text>
      </View>
    );
  }

  const lineData = dinamica.map((d) => ({ value: d.diff, dataPointText: '' }));
  const absMax = Math.max(2, ...lineData.map(d => Math.abs(d.value))) + 2;

  return (
    <ScrollView contentContainerStyle={p.scroll}>
      <Section title="Momentum do jogo">
        <Text style={p.hint}>Acima do zero = Dupla A lidera · Abaixo = Dupla B lidera</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <LineChart
            data={lineData}
            width={Math.max(CHART_W, dinamica.length * 16)}
            height={180}
            color={Colors.gold}
            thickness={2}
            hideDataPoints={dinamica.length > 30}
            dataPointsColor={Colors.gold}
            startFillColor={Colors.gold + '44'}
            endFillColor={Colors.gold + '00'}
            areaChart
            hideRules={false}
            rulesColor={Colors.line}
            rulesType="dashed"
            yAxisTextStyle={{ color: Colors.muted, fontSize: 9 }}
            xAxisLabelTextStyle={{ color: Colors.muted, fontSize: 9 }}
            noOfSections={6}
            maxValue={absMax}
            mostNegativeValue={-absMax}
            referenceLinesConfig={[
              { y: 0, color: Colors.muted, thickness: 1, type: 'solid', labelText: '0', labelTextStyle: { color: Colors.faint, fontSize: 8 } },
            ]}
          />
        </ScrollView>
      </Section>
    </ScrollView>
  );
}

function AbaLog({ analise }: { analise: BtAnalise }) {
  return (
    <ScrollView contentContainerStyle={p.scroll}>
      {analise.pontos.length === 0 && (
        <View style={p.empty}>
          <Text style={p.emptyTxt}>Nenhum ponto registrado.</Text>
        </View>
      )}
      {[...analise.pontos].reverse().map((pt, i) => {
        const dupla = pt.vencedorDupla;
        const cor = dupla === 'A' ? Colors.gold : Colors.teal;
        const sacNome = analise.nomes[pt.sacador]?.split(' ')[0] ?? pt.sacador;
        return (
          <View key={pt.id} style={log.row}>
            <View style={[log.dot, { backgroundColor: cor }]} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={log.placar}>{pt.setScore} · {pt.gameScore}</Text>
              <Text style={log.detalhe}>
                Saque: {sacNome} ({pt.posicaoSaque}) · {pt.finalizacao}
                {pt.tipoFinalizacao ? ` · ${pt.tipoFinalizacao}` : ''}
              </Text>
              <Text style={[log.vencedor, { color: cor }]}>Dupla {dupla} venceu</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const log = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  placar: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.text },
  detalhe: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  vencedor: { fontFamily: FontFamily.bodyMed, fontSize: 11 },
});

// ─── Tela principal ──────────────────────────────────────────────────────────

export default function RelatorioScreen() {
  const { matchId, compId } = useLocalSearchParams<{ matchId: string; compId: string }>();
  const { group } = useAuth();
  const [analise, setAnalise] = useState<BtAnalise | null>(null);
  const [stats, setStats] = useState<BtEstatisticas | null>(null);
  const [aba, setAba] = useState<Aba>('Resumo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      let a = await carregarAnalise(matchId, compId ?? '');
      if (!a && group?.id) {
        a = await loadAnaliseFs(group.id, matchId).catch(() => null);
        if (a) await salvarAnalise(a);
      }
      setLoading(false);
      if (!a) return;
      // Garante placarFinal calculado a partir dos pontos se ausente
      if (!a.placarFinal && a.pontos.length > 0) {
        let pl = placardInicial(a.rule);
        for (const pt of a.pontos) pl = avancaPonto(pl, pt.vencedorDupla);
        if (pl.setsA > 0 || pl.setsB > 0 || pl.historicGamesA.length > 0) {
          a = {
            ...a,
            placarFinal: {
              setsA: pl.setsA, setsB: pl.setsB,
              gamesA: pl.historicGamesA, gamesB: pl.historicGamesB,
            },
          };
        }
      }
      setAnalise(a);
      setStats(calcularEstatisticas(a));
    }
    load();
  }, [matchId]);

  return (
    <SafeAreaView style={r.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={r.header}>
        <TouchableOpacity onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace({ pathname: '/competitions/[id]', params: { id: compId ?? '' } });
        }}>
          <Text style={r.back}>←</Text>
        </TouchableOpacity>
        <Text style={r.title}>Análise BT</Text>
      </View>

      {loading && (
        <View style={p.empty}>
          <Text style={p.emptyTxt}>Carregando análise...</Text>
        </View>
      )}

      {!loading && !analise && (
        <View style={p.empty}>
          <Text style={p.emptyTxt}>Nenhuma análise encontrada para esta partida.</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: Spacing.md }}>
            <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.teal }}>← Voltar</Text>
          </TouchableOpacity>
        </View>
      )}

      {analise && stats && (
        <>
          <TabBar aba={aba} onSelect={setAba} />
          {aba === 'Resumo' && <AbaResumo analise={analise} stats={stats} />}
          {aba === 'Stats' && <AbaStats analise={analise} stats={stats} />}
          {aba === 'Saques' && <AbaSaques analise={analise} stats={stats} />}
          {aba === 'Finalizações' && <AbaFinalizacoes analise={analise} stats={stats} />}
          {aba === 'Dinâmica' && <AbaDinamica stats={stats} />}
          {aba === 'Log' && <AbaLog analise={analise} />}
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Estilos compartilhados ───────────────────────────────────────────────────

const r = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  back: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
});

const p = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.lg },
  hint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  emptyTxt: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, textAlign: 'center' },
});
