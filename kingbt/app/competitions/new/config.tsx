import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Card, Button } from '@/components';
import type { Format } from '@/logic/types';

export default function ConfigStep() {
  const { format } = useLocalSearchParams<{ format: Format }>();
  const [dbl, setDbl] = useState(false);
  const [groups, setGroups] = useState(2);
  const [qualifiers, setQualifiers] = useState(2);
  const [thirdPlace, setThirdPlace] = useState(false);

  function next() {
    router.push({
      pathname: '/competitions/new/participants',
      params: { format, dbl: String(dbl), groups: String(groups), qualifiers: String(qualifiers), thirdPlace: String(thirdPlace) },
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
            <View key={n} style={[styles.step, n === 2 && styles.stepActive]}>
              <Text style={[styles.stepNum, n === 2 && styles.stepNumActive]}>{n}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.title}>Configurações</Text>

        <Card style={styles.section}>
          {(format === 'liga' || format === 'grupos') && (
            <Row label="Ida e Volta" desc="Cada dupla de adversários se enfrenta duas vezes">
              <Switch value={dbl} onValueChange={setDbl} trackColor={{ true: Colors.gold }} />
            </Row>
          )}

          {format === 'grupos' && (
            <>
              <Row label="Grupos" desc={`${groups} grupos`}>
                <Stepper value={groups} min={2} max={6} onChange={setGroups} />
              </Row>
              <Row label="Classificados/Grupo" desc={`${qualifiers} por grupo`}>
                <Stepper value={qualifiers} min={1} max={4} onChange={setQualifiers} />
              </Row>
            </>
          )}

          {(format === 'mata' || format === 'grupos') && (
            <Row label="Disputa de 3º Lugar" desc="Adiciona partida extra pelo bronze">
              <Switch value={thirdPlace} onValueChange={setThirdPlace} trackColor={{ true: Colors.gold }} />
            </Row>
          )}

          {(format === 'avulso' || format === 'super8') && (
            <View style={styles.info}>
              <Text style={styles.infoText}>
                O Americano gera automaticamente o número ideal de jogos para cobrir todas as combinações de duplas.
              </Text>
            </View>
          )}
        </Card>

        <Button label="Próximo: Participantes →" onPress={next} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <View style={row.wrap}>
      <View style={row.info}>
        <Text style={row.label}>{label}</Text>
        <Text style={row.desc}>{desc}</Text>
      </View>
      {children}
    </View>
  );
}
const row = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line },
  info: { flex: 1, gap: 2 },
  label: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  desc: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
});

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <View style={stp.row}>
      <TouchableOpacity style={stp.btn} onPress={() => onChange(Math.max(min, value - 1))}>
        <Text style={stp.btnText}>−</Text>
      </TouchableOpacity>
      <Text style={stp.val}>{value}</Text>
      <TouchableOpacity style={stp.btn} onPress={() => onChange(Math.min(max, value + 1))}>
        <Text style={stp.btnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
const stp = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  btn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.gold, lineHeight: 24 },
  val: { fontFamily: FontFamily.numberBold, fontSize: 18, color: Colors.text, width: 28, textAlign: 'center' },
});

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
  section: { gap: 0, padding: 0, paddingHorizontal: Spacing.md },
  info: { paddingVertical: Spacing.md },
  infoText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, lineHeight: 20 },
});
