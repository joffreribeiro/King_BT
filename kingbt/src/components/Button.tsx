import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/theme';

type Variant = 'primary' | 'soft' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

const CONFIG: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: Colors.gold,   fg: Colors.bg,    border: Colors.gold },
  soft:    { bg: Colors.surf2,  fg: Colors.gold,  border: Colors.line },
  ghost:   { bg: 'transparent', fg: Colors.muted, border: 'transparent' },
  danger:  { bg: Colors.coral + '22', fg: Colors.coral, border: Colors.coral + '66' },
};

const PAD: Record<'sm' | 'md' | 'lg', { v: number; h: number; fs: number }> = {
  sm: { v: Spacing.xs, h: Spacing.md, fs: 13 },
  md: { v: Spacing.sm + 4, h: Spacing.lg, fs: 15 },
  lg: { v: Spacing.md, h: Spacing.xl, fs: 16 },
};

export default function Button({
  label, onPress, variant = 'primary', loading = false,
  disabled = false, fullWidth = false, size = 'md',
}: Props) {
  const { bg, fg, border } = CONFIG[variant];
  const { v, h, fs } = PAD[size];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: border, paddingVertical: v, paddingHorizontal: h },
        fullWidth && styles.full,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading
        ? <ActivityIndicator color={fg} size="small" />
        : <Text style={[styles.label, { color: fg, fontSize: fs }]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  full: { width: '100%' },
  label: { fontFamily: FontFamily.title, letterSpacing: 0.3 },
  disabled: { opacity: 0.4 },
});
