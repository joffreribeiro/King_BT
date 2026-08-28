import { View, Text, StyleSheet } from 'react-native';
import { FontFamily } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

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

/**
 * Círculo de cor cheia com as iniciais em cor de fundo — o mesmo desenho das
 * bolhas de jogador da aba Competições. Antes era um quadrado arredondado com
 * fundo escurecido e iniciais coloridas, o que fazia o mesmo jogador aparecer
 * de dois jeitos diferentes conforme a tela.
 */
export default function Avatar({ name, color, size = 44, showCrown = false }: Props) {
  const { colors: Colors } = useTheme();
  const fontSize = size * 0.4;
  const borderRadius = size / 2;
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: color,
            borderColor: 'rgba(0,0,0,0.3)',
          },
        ]}
      >
        <Text style={[styles.initials, { fontSize, color: Colors.bg }]}>
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
