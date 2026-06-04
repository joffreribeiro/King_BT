import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, FontFamily, Spacing } from '@/theme';
import { Avatar, Card, Button } from '@/components';
import { PLAYERS } from '@/mocks/data';
import { buildCompetition } from '@/logic/formats';
import { addCompetition } from '@/mocks/competitionStore';
import type { Format } from '@/logic/types';

const FORMAT_LABEL: Record<Format, string> = {
  avulso: 'Americano (duplas rotativas)', liga: 'Liga', grupos: 'Grupos + Eliminatórias',
  mata: 'Mata-Mata', super8: 'Super 8',
};

export default function ReviewStep() {
  const p = useLocalSearchParams<{
    format: Format; dbl: string; groups: string; qualifiers: string;
    thirdPlace: string; playerIds: string;
  }>();

  const playerIds = p.playerIds?.split(',') ?? [];
  const players = playerIds.map(id => PLAYERS.find(pl => pl.id === id)!).filter(Boolean);

  const comp = buildCompetition({
    name: `${FORMAT_LABEL[p.format]} — ${new Date().toLocaleDateString('pt-BR')}`,
    format: p.format,
    unit: 'individual',
    competitors: players.map(pl => ({
      id: pl.id, name: pl.name, short: pl.name.slice(0,3).toUpperCase(),
      color: pl.color, members: [pl.id],
    })),
    config: {
      rounds: p.dbl === 'true' ? 'double' : 'single',
      groups: parseInt(p.groups ?? '2'),
      qualifiers: parseInt(p.qualifiers ?? '2'),
      thirdPlace: p.thirdPlace === 'true',
      winRule: { mode: 'games', target: 6 },
    },
  });

  function start() {
    addCompetition(comp);
    router.replace({ pathname: '/competitions/[id]', params: { id: comp.id } });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>

        <View style={styles.wizard}>
          {[1,2,3,4].map(n => (
            <View key={n} style={[styles.step, n === 4 && styles.stepActive, n < 4 && styles.stepDone]}>
              <Text style={[styles.stepNum, (n === 4 || n < 4) && styles.stepNumActive]}>
                {n < 4 ? '✓' : n}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.title}>Revisar e Gerar</Text>

        <Card style={styles.summary}>
          <Row label="Formato" value={FORMAT_LABEL[p.format]} />
          <Row label="Jogadores" value={String(players.length)} />
          <Row label="Jogos gerados" value={String(comp.matches.length)} />
          {p.dbl === 'true' && <Row label="Turno" value="Ida e Volta" />}
          {p.thirdPlace === 'true' && <Row label="Disputa 3º" value="Sim" />}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Participantes</Text>
          <View style={styles.playerRow}>
            {players.map(pl => (
              <View key={pl.id} style={styles.playerItem}>
                <Avatar name={pl.name} color={pl.color} size={36} />
                <Text style={styles.playerName}>{pl.name.split(' ')[0]}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Button label="🎾 Iniciar Competição" onPress={start} fullWidth size="lg" />
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rw.row}>
      <Text style={rw.label}>{label}</Text>
      <Text style={rw.value}>{value}</Text>
    </View>
  );
}
const rw = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.line },
  label: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  value: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  back: { paddingBottom: Spacing.sm },
  backText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.teal },
  wizard: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  step: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  stepActive: { backgroundColor: Colors.gold },
  stepDone: { backgroundColor: Colors.teal },
  stepNum: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.faint },
  stepNumActive: { color: Colors.bg },
  title: { fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.text },
  summary: { gap: 0, padding: Spacing.md },
  sectionTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text, marginBottom: Spacing.sm },
  playerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  playerItem: { alignItems: 'center', gap: 4 },
  playerName: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
});
