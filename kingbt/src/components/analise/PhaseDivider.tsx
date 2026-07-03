import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, Spacing } from '@/theme';

export function PhaseDivider({ label }: { label: string }) {
  return (
    <View style={ph.wrap}>
      <View style={ph.line} />
      <Text style={ph.txt}>{label}</Text>
      <View style={ph.line} />
    </View>
  );
}

const ph = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: Colors.line },
  txt: { fontFamily: FontFamily.bodyMed, fontSize: 10, color: Colors.faint, letterSpacing: 1 },
});
