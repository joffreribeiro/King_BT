import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar } from '@/components';
import { PLAYERS } from '@/mocks/data';
import type { Format } from '@/logic/types';

const STEPS = ['Formato', 'Ajustes', 'Quem joga', 'Revisar'];

type Params = {
  format: Format; name: string; unit: string; rounds: string;
  winMode: string; target: string; groups: string; qualifiers: string; thirdPlace: string;
};

export default function ParticipantsStep() {
  const params = useLocalSearchParams<Params>();
  const isDuplas = params.unit === 'duplas';

  // Modo individual — selecionar jogadores
  const [selected, setSelected] = useState<string[]>([]);
  // Modo duplas — pares montados
  const [pairs, setPairs] = useState<[string, string][]>([]);
  const [pairBuf, setPairBuf] = useState<string | null>(null); // primeiro jogador da dupla em formação

  function togglePlayer(id: string) {
    if (!isDuplas) {
      setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      return;
    }
    // Modo duplas: dois toques = 1 dupla
    if (pairBuf === null) {
      setPairBuf(id);
    } else if (pairBuf === id) {
      setPairBuf(null);
    } else {
      setPairs(prev => [...prev, [pairBuf, id]]);
      setPairBuf(null);
    }
  }

  function removePair(i: number) {
    setPairs(prev => prev.filter((_, idx) => idx !== i));
  }

  const canContinue = isDuplas ? pairs.length >= 2 : selected.length >= 4;
  const usedInPair = pairs.flat();

  function next() {
    if (!canContinue) return;
    const ids = isDuplas
      ? pairs.map(([a, b]) => `${a}+${b}`).join(',')
      : selected.join(',');
    router.push({
      pathname: '/competitions/new/review',
      params: { ...params, playerIds: ids },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova competição</Text>
      </View>

      {/* Steps */}
      <View style={styles.stepBar}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepLine, i <= 2 && styles.stepLineActive]} />
            <Text style={[styles.stepLabel, i === 2 && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Título */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {isDuplas ? 'Monte as duplas' : 'Quem vai jogar'}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {isDuplas ? pairs.length : selected.length}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {isDuplas
            ? 'Toque em dois jogadores para formar uma dupla.'
            : `Selecione os participantes. Mínimo 4.`}
        </Text>

        {/* Duplas formadas */}
        {isDuplas && pairs.length > 0 && (
          <View style={styles.pairsGrid}>
            {pairs.map(([a, b], i) => {
              const pA = PLAYERS.find(p => p.id === a)!;
              const pB = PLAYERS.find(p => p.id === b)!;
              return (
                <TouchableOpacity key={i} style={styles.pairChip} onPress={() => removePair(i)}>
                  <Avatar name={pA.name} color={pA.color} size={24} />
                  <Text style={styles.pairText}>{pA.name.split(' ')[0]}/{pB.name.split(' ')[0]}</Text>
                  <Text style={styles.pairRemove}>✕</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Grid de jogadores */}
        <View style={styles.grid}>
          {PLAYERS.map(pl => {
            const isSelected = isDuplas
              ? usedInPair.includes(pl.id) || pairBuf === pl.id
              : selected.includes(pl.id);
            const isPairBuf = pairBuf === pl.id;
            const isUsed = usedInPair.includes(pl.id);

            return (
              <TouchableOpacity
                key={pl.id}
                style={[
                  styles.playerCard,
                  isSelected && !isPairBuf && styles.playerCardSelected,
                  isPairBuf && styles.playerCardBuf,
                  isUsed && styles.playerCardUsed,
                ]}
                onPress={() => togglePlayer(pl.id)}
                disabled={isDuplas && isUsed}
                activeOpacity={0.75}
              >
                <Avatar name={pl.name} color={pl.color} size={36} />
                <Text style={[styles.playerName, isSelected && { color: Colors.gold }]} numberOfLines={1}>
                  {pl.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Instrução modo duplas */}
        {isDuplas && pairBuf && (
          <View style={styles.bufHint}>
            <Text style={styles.bufHintText}>
              {PLAYERS.find(p => p.id === pairBuf)?.name} selecionado — toque no parceiro
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btnContinue, !canContinue && styles.btnDisabled]}
          onPress={next}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, !canContinue && styles.btnTextDisabled]}>
            {canContinue
              ? 'Continuar'
              : isDuplas ? 'Mínimo 2 duplas' : 'Mínimo 4 jogadores'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, lineHeight: 24 },
  headerTitle: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.text },
  stepBar: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs, gap: Spacing.xs },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepLine: { height: 3, width: '100%', borderRadius: 2, backgroundColor: Colors.surf2 },
  stepLineActive: { backgroundColor: Colors.gold },
  stepLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  stepLabelActive: { color: Colors.gold, fontFamily: FontFamily.bodyMed },
  scroll: { padding: Spacing.md, gap: Spacing.md },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text },
  countBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.gold },
  subtitle: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, marginTop: -Spacing.xs },

  pairsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pairChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surf2, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: Colors.gold + '44' },
  pairText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  pairRemove: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.coral, marginLeft: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  playerCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surf,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.line,
    padding: Spacing.sm + 2,
  },
  playerCardSelected: { borderColor: Colors.gold, backgroundColor: Colors.surf2 },
  playerCardBuf: { borderColor: Colors.teal, backgroundColor: Colors.teal + '11' },
  playerCardUsed: { opacity: 0.4 },
  playerName: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },

  bufHint: { backgroundColor: Colors.teal + '22', borderRadius: Radius.sm, padding: Spacing.sm, alignItems: 'center' },
  bufHintText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.teal },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, paddingBottom: Spacing.lg, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.line },
  btnContinue: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  btnDisabled: { backgroundColor: Colors.surf2 },
  btnText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
  btnTextDisabled: { color: Colors.faint },
});
