import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import type { Format } from '@/logic/types';

const STEPS = ['Formato', 'Ajustes', 'Quem joga', 'Revisar'];

const FORMAT_DEFAULT_NAME: Record<Format, string> = {
  liga: 'Liga', grupos: 'Grupos', mata: 'Mata-mata',
  avulso: 'Avulso', super8: 'Super 8',
};

type Unit = 'individual' | 'duplas';
type Rounds = 'single' | 'double';
type WinMode = 'games' | 'sets' | 'points';

function SegmentControl<T extends string>({
  options, value, onChange, descriptions,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  descriptions?: Partial<Record<T, string>>;
}) {
  return (
    <View style={seg.wrap}>
      <View style={seg.bar}>
        {options.map(o => (
          <TouchableOpacity
            key={o.value}
            style={[seg.btn, value === o.value && seg.btnActive]}
            onPress={() => onChange(o.value)}
            activeOpacity={0.8}
          >
            <Text style={[seg.text, value === o.value && seg.textActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {descriptions?.[value] && (
        <Text style={seg.desc}>{descriptions[value]}</Text>
      )}
    </View>
  );
}
const seg = StyleSheet.create({
  wrap: { gap: 6 },
  bar: { flexDirection: 'row', backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: 3 },
  btn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.sm - 2 },
  btnActive: { backgroundColor: Colors.gold },
  text: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  textActive: { color: Colors.bg },
  desc: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, paddingLeft: 2 },
});

function Stepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <View style={stp.row}>
      <Text style={stp.label}>{label}</Text>
      <View style={stp.controls}>
        <TouchableOpacity style={stp.btn} onPress={() => onChange(Math.max(min, value - 1))}>
          <Text style={stp.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={stp.val}>{value}</Text>
        <TouchableOpacity style={stp.btn} onPress={() => onChange(Math.min(max, value + 1))}>
          <Text style={stp.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const stp = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.text },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  btn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.text, lineHeight: 26 },
  val: { fontFamily: FontFamily.numberBold, fontSize: 22, color: Colors.text, minWidth: 28, textAlign: 'center' },
});

export default function ConfigStep() {
  const { format } = useLocalSearchParams<{ format: Format }>();
  const [name, setName]       = useState(FORMAT_DEFAULT_NAME[format] ?? 'Competição');
  const [unit, setUnit]       = useState<Unit>('individual');
  const [rounds, setRounds]   = useState<Rounds>('single');
  const [winMode, setWinMode] = useState<WinMode>('games');
  const [target, setTarget]   = useState(6);
  const [groups, setGroups]   = useState(2);
  const [qualifiers, setQualifiers] = useState(2);

  const winLabel: Record<WinMode, string> = {
    games: 'games', sets: 'sets', points: 'pontos',
  };

  function next() {
    router.push({
      pathname: '/competitions/new/participants',
      params: {
        format,
        name,
        unit,
        rounds,
        winMode,
        target: String(target),
        groups: String(groups),
        qualifiers: String(qualifiers),
        thirdPlace: 'false',
      },
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
            <View style={[styles.stepLine, i <= 1 && styles.stepLineActive]} />
            <Text style={[styles.stepLabel, i === 1 && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Nome */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Nome da competição</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholderTextColor={Colors.faint}
          />
        </View>

        {/* Tipo de competidor */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>
            Tipo de competidor
            {unit === 'duplas' && <Text style={styles.required}>*</Text>}
          </Text>
          <SegmentControl
            options={[
              { value: 'individual', label: 'Individual' },
              { value: 'duplas', label: 'Duplas fixas' },
            ]}
            value={unit}
            onChange={setUnit}
            descriptions={{
              individual: 'Cada jogador compete individualmente.',
              duplas: 'Você inscreve as duplas; elas competem entre si.',
            }}
          />
        </View>

        {/* Turnos — só para liga e grupos */}
        {(format === 'liga' || format === 'grupos') && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Turnos</Text>
            <SegmentControl
              options={[
                { value: 'single', label: 'Turno único' },
                { value: 'double', label: 'Ida e volta' },
              ]}
              value={rounds}
              onChange={setRounds}
              descriptions={{
                single: 'Turno único: cada confronto uma vez.',
                double: 'Ida e volta: cada confronto acontece duas vezes.',
              }}
            />
          </View>
        )}

        {/* Grupos config */}
        {format === 'grupos' && (
          <>
            <View style={styles.field}>
              <Stepper label="Número de grupos" value={groups} min={2} max={6} onChange={setGroups} />
            </View>
            <View style={styles.field}>
              <Stepper label="Classificados por grupo" value={qualifiers} min={1} max={4} onChange={setQualifiers} />
            </View>
          </>
        )}

        {/* Como vencer */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Como vencer cada jogo</Text>
          <SegmentControl
            options={[
              { value: 'games', label: 'Games' },
              { value: 'sets', label: 'Sets' },
              { value: 'points', label: 'Tie-break' },
            ]}
            value={winMode}
            onChange={setWinMode}
          />
        </View>

        {/* Target */}
        <View style={styles.field}>
          <Stepper
            label={`${winMode === 'sets' ? 'Melhor de quantos' : 'Até quantos'} ${winLabel[winMode]}`}
            value={target}
            min={1}
            max={winMode === 'sets' ? 5 : 21}
            onChange={setTarget}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.btnContinue} onPress={next} activeOpacity={0.85}>
          <Text style={styles.btnText}>Continuar</Text>
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
  scroll: { padding: Spacing.md, gap: Spacing.lg },
  field: { gap: Spacing.sm },
  fieldLabel: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  required: { color: Colors.coral },
  input: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: FontFamily.body, fontSize: 15, color: Colors.text },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, paddingBottom: Spacing.lg, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.line },
  btnContinue: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  btnText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
});
