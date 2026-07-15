import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

interface Props {
  /** 0–100. */
  pct: number;
  color?: string;
  height?: number;
}

/** Barra de progresso track+fill — consolida o padrão repetido em várias telas de stats. */
export function ProgressBar({ pct, color, height = 5 }: Props) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={[s.track, { height, borderRadius: height / 2 }]}>
      <View style={[s.fill, {
        width: `${clamped}%` as any,
        height,
        borderRadius: height / 2,
        backgroundColor: color ?? Colors.gold,
      }]} />
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  track: { backgroundColor: Colors.surf2, overflow: 'hidden', width: '100%' },
  fill:  { borderRadius: Radius.sm },
});
