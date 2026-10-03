import { View, Text, StyleSheet, PanResponder, Platform } from 'react-native';
import { useMemo, useRef } from 'react';
import { FontFamily, Spacing, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { SKILLS, SKILL_MIN, SKILL_MAX, clampSkill, type SkillKey } from '@/logic/skills';
import { SkillIcon } from './SkillIcon';

type Values = Record<SkillKey, number>;

/** Habilidades em duas colunas: ícone, nome e nota na mesma linha, barra por baixo. */
export function SkillGrid({ values, decimals = false }: { values: Values; decimals?: boolean }) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={s.grid}>
      {SKILLS.map(sk => {
        const v = values[sk.key];
        return (
          <View key={sk.key} style={s.cell}>
            <SkillIcon skill={sk.key} size={40} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={s.cellTop}>
                <Text style={s.cellName} numberOfLines={1}>{sk.short}</Text>
                <Text style={s.cellValue}>{decimals ? v.toFixed(1).replace('.', ',') : v}</Text>
              </View>
              <View style={s.track}><View style={[s.fill, { width: `${(v / SKILL_MAX) * 100}%` }]} /></View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const THUMB = 26;

/**
 * Barra que se arrasta (ou se toca) para escolher a nota de 1 a 10. Feita com
 * PanResponder para funcionar igual na web e no celular, sem biblioteca extra.
 */
function SkillSlider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const trackRef = useRef<View>(null);
  const box = useRef({ left: 0, width: 1 });
  const cb = useRef(onChange);
  cb.current = onChange;

  const setFromPageX = (pageX: number) => {
    const { left, width } = box.current;
    const frac = Math.max(0, Math.min(1, (pageX - left) / Math.max(1, width)));
    cb.current(clampSkill(SKILL_MIN + frac * (SKILL_MAX - SKILL_MIN)));
  };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // Enquanto arrasta, a barra fica com o gesto (a lista não rola junto).
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const pageX = e.nativeEvent.pageX;
      trackRef.current?.measureInWindow((x, _y, w) => {
        box.current = { left: x, width: w };
        setFromPageX(pageX);
      });
    },
    onPanResponderMove: (e) => setFromPageX(e.nativeEvent.pageX),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const frac = (value - SKILL_MIN) / (SKILL_MAX - SKILL_MIN);
  return (
    <View
      ref={trackRef}
      {...pan.panHandlers}
      style={[s.sliderHit, Platform.OS === 'web' ? ({ touchAction: 'none', cursor: 'pointer', userSelect: 'none' } as any) : null]}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: SKILL_MIN, max: SKILL_MAX, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(ev) => {
        if (ev.nativeEvent.actionName === 'increment') onChange(clampSkill(value + 1));
        if (ev.nativeEvent.actionName === 'decrement') onChange(clampSkill(value - 1));
      }}
    >
      <View style={s.sliderTrack} pointerEvents="none">
        <View style={[s.sliderFill, { width: `${frac * 100}%` }]} />
      </View>
      <View style={[s.thumb, { left: `${frac * 100}%`, marginLeft: -THUMB / 2 }]} pointerEvents="none" />
    </View>
  );
}

/** Edição: cada habilidade com o nome, a nota e uma barra para arrastar. */
export function SkillSliders({ values, onChange }: { values: Values; onChange: (key: SkillKey, value: number) => void }) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={{ gap: Spacing.md }}>
      {SKILLS.map(sk => (
        <View key={sk.key} style={{ gap: 6 }}>
          <View style={s.cellTop}>
            <Text style={s.skill}>{sk.label}</Text>
            <Text style={s.sliderValue}>{values[sk.key]}</Text>
          </View>
          <SkillSlider value={values[sk.key]} onChange={v => onChange(sk.key, v)} label={sk.label} />
        </View>
      ))}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.md, rowGap: Spacing.md },
  cell: { flexBasis: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 140 },
  cellTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cellName: { flexShrink: 1, fontFamily: FontFamily.body, fontSize: 14, color: Colors.text },
  cellValue: { fontFamily: FontFamily.numberBold, fontSize: 17, color: Colors.text },
  skill: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text },
  track: { height: 6, borderRadius: 3, backgroundColor: Colors.surf2, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: Colors.gold },
  sliderValue: { fontFamily: FontFamily.numberBold, fontSize: 17, color: Colors.gold },
  sliderHit: { height: 36, justifyContent: 'center' },
  sliderTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.surf2, overflow: 'hidden' },
  sliderFill: { height: 6, borderRadius: 3, backgroundColor: Colors.gold },
  thumb: { position: 'absolute', top: 5, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: Colors.gold, borderWidth: 3, borderColor: Colors.bg },
});
