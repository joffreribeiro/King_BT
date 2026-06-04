import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Card } from '@/components';
import type { Format } from '@/logic/types';

const FORMATS: { id: Format; label: string; icon: string; desc: string }[] = [
  { id: 'avulso',  label: 'Americano',    icon: '🔄', desc: 'Duplas rotativas — todos jogam com todos. Ideal para grupos.' },
  { id: 'liga',    label: 'Liga',         icon: '📋', desc: 'Round-robin simples ou ida e volta. Classificação por pontos.' },
  { id: 'grupos',  label: 'Grupos + KO',  icon: '🗂️', desc: 'Fase de grupos seguida de mata-mata. Até 6 grupos.' },
  { id: 'mata',    label: 'Mata-Mata',    icon: '⚔️', desc: 'Eliminatória direta. Chave automática por seed.' },
  { id: 'super8',  label: 'Super 8',      icon: '8️⃣', desc: '8 jogadores, americano completo. Formato especial.' },
];

export default function FormatStep() {
  function pick(f: Format) {
    router.push({ pathname: '/competitions/new/config', params: { format: f } });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Cancelar</Text>
        </TouchableOpacity>

        <View style={styles.wizard}>
          {[1,2,3,4].map(n => (
            <View key={n} style={[styles.step, n === 1 && styles.stepActive]}>
              <Text style={[styles.stepNum, n === 1 && styles.stepNumActive]}>{n}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.title}>Escolha o Formato</Text>
        <Text style={styles.subtitle}>Como a competição vai funcionar?</Text>

        <View style={styles.list}>
          {FORMATS.map(f => (
            <TouchableOpacity key={f.id} onPress={() => pick(f.id)} activeOpacity={0.8}>
              <Card style={styles.fmtCard} elevated>
                <Text style={styles.fmtIcon}>{f.icon}</Text>
                <View style={styles.fmtInfo}>
                  <Text style={styles.fmtLabel}>{f.label}</Text>
                  <Text style={styles.fmtDesc}>{f.desc}</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  back: { paddingBottom: Spacing.sm },
  backText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.teal },
  wizard: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  step: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  stepActive: { backgroundColor: Colors.gold },
  stepNum: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.faint },
  stepNumActive: { color: Colors.bg },
  title: { fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, marginTop: -Spacing.sm },
  list: { gap: Spacing.sm },
  fmtCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  fmtIcon: { fontSize: 32, width: 40 },
  fmtInfo: { flex: 1 },
  fmtLabel: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  fmtDesc: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: 2 },
  arrow: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.faint },
});
