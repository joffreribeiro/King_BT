import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Animated, Easing, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { useAuth } from '@/store/AuthContext';

const { width: SW, height: SH } = Dimensions.get('window');
// Centro aproximado do ícone (topo da tela + padding)
const ICON_CX = SW / 2;
const ICON_CY = 140;

type Mode = 'options' | 'signin' | 'signup';

// ── Anéis pulsantes ───────────────────────────────────────────────────────────
function PulseRing({ size, delay, borderColor }: { size: number; delay: number; borderColor: string }) {
  const scale = useRef(new Animated.Value(0.93)).current;
  const alpha = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.07, duration: 1900, useNativeDriver: true }),
          Animated.timing(alpha, { toValue: 0.6, duration: 1900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.93, duration: 1900, useNativeDriver: true }),
          Animated.timing(alpha, { toValue: 0.2, duration: 1900, useNativeDriver: true }),
        ]),
      ])
    );
    const t = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(t); loop.stop(); };
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 1.5, borderColor,
      left: SW / 2 - size / 2,
      top: ICON_CY - size / 2,
      opacity: alpha,
      transform: [{ scale }],
    }} />
  );
}

// ── Partículas ────────────────────────────────────────────────────────────────
type Particle = { x: Animated.Value; y: Animated.Value; alpha: Animated.Value; size: number; key: number };

function useLoginParticles(count: number) {
  const particles = useRef<Particle[]>([]);
  if (particles.current.length === 0) {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x: new Animated.Value(0), y: new Animated.Value(0),
        alpha: new Animated.Value(0), size: Math.random() * 2 + 0.8, key: i,
      });
    }
  }
  const animate = useCallback((p: Particle, delay: number) => {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 40 + Math.random() * 80;
    const sx = ICON_CX + Math.cos(angle) * dist;
    const sy = ICON_CY + Math.sin(angle) * dist;
    const vx = (Math.random() - 0.5) * 50;
    const vy = -(Math.random() * 60 + 20);
    const dur = 1000 + Math.random() * 800;
    p.x.setValue(sx); p.y.setValue(sy); p.alpha.setValue(0);
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(p.alpha, { toValue: 0.8, duration: dur * 0.2, useNativeDriver: true }),
          Animated.timing(p.alpha, { toValue: 0,   duration: dur * 0.8, useNativeDriver: true }),
        ]),
        Animated.timing(p.x, { toValue: sx + vx, duration: dur, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: sy + vy, duration: dur, useNativeDriver: true }),
      ]),
    ]).start(() => animate(p, Math.random() * 500));
  }, []);

  useEffect(() => {
    particles.current.forEach((p, i) => animate(p, 800 + i * 40));
  }, []);

  return particles.current;
}

export default function LoginScreen() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, error, clearError, user, group, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('options');

  // Raios rotativos
  const raysRotate  = useRef(new Animated.Value(0)).current;
  const raysOpacity = useRef(new Animated.Value(0)).current;

  // Glow pulsante
  const glowOpacity = useRef(new Animated.Value(0.04)).current;

  // Shimmer em loop
  const shimmerX = useRef(new Animated.Value(-200)).current;

  const particles = useLoginParticles(30);

  useEffect(() => {
    // Raios aparecem e giram
    Animated.timing(raysOpacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    Animated.loop(
      Animated.timing(raysRotate, { toValue: 1, duration: 20000, useNativeDriver: true, easing: Easing.linear })
    ).start();

    // Glow pulsa bem sutil
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1,   duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(glowOpacity, { toValue: 0.3, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();

    // Shimmer varre em loop
    const runShimmer = () => {
      shimmerX.setValue(-200);
      Animated.timing(shimmerX, { toValue: 260, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
        .start(() => setTimeout(runShimmer, 2000));
    };
    setTimeout(runShimmer, 1000);
  }, []);

  const raysRotateDeg = raysRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

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

          {/* ── Anéis pulsantes (fora do ScrollView para cobrir a tela) ── */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <PulseRing size={230} delay={0}    borderColor="rgba(243,197,68,0.35)" />
            <PulseRing size={290} delay={500}  borderColor="rgba(243,197,68,0.18)" />
            <PulseRing size={360} delay={1000} borderColor="rgba(243,197,68,0.09)" />
          </View>

          {/* ── Camada de animação (atrás de tudo) ── */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>

            {/* Raios rotativos */}
            <Animated.View style={[deco.raysWrap, { opacity: raysOpacity, transform: [{ rotate: raysRotateDeg }] }]}>
              {[0, 52, 105, 160, 215, 270, 325].map((angle, i) => (
                <View key={i} style={[deco.rayLine, { transform: [{ rotate: `${angle}deg` }] }]}>
                  <View style={{ width: SW * 2.5, height: 1.5, backgroundColor: `rgba(243,197,68,${0.04 + (i % 3) * 0.012})` }} />
                </View>
              ))}
            </Animated.View>

            {/* Glow dourado atrás do ícone */}
            <Animated.View style={[deco.glow, { opacity: glowOpacity }]} />

            {/* Partículas */}
            {particles.map(p => (
              <Animated.View key={p.key} style={{
                position: 'absolute', width: p.size * 5, height: p.size * 5,
                borderRadius: p.size * 2.5, backgroundColor: '#FFDC50',
                left: 0, top: 0, opacity: p.alpha,
                transform: [{ translateX: p.x as any }, { translateY: p.y as any }],
              }} />
            ))}
          </View>

          {/* Logo com shimmer */}
          <View style={styles.logoWrap}>
            <View style={styles.logoGlow}>
              <View style={{ overflow: 'hidden', borderRadius: 100, width: 200, height: 200 }}>
                <Image source={require('../../assets/kingbt-icon.png')} style={styles.logo} resizeMode="contain" />
                {/* Shimmer sweep */}
                <Animated.View style={[deco.shimmer, { transform: [{ translateX: shimmerX }, { skewX: '-20deg' }] }]} />
              </View>
            </View>
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
  raysWrap: {
    position: 'absolute',
    width: SW * 2.5, height: SW * 2.5,
    left: -(SW * 0.75), top: ICON_CY - SW * 1.25,
  },
  rayLine: {
    position: 'absolute',
    width: SW * 2.5, height: SW * 2.5,
    left: 0, top: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    top: ICON_CY - 120, left: SW / 2 - 120,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(243,197,68,0.08)',
  },
  shimmer: {
    position: 'absolute', top: '-40%',
    width: '50%', height: '180%',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  logoWrap: { alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  logoGlow: {
    width: 200, height: 200, borderRadius: 100,
  },
  logo: { width: 200, height: 200, borderRadius: 100 },
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
