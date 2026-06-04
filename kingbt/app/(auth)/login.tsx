import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { KingBTLogo } from '@/components';

export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <KingBTLogo size="lg" showTagline />
        <Text style={styles.tagline}>Play com respeito, evolua sempre.</Text>

        <View style={styles.btns}>
          <TouchableOpacity style={styles.btnGoogle} onPress={() => router.replace('/(app)')} activeOpacity={0.85}>
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.btnText}>Entrar com Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnCode} onPress={() => router.replace('/(app)')} activeOpacity={0.85}>
            <Text style={styles.btnCodeText}>Entrar com código do grupo</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Código do grupo: <Text style={styles.code}>KINGBT</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
  tagline: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted, letterSpacing: 1 },
  btns: { width: '100%', gap: Spacing.md },
  btnGoogle: { backgroundColor: Colors.teal, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  googleG: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.bg },
  btnText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
  btnCode: { borderWidth: 1.5, borderColor: Colors.gold, paddingVertical: Spacing.md, borderRadius: Radius.md, alignItems: 'center' },
  btnCodeText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.gold },
  hint: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.faint },
  code: { color: Colors.gold, fontFamily: FontFamily.numberBold },
});
