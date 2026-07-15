import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Radius, Spacing, Type, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

interface Props {
  icon?: string;
  value: string | number;
  label: string;
  color?: string;
}

/** Card compacto ícone/número/rótulo — consolida o padrão "resultBox" repetido em várias telas (Vitórias/Derrotas/Aproveit. etc.). */
export function StatCard({ icon, value, label, color }: Props) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={s.box}>
      {icon && <Text style={s.icon}>{icon}</Text>}
      <Text style={[s.num, { color: color ?? Colors.text }]}>{value}</Text>
      <Text style={s.lbl}>{label}</Text>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  box:  { flex: 1, alignItems: 'center', backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.sm, gap: 2 },
  icon: { fontSize: 18 },
  num:  { ...Type.numberLg, fontSize: 22, lineHeight: 26 },
  lbl:  { ...Type.caption, color: Colors.muted },
});
