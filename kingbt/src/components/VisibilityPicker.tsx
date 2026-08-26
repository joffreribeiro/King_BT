import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontFamily, Spacing, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import Card from './Card';

export type GroupVisibility = 'privado' | 'publico';

type Props = {
  value: GroupVisibility;
  onChange: (v: GroupVisibility) => void;
};

export function VisibilityPicker({ value, onChange }: Props) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);

  return (
    <Card style={{ gap: Spacing.sm }}>
      <TouchableOpacity style={s.visRow} onPress={() => onChange('privado')} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <Text style={s.visLabel}>🔒 Privado</Text>
          <Text style={s.visDesc}>Só quem tem o código pode entrar e ver o grupo.</Text>
        </View>
        {value === 'privado' && <Text style={s.visCheck}>✓</Text>}
      </TouchableOpacity>
      <View style={{ height: 1, backgroundColor: Colors.line }} />
      <TouchableOpacity style={s.visRow} onPress={() => onChange('publico')} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <Text style={s.visLabel}>🌍 Público</Text>
          <Text style={s.visDesc}>Qualquer pessoa pode visitar (ver ranking e jogos) sem entrar no grupo.</Text>
        </View>
        {value === 'publico' && <Text style={s.visCheck}>✓</Text>}
      </TouchableOpacity>
    </Card>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  visRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  visLabel: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  visDesc: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: 2 },
  visCheck: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.teal },
});
