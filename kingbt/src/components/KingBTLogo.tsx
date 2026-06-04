import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily } from '@/theme';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
};

const SIZES = { sm: 20, md: 32, lg: 48 } as const;

export default function KingBTLogo({ size = 'md', showTagline = false }: Props) {
  const fs = SIZES[size];
  return (
    <View style={styles.container}>
      <Text style={[styles.logo, { fontSize: fs }]}>
        KING<Text style={styles.accent}>BT</Text>
      </Text>
      {showTagline && (
        <Text style={[styles.tagline, { fontSize: fs * 0.28 }]}>
          BEACH TENNIS
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  logo: {
    fontFamily: FontFamily.titleBold,
    color: Colors.text,
    letterSpacing: 2,
  },
  accent: { color: Colors.gold },
  tagline: {
    fontFamily: FontFamily.number,
    color: Colors.textSoft,
    letterSpacing: 4,
    marginTop: -4,
  },
});
