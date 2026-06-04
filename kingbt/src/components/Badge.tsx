import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/theme';

type Variant = 'gold' | 'teal' | 'coral' | 'neutral';

type Props = {
  label: string;
  variant?: Variant;
  small?: boolean;
};

const BG: Record<Variant, string> = {
  gold:    Colors.gold + '22',
  teal:    Colors.teal + '22',
  coral:   Colors.coral + '22',
  neutral: Colors.line,
};

const FG: Record<Variant, string> = {
  gold:    Colors.gold,
  teal:    Colors.teal,
  coral:   Colors.coral,
  neutral: Colors.textSoft,
};

export default function Badge({ label, variant = 'neutral', small = false }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: BG[variant] }]}>
      <Text style={[
        styles.label,
        { color: FG[variant], fontSize: small ? 11 : 13 },
      ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: FontFamily.numberBold,
    letterSpacing: 0.3,
  },
});
