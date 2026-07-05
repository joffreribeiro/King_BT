import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontFamily, Radius, Spacing, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

type Variant = 'gold' | 'teal' | 'coral' | 'neutral' | 'muted';

type Props = { label: string; variant?: Variant; small?: boolean };

const makeCfg = (Colors: ThemeColors): Record<Variant, { bg: string; fg: string }> => ({
  gold:    { bg: Colors.gold  + '22', fg: Colors.gold   },
  teal:    { bg: Colors.teal  + '22', fg: Colors.teal   },
  coral:   { bg: Colors.coral + '22', fg: Colors.coral  },
  neutral: { bg: Colors.line,         fg: Colors.muted  },
  muted:   { bg: Colors.surf2,        fg: Colors.faint  },
});

export default function Badge({ label, variant = 'neutral', small = false }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const CFG = useMemo(() => makeCfg(Colors), [Colors]);
  const { bg, fg } = CFG[variant];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg, fontSize: small ? 10 : 12 }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  label: { fontFamily: FontFamily.numberBold, letterSpacing: 0.3 },
});
