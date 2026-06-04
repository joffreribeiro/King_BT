import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '@/theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  padding?: number;
};

export default function Card({ children, style, elevated = false, padding = Spacing.md }: Props) {
  return (
    <View style={[styles.card, elevated && styles.elevated, { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
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
