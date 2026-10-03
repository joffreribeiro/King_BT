import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useSettings } from '@/store/SettingsContext';
import { Card } from '@/components';
import { setXpConfig } from '@/firebase/xpConfig';
import { DEFAULT_XP_CONFIG, validateXpConfig, type XpConfig } from '@/logic/xpConfig';
import { playerXp, playerLevel } from '@/logic/playerLevel';
import { RARITY_LABEL, RARITY_ORDER, type Rarity } from '@/constants/rarity';

type Form = { game: string; win: string; event: string; rating: string; honor: string; rarity: Record<Rarity, string> };

const toForm = (c: XpConfig): Form => ({
  game: String(c.game), win: String(c.win), event: String(c.event), rating: String(c.rating), honor: String(c.honor),
  rarity: Object.fromEntries(RARITY_ORDER.map(k => [k, String(c.rarity[k])])) as Record<Rarity, string>,
});

const num = (v: string) => Number(v.trim());
const ok = (v: string) => /^\d{1,3}$/.test(v.trim()) && num(v) <= 999;

/** Admin: quanto XP cada ação rende neste grupo. O XP decide o nível dos jogadores. */
export function XpConfigCard() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { group, isAdmin } = useAuth();
  const { xpConfig } = useSettings();
  const [form, setForm] = useState<Form>(toForm(xpConfig));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (!saving) setForm(toForm(xpConfig)); }, [xpConfig, saving]);

  if (!group || !isAdmin) return null;

  const allOk = ok(form.game) && ok(form.win) && ok(form.event) && ok(form.rating) && ok(form.honor) && RARITY_ORDER.every(k => ok(form.rarity[k]));

  // Exemplo vivo para calibrar: o que um jogador "médio" ganharia com os valores digitados.
  const example = (() => {
    if (!allOk) return null;
    const cfg = validateXpConfig({
      game: num(form.game), win: num(form.win), event: num(form.event), rating: num(form.rating), honor: num(form.honor),
      rarity: Object.fromEntries(RARITY_ORDER.map(k => [k, num(form.rarity[k])])),
    });
    const x = playerXp(20, undefined, null, { wins: 12, events: 4, rated: 5, achievementXp: 3 * cfg.rarity.comum + cfg.rarity.rara }, cfg);
    return { xp: x.xp, level: playerLevel(x.xp).name };
  })();

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const cfg = validateXpConfig({
        game: num(form.game), win: num(form.win), event: num(form.event), rating: num(form.rating), honor: num(form.honor),
        rarity: Object.fromEntries(RARITY_ORDER.map(k => [k, num(form.rarity[k])])),
      });
      await setXpConfig(group!.id, cfg);
      setMsg('Salvo. Os níveis já foram recalculados.');
    } catch {
      setMsg('Não foi possível salvar. Verifique a conexão e tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, value: string, onChange: (t: string) => void, hint?: string) => (
    <View style={s.field} key={label}>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        {!!hint && <Text style={s.hint}>{hint}</Text>}
      </View>
      <TextInput
        style={[s.input, !ok(value) && { borderColor: Colors.coral }]}
        value={value}
        onChangeText={t => onChange(t.replace(/[^0-9]/g, '').slice(0, 3))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={Colors.faint}
      />
    </View>
  );

  return (
    <View>
      <Text style={s.title}>XP e níveis</Text>
      <Text style={s.sectionHint}>Quanto XP cada ação rende. O XP total de cada jogador decide o nível dele. Vale só para este grupo.</Text>
      <Card style={{ gap: Spacing.xs }}>
        {field('Jogo disputado', form.game, t => setForm(f => ({ ...f, game: t })))}
        {field('Vitória', form.win, t => setForm(f => ({ ...f, win: t })), 'Somada ao XP do jogo')}
        {field('Competição disputada', form.event, t => setForm(f => ({ ...f, event: t })))}
        {field('Colega avaliado', form.rating, t => setForm(f => ({ ...f, rating: t })))}
        {field('Honraria recebida', form.honor, t => setForm(f => ({ ...f, honor: t })), 'Concedida pelo admin')}
        <Text style={s.group}>CONQUISTAS, POR RARIDADE</Text>
        {RARITY_ORDER.map(k => field(RARITY_LABEL[k], form.rarity[k], t => setForm(f => ({ ...f, rarity: { ...f.rarity, [k]: t } }))))}
        {!!example && (
          <View style={s.example}>
            <Text style={s.exampleText}>
              Exemplo: 20 jogos, 12 vitórias, 4 competições, 5 colegas avaliados e 4 conquistas (3 comuns e 1 rara) = <Text style={s.exampleStrong}>{example.xp} XP</Text>, nível <Text style={s.exampleStrong}>{example.level}</Text>.
            </Text>
          </View>
        )}
        {!!msg && <Text style={[s.hint, { color: msg.startsWith('Salvo') ? Colors.teal : Colors.coral }]}>{msg}</Text>}
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
          <TouchableOpacity style={[s.save, (!allOk || saving) && { opacity: 0.4 }]} onPress={save} disabled={!allOk || saving} accessibilityRole="button">
            <Text style={s.saveText}>{saving ? 'Salvando…' : 'Salvar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.reset} onPress={() => setForm(toForm(DEFAULT_XP_CONFIG))} accessibilityRole="button">
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
  example: { backgroundColor: Colors.gold + '14', borderWidth: 1, borderColor: Colors.gold + '55', borderRadius: Radius.md, padding: Spacing.sm, marginTop: Spacing.sm },
  exampleText: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 19, color: Colors.text },
  exampleStrong: { fontFamily: FontFamily.titleBold, color: Colors.gold },
  group: { fontFamily: FontFamily.titleBold, fontSize: 12, letterSpacing: 1.3, color: Colors.muted, marginTop: Spacing.sm },
  field: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 6 },
  label: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text },
  hint: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  input: { width: 72, minHeight: 42, textAlign: 'center', fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.text, backgroundColor: Colors.surf2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line },
  save: { flex: 1, minHeight: 46, borderRadius: Radius.full, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: FontFamily.titleBold, fontSize: 15, color: Colors.bg },
  reset: { minHeight: 46, paddingHorizontal: Spacing.md, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  resetText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
});
