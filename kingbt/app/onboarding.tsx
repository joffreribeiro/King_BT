import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Animated, Easing, Dimensions,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Defs, RadialGradient as SvgRadialGradient, LinearGradient as SvgLinearGradient,
  Stop, Rect, Text as SvgText,
} from 'react-native-svg';
import { FontFamily } from '@/theme';
import { Icon, type IconName } from '@/components';

const { width, height } = Dimensions.get('window');
const ONBOARDING_KEY = '@kingbt:onboarding_done';

const GOLD_BRIGHT = '#FFDD66';
const GOLD        = '#F3C544';
const GOLD_DEEP    = '#C2891A';
const TEAL         = '#54B981';
const PURPLE       = '#C084FC';

// ── Glow radial (fundo) ─────────────────────────────────────────────────────
// Substitui o preto chapado atrás do conteúdo por um brilho dourado suave,
// ancorado onde o olho já pousa primeiro (o mascote). Puramente decorativo —
// pointerEvents 'none' pra nunca capturar toque.
function RadialGlow({ cy, r, opacity = 0.24 }: { cy: number; r: number; opacity?: number }) {
  return (
    <Svg width={width} height={height * 0.7} style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Defs>
        <SvgRadialGradient id="glow" cx={width / 2} cy={cy} r={r} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={GOLD} stopOpacity={opacity} />
          <Stop offset="1" stopColor={GOLD} stopOpacity={0} />
        </SvgRadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height * 0.7} fill="url(#glow)" />
    </Svg>
  );
}

// ── "KING BT" em degradê metálico (em vez de dourado sólido) ────────────────
function BrandWordmark({ fontSize }: { fontSize: number }) {
  return (
    <Svg width={280} height={fontSize * 1.25}>
      <Defs>
        <SvgLinearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={GOLD_BRIGHT} />
          <Stop offset="0.55" stopColor={GOLD} />
          <Stop offset="1" stopColor={GOLD_DEEP} />
        </SvgLinearGradient>
      </Defs>
      <SvgText
        x="50%" y={fontSize * 0.92}
        fontSize={fontSize}
        fontFamily={FontFamily.titleBold}
        fontWeight="800"
        letterSpacing={-1.5}
        fill="url(#brandGrad)"
        textAnchor="middle"
      >
        KING BT
      </SvgText>
    </Svg>
  );
}

// ── Logo com anel dourado ────────────────────────────────────────────────────
function LogoRing({ ringSize, imageSize }: { ringSize: number; imageSize: number }) {
  return (
    <LinearGradient
      colors={[GOLD_BRIGHT, GOLD_DEEP, GOLD_BRIGHT]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: ringSize, height: ringSize, borderRadius: ringSize / 2,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Image
        source={require('../assets/kingbt-icon.png')}
        style={{ width: imageSize, height: imageSize, borderRadius: imageSize / 2 }}
        resizeMode="cover"
      />
    </LinearGradient>
  );
}

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
  active:   { width: 20, backgroundColor: GOLD },
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

  const shadowRadius = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [22, 50] });

  return (
    <View style={ob.slideWelcome}>
      <RadialGlow cy={height * 0.32} r={height * 0.32} />
      <Animated.View style={[ob.logoShadow, { shadowRadius }]}>
        <LogoRing ringSize={158} imageSize={148} />
      </Animated.View>
      <View style={ob.kickerRule} />
      <Text style={ob.greeting}>Bem-vindo ao</Text>
      <BrandWordmark fontSize={44} />
      <Text style={ob.tagline}>Play com respeito,{'\n'}evolua sempre.</Text>
    </View>
  );
}

// ── Slide 2: Features ─────────────────────────────────────────────────────────
const FEATURES: { icon: IconName; label: string; desc: string; color: string }[] = [
  { icon: 'competitions', label: 'Competições',      desc: 'Crie e gerencie torneios e ligas de Beach Tennis', color: GOLD },
  { icon: 'chart',        label: 'Quadra ao vivo',   desc: 'Registre o placar em tempo real direto da quadra',  color: TEAL },
  { icon: 'crown',        label: 'Ranking e Badges', desc: 'Histórico, evolução de rating e conquistas',        color: PURPLE },
];

function FeatureCard({ f }: { f: typeof FEATURES[number] }) {
  return (
    <View style={[ob.featureCard, { borderColor: `${f.color}4D` }]}>
      <LinearGradient
        colors={[`${f.color}26`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 0.4 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[ob.featureIcon, { backgroundColor: `${f.color}26`, shadowColor: f.color }]}>
        <Icon name={f.icon} size={22} color={f.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ob.featureLabel}>{f.label}</Text>
        <Text style={ob.featureDesc}>{f.desc}</Text>
      </View>
    </View>
  );
}

function SlideFeatures() {
  return (
    <View style={ob.slideFeatures}>
      <View>
        <Text style={ob.eyebrow}>3 FERRAMENTAS</Text>
        <Text style={ob.slideTitle}>O que você vai{'\n'}encontrar</Text>
        <Text style={ob.slideSubtitle}>Tudo para sua temporada de Beach Tennis</Text>
      </View>
      <View style={ob.featureList}>
        {FEATURES.map(f => <FeatureCard key={f.label} f={f} />)}
      </View>
    </View>
  );
}

// ── Slide 3: CTA ──────────────────────────────────────────────────────────────
function SlideCta({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  return (
    <View style={ob.slideCta}>
      <RadialGlow cy={height * 0.14} r={height * 0.22} opacity={0.18} />

      <View style={{ alignItems: 'center', gap: 14 }}>
        <LogoRing ringSize={88} imageSize={80} />
        <Text style={ob.ctaGreeting}>Pronto para</Text>
        <Text style={ob.ctaBig}>começar?</Text>
        <Text style={ob.ctaSubtitle}>
          Faça parte da comunidade King BT e dispute o ranking da temporada.
        </Text>

        <View style={ob.trustPill}>
          <View style={ob.trustAvatars}>
            <View style={[ob.trustDot, { backgroundColor: GOLD }]} />
            <View style={[ob.trustDot, { backgroundColor: TEAL, marginLeft: -7 }]} />
            <View style={[ob.trustDot, { backgroundColor: PURPLE, marginLeft: -7 }]} />
          </View>
          <Text style={ob.trustText}>Junte-se aos jogadores da sua região</Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Dots total={3} current={2} />

        <TouchableOpacity onPress={onFinish} activeOpacity={0.9} style={{ borderRadius: 14, overflow: 'hidden' }}>
          <LinearGradient colors={[GOLD, GOLD_DEEP]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ob.primaryBtnInner}>
            <Text style={ob.primaryBtnText}>Criar conta gratuita</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={ob.linkBtn} onPress={onFinish} activeOpacity={0.7}>
          <Text style={ob.linkBtnText}>Já tenho uma conta</Text>
        </TouchableOpacity>

        <View style={ob.quietRow}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <Text style={ob.quietText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={ob.quietText}>Ao continuar você aceita os Termos de Uso</Text>
        </View>
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
                colors={[GOLD, GOLD_DEEP]}
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
// Tela de marca: roda antes de escolher grupo/tema e é sempre escura, então as
// cores ficam cruas de propósito, fora do ThemeContext. O texto secundário usava
// '#6E6452' (~3,4:1 sobre o fundo, abaixo de AA) — mesma cor que o tema já havia
// abandonado por isso; passou para o '#8A7E66' do token `faint`.
const ob = StyleSheet.create({
  // Welcome — sem paddingTop no topo: o glow + logo ficam
  // centralizados de verdade no eixo vertical, não empurrados pra baixo.
  slideWelcome: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  logoShadow: {
    borderRadius: 79,
    shadowColor: GOLD,
    shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    marginBottom: 8,
  },
  kickerRule: { width: 30, height: 2, borderRadius: 1, backgroundColor: GOLD, opacity: 0.5, marginTop: 4 },
  greeting:  { fontFamily: FontFamily.body,       fontSize: 15, color: '#8A7E66' },
  tagline:   { fontFamily: FontFamily.body,       fontSize: 13, color: '#8A7E66', textAlign: 'center', lineHeight: 20, marginTop: -4 },

  // Features
  slideFeatures: {
    width,
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 84,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: FontFamily.numberBold, fontSize: 11, color: GOLD,
    letterSpacing: 2, marginBottom: 10,
  },
  slideTitle:    { fontFamily: FontFamily.titleBold, fontSize: 30, lineHeight: 36, color: '#F6EFDD', fontWeight: '800' },
  slideSubtitle: { fontFamily: FontFamily.body,      fontSize: 13, color: '#8A7E66', marginTop: 8 },
  featureList: { gap: 12 },
  featureCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#16140F', borderWidth: 1, borderRadius: 14,
    padding: 14, overflow: 'hidden',
  },
  featureIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  featureLabel: { fontFamily: FontFamily.title,  fontSize: 14, color: '#F6EFDD', fontWeight: '700', marginBottom: 2 },
  featureDesc:  { fontFamily: FontFamily.body,   fontSize: 11.5, color: '#8A7E66', lineHeight: 16 },

  // CTA
  slideCta: {
    width,
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 90,
    paddingBottom: 48,
  },
  ctaGreeting: { fontFamily: FontFamily.body, fontSize: 18, color: '#F6EFDD', textAlign: 'center' },
  ctaBig:      { fontFamily: FontFamily.titleBold, fontSize: 48, color: '#F6EFDD', textAlign: 'center', fontWeight: '800', letterSpacing: -2, lineHeight: 52, marginTop: -4 },
  ctaSubtitle: { fontFamily: FontFamily.body,      fontSize: 13, color: '#8A7E66', textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  trustPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6,
    backgroundColor: '#16140F', borderWidth: 1, borderColor: 'rgba(214,175,70,0.16)',
    borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14,
  },
  trustAvatars: { flexDirection: 'row' },
  trustDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#000' },
  trustText: { fontFamily: FontFamily.body, fontSize: 11, color: '#A99B7C' },

  primaryBtnInner: { padding: 16, alignItems: 'center', borderRadius: 14 },
  primaryBtnText:  { fontFamily: FontFamily.title, fontSize: 15, color: '#000', fontWeight: '700' },
  linkBtn:      { alignItems: 'center', paddingVertical: 10 },
  linkBtnText:  { fontFamily: FontFamily.bodyMed, fontSize: 15, color: GOLD, fontWeight: '700' },
  quietRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  quietText: { fontFamily: FontFamily.body, fontSize: 11, color: '#3a3228', flexShrink: 1 },

  // Nav
  skipBtn:  { position: 'absolute', top: 54, right: 24, zIndex: 10, padding: 8 },
  skipText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: '#8A7E66' },
  footer:   { paddingHorizontal: 24, paddingBottom: 36, gap: 0 },
  btnRow:   { flexDirection: 'row', gap: 10 },
  backBtn:    { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: '#8A7E66' },
  nextBtn:  { flex: 1, borderRadius: 14, overflow: 'hidden' },
  nextBtnInner: { padding: 14, alignItems: 'center' },
  nextBtnText:  { fontFamily: FontFamily.title, fontSize: 15, color: '#000', fontWeight: '700' },
});
