import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import Avatar from '@/components/Avatar';
import { drawPotPairs, splitPots, type PotDraw } from '@/logic/potDraw';

export interface PotCandidate {
  id: string;
  name: string;
  color: string;
  category?: string | null;
  rank?: number | null;
}

interface Props {
  visible: boolean;
  candidates: PotCandidate[];
  onClose: () => void;
  /** Já vêm marcados ao abrir (ex.: quem se inscreveu). */
  preselect?: string[];
  /** Duplas sorteadas, para o chamador adicionar às suas. */
  onUse: (pairs: [string, string][]) => void;
}

/** Sorteio de duplas por potes: 1) escolher quem entra, 2) ver os potes e o sorteio, 3) usar as duplas. */
export function PotsDrawModal({ visible, candidates, preselect, onClose, onUse }: Props) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [sel, setSel] = useState<string[]>([]);
  const [draw, setDraw] = useState<PotDraw | null>(null);

  const byId = useMemo(() => new Map(candidates.map(c => [c.id, c])), [candidates]);
  useEffect(() => {
    if (visible) setSel((preselect ?? []).filter(id => byId.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const chosen = candidates.filter(c => sel.includes(c.id));
  const preview = useMemo(() => splitPots(chosen), [chosen]);
  const first = (id: string) => (byId.get(id)?.name ?? id).split(' ')[0];
  const tag = (id: string) => byId.get(id)?.category ?? '';

  function toggle(id: string) {
    setDraw(null);
    setSel(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }
  function close() { setSel([]); setDraw(null); onClose(); }
  function use() {
    if (!draw) return;
    onUse(draw.pairs);
    setSel([]); setDraw(null);
  }

  const potLine = (ids: string[]) => ids.map(id => `${first(id)}${tag(id) ? ` (${tag(id)})` : ''}`).join(', ') || '—';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={close}>
        <TouchableOpacity style={s.sheet} activeOpacity={1}>
          <Text style={s.title}>Sortear duplas por potes</Text>
          <Text style={s.lead}>
            Os jogadores marcados são separados por nível (categoria e depois ranking): o Pote 1 fica com os mais fortes e o Pote 2 com os demais.
            Cada dupla leva um jogador de cada pote.
          </Text>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <View style={s.head}>
              <Text style={s.count}>{chosen.length} {chosen.length === 1 ? 'marcado' : 'marcados'}</Text>
              <TouchableOpacity onPress={() => { setDraw(null); setSel(sel.length === candidates.length ? [] : candidates.map(c => c.id)); }} hitSlop={8}>
                <Text style={s.link}>{sel.length === candidates.length ? 'Limpar' : 'Marcar todos'}</Text>
              </TouchableOpacity>
            </View>
            <View style={s.chips}>
              {candidates.map(c => {
                const on = sel.includes(c.id);
                return (
                  <TouchableOpacity
                    key={c.id} style={[s.chip, on && s.chipOn]} onPress={() => toggle(c.id)} activeOpacity={0.8}
                    accessibilityRole="button" accessibilityState={{ selected: on }}
                  >
                    <Avatar name={c.name} color={c.color} size={24} />
                    <Text style={[s.chipText, on && { color: C.gold }]} numberOfLines={1}>{c.name.split(' ')[0]}</Text>
                    {c.category ? <Text style={s.chipTag}>{c.category}</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {chosen.length >= 2 && (
              <View style={s.box}>
                <Text style={s.boxTitle}>Pote 1 (mais fortes)</Text>
                <Text style={s.boxText}>{potLine(preview.pot1)}</Text>
                <Text style={[s.boxTitle, { marginTop: Spacing.sm }]}>Pote 2</Text>
                <Text style={s.boxText}>{potLine(preview.pot2)}</Text>
                {preview.leftover ? <Text style={s.warn}>Número ímpar: {first(preview.leftover)} fica sem dupla.</Text> : null}
              </View>
            )}

            {draw && (
              <View style={s.box}>
                <Text style={s.boxTitle}>Duplas sorteadas</Text>
                {draw.pairs.map(([a, b], i) => (
                  <Text key={i} style={s.pair}>Dupla {i + 1}: {first(a)} / {first(b)}</Text>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity style={s.ghost} onPress={close} activeOpacity={0.8}><Text style={s.ghostText}>Cancelar</Text></TouchableOpacity>
            {draw ? (
              <>
                <TouchableOpacity style={s.outline} onPress={() => setDraw(drawPotPairs(chosen))} activeOpacity={0.8}><Text style={s.outlineText}>Sortear de novo</Text></TouchableOpacity>
                <TouchableOpacity style={s.primary} onPress={use} activeOpacity={0.85}><Text style={s.primaryText}>Usar duplas</Text></TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[s.primary, chosen.length < 4 && { opacity: 0.4 }]} disabled={chosen.length < 4}
                onPress={() => setDraw(drawPotPairs(chosen))} activeOpacity={0.85}
              >
                <Text style={s.primaryText}>{chosen.length < 4 ? 'Marque ao menos 4' : 'Sortear'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: C.surf, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.line, padding: Spacing.md, maxWidth: 520, width: '100%', alignSelf: 'center', gap: Spacing.sm },
  title: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 24, color: C.text },
  lead: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: C.muted },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  count: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: C.muted },
  link: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: C.gold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: Radius.full, backgroundColor: C.surf2, borderWidth: 1, borderColor: C.line },
  chipOn: { borderColor: C.gold, backgroundColor: C.gold + '1F' },
  chipText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: C.text, maxWidth: 110 },
  chipTag: { fontFamily: FontFamily.numberBold, fontSize: 12, color: C.faint },
  box: { backgroundColor: C.surf2, borderRadius: Radius.md, borderWidth: 1, borderColor: C.line, padding: Spacing.md, marginTop: Spacing.sm },
  boxTitle: { fontFamily: FontFamily.titleBold, fontSize: 13, letterSpacing: 1, color: C.gold, textTransform: 'uppercase' },
  boxText: { fontFamily: FontFamily.body, fontSize: 15, lineHeight: 22, color: C.text, marginTop: 2 },
  warn: { fontFamily: FontFamily.body, fontSize: 14, color: C.coral, marginTop: Spacing.sm },
  pair: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.text, marginTop: 4 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  ghost: { minHeight: 48, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.muted },
  outline: { flex: 1, minHeight: 48, borderRadius: Radius.full, borderWidth: 1, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.gold },
  primary: { flex: 1, minHeight: 48, borderRadius: Radius.full, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FontFamily.titleBold, fontSize: 15, color: C.bg },
});
