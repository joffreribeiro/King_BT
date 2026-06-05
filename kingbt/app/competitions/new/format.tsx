import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import type { Format } from '@/logic/types';

const STEPS = ['Formato', 'Ajustes', 'Quem joga', 'Revisar'];

const FORMATS: {
  id: Format;
  label: string;
  desc: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    id: 'liga',
    label: 'Liga',
    desc: 'Todos jogam contra todos. Gera um ranking por pontos.',
    icon: '≡',
    iconBg: '#1a2e1a',
    iconColor: '#54B981',
  },
  {
    id: 'grupos',
    label: 'Grupos + Eliminatórias',
    desc: 'Divide em grupos; os melhores avançam para o chaveamento.',
    icon: '⊞',
    iconBg: '#1a1a2e',
    iconColor: '#6B7FD7',
  },
  {
    id: 'mata',
    label: 'Mata-mata',
    desc: 'Quem perde está fora. Direto à final.',
    icon: '⇌',
    iconBg: '#2e1a1a',
    iconColor: '#E5483D',
  },
  {
    id: 'avulso',
    label: 'Avulso',
    desc: 'Parceiros rotacionam: todos jogam com todos.',
    icon: '✕',
    iconBg: '#1a2a2e',
    iconColor: '#2DD4BF',
  },
  {
    id: 'super8',
    label: 'Super 8',
    desc: '8 jogadores, parceiros rotativos, ranking individual.',
    icon: '◈',
    iconBg: '#2a1a2e',
    iconColor: '#C084FC',
  },
];

export default function FormatStep() {
  const [selected, setSelected] = useState<Format | null>(null);

  function next() {
    if (!selected) return;
    router.push({ pathname: '/competitions/new/config', params: { format: selected } });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(app)')} style={styles.closeBtn}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova competição</Text>
      </View>

      {/* Barra de progresso */}
      <View style={styles.stepBar}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepLine, i === 0 && styles.stepLineActive]} />
            <Text style={[styles.stepLabel, i === 0 && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Escolha o formato</Text>
        <Text style={styles.subtitle}>Cada formato monta os jogos de um jeito.</Text>

        <View style={styles.list}>
          {FORMATS.map(f => {
            const isSelected = selected === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(f.id)}
                activeOpacity={0.8}
              >
                {/* Ícone */}
                <View style={[styles.icon, { backgroundColor: f.iconBg }]}>
                  <Text style={[styles.iconText, { color: f.iconColor }]}>{f.icon}</Text>
                </View>

                {/* Texto */}
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardLabel, isSelected && { color: Colors.gold }]}>
                    {f.label}
                  </Text>
                  <Text style={styles.cardDesc}>{f.desc}</Text>
                </View>

                {/* Radio */}
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Botão fixo no rodapé */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btnContinue, !selected && styles.btnDisabled]}
          onPress={next}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, !selected && styles.btnTextDisabled]}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surf2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontFamily: FontFamily.titleBold,
    fontSize: 14,
    color: Colors.text,
  },
  headerTitle: {
    fontFamily: FontFamily.title,
    fontSize: 17,
    color: Colors.text,
  },

  // Steps
  stepBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepLine: { height: 3, width: '100%', borderRadius: 2, backgroundColor: Colors.surf2 },
  stepLineActive: { backgroundColor: Colors.gold },
  stepLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  stepLabelActive: { color: Colors.gold, fontFamily: FontFamily.bodyMed },

  // Scroll
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  title: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, marginTop: -Spacing.xs },
  list: { gap: Spacing.sm, marginTop: Spacing.sm },

  // Card de formato
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surf,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.line,
    padding: Spacing.md,
  },
  cardSelected: {
    borderColor: Colors.gold + '88',
    backgroundColor: Colors.surf2,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 26, fontWeight: '700' },
  cardInfo: { flex: 1, gap: 3 },
  cardLabel: {
    fontFamily: FontFamily.title,
    fontSize: 15,
    color: Colors.text,
  },
  cardDesc: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.muted,
    lineHeight: 17,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.gold },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.gold,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  btnContinue: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  btnDisabled: {
    backgroundColor: Colors.surf2,
  },
  btnText: {
    fontFamily: FontFamily.title,
    fontSize: 16,
    color: Colors.bg,
  },
  btnTextDisabled: {
    color: Colors.faint,
  },
});
