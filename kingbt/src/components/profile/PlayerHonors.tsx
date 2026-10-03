import { View, Text, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { FontFamily, Spacing, Radius, PODIUM_COLORS, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Card } from '@/components';
import { useSettings } from '@/store/SettingsContext';
import { honorsOf } from '@/logic/honors';

const brDate = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

/** Honrarias que o admin concedeu ao jogador. Some se não houver. */
export function PlayerHonors({ playerId }: { playerId: string }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { honors } = useSettings();
  const mine = useMemo(() => honorsOf(honors, playerId), [honors, playerId]);
  if (mine.length === 0) return null;
  return (
    <Card>
      <Text style={s.title}>Honrarias</Text>
      <Text style={s.hint}>{mine.length} {mine.length === 1 ? 'honraria concedida' : 'honrarias concedidas'} pelo grupo</Text>
      <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
        {mine.map(h => (
          <View key={h.id} style={[s.row, { borderColor: PODIUM_COLORS[0] + '66' }]}>
            <Text style={s.icon}>{h.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{h.title}</Text>
              {!!h.note && <Text style={s.note}>{h.note}</Text>}
              <Text style={s.hint}>{brDate(h.date)}</Text>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  title: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 22, color: C.text },
  hint: { fontFamily: FontFamily.body, fontSize: 14, color: C.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderRadius: Radius.md, backgroundColor: C.surf2, padding: Spacing.md },
  icon: { fontSize: 30 },
  name: { fontFamily: FontFamily.titleBold, fontSize: 16, color: C.text },
  note: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: C.text, marginTop: 2 },
});
