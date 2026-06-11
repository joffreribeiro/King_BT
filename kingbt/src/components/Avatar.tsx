import { View, Text, StyleSheet } from 'react-native';
import { FontFamily } from '@/theme';

type Props = {
  name: string;
  color: string;
  size?: number;
  showCrown?: boolean;
};

function initials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function darken(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - 70);
  const g = Math.max(0, ((n >> 8) & 0xff) - 70);
  const b = Math.max(0, (n & 0xff) - 70);
  return `rgb(${r},${g},${b})`;
}

export default function Avatar({ name, color, size = 44, showCrown = false }: Props) {
  const fontSize = size * 0.35;
  const borderRadius = size * 0.34;
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: darken(color),
            borderColor: color + 'AA',
          },
        ]}
      >
        <Text style={[styles.initials, { fontSize, color }]}>
          {initials(name)}
        </Text>
      </View>
      {showCrown && (
        <Text style={[styles.crown, { fontSize: size * 0.28, top: -(size * 0.22) }]}>
          👑
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  initials: { fontFamily: FontFamily.numberBold, letterSpacing: 0.5 },
  crown: { position: 'absolute' },
});
