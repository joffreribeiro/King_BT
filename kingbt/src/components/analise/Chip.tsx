import { useMemo } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontFamily, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

export function Chip({
  label, selected, onPress, color, small,
}: { label: string; selected: boolean; onPress: () => void; color?: string; small?: boolean }) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeChipStyles(Colors), [Colors]);

  const bg = selected ? (color ?? Colors.gold) : Colors.surf2;
  const tc = selected ? Colors.bg : Colors.muted;
  return (
    <TouchableOpacity
      style={[styles.base, small && styles.small, { backgroundColor: bg, borderColor: selected ? (color ?? Colors.gold) : Colors.line }]}
      onPress={onPress} activeOpacity={0.75}
    >
      <Text style={[styles.txt, small && styles.smallTxt, { color: tc }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeChipStyles = (Colors: ThemeColors) => StyleSheet.create({
  base: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  small: { paddingHorizontal: 10, paddingVertical: 5 },
  txt: { fontFamily: FontFamily.bodyMed, fontSize: 13 },
  smallTxt: { fontSize: 11 },
});
