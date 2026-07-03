import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, FontFamily, Radius } from '@/theme';

export function Chip({
  label, selected, onPress, color, small,
}: { label: string; selected: boolean; onPress: () => void; color?: string; small?: boolean }) {
  const bg = selected ? (color ?? Colors.gold) : Colors.surf2;
  const tc = selected ? Colors.bg : Colors.muted;
  return (
    <TouchableOpacity
      style={[chip.base, small && chip.small, { backgroundColor: bg, borderColor: selected ? (color ?? Colors.gold) : Colors.line }]}
      onPress={onPress} activeOpacity={0.75}
    >
      <Text style={[chip.txt, small && chip.smallTxt, { color: tc }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const chip = StyleSheet.create({
  base: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  small: { paddingHorizontal: 10, paddingVertical: 5 },
  txt: { fontFamily: FontFamily.bodyMed, fontSize: 13 },
  smallTxt: { fontSize: 11 },
});
