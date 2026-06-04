import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '@/theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
};

export default function Card({ children, style, elevated = false }: Props) {
  return (
    <View style={[styles.card, elevated && styles.elevated, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  elevated: {
    backgroundColor: Colors.surface2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
