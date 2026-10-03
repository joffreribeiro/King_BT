import { useMemo, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, type TextInputProps } from 'react-native';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Icon } from '@/components/icons';

/** Peças do formulário "Nova competição" e da tela "Montar grupos": fontes ≥ 14 e alvos de toque ≥ 44. */

export function SectionTitle({ children, required }: { children: ReactNode; required?: boolean }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={s.sectionWrap}>
      <Text style={s.sectionTitle}>{children}{required ? <Text style={s.req}> *</Text> : null}</Text>
    </View>
  );
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  return <Text style={s.fieldLabel}>{children}{required ? <Text style={s.req}> *</Text> : null}</Text>;
}

export function Hint({ children }: { children: ReactNode }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  return <Text style={s.hint}>{children}</Text>;
}

export function Notice({ children, tone = 'gold' }: { children: ReactNode; tone?: 'gold' | 'coral' | 'teal' }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const color = tone === 'coral' ? C.coral : tone === 'teal' ? C.teal : C.gold;
  return (
    <View style={[s.notice, { borderColor: color + '66', backgroundColor: color + '14' }]}>
      <Text style={s.noticeText}>{children}</Text>
    </View>
  );
}

export function AppInput(props: TextInputProps & { invalid?: boolean }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { invalid, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={C.faint}
      {...rest}
      style={[s.input, props.multiline && s.textArea, invalid && { borderColor: C.coral }, props.editable === false && { opacity: 0.4 }, style]}
    />
  );
}

/** Botões em pílula, com quebra de linha. Nada selecionado quando `value` é null. */
export function ChipGroup<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={s.chipRow}>
      {options.map(o => {
        const on = value === o.value;
        return (
          <TouchableOpacity
            key={o.value} style={[s.chip, on && s.chipOn]} onPress={() => onChange(o.value)}
            activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: on }}
          >
            <Text style={[s.chipText, on && s.chipTextOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Lista suspensa: campo que abre uma lista de opções (com descrição opcional). Nada selecionado quando `value` é null. */
export function SelectField<T extends string>({ options, value, onChange, title, placeholder = 'Selecione', accessibilityLabel }: {
  options: { value: T; label: string; desc?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  title: string;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const [open, setOpen] = useState(false);
  const cur = options.find(o => o.value === value);
  return (
    <>
      <TouchableOpacity
        style={s.select} onPress={() => setOpen(true)} activeOpacity={0.8}
        accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ expanded: open }}
      >
        <View style={{ flex: 1 }}>
          <Text style={[s.selectText, !cur && { color: C.faint }]} numberOfLines={1}>{cur ? cur.label : placeholder}</Text>
          {cur?.desc ? <Text style={s.selectDesc} numberOfLines={1}>{cur.desc}</Text> : null}
        </View>
        <Icon name="chevronDown" size={18} color={C.muted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1}>
            <Text style={s.sheetTitle}>{title}</Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {options.map((o, i) => {
                const on = o.value === value;
                return (
                  <TouchableOpacity
                    key={o.value} style={[s.opt, i < options.length - 1 && s.optBorder, on && s.optOn]}
                    onPress={() => { onChange(o.value); setOpen(false); }} activeOpacity={0.7}
                    accessibilityRole="button" accessibilityState={{ selected: on }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[s.optText, on && { color: C.gold, fontFamily: FontFamily.title }]}>{o.label}</Text>
                      {o.desc ? <Text style={s.optDesc}>{o.desc}</Text> : null}
                    </View>
                    {on ? <Icon name="check" size={18} color={C.gold} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={s.cancel} onPress={() => setOpen(false)} activeOpacity={0.8}>
              <Text style={s.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

/** Opções lado a lado, dividindo a largura. */
export function Segment<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={s.seg}>
      {options.map(o => {
        const on = value === o.value;
        return (
          <TouchableOpacity
            key={o.value} style={[s.segBtn, on && s.chipOn]} onPress={() => onChange(o.value)}
            activeOpacity={0.8} accessibilityRole="button" accessibilityState={{ selected: on }}
          >
            <Text style={[s.chipText, on && s.chipTextOn]} numberOfLines={1}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function ToggleRow({ title, subtitle, value, onChange }: {
  title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <TouchableOpacity
      style={s.toggleRow} onPress={() => onChange(!value)} activeOpacity={0.8}
      accessibilityRole="switch" accessibilityState={{ checked: value }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.toggleTitle}>{title}</Text>
        {subtitle ? <Text style={s.toggleSub}>{subtitle}</Text> : null}
      </View>
      <View style={[s.track, value && s.trackOn]}>
        <View style={[s.thumb, value && s.thumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

export function StepperRow({ label, sub, value, min, max, onChange }: {
  label: string; sub?: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={s.stepRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.toggleTitle}>{label}</Text>
        {sub ? <Text style={s.toggleSub}>{sub}</Text> : null}
      </View>
      <View style={s.stepCtl}>
        <TouchableOpacity
          style={s.stepBtn} onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
          accessibilityLabel={`Diminuir ${label}`}
        >
          <Icon name="minus" size={18} color={value <= min ? C.faint : C.gold} />
        </TouchableOpacity>
        <Text style={s.stepVal}>{value}</Text>
        <TouchableOpacity
          style={s.stepBtn} onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
          accessibilityLabel={`Aumentar ${label}`}
        >
          <Icon name="plus" size={18} color={value >= max ? C.faint : C.gold} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function Box({ children }: { children: ReactNode }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  return <View style={s.box}>{children}</View>;
}

export function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={[s.sumRow, !last && s.sumBorder]}>
      <Text style={s.sumLabel}>{label}</Text>
      <Text style={s.sumValue}>{value}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, busy, outline }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean; outline?: boolean;
}) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const off = disabled || busy;
  return (
    <TouchableOpacity
      style={[s.cta, outline && s.ctaOutline, off && s.ctaOff]} onPress={onPress} disabled={off}
      activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ disabled: !!off }}
    >
      <Text style={[s.ctaText, outline && { color: C.gold }, off && { color: C.faint }]}>{busy ? 'Aguarde…' : label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  select: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: C.surf,
    borderRadius: Radius.md, borderWidth: 1, borderColor: C.line, paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  selectText: { fontFamily: FontFamily.bodyMed, fontSize: 16, color: C.text },
  selectDesc: { fontFamily: FontFamily.body, fontSize: 14, color: C.muted, marginTop: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: C.surf, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.line, padding: Spacing.md, maxWidth: 480, width: '100%', alignSelf: 'center' },
  sheetTitle: { fontFamily: FontFamily.titleBold, fontSize: 17, color: C.text, marginBottom: Spacing.sm },
  opt: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, paddingHorizontal: 4 },
  optBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  optOn: { backgroundColor: C.gold + '14' },
  optText: { fontFamily: FontFamily.bodyMed, fontSize: 16, color: C.text },
  optDesc: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 19, color: C.muted, marginTop: 1 },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  cancelText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.muted },
  sectionWrap: { marginTop: Spacing.lg, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.line },
  sectionTitle: { fontFamily: FontFamily.titleBold, fontSize: 14, letterSpacing: 1.3, color: C.gold, textTransform: 'uppercase' },
  req: { color: C.coral },
  fieldLabel: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: C.muted, marginTop: Spacing.md, marginBottom: 6 },
  hint: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: C.muted, marginTop: 6 },
  notice: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  noticeText: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: C.text },
  input: {
    minHeight: 48, backgroundColor: C.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: C.line,
    paddingHorizontal: Spacing.md, paddingVertical: 12, fontFamily: FontFamily.body, fontSize: 16, color: C.text,
  },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    minHeight: 44, paddingHorizontal: 16, borderRadius: Radius.full, borderWidth: 1, borderColor: C.line,
    backgroundColor: C.surf, alignItems: 'center', justifyContent: 'center',
  },
  chipOn: { borderColor: C.gold, backgroundColor: C.gold + '26' },
  chipText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: C.muted },
  chipTextOn: { color: C.gold, fontFamily: FontFamily.title },
  seg: { flexDirection: 'row', gap: Spacing.sm },
  segBtn: {
    flex: 1, minHeight: 46, paddingHorizontal: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: C.line,
    backgroundColor: C.surf, alignItems: 'center', justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56, backgroundColor: C.surf,
    borderWidth: 1, borderColor: C.line, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, marginTop: Spacing.sm,
  },
  toggleTitle: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.text },
  toggleSub: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 19, color: C.muted },
  track: { width: 48, height: 28, borderRadius: 14, backgroundColor: C.surf2, borderWidth: 1, borderColor: C.line, justifyContent: 'center', paddingHorizontal: 3 },
  trackOn: { backgroundColor: C.gold, borderColor: C.gold },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.muted },
  thumbOn: { backgroundColor: C.bg, alignSelf: 'flex-end' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 56, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  stepCtl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.gold + '88', alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontFamily: FontFamily.numberBold, fontSize: 20, color: C.text, minWidth: 28, textAlign: 'center' },
  box: { backgroundColor: C.surf, borderWidth: 1, borderColor: C.line, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, marginTop: Spacing.sm },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: 8 },
  sumBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
  sumLabel: { fontFamily: FontFamily.body, fontSize: 14, color: C.muted },
  sumValue: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: C.text, flex: 1, textAlign: 'right' },
  cta: { minHeight: 54, borderRadius: Radius.full, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  ctaOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.gold, minHeight: 48 },
  ctaOff: { backgroundColor: C.surf2, borderColor: C.line, borderWidth: 1 },
  ctaText: { fontFamily: FontFamily.title, fontSize: 16, color: C.bg, textAlign: 'center' },
});
