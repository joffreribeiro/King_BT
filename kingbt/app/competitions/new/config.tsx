import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import type { Format, Gender } from '@/logic/types';

const STEPS = ['Formato', 'Ajustes', 'Quem joga', 'Revisar'];

const FORMAT_DEFAULT_NAME: Record<Format, string> = {
  liga: 'Liga', grupos: 'Grupos', mata: 'Mata-mata',
  avulso: 'Avulso', super8: 'Super 8',
};

type Unit = 'individual' | 'duplas';
type Rounds = 'single' | 'double';

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
  const [gender, setGender]   = useState<Gender>('masculino');
  const [rounds, setRounds]   = useState<Rounds>('single');
  const [sets, setSets]       = useState(3);
  const [games, setGames]     = useState(4);
  const [tiebreak, setTiebreak] = useState(7);
  const [groups, setGroups]   = useState(2);
  const [qualifiers, setQualifiers] = useState(2);
  const [location, setLocation] = useState('');
  const [notes, setNotes]     = useState('');
  const [useOfficialRules, setUseOfficialRules]     = useState(true);
  const [superTiebreak, setSuperTiebreak]           = useState(true);
  const [superTiebreakPts, setSuperTiebreakPts]     = useState(10);
  const [tiebreakAt, setTiebreakAt]                 = useState<'deuce' | 'full'>('deuce');
  const [selectedPreset, setSelectedPreset]         = useState<number | null>(0);

  function next() {
    router.push({
      pathname: '/competitions/new/participants',
      params: {
        format, name, unit, gender, rounds,
        sets: String(sets), games: String(games), tiebreak: String(tiebreak),
        tiebreakAt,
        location, notes,
        useOfficialRules: String(useOfficialRules),
        superTiebreak: String(superTiebreak),
        superTiebreakPts: String(superTiebreakPts),
        groups: String(groups), qualifiers: String(qualifiers), thirdPlace: 'false',
      },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/competitions/new/format')} style={styles.backBtn}>
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
              { value: 'duplas', label: 'Duplas' },
            ]}
            value={unit}
            onChange={setUnit}
            descriptions={{
              individual: 'Cada jogador compete individualmente.',
              duplas: 'Dois jogadores formam uma dupla.',
            }}
          />
        </View>

        {/* Gênero */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Categoria</Text>
          <SegmentControl
            options={[
              { value: 'masculino', label: 'Masculino' },
              { value: 'feminino', label: 'Feminino' },
              { value: 'misto', label: 'Misto' },
            ]}
            value={gender}
            onChange={setGender}
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

        {/* Presets de formato de disputa */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Formato de disputa</Text>
          <Text style={[styles.fieldLabel, { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: -4 }]}>
            Escolha um preset ou configure manualmente abaixo
          </Text>
          <View style={preset.grid}>
            {([
              // MD1 ordenado por games
              { label: 'MD1 · 4 games', desc: 'Com tie 7 em 3-3',            sets: 1, games: 4, tb: 7, tbAt: 'deuce', stb: false, stbPts: 10 },
              { label: 'MD1 · 4 games', desc: 'Com tie 7 em 4-4',            sets: 1, games: 4, tb: 7, tbAt: 'full',  stb: false, stbPts: 10 },
              { label: 'MD1 · 6 games', desc: 'Com tie 7 em 5-5',            sets: 1, games: 6, tb: 7, tbAt: 'deuce', stb: false, stbPts: 10 },
              { label: 'MD1 · 7 games', desc: 'Com tie 7 em 6-6',            sets: 1, games: 7, tb: 7, tbAt: 'deuce', stb: false, stbPts: 10 },
              { label: 'MD1 · 8 games', desc: 'Com tie 7 em 8-8',            sets: 1, games: 8, tb: 7, tbAt: 'full',  stb: false, stbPts: 10 },
              { label: 'Super TB · 10', desc: 'Apenas super tie-break',       sets: 1, games: 1, tb: 7, tbAt: 'deuce', stb: true,  stbPts: 10 },
              // MD3 ordenado por games
              { label: 'MD3 · 4 games', desc: 'Com tie 7 em 3-3 e super 10', sets: 3, games: 4, tb: 7, tbAt: 'deuce', stb: true,  stbPts: 10 },
              { label: 'MD3 · 4 games', desc: 'Com tie 7 em 4-4',            sets: 3, games: 4, tb: 7, tbAt: 'full',  stb: false, stbPts: 10 },
              { label: 'MD3 · 6 games', desc: 'Com tie 7 em 5-5 e super 10', sets: 3, games: 6, tb: 7, tbAt: 'deuce', stb: true,  stbPts: 10 },
              { label: 'MD3 · 6 games', desc: 'Com tie 7 em 5-5, sem super', sets: 3, games: 6, tb: 7, tbAt: 'deuce', stb: false, stbPts: 10 },
            ] as { label: string; desc: string; sets: number; games: number; tb: number; tbAt: 'deuce'|'full'; stb: boolean; stbPts: number }[]).map((p, i) => {
              const isActive = selectedPreset === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[preset.card, isActive && preset.cardActive]}
                  onPress={() => {
                    setSelectedPreset(i);
                    setSets(p.sets); setGames(p.games); setTiebreak(p.tb);
                    setTiebreakAt(p.tbAt);
                    setSuperTiebreak(p.stb); setSuperTiebreakPts(p.stbPts);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[preset.label, isActive && preset.labelActive]}>{p.label}</Text>
                  <Text style={[preset.desc, isActive && preset.descActive]}>{p.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Configuração manual */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Configurar manualmente</Text>
          <SegmentControl
            options={[
              { value: '1', label: '1 set' },
              { value: '3', label: 'Melhor de 3' },
              { value: '5', label: 'Melhor de 5' },
            ]}
            value={String(sets)}
            onChange={(v) => setSets(parseInt(v, 10))}
            descriptions={{
              '1': 'Jogo único: vence quem ganhar o set.',
              '3': 'Melhor de 3 sets: vence quem ganhar 2.',
              '5': 'Melhor de 5 sets: vence quem ganhar 3.',
            }}
          />
        </View>
        <View style={styles.field}>
          <Stepper label="Games por set" value={games} min={1} max={12} onChange={v => { setGames(v); setSelectedPreset(null); }} />
        </View>
        <View style={styles.field}>
          <Stepper label="Pontos do tie-break" value={tiebreak} min={5} max={15} onChange={v => { setTiebreak(v); setSelectedPreset(null); }} />
        </View>

        {/* Super tie-break no set decisivo — só para Melhor de 3 ou 5 */}
        {sets > 1 && (
          <View style={styles.field}>
            <TouchableOpacity
              style={tog.row}
              onPress={() => setSuperTiebreak(v => !v)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={tog.label}>Super tie-break no set decisivo</Text>
                <Text style={tog.desc}>
                  {sets}° set substituído por super tie-break a {superTiebreakPts} pts (ganhar por 2)
                </Text>
              </View>
              <View style={[tog.track, superTiebreak && tog.trackOn]}>
                <View style={[tog.thumb, superTiebreak && tog.thumbOn]} />
              </View>
            </TouchableOpacity>
            {superTiebreak && (
              <Stepper label="Pontos do super tie-break" value={superTiebreakPts} min={7} max={15} onChange={setSuperTiebreakPts} />
            )}
          </View>
        )}

        {/* Regras oficiais BT */}
        <View style={styles.field}>
          <TouchableOpacity
            style={tog.row}
            onPress={() => setUseOfficialRules(v => !v)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={tog.label}>Usar regras oficiais BT</Text>
              <Text style={tog.desc}>Valida placares: 6-0..6-4, 7-5, 7-6 (TB)</Text>
            </View>
            <View style={[tog.track, useOfficialRules && tog.trackOn]}>
              <View style={[tog.thumb, useOfficialRules && tog.thumbOn]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Informações (opcional) */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Local / quadras (opcional)</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Ex: Arena Beach — quadras 1 e 2"
            placeholderTextColor={Colors.faint}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Regras / observações (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex: critério de desempate, premiação, horários…"
            placeholderTextColor={Colors.faint}
            multiline
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

const preset = StyleSheet.create({
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card:        { width: '47%', backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, padding: Spacing.sm, gap: 2 },
  cardActive:  { borderColor: Colors.gold, backgroundColor: Colors.gold + '15' },
  label:       { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  labelActive: { color: Colors.gold },
  desc:        { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  descActive:  { color: Colors.gold + 'BB' },
});

const tog = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  label: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  desc: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  track: { width: 46, height: 26, borderRadius: 13, backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line, justifyContent: 'center', paddingHorizontal: 3 },
  trackOn: { backgroundColor: Colors.teal + '44', borderColor: Colors.teal },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.muted },
  thumbOn: { backgroundColor: Colors.teal, alignSelf: 'flex-end' },
});

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
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, paddingBottom: Spacing.lg, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.line },
  btnContinue: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  btnText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
});
