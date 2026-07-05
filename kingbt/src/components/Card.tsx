import { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Radius, Spacing, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  padding?: number;
};

export default function Card({ children, style, elevated = false, padding = Spacing.md }: Props) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={[styles.card, elevated && styles.elevated, { padding }, style]}>
      {children}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surf,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  elevated: {
    backgroundColor: Colors.surf2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
