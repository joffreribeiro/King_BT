import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/theme';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
};

const BG: Record<Variant, string> = {
  primary: Colors.teal,
  accent:  Colors.gold,
  outline: 'transparent',
  ghost:   'transparent',
};

const FG: Record<Variant, string> = {
  primary: Colors.bg,
  accent:  Colors.bg,
  outline: Colors.gold,
  ghost:   Colors.textSoft,
};

const BORDER: Record<Variant, string> = {
  primary: Colors.teal,
  accent:  Colors.gold,
  outline: Colors.gold,
  ghost:   'transparent',
};

export default function Button({
  label, onPress, variant = 'primary', loading = false, disabled = false, fullWidth = false,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.btn,
        { backgroundColor: BG[variant], borderColor: BORDER[variant] },
        fullWidth && styles.full,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading
        ? <ActivityIndicator color={FG[variant]} size="small" />
        : <Text style={[styles.label, { color: FG[variant] }]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  full: { width: '100%' },
  label: {
    fontFamily: FontFamily.title,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  disabled: { opacity: 0.45 },
});
