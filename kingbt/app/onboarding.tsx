import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Animated, Easing, Dimensions,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily } from '@/theme';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = '@kingbt:onboarding_done';

// ── Dots ──────────────────────────────────────────────────────────────────────
function Dots({ total, current }: { total: number; current: number }) {
  return (
    <View style={dot.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[dot.dot, i === current ? dot.active : dot.inactive]}
        />
      ))}
    </View>
  );
}
const dot = StyleSheet.create({
  row:      { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 },
  dot:      { height: 6, borderRadius: 3 },
  active:   { width: 20, backgroundColor: '#F3C544' },
  inactive: { width: 6,  backgroundColor: '#3a3228' },
});

// ── Slide 1: Welcome ──────────────────────────────────────────────────────────
function SlideWelcome() {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);

  const shadowRadius = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 48] });

  return (
    <View style={ob.slide}>
      <Animated.View style={[ob.logoContainer, { shadowRadius }]}>
        <Image
          source={require('../assets/kingbt-icon.png')}
          style={ob.logo}
          resizeMode="contain"
        />
      </Animated.View>
      <Text style={ob.greeting}>Bem-vindo ao</Text>
      <Text style={ob.brandName}>KING BT</Text>
      <Text style={ob.tagline}>Play com respeito,{'\n'}evolua sempre.</Text>
    </View>
  );
}

// ── Slide 2: Features ─────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '🏆', label: 'Competições',      desc: 'Crie e gerencie torneios e ligas de Beach Tennis', color: '#F3C544' },
  { icon: '📊', label: 'Quadra ao vivo',   desc: 'Registre o placar em tempo real direto da quadra',  color: '#54B981' },
  { icon: '👑', label: 'Ranking e Badges', desc: 'Histórico, evolução de rating e conquistas',        color: '#C084FC' },
];

function SlideFeatures() {
  return (
    <View style={[ob.slide, { alignItems: 'flex-start', justifyContent: 'center' }]}>
      <Text style={[ob.slideTitle, { textAlign: 'left', fontSize: 32, lineHeight: 38 }]}>
        O que você vai{'\n'}encontrar
      </Text>
      <Text style={[ob.slideSubtitle, { textAlign: 'left', marginBottom: 16 }]}>
        Tudo para sua temporada de Beach Tennis
      </Text>
      {FEATURES.map(f => (
        <View key={f.label} style={[ob.featureCard, { borderColor: `${f.color}33` }]}>
          <View style={[ob.featureIcon, { backgroundColor: `${f.color}22`, width: 48, height: 48, borderRadius: 12 }]}>
            <Text style={{ fontSize: 22 }}>{f.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ob.featureLabel}>{f.label}</Text>
            <Text style={ob.featureDesc}>{f.desc}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Slide 3: CTA ──────────────────────────────────────────────────────────────
function SlideCta({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  return (
    <View style={[ob.slide, { justifyContent: 'space-between', paddingBottom: 48 }]}>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <Image
          source={require('../assets/kingbt-icon.png')}
          style={ob.logoSmall}
          resizeMode="contain"
        />
        <Text style={ob.ctaGreeting}>Pronto para</Text>
        <Text style={ob.ctaBig}>começar?</Text>
        <Text style={ob.ctaSubtitle}>
          Faça parte da comunidade King BT e dispute o ranking da temporada.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <Dots total={3} current={2} />

        <TouchableOpacity onPress={onFinish} activeOpacity={0.9} style={{ borderRadius: 14, overflow: 'hidden' }}>
          <LinearGradient colors={['#F3C544', '#C2891A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ob.primaryBtnInner}>
            <Text style={ob.primaryBtnText}>Criar conta gratuita</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={ob.secondaryBtn} onPress={onFinish} activeOpacity={0.8}>
          <Text style={ob.secondaryBtnText}>Já tenho uma conta</Text>
        </TouchableOpacity>

        <TouchableOpacity style={ob.backBtnCta} onPress={onBack} activeOpacity={0.7}>
          <Text style={ob.backBtnText}>← Voltar</Text>
        </TouchableOpacity>

        <Text style={ob.termsText}>Ao continuar você aceita os Termos de Uso</Text>
      </View>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const [step, setStep] = useState(0);

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(auth)/login');
  };

  const goNext = () => {
    if (step < 2) setStep(s => s + 1);
    else finishOnboarding();
  };

  const goBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Botão Pular */}
      {step < 2 && (
        <TouchableOpacity style={ob.skipBtn} onPress={finishOnboarding}>
          <Text style={ob.skipText}>Pular</Text>
        </TouchableOpacity>
      )}

      {/* Slide ativo */}
      <View style={{ flex: 1 }}>
        {step === 0 && <SlideWelcome />}
        {step === 1 && <SlideFeatures />}
        {step === 2 && <SlideCta onFinish={finishOnboarding} onBack={goBack} />}
      </View>

      {/* Footer com dots + botões (slides 0 e 1) */}
      {step < 2 && (
        <View style={ob.footer}>
          <Dots total={3} current={step} />
          <View style={ob.btnRow}>
            {step > 0 && (
              <TouchableOpacity style={ob.backBtn} onPress={goBack}>
                <Text style={ob.backBtnText}>← Voltar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[ob.nextBtn, step === 0 && { flex: 1 }]}
              onPress={goNext}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#F3C544', '#C2891A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={ob.nextBtnInner}
              >
                <Text style={ob.nextBtnText}>Próximo →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ob = StyleSheet.create({
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 80,
    gap: 12,
  },

  // Welcome
  logoContainer: {
    width: 200, height: 200, borderRadius: 100,
    shadowColor: '#F3C544',
    shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    marginBottom: 8,
  },
  logo:      { width: 200, height: 200, borderRadius: 100 },
  logoSmall: { width: 120, height: 120, borderRadius: 60, marginBottom: 8 },
  greeting:  { fontFamily: FontFamily.body,       fontSize: 14, color: '#6E6452' },
  brandName: { fontFamily: FontFamily.titleBold,  fontSize: 42, color: '#F3C544', letterSpacing: -1.5, fontWeight: '800' },
  tagline:   { fontFamily: FontFamily.body,       fontSize: 13, color: '#6E6452', textAlign: 'center', lineHeight: 20 },

  // Features
  slideTitle:    { fontFamily: FontFamily.titleBold, fontSize: 28, color: '#F6EFDD', textAlign: 'center', fontWeight: '800' },
  slideSubtitle: { fontFamily: FontFamily.body,      fontSize: 13, color: '#6E6452', textAlign: 'center', marginBottom: 8 },
  featureCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#16140F', borderWidth: 1, borderRadius: 12,
    padding: 12, width: '100%',
  },
  featureIcon:  { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureLabel: { fontFamily: FontFamily.title,  fontSize: 13, color: '#F6EFDD', fontWeight: '700', marginBottom: 2 },
  featureDesc:  { fontFamily: FontFamily.body,   fontSize: 10, color: '#6E6452', lineHeight: 15 },

  // CTA
  ctaTitle:    { fontFamily: FontFamily.titleBold, fontSize: 32, color: '#F6EFDD', textAlign: 'center', fontWeight: '800' },
  ctaGreeting: { fontFamily: FontFamily.body, fontSize: 18, color: '#F6EFDD', textAlign: 'center' },
  ctaBig:      { fontFamily: FontFamily.titleBold, fontSize: 48, color: '#F6EFDD', textAlign: 'center', fontWeight: '800', letterSpacing: -2, lineHeight: 52, marginTop: -4 },
  ctaSubtitle: { fontFamily: FontFamily.body,      fontSize: 13, color: '#6E6452', textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  primaryBtnInner: { padding: 16, alignItems: 'center', borderRadius: 14 },
  primaryBtnText:  { fontFamily: FontFamily.title, fontSize: 15, color: '#000', fontWeight: '700' },
  secondaryBtn:     { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, alignItems: 'center' },
  secondaryBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: '#A99B7C', fontWeight: '700' },
  termsText:        { fontFamily: FontFamily.body, fontSize: 10, color: '#3a3228', textAlign: 'center' },

  // Nav
  skipBtn:  { position: 'absolute', top: 54, right: 24, zIndex: 10, padding: 8 },
  skipText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: '#6E6452' },
  footer:   { paddingHorizontal: 24, paddingBottom: 36, gap: 0 },
  btnRow:   { flexDirection: 'row', gap: 10 },
  backBtn:    { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  backBtnCta: { alignItems: 'center', paddingVertical: 8 },
  backBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: '#6E6452' },
  nextBtn:  { flex: 1, borderRadius: 14, overflow: 'hidden' },
  nextBtnInner: { padding: 14, alignItems: 'center' },
  nextBtnText:  { fontFamily: FontFamily.title, fontSize: 15, color: '#000', fontWeight: '700' },
});
