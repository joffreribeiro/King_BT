import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { useAuth } from '@/store/AuthContext';

export default function JoinGroupScreen() {
  const { user, group, loading, joinGroup, logout, error, clearError } = useAuth();
  const router = useRouter();
  const [code, setCode]     = useState('');
  const [busy, setBusy]     = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && group) router.replace('/(app)');
  }, [loading, user, group]);

  async function handleJoin() {
    if (!code.trim()) return;
    setBusy(true);
    clearError();
    await joinGroup(code.trim());
    setBusy(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.center}>

          <View style={styles.top}>
            <Text style={styles.title}>Entrar no grupo</Text>
            <Text style={styles.subtitle}>
              Olá, {user?.displayName?.split(' ')[0]}! {'\n'}
              Insira o código do grupo para continuar.
            </Text>
          </View>

          {/* Erro */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={t => { setCode(t.toUpperCase()); clearError(); }}
              placeholder="Ex: KINGBT"
              placeholderTextColor={Colors.faint}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
            />
          </View>

          {/* Botão entrar */}
          <TouchableOpacity
            style={[styles.btnJoin, (!code.trim() || busy) && styles.btnDisabled]}
            onPress={handleJoin}
            disabled={!code.trim() || busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color={Colors.bg} />
              : <>
                  <Text style={styles.btnIcon}>⚡</Text>
                  <Text style={styles.btnText}>Entrar no grupo</Text>
                </>
            }
          </TouchableOpacity>

          {/* Sair */}
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: {
    flex: 1, justifyContent: 'center',
    paddingHorizontal: Spacing.xl, gap: Spacing.md,
  },
  top: { gap: Spacing.sm, marginBottom: Spacing.sm },
  title: { fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.text },
  subtitle: {
    fontFamily: FontFamily.body, fontSize: 15,
    color: Colors.muted, lineHeight: 22,
  },
  errorBox: {
    backgroundColor: Colors.coral + '22', borderRadius: Radius.sm,
    padding: Spacing.sm, borderWidth: 1, borderColor: Colors.coral + '44',
  },
  errorText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral },
  inputWrap: {
    backgroundColor: Colors.surf, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.line,
  },
  input: {
    fontFamily: FontFamily.numberBold, fontSize: 22,
    color: Colors.text, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md, letterSpacing: 2,
    textAlign: 'center',
  },
  btnJoin: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.md + 2, minHeight: 54,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm,
  },
  btnDisabled: { backgroundColor: Colors.surf2 },
  btnIcon: { fontSize: 18 },
  btnText: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.bg },
  logoutBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  logoutText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.faint },
});
