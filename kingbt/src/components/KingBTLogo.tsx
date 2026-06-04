import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, FontFamily } from '@/theme';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  useImage?: boolean;
};

const FS = { sm: 18, md: 30, lg: 48 } as const;

export default function KingBTLogo({ size = 'md', showTagline = false, useImage = false }: Props) {
  const fs = FS[size];

  if (useImage) {
    const imgSize = fs * 3;
    return (
      <View style={styles.container}>
        <Image
          source={require('../../assets/kingbt-logo.png')}
          style={{ width: imgSize, height: imgSize }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.logo, { fontSize: fs }]}>
        KING<Text style={styles.accent}>BT</Text>
      </Text>
      {showTagline && (
        <Text style={[styles.tagline, { fontSize: fs * 0.27 }]}>BEACH TENNIS</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  logo: { fontFamily: FontFamily.titleBold, color: Colors.text, letterSpacing: 2 },
  accent: { color: Colors.gold },
  tagline: { fontFamily: FontFamily.number, color: Colors.muted, letterSpacing: 4, marginTop: -4 },
});
