import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { OptionModal } from '@/components/OptionModal';
import { Icon } from '@/components/icons';
import { maskDate } from '@/logic/eventDateTime';
import {
  CATEGORIES, HANDS, SIDES, cleanAbout, formatHeight, isoToBr, parseBirthday, parseHeight, parseSince,
  type PlayerAbout, type Hand, type Side, type Category,
} from '@/logic/playerAbout';

interface Props {
  name: string;
  about?: PlayerAbout;
  onClose: () => void;
  /** Só chamado se o nome mudou. */
  onSaveName: (name: string) => void | Promise<void>;
  onSaveAbout: (about: PlayerAbout) => void | Promise<void>;
  /** Categoria sugerida pelo Radar, se já há dados. */
  suggested?: Category;
}

/** Editor do perfil (aberto pelo lápis ao lado do nome): nome + ficha "Sobre". */
export function EditProfileModal({ name, about, onClose, onSaveName, onSaveAbout, suggested }: Props) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);

  const [nameText, setNameText] = useState(name);
  const [birthday, setBirthday] = useState(isoToBr(about?.birthday));
  const [height, setHeight] = useState(formatHeight(about?.heightM));
  const [hand, setHand] = useState<Hand | undefined>(about?.hand);
  const [side, setSide] = useState<Side | undefined>(about?.side);
  const [since, setSince] = useState(isoToBr(about?.since));
  const [category, setCategory] = useState<Category | undefined>(about?.category);
  const [pickCategory, setPickCategory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmed = nameText.trim();
    if (trimmed.length < 2) { setError('O nome precisa ter ao menos 2 letras.'); return; }

    // Campo vazio = "não informado". Preenchido e inválido = erro, sem gravar nada.
    const b = birthday.trim() ? parseBirthday(birthday) : undefined;
    if (birthday.trim() && !b) { setError('Data de aniversário inválida. Use DD/MM/AAAA.'); return; }
    const h = height.trim() ? parseHeight(height) : undefined;
    if (height.trim() && h == null) { setError('Altura inválida. Use metros, entre 1,00 e 2,50 (ex.: 1,78).'); return; }
    const sn = since.trim() ? parseSince(since) : undefined;
    if (since.trim() && !sn) { setError('Data de início inválida. Use DD/MM/AAAA, sem data futura.'); return; }

    setBusy(true);
    setError(null);
    try {
      if (trimmed !== name) await onSaveName(trimmed);
      await onSaveAbout(cleanAbout({ birthday: b ?? undefined, heightM: h ?? undefined, hand, side, since: sn ?? undefined, category }));
      onClose();
    } catch {
      setError('Não foi possível salvar. Verifique a conexão e tente de novo.');
      setBusy(false);
    }
  }

  const chips = <T extends string>(items: readonly { key: T; label: string }[], value: T | undefined, set: (v: T | undefined) => void) => (
    <View style={s.chipRow}>
      {items.map(it => (
        <TouchableOpacity key={it.key} style={[s.chip, value === it.key && s.chipOn]} onPress={() => set(value === it.key ? undefined : it.key)} activeOpacity={0.8}>
          <Text style={[s.chipText, value === it.key && s.chipTextOn]}>{it.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.box}>
          <View style={s.header}>
            <Text style={s.title}>Editar perfil</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Fechar">
              <Icon name="close" size={18} color={Colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.md, paddingBottom: Spacing.sm }}>
            <View>
              <Text style={s.label}>Nome</Text>
              <TextInput style={s.input} value={nameText} onChangeText={setNameText} placeholder="Seu nome" placeholderTextColor={Colors.faint} maxLength={40} />
              <Text style={s.help}>O nome vale para todos os seus grupos.</Text>
            </View>

            <View>
              <Text style={s.label}>Data de aniversário</Text>
              <TextInput style={s.input} value={birthday} onChangeText={t => setBirthday(maskDate(t))} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.faint} keyboardType="number-pad" maxLength={10} />
            </View>

            <View>
              <Text style={s.label}>Altura (m)</Text>
              <TextInput style={s.input} value={height} onChangeText={t => setHeight(t.replace(/[^0-9.,]/g, '').slice(0, 4))} placeholder="Ex.: 1,78" placeholderTextColor={Colors.faint} keyboardType="decimal-pad" maxLength={4} />
            </View>

            <View>
              <Text style={s.label}>Mão dominante</Text>
              {chips(HANDS, hand, setHand)}
            </View>

            <View>
              <Text style={s.label}>Lado preferido</Text>
              {chips(SIDES, side, setSide)}
            </View>

            <View>
              <Text style={s.label}>Praticando beach tennis desde</Text>
              <TextInput style={s.input} value={since} onChangeText={t => setSince(maskDate(t))} placeholder="DD/MM/AAAA" placeholderTextColor={Colors.faint} keyboardType="number-pad" maxLength={10} />
            </View>

            <View>
              <Text style={s.label}>Categoria</Text>
              <TouchableOpacity style={s.select} onPress={() => setPickCategory(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Escolher categoria">
                <Text style={[s.selectText, !category && { color: Colors.faint }]}>{category ?? 'Selecione'}</Text>
                <Icon name="chevronDown" size={16} color={Colors.muted} />
              </TouchableOpacity>
              {!!suggested && suggested !== category && (
                <TouchableOpacity onPress={() => setCategory(suggested)} style={s.suggest} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Usar categoria sugerida ${suggested}`}>
                  <Text style={s.suggestText}>A avaliação sugere <Text style={{ fontFamily: FontFamily.titleBold }}>{suggested}</Text> · toque para usar</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {!!error && <Text style={s.error}>{error}</Text>}

          <View style={s.actions}>
            <TouchableOpacity style={s.btnGhost} onPress={onClose} disabled={busy}><Text style={s.btnGhostText}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btnPrimary, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}><Text style={s.btnPrimaryText}>{busy ? 'Salvando…' : 'Salvar'}</Text></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {pickCategory && (
        <OptionModal
          title="Categoria"
          options={[
            ...CATEGORIES.map(c => ({ key: c, label: c })),
            { key: '', label: 'Não informar', color: Colors.muted },
          ]}
          onSelect={k => { setCategory(k ? (k as Category) : undefined); setPickCategory(false); }}
          onClose={() => setPickCategory(false)}
        />
      )}
    </Modal>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  suggest: { marginTop: 8, minHeight: 40, paddingHorizontal: 14, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.gold, backgroundColor: Colors.gold + '1F', alignSelf: 'flex-start', justifyContent: 'center' },
  suggestText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.gold },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: Spacing.md },
  box: { width: '100%', maxWidth: 440, maxHeight: '92%', backgroundColor: Colors.surf, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.line, padding: Spacing.md, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 24, color: Colors.text },
  label: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted, marginBottom: 6 },
  help: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.faint, marginTop: 4 },
  input: { minHeight: 46, borderRadius: Radius.md, backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: Spacing.md, fontFamily: FontFamily.body, fontSize: 15, color: Colors.text },
  select: { minHeight: 46, borderRadius: Radius.md, backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.text },
  chipRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 16, minHeight: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line },
  chipOn: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  chipText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  chipTextOn: { fontFamily: FontFamily.title, color: Colors.bg },
  error: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  btnGhost: { flex: 1, minHeight: 48, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.line },
  btnGhostText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.muted },
  btnPrimary: { flex: 1, minHeight: 48, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gold },
  btnPrimaryText: { fontFamily: FontFamily.titleBold, fontSize: 15, color: Colors.bg },
});
