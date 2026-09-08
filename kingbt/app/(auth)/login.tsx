import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Animated, Easing, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { Icon } from '@/components';

/**
 * Botão dourado em degradê — usado tanto pro CTA único da tela de opções
 * quanto pelos botões de submit (Entrar/Criar conta/Redefinir). Extraído
 * porque o estado desabilitado tinha um bug real: `btnDisabled` trocava só o
 * fundo pro cinza escuro `surf2`, mas o texto continuava com `Colors.bg`
 * (quase preto) — texto escuro sobre fundo escuro, ilegível. Aqui o texto
 * desabilitado usa `Colors.faint`, visível mas claramente inativo.
 */
function GoldButton({ label, onPress, disabled, busy, styles, Colors }: {
  label: string; onPress: () => void; disabled?: boolean; busy?: boolean;
  styles: ReturnType<typeof makeStyles>; Colors: ThemeColors;
}) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85} style={styles.btnGradientWrap}>
      {disabled ? (
        <View style={[styles.btnGradientInner, styles.btnDisabled]}>
          <Text style={styles.btnTextDisabled}>{label}</Text>
        </View>
      ) : (
        <LinearGradient
          colors={[Colors.gold, Colors.goldDeep]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.btnGradientInner}
        >
          {busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.btnText}>{label}</Text>}
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
}

const { width: SW, height: SH } = Dimensions.get('window');

type Mode = 'options' | 'signin' | 'signup' | 'forgot';

// ── Anéis pulsantes ───────────────────────────────────────────────────────────
function PulseRing({ size, delay, borderColor, centerY }: { size: number; delay: number; borderColor: string; centerY: number }) {
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
      top: centerY - size / 2,
      opacity: alpha,
      transform: [{ scale }],
    }} />
  );
}

export default function LoginScreen() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, error, clearError, user, groupIds, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('options');

  // Centro do logo: a tela agora centraliza o conteúdo verticalmente, então a
  // posição real do logo varia com a altura do formulário — os anéis, raios
  // e glow seguem essa medida em vez de um Y fixo.
  const [centerY, setCenterY] = useState(SH * 0.32);
  const onLogoLayout = useCallback((e: { nativeEvent: { layout: { y: number; height: number } } }) => {
    const y = e.nativeEvent.layout.y + e.nativeEvent.layout.height / 2;
    setCenterY(y);
  }, []);

  // Raios rotativos
  const raysRotate  = useRef(new Animated.Value(0)).current;
  const raysOpacity = useRef(new Animated.Value(0)).current;

  // Glow pulsante
  const glowOpacity = useRef(new Animated.Value(0.04)).current;

  // Shimmer em loop
  const shimmerX = useRef(new Animated.Value(-200)).current;

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
    // Após o login: com grupos vai para a tela de escolha; sem grupos, entra/cria
    if (user && groupIds.length > 0) router.replace('/(auth)/groups');
    else if (user) router.replace('/(auth)/join');
  }, [loading, user, groupIds]);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  function reset(m: Mode) { clearError(); setResetSent(false); setMode(m); }

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

  async function handleResetPassword() {
    if (!email) return;
    setBusy(true);
    const ok = await resetPassword(email);
    setBusy(false);
    if (ok) setResetSent(true);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* ── Anéis pulsantes (fora do ScrollView pra cobrir a tela toda) ──
            Antes viviam DENTRO do ScrollView apesar do comentário dizer o
            contrário: por serem 2,5x mais largos que a tela (deco.raysWrap),
            viravam parte do conteúdo rolável e um scroll horizontal (gesto de
            trackpad, por ex.) desalinhava a tela inteira. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <PulseRing size={230} delay={0}    borderColor="rgba(243,197,68,0.35)" centerY={centerY} />
          <PulseRing size={290} delay={500}  borderColor="rgba(243,197,68,0.18)" centerY={centerY} />
          <PulseRing size={360} delay={1000} borderColor="rgba(243,197,68,0.09)" centerY={centerY} />
        </View>

        {/* ── Camada de animação (atrás de tudo) ── */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>

          {/* Raios rotativos */}
          <Animated.View style={[deco.raysWrap, { top: centerY - SW * 1.25, opacity: raysOpacity, transform: [{ rotate: raysRotateDeg }] }]}>
            {[0, 52, 105, 160, 215, 270, 325].map((angle, i) => (
              <View key={i} style={[deco.rayLine, { transform: [{ rotate: `${angle}deg` }] }]}>
                <View style={{ width: SW * 2.5, height: 1.5, backgroundColor: `rgba(243,197,68,${0.04 + (i % 3) * 0.012})` }} />
              </View>
            ))}
          </Animated.View>

          {/* Glow dourado atrás do ícone */}
          <Animated.View style={[deco.glow, { top: centerY - 120, opacity: glowOpacity }]} />

        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Logo com anel dourado + shimmer */}
          <View style={styles.logoWrap} onLayout={onLogoLayout}>
            <LinearGradient
              colors={[Colors.goldBright, Colors.goldDeep, Colors.goldBright]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.logoRing}
            >
              <View style={{ overflow: 'hidden', borderRadius: 96, width: 192, height: 192 }}>
                <Image source={require('../../assets/kingbt-icon.png')} style={styles.logo} resizeMode="contain" />
                {/* Shimmer sweep */}
                <Animated.View style={[deco.shimmer, { transform: [{ translateX: shimmerX }, { skewX: '-20deg' }] }]} />
              </View>
            </LinearGradient>
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
              <Text style={styles.subtitle}>Acesse sua conta e volte pra quadra.</Text>

              <GoldButton label="Entrar com e-mail" onPress={() => reset('signin')} styles={styles} Colors={Colors} />

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
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={19} color={Colors.faint} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => reset('forgot')} style={styles.forgotBtn}>
                <Text style={styles.linkText}>Esqueceu a senha?</Text>
              </TouchableOpacity>

              <GoldButton
                label="Entrar" onPress={handleSignIn}
                disabled={!email || !password || busy} busy={busy}
                styles={styles} Colors={Colors}
              />

              <TouchableOpacity onPress={() => reset('signup')} style={styles.linkBtn}>
                <Text style={styles.linkText}>Não tem conta? <Text style={styles.linkAccent}>Criar conta</Text></Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Esqueceu a senha ── */}
          {mode === 'forgot' && (
            <View style={styles.form}>
              <TouchableOpacity onPress={() => reset('signin')} style={styles.backBtn}>
                <Text style={styles.backText}>← Voltar</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Redefinir senha</Text>

              {resetSent ? (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>
                    Enviamos um link de redefinição de senha para {email}. Verifique sua caixa de entrada (e o spam).
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.linkText}>
                    Informe seu e-mail cadastrado. Vamos enviar um link para você criar uma nova senha.
                  </Text>

                  <TextInput style={styles.input} value={email} onChangeText={setEmail}
                    placeholder="E-mail" placeholderTextColor={Colors.faint}
                    keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

                  <GoldButton
                    label="Enviar link de redefinição" onPress={handleResetPassword}
                    disabled={!email || busy} busy={busy}
                    styles={styles} Colors={Colors}
                  />
                </>
              )}
            </View>
          )}

          {/* ── Criar conta ── */}
          {mode === 'signup' && (
            <View style={styles.form}>
              <TouchableOpacity onPress={() => reset('options')} style={styles.backBtn}>
                <Text style={styles.backText}>← Voltar</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Criar conta</Text>
              <Text style={styles.subtitle}>Cadastre-se e comece a disputar o ranking da temporada.</Text>

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
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={19} color={Colors.faint} />
                </TouchableOpacity>
              </View>

              <GoldButton
                label="Criar conta" onPress={handleSignUp}
                disabled={!name || !email || !password || busy} busy={busy}
                styles={styles} Colors={Colors}
              />

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
    left: -(SW * 0.75),
  },
  rayLine: {
    position: 'absolute',
    width: SW * 2.5, height: SW * 2.5,
    left: 0, top: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    left: SW / 2 - 120,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(243,197,68,0.08)',
  },
  shimmer: {
    position: 'absolute', top: '-40%',
    width: '50%', height: '180%',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  // overflow:'hidden' corta a camada decorativa de raios (deco.raysWrap,
  // 2,5x mais larga que a tela) nos limites da tela — sem isso, no RN Web
  // ela expandia o conteúdo scrollável e um scroll horizontal (trackpad,
  // gesto) desalinhava a tela inteira, cortando o formulário na lateral.
  container: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl },
  logoWrap: { alignItems: 'center', paddingBottom: Spacing.sm },
  logoRing: {
    width: 202, height: 202, borderRadius: 101,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.gold, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  logo: { width: 192, height: 192, borderRadius: 96 },
  form: { gap: Spacing.md },
  title: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, marginTop: -Spacing.sm },
  errorBox: { backgroundColor: Colors.coral + '22', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.coral + '44', marginBottom: Spacing.xs },
  errorText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral },
  successBox: { backgroundColor: Colors.teal + '22', borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.teal + '44' },
  successText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.teal },
  input: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: FontFamily.body, fontSize: 15, color: Colors.text },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line },
  passwordInput: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: FontFamily.body, fontSize: 15, color: Colors.text },
  eyeBtn: { paddingHorizontal: Spacing.md },
  btnGradientWrap: { borderRadius: Radius.md, overflow: 'hidden', shadowColor: Colors.gold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 },
  btnGradientInner: { paddingVertical: Spacing.md + 2, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  btnDisabled: { backgroundColor: Colors.surf2 },
  btnText: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.bg },
  // Antes o estado desabilitado só trocava o fundo (pra surf2) e deixava o
  // texto em Colors.bg (quase preto) — texto ilegível sobre fundo escuro.
  btnTextDisabled: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.faint },
  googleG: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.bg },
  sep: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sepLine: { flex: 1, height: 1, backgroundColor: Colors.line },
  sepText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint },
  backBtn: { paddingBottom: Spacing.xs },
  backText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.teal },
  linkBtn: { alignItems: 'center' },
  forgotBtn: { alignItems: 'flex-end' },
  linkText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted },
  linkAccent: { color: Colors.gold, fontFamily: FontFamily.bodyMed },
});
