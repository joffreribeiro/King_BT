import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, TextInput, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { useAuth } from '@/store/AuthContext';

type Mode = 'options' | 'signin' | 'signup';

export default function LoginScreen() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, error, clearError, user, group, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode]         = useState<Mode>('options');

  useEffect(() => {
    if (loading) return;
    if (user && group) router.replace('/(app)');
    else if (user && !group) router.replace('/(auth)/join');
  }, [loading, user, group]);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function reset(m: Mode) { clearError(); setMode(m); }

  async function handleGoogle() {
    setBusy(true); await signInWithGoogle(); setBusy(false);
  }

  async function handleSignIn() {
    if (!email || !password) return;
    setBusy(true); await signInWithEmail(email, password); setBusy(false);
  }

  async function handleSignUp() {
    if (!name || !email || !password) return;
    setBusy(true); await signUpWithEmail(name, email, password); setBusy(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Glow decorativo */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={deco.glow} />
          </View>

          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image source={require('../../assets/kingbt-logo.png')} style={styles.logo} resizeMode="contain" />
          </View>

          {/* Erro */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Tela de opções ── */}
          {mode === 'options' && (
            <View style={styles.form}>
              <Text style={styles.title}>Entrar</Text>

              <TouchableOpacity style={styles.btnEmail} onPress={() => reset('signin')} activeOpacity={0.85}>
                <Text style={styles.btnEmailText}>Entrar com e-mail</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => reset('signup')} style={styles.linkBtn}>
                <Text style={styles.linkText}>Não tem conta? <Text style={styles.linkAccent}>Criar conta</Text></Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Login com e-mail ── */}
          {mode === 'signin' && (
            <View style={styles.form}>
              <TouchableOpacity onPress={() => reset('options')} style={styles.backBtn}>
                <Text style={styles.backText}>← Voltar</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Entrar com e-mail</Text>

              <TextInput style={styles.input} value={email} onChangeText={setEmail}
                placeholder="E-mail" placeholderTextColor={Colors.faint}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

              <View style={styles.passwordWrap}>
                <TextInput style={styles.passwordInput} value={password} onChangeText={setPassword}
                  placeholder="Senha" placeholderTextColor={Colors.faint}
                  secureTextEntry={!showPassword} />
                <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
                  <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, (!email || !password || busy) && styles.btnDisabled]}
                onPress={handleSignIn} disabled={!email || !password || busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.btnText}>Entrar</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => reset('signup')} style={styles.linkBtn}>
                <Text style={styles.linkText}>Não tem conta? <Text style={styles.linkAccent}>Criar conta</Text></Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Criar conta ── */}
          {mode === 'signup' && (
            <View style={styles.form}>
              <TouchableOpacity onPress={() => reset('options')} style={styles.backBtn}>
                <Text style={styles.backText}>← Voltar</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Criar conta</Text>

              <TextInput style={styles.input} value={name} onChangeText={setName}
                placeholder="Seu nome" placeholderTextColor={Colors.faint}
                autoCapitalize="words" />

              <TextInput style={styles.input} value={email} onChangeText={setEmail}
                placeholder="E-mail" placeholderTextColor={Colors.faint}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

              <View style={styles.passwordWrap}>
                <TextInput style={styles.passwordInput} value={password} onChangeText={setPassword}
                  placeholder="Senha (mín. 6 caracteres)" placeholderTextColor={Colors.faint}
                  secureTextEntry={!showPassword} />
                <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
                  <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, (!name || !email || !password || busy) && styles.btnDisabled]}
                onPress={handleSignUp} disabled={!name || !email || !password || busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.btnText}>Criar conta</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => reset('signin')} style={styles.linkBtn}>
                <Text style={styles.linkText}>Já tem conta? <Text style={styles.linkAccent}>Entrar</Text></Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const deco = StyleSheet.create({
  glow: {
    position: 'absolute', top: 60, alignSelf: 'center',
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: Colors.gold, opacity: 0.07,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  logoWrap: { alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  logo: { width: 260, height: 260 },
  form: { gap: Spacing.md },
  title: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text },
  errorBox: { backgroundColor: Colors.coral + '22', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.coral + '44', marginBottom: Spacing.xs },
  errorText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral },
  input: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: FontFamily.body, fontSize: 15, color: Colors.text },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line },
  passwordInput: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: FontFamily.body, fontSize: 15, color: Colors.text },
  eyeBtn: { paddingHorizontal: Spacing.md },
  eyeText: { fontSize: 18 },
  btnGoogle: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md + 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 54, shadowColor: Colors.gold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10 },
  btnEmail: { borderWidth: 1.5, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', backgroundColor: Colors.surf, minHeight: 52 },
  btnEmailText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  btnPrimary: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md + 2, alignItems: 'center', minHeight: 54 },
  btnDisabled: { backgroundColor: Colors.surf2 },
  btnText: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.bg },
  googleG: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.bg },
  sep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sepLine: { flex: 1, height: 1, backgroundColor: Colors.line },
  sepText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint },
  backBtn: { paddingBottom: Spacing.xs },
  backText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.teal },
  linkBtn: { alignItems: 'center' },
  linkText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  linkAccent: { color: Colors.gold, fontFamily: FontFamily.bodyMed },
});
