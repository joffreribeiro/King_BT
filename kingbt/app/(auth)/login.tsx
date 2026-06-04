import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { KingBTLogo } from '@/components';

export default function LoginScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>

        <Text style={styles.crown}>👑</Text>
        <KingBTLogo size="lg" showTagline />

        <Text style={styles.tagline}>Play com respeito, evolua sempre.</Text>

        <View style={styles.btnGroup}>
          <TouchableOpacity
            style={styles.btnGoogle}
            onPress={() => router.replace('/(tabs)/home')}
            activeOpacity={0.8}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.btnText}>Entrar com Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnCode}
            onPress={() => router.replace('/(tabs)/home')}
            activeOpacity={0.8}
          >
            <Text style={styles.btnCodeText}>Entrar com código do grupo</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Código do grupo KING BT: <Text style={styles.code}>KINGBT</Text>
        </Text>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  crown: { fontSize: 72 },
  tagline: {
    fontFamily: FontFamily.number,
    fontSize: 13,
    color: Colors.textSoft,
    letterSpacing: 1,
    textAlign: 'center',
  },
  btnGroup: { width: '100%', gap: Spacing.md },
  btnGoogle: {
    backgroundColor: Colors.teal,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  googleIcon: {
    fontFamily: FontFamily.titleBold,
    fontSize: 18,
    color: Colors.bg,
  },
  btnText: {
    fontFamily: FontFamily.title,
    fontSize: 16,
    color: Colors.bg,
  },
  btnCode: {
    borderWidth: 1.5,
    borderColor: Colors.gold,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  btnCodeText: {
    fontFamily: FontFamily.title,
    fontSize: 16,
    color: Colors.gold,
  },
  footer: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.textSoft,
  },
  code: { color: Colors.gold, fontFamily: FontFamily.numberBold },
});
