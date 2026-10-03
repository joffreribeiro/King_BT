import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useSettings } from '@/store/SettingsContext';
import { Card } from '@/components';
import { setCategoryCuts } from '@/firebase/categoryCuts';
import { CUT_ORDER, DEFAULT_CATEGORY_CUTS, isValidCategoryCuts, type CategoryCuts } from '@/logic/categorySuggestion';

type Form = Record<(typeof CUT_ORDER)[number], string>;
const toForm = (c: CategoryCuts): Form => ({ Open: String(c.Open), A: String(c.A), B: String(c.B), C: String(c.C), D: String(c.D) });
const toNum = (f: Form): Record<string, number> => Object.fromEntries(CUT_ORDER.map(k => [k, Number(f[k].trim())]));

/** Admin: nota mínima (de 1 a 100) para cada categoria na sugestão pela avaliação. Abaixo de D é Iniciante. */
export function CategoryCutsCard() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { group, isAdmin } = useAuth();
  const { categoryCuts } = useSettings();
  const [form, setForm] = useState<Form>(toForm(categoryCuts));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (!saving) setForm(toForm(categoryCuts)); }, [categoryCuts, saving]);

  if (!group || !isAdmin) return null;

  const valid = isValidCategoryCuts(toNum(form));

  async function save() {
    setSaving(true); setMsg(null);
    try {
      await setCategoryCuts(group!.id, toNum(form) as unknown as CategoryCuts);
      setMsg('Salvo. As sugestões já foram recalculadas.');
    } catch {
      setMsg('Não foi possível salvar. Verifique a conexão e tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <Text style={s.title}>Categorias pela avaliação</Text>
      <Text style={s.sectionHint}>
        Nota mínima (de 1 a 100) para cada categoria na sugestão que o app faz a partir da autoavaliação e da avaliação dos colegas. Abaixo da nota de D, o jogador é Iniciante. Cada nota precisa ser menor que a da categoria acima. Vale só para este grupo.
      </Text>
      <Card style={{ gap: Spacing.xs }}>
        {CUT_ORDER.map(k => (
          <View style={s.field} key={k}>
            <Text style={s.label}>{k}</Text>
            <TextInput
              style={[s.input, !/^\d{1,3}$/.test(form[k].trim()) && { borderColor: Colors.coral }]}
              value={form[k]}
              onChangeText={t => setForm(f => ({ ...f, [k]: t.replace(/[^0-9]/g, '').slice(0, 3) }))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.faint}
            />
          </View>
        ))}
        {!valid && <Text style={[s.hint, { color: Colors.coral }]}>Use notas de 1 a 100, cada uma menor que a da categoria acima (Open &gt; A &gt; B &gt; C &gt; D).</Text>}
        {!!msg && <Text style={[s.hint, { color: msg.startsWith('Salvo') ? Colors.teal : Colors.coral }]}>{msg}</Text>}
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
          <TouchableOpacity style={[s.save, (!valid || saving) && { opacity: 0.4 }]} onPress={save} disabled={!valid || saving} accessibilityRole="button">
            <Text style={s.saveText}>{saving ? 'Salvando…' : 'Salvar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.reset} onPress={() => setForm(toForm(DEFAULT_CATEGORY_CUTS))} accessibilityRole="button">
            <Text style={s.resetText}>Restaurar padrão</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  title: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text, marginBottom: 4 },
  sectionHint: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 18, color: Colors.muted, marginBottom: Spacing.sm },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontFamily: FontFamily.bodyMed, fontSize: 16, color: Colors.text },
  hint: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  input: { width: 72, minHeight: 42, textAlign: 'center', fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.text, backgroundColor: Colors.surf2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line },
  save: { flex: 1, minHeight: 46, borderRadius: Radius.full, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: FontFamily.titleBold, fontSize: 15, color: Colors.bg },
  reset: { minHeight: 46, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
});
