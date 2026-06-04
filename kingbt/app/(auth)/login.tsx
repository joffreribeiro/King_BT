import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';

export default function LoginScreen() {
  const handleEnter = () => {
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.crown}>👑</Text>
        <Text style={styles.logo}>
          KING<Text style={styles.logoAccent}>BT</Text>
        </Text>
        <Text style={styles.tagline}>Beach Tennis entre amigos</Text>

        <TouchableOpacity style={styles.btnGoogle} onPress={handleEnter}>
          <Text style={styles.btnText}>Entrar com Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnCode} onPress={handleEnter}>
          <Text style={styles.btnCodeText}>Entrar com código do grupo</Text>
        </TouchableOpacity>
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
    gap: Spacing.md,
  },
  crown: { fontSize: 64 },
  logo: {
    fontFamily: FontFamily.titleBold,
    fontSize: 48,
    color: Colors.text,
    letterSpacing: 2,
  },
  logoAccent: { color: Colors.gold },
  tagline: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    color: Colors.textSoft,
    marginBottom: Spacing.xl,
  },
  btnGoogle: {
    backgroundColor: Colors.teal,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    width: '100%',
    alignItems: 'center',
  },
  btnText: {
    fontFamily: FontFamily.title,
    fontSize: 16,
    color: Colors.bg,
  },
  btnCode: {
    borderWidth: 1,
    borderColor: Colors.gold,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    width: '100%',
    alignItems: 'center',
  },
  btnCodeText: {
    fontFamily: FontFamily.title,
    fontSize: 16,
    color: Colors.gold,
  },
});
