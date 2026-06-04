import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card, Button } from '@/components';
import { PLAYERS } from '@/mocks/data';
import type { Format } from '@/logic/types';

export default function ParticipantsStep() {
  const params = useLocalSearchParams<{ format: Format; dbl: string; groups: string; qualifiers: string; thirdPlace: string }>();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const canNext = selected.length >= 4;
  const estGames = selected.length >= 4
    ? Math.ceil(selected.length * (selected.length - 1) / 4)
    : 0;

  function next() {
    if (!canNext) return;
    router.push({
      pathname: '/competitions/new/review',
      params: { ...params, playerIds: selected.join(',') },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>

        <View style={styles.wizard}>
          {[1,2,3,4].map(n => (
            <View key={n} style={[styles.step, n === 3 && styles.stepActive, n < 3 && styles.stepDone]}>
              <Text style={[styles.stepNum, (n === 3 || n < 3) && styles.stepNumActive]}>
                {n < 3 ? '✓' : n}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.title}>Participantes</Text>
        <Text style={styles.subtitle}>
          {selected.length} selecionados{canNext ? ` · ~${estGames} jogos` : ' · mínimo 4'}
        </Text>

        <View style={styles.grid}>
          {PLAYERS.map(pl => {
            const on = selected.includes(pl.id);
            return (
              <TouchableOpacity key={pl.id} onPress={() => toggle(pl.id)} activeOpacity={0.8}
                style={[styles.playerCard, on && styles.playerCardOn]}>
                <Avatar name={pl.name} color={pl.color} size={44} />
                <Text style={[styles.playerName, on && { color: Colors.gold }]}>{pl.name}</Text>
                <Text style={styles.playerEmoji}>{pl.titleEmoji}</Text>
                {on && (
                  <View style={styles.check}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {/* Convidado */}
          <TouchableOpacity style={styles.guestCard}>
            <Text style={styles.guestPlus}>+</Text>
            <Text style={styles.guestLabel}>Convidado</Text>
          </TouchableOpacity>
        </View>

        <Button label={canNext ? 'Próximo: Revisão →' : 'Selecione 4+ jogadores'} onPress={next} fullWidth disabled={!canNext} />
        <View style={{ height: Spacing.xl }} />
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
  stepDone: { backgroundColor: Colors.teal },
  stepNum: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.faint },
  stepNumActive: { color: Colors.bg },
  title: { fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, marginTop: -Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  playerCard: {
    width: '47%', backgroundColor: Colors.surf, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.line, padding: Spacing.md,
    alignItems: 'center', gap: Spacing.xs,
  },
  playerCardOn: { borderColor: Colors.gold, backgroundColor: Colors.gold + '11' },
  playerName: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text, textAlign: 'center' },
  playerEmoji: { fontSize: 18 },
  check: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  checkText: { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.bg },
  guestCard: {
    width: '47%', backgroundColor: Colors.surf, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.line, borderStyle: 'dashed',
    padding: Spacing.md, alignItems: 'center', justifyContent: 'center',
    gap: Spacing.xs, minHeight: 110,
  },
  guestPlus: { fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.faint },
  guestLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint },
});
