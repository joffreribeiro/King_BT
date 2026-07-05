import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontFamily, Spacing, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

export function PhaseDivider({ label }: { label: string }) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makePhStyles(Colors), [Colors]);

  return (
    <View style={styles.wrap}>
      <View style={styles.line} />
      <Text style={styles.txt}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const makePhStyles = (Colors: ThemeColors) => StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: Colors.line },
  txt: { fontFamily: FontFamily.bodyMed, fontSize: 10, color: Colors.faint, letterSpacing: 1 },
});
