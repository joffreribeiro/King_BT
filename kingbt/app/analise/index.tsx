import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { listarAnalises, type BtAnalise } from '@/logic/btTracker';
import { useAuth } from '@/store/AuthContext';
import { listAnalisesFs } from '@/firebase/analises';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function AnaliseCard({ analise }: { analise: BtAnalise }) {
  const { jogadores, nomes, placarFinal, criadaEm, matchId, competitionId } = analise;
  const nA = `${nomes[jogadores.a1]?.split(' ')[0] ?? jogadores.a1} / ${nomes[jogadores.a2]?.split(' ')[0] ?? jogadores.a2}`.replace('/ ', '').trimEnd();
  const nB = `${nomes[jogadores.b1]?.split(' ')[0] ?? jogadores.b1} / ${nomes[jogadores.b2]?.split(' ')[0] ?? jogadores.b2}`.replace('/ ', '').trimEnd();

  const scoreLabel = placarFinal
    ? `${placarFinal.setsA} × ${placarFinal.setsB} sets`
    : `${analise.pontos.length} pontos`;

  return (
    <TouchableOpacity
      style={card.wrap}
      activeOpacity={0.8}
      onPress={() => router.push({
        pathname: '/analise/[matchId]/relatorio' as any,
        params: { matchId, compId: competitionId },
      })}
    >
      <View style={card.header}>
        <Text style={card.score}>{scoreLabel}</Text>
        <Text style={card.date}>{formatDate(criadaEm)}</Text>
      </View>
      <View style={card.teams}>
        <Text style={[card.team, { color: Colors.gold }]} numberOfLines={1}>{nA}</Text>
        <Text style={card.vs}>×</Text>
        <Text style={[card.team, { color: Colors.teal }]} numberOfLines={1}>{nB}</Text>
      </View>
      <Text style={card.hint}>📊 Ver relatório completo</Text>
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surf, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line,
    padding: Spacing.md, gap: Spacing.xs,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  score: { fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.text },
  date: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  teams: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  team: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13 },
  vs: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.faint },
  hint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted, marginTop: 2 },
});

export default function AnaliseListScreen() {
  const { group } = useAuth();
  const [analises, setAnalises] = useState<BtAnalise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      let list = await listarAnalises();
      // Complementa com Firebase se estiver online
      if (group?.id) {
        try {
          const remote = await listAnalisesFs(group.id);
          const localIds = new Set(list.map(a => a.matchId));
          const novos = remote.filter(a => !localIds.has(a.matchId));
          list = [...list, ...novos];
        } catch { /* offline ou sem permissão */ }
      }
      // Ordena por mais recente primeiro
      list.sort((a, b) => b.criadaEm - a.criadaEm);
      setAnalises(list);
      setLoading(false);
    }
    load();
  }, [group?.id]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Histórico de Análises BT</Text>
      </View>

      {loading && (
        <View style={s.center}>
          <Text style={s.hint}>Carregando análises...</Text>
        </View>
      )}

      {!loading && analises.length === 0 && (
        <View style={s.center}>
          <Text style={{ fontSize: 40, textAlign: 'center' }}>📊</Text>
          <Text style={s.emptyTitle}>Nenhuma análise salva</Text>
          <Text style={s.hint}>
            Registre uma partida com "Analisar ponto a ponto" para criar sua primeira análise.
          </Text>
        </View>
      )}

      {!loading && analises.length > 0 && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {analises.map(a => <AnaliseCard key={a.matchId} analise={a} />)}
          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  back: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 18, color: Colors.text, textAlign: 'center' },
  hint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
