import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { gerarRelatorioTreinoHtml } from '@/logic/exportRelatorio';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import {
  carregarTreino, salvarTreino, ajustarContagem, calcularAnaliseTreino,
  TREINO_GOLPES, type BtTreino,
} from '@/logic/btTreino';
import { saveTreinoFs, loadTreinoFs } from '@/firebase/treinos';
import { BarChart } from 'react-native-gifted-charts';

type Aba = 'Golpes' | 'Análise';

function GolpeRow({ treino, golpeKey, label, onChange }: {
  treino: BtTreino; golpeKey: string; label: string;
  onChange: (campo: 'bom' | 'ruim', delta: 1 | -1) => void;
}) {
  const { colors: Colors } = useTheme();
  const g = useMemo(() => makeGolpeStyles(Colors), [Colors]);
  const c = treino.contagens[golpeKey] ?? { bom: 0, ruim: 0 };
  const total = c.bom + c.ruim;
  const pct = total > 0 ? Math.round((c.bom / total) * 100) : 0;

  return (
    <View style={g.row}>
      <View style={{ flex: 1 }}>
        <Text style={g.label} numberOfLines={1}>{label}</Text>
        <Text style={g.pct}>{total > 0 ? `${pct}% · ${total}` : '—'}</Text>
      </View>
      <View style={g.counter}>
        <TouchableOpacity style={[g.btn, g.btnBom]} onPress={() => onChange('bom', -1)} hitSlop={6}><Text style={g.btnTxt}>−</Text></TouchableOpacity>
        <Text style={[g.val, { color: Colors.teal }]}>{c.bom}</Text>
        <TouchableOpacity style={[g.btn, g.btnBom]} onPress={() => onChange('bom', 1)} hitSlop={6}><Text style={g.btnTxt}>+</Text></TouchableOpacity>
      </View>
      <View style={g.counter}>
        <TouchableOpacity style={[g.btn, g.btnRuim]} onPress={() => onChange('ruim', -1)} hitSlop={6}><Text style={g.btnTxt}>−</Text></TouchableOpacity>
        <Text style={[g.val, { color: Colors.coral }]}>{c.ruim}</Text>
        <TouchableOpacity style={[g.btn, g.btnRuim]} onPress={() => onChange('ruim', 1)} hitSlop={6}><Text style={g.btnTxt}>+</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const makeGolpeStyles = (Colors: ThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.line },
  label: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  pct: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnBom: { borderColor: Colors.teal + '66', backgroundColor: Colors.teal + '11' },
  btnRuim: { borderColor: Colors.coral + '66', backgroundColor: Colors.coral + '11' },
  btnTxt: { fontFamily: FontFamily.titleBold, fontSize: 13, color: Colors.text, lineHeight: 16 },
  val: { fontFamily: FontFamily.numberBold, fontSize: 13, width: 18, textAlign: 'center' },
});

function DashCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { colors: Colors } = useTheme();
  const d = useMemo(() => makeDashStyles(Colors), [Colors]);
  return (
    <View style={d.card}>
      <Text style={d.label}>{label}</Text>
      <Text style={d.value}>{value}</Text>
      {hint && <Text style={d.hint}>{hint}</Text>}
    </View>
  );
}

const makeDashStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: { flex: 1, minWidth: '45%', backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, padding: Spacing.sm, gap: 2 },
  label: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  value: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  hint: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
});

export default function TreinoDetailScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { treinoId, playerId } = useLocalSearchParams<{ treinoId: string; playerId: string }>();
  const { group } = useAuth();
  const { findPlayer } = useGroupPlayers();
  const [treino, setTreino] = useState<BtTreino | null>(null);
  const [aba, setAba] = useState<Aba>('Golpes');
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  async function exportarPdf() {
    if (!treino) return;
    try {
      setExportando(true);
      const htmlStr = gerarRelatorioTreinoHtml(treino, calcularAnaliseTreino(treino), findPlayer(treino.playerId)?.name ?? treino.playerId);
      const { uri } = await Print.printToFileAsync({ html: htmlStr, base64: false });
      setExportando(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Análise Individual King BT' });
      }
    } catch {
      setExportando(false);
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    }
  }

  useEffect(() => {
    async function load() {
      let t = await carregarTreino(playerId, treinoId);
      if (!t && group?.id) {
        t = await loadTreinoFs(group.id, treinoId).catch(() => null);
        if (t) await salvarTreino(t);
      }
      setTreino(t);
      setLoading(false);
    }
    load();
  }, [treinoId, playerId]);

  async function onChange(golpeKey: string, campo: 'bom' | 'ruim', delta: 1 | -1) {
    if (!treino) return;
    const atualizado = ajustarContagem(treino, golpeKey, campo, delta);
    setTreino(atualizado);
    await salvarTreino(atualizado);
    if (group?.id) saveTreinoFs(group.id, atualizado).catch(() => {});
  }

  const analise = treino ? calcularAnaliseTreino(treino) : null;
  const nome = treino ? (findPlayer(treino.playerId)?.name ?? treino.playerId) : '';

  const barData = useMemo(() => {
    if (!treino) return [];
    return TREINO_GOLPES
      .map(g => ({ g, c: treino.contagens[g.key] }))
      .filter(({ c }) => c && (c.bom + c.ruim) > 0)
      .map(({ g, c }) => ({
        value: c!.bom, label: g.label.length > 8 ? g.label.slice(0, 8) : g.label, frontColor: Colors.teal,
      }));
  }, [treino, Colors]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/treino')}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{treino?.titulo ?? 'Análise Individual'}</Text>
          <Text style={s.subtitle} numberOfLines={1}>{nome}</Text>
        </View>
        {treino && (
          <TouchableOpacity style={s.exportBtn} onPress={exportarPdf} disabled={exportando}>
            <Text style={s.exportTxt}>{exportando ? '...' : '⬇ PDF'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <View style={s.center}><Text style={s.hint}>Carregando...</Text></View>
      )}

      {!loading && treino && analise && (
        <>
          <View style={s.tabBar}>
            {(['Golpes', 'Análise'] as Aba[]).map(a => (
              <TouchableOpacity key={a} style={[s.tab, aba === a && s.tabActive]} onPress={() => setAba(a)}>
                <Text style={[s.tabTxt, aba === a && s.tabTxtActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {aba === 'Golpes' && (
            <ScrollView contentContainerStyle={s.scroll}>
              {TREINO_GOLPES.map(g => (
                <GolpeRow
                  key={g.key} treino={treino} golpeKey={g.key} label={g.label}
                  onChange={(campo, delta) => onChange(g.key, campo, delta)}
                />
              ))}
              <View style={{ height: Spacing.xl }} />
            </ScrollView>
          )}

          {aba === 'Análise' && (
            <ScrollView contentContainerStyle={s.scroll}>
              {analise.totalTentativas === 0 ? (
                <View style={s.center}><Text style={s.hint}>Registre alguns golpes para ver a análise.</Text></View>
              ) : (
                <>
                  <View style={s.dashGrid}>
                    <DashCard label="Melhor golpe" value={analise.melhorGolpe?.label ?? '—'} hint={analise.melhorGolpe ? `${analise.melhorGolpe.pct}%` : 'Mín. 4 tentativas'} />
                    <DashCard label="Pior golpe" value={analise.piorGolpe?.label ?? '—'} hint={analise.piorGolpe ? `${analise.piorGolpe.pct}%` : 'Mín. 4 tentativas'} />
                    <DashCard label="Mais utilizado" value={analise.maisUtilizado?.label ?? '—'} hint={analise.maisUtilizado ? `${analise.maisUtilizado.total}x` : undefined} />
                    <DashCard label="Menos utilizado" value={analise.menosUtilizado?.label ?? '—'} hint={analise.menosUtilizado ? `${analise.menosUtilizado.total}x` : undefined} />
                    <DashCard label="Aproveitamento geral" value={`${analise.aproveitamentoGeral}%`} />
                    <DashCard label="Golpes acima de 50%" value={`${analise.golpesAcima50.count} / ${analise.golpesAcima50.total}`} />
                  </View>

                  <View style={s.chartWrap}>
                    <Text style={s.sectionTitle}>Golpes registrados (acertos)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <BarChart
                        data={barData}
                        width={Math.max(300, barData.length * 40)}
                        barWidth={20}
                        spacing={16}
                        hideRules
                        xAxisLabelTextStyle={{ color: Colors.muted, fontSize: 8, fontFamily: FontFamily.body }}
                        yAxisTextStyle={{ color: Colors.muted, fontSize: 9 }}
                        noOfSections={4}
                        barBorderRadius={4}
                      />
                    </ScrollView>
                  </View>
                </>
              )}
            </ScrollView>
          )}
        </>
      )}

      {!loading && !treino && (
        <View style={s.center}><Text style={s.hint}>Análise não encontrada.</Text></View>
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
  back: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  exportBtn: { backgroundColor: Colors.surf2, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.line },
  exportTxt: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.teal },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.line, paddingHorizontal: Spacing.md },
  tab: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.gold },
  tabTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.faint },
  tabTxtActive: { color: Colors.gold },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  hint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  dashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chartWrap: { gap: Spacing.xs },
  sectionTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.gold },
});
