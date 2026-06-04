import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontFamily, Spacing } from '@/theme';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Perfil</Text>
      <Text style={styles.placeholder}>Estatísticas do jogador — Passo 4.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.md },
  title: { fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.text },
  placeholder: { fontFamily: FontFamily.body, color: Colors.textSoft, marginTop: Spacing.md },
});
