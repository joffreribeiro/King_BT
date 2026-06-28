import {
  View,
  Image,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useEffect, useRef, useState, useCallback } from 'react';
import Svg, { Defs, RadialGradient, Stop, Circle as SvgCircle, G } from 'react-native-svg';
import { FontFamily } from '@/theme';

const { width: SW, height: SH } = Dimensions.get('window');
const CX = SW / 2;
const CY = SH / 2;

// --- Particles ---
type Particle = {
  x: Animated.Value;
  y: Animated.Value;
  alpha: Animated.Value;
  size: number;
  key: number;
};

function useParticles(count: number, active: boolean): Particle[] {
  const particles = useRef<Particle[]>([]);

  if (particles.current.length === 0) {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        alpha: new Animated.Value(0),
        size: Math.random() * 2.4 + 0.6,
        key: i,
      });
    }
  }

  const animateParticle = useCallback((p: Particle, delay: number) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 110;
    const startX = CX + Math.cos(angle) * dist;
    const startY = CY + Math.sin(angle) * dist;
    const vx = (Math.random() - 0.5) * 60;
    const vy = -(Math.random() * 80 + 30);
    const duration = 1200 + Math.random() * 800;

    p.x.setValue(startX);
    p.y.setValue(startY);
    p.alpha.setValue(0);

    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(p.alpha, { toValue: 0.7 + Math.random() * 0.25, duration: duration * 0.2, useNativeDriver: true }),
          Animated.timing(p.alpha, { toValue: 0, duration: duration * 0.8, useNativeDriver: true }),
        ]),
        Animated.timing(p.x, { toValue: startX + vx, duration, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: startY + vy, duration, useNativeDriver: true }),
      ]),
    ]).start(() => {
      if (active) animateParticle(p, Math.random() * 400);
    });
  }, [active]);

  useEffect(() => {
    if (!active) return;
    particles.current.forEach((p, i) => {
      animateParticle(p, 1000 + i * 30);
    });
  }, [active]);

  return particles.current;
}

// --- Ring component ---
function PulseRing({ size, delay, borderColor }: { size: number; delay: number; borderColor: string }) {
  const scale = useRef(new Animated.Value(0.93)).current;
  const alpha = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.07, duration: 1900, useNativeDriver: true }),
          Animated.timing(alpha, { toValue: 0.5, duration: 1900, useNativeDriver: true }),
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
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: size > 420 ? 1.5 : 1,
      borderColor,
      left: CX - size / 2,
      top: CY - size / 2,
      opacity: alpha,
      transform: [{ scale }],
    }} />
  );
}

// --- Main component ---
type Props = {
  onFinish: () => void;
};

export default function SplashAnimation({ onFinish }: Props) {
  const [active, setActive] = useState(true);
  const [showReplay, setShowReplay] = useState(false);

  // Animated values
  const coverOpacity   = useRef(new Animated.Value(1)).current;
  const logoScale      = useRef(new Animated.Value(0.32)).current;
  const logoOpacity    = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(50)).current;
  const logoBrightness = useRef(new Animated.Value(0)).current; // unused visual, kept for timing
  const glowOpacity    = useRef(new Animated.Value(0.5)).current;
  const burstOpacity   = useRef(new Animated.Value(0)).current;
  const burstScale     = useRef(new Animated.Value(0.3)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY       = useRef(new Animated.Value(14)).current;
  const shimmerX       = useRef(new Animated.Value(-200)).current;
  const raysOpacity    = useRef(new Animated.Value(0)).current;
  const raysRotate     = useRef(new Animated.Value(0)).current;
  const screenOpacity  = useRef(new Animated.Value(1)).current;

  const particles = useParticles(50, active);

  const runAnimation = useCallback(() => {
    setShowReplay(false);
    setActive(true);

    // Reset all values
    coverOpacity.setValue(1);
    logoScale.setValue(0.32);
    logoOpacity.setValue(0);
    logoTranslateY.setValue(50);
    glowOpacity.setValue(0.5);
    burstOpacity.setValue(0);
    burstScale.setValue(0.3);
    taglineOpacity.setValue(0);
    taglineY.setValue(14);
    shimmerX.setValue(-200);
    raysOpacity.setValue(0);
    raysRotate.setValue(0);
    screenOpacity.setValue(1);

    // 1. Cover fade out at 0.5s
    Animated.timing(coverOpacity, {
      toValue: 0, duration: 550, delay: 500, useNativeDriver: true,
    }).start();

    // 2. Logo reveal at 1.0s
    Animated.sequence([
      Animated.delay(1000),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(logoScale, {
          toValue: 1, friction: 5, tension: 40, useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    ]).start();

    // 3. Burst at 1.1s
    Animated.sequence([
      Animated.delay(1100),
      Animated.parallel([
        Animated.timing(burstOpacity, { toValue: 0.85, duration: 240, useNativeDriver: true }),
        Animated.timing(burstScale, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(burstOpacity, { toValue: 0, duration: 960, useNativeDriver: true }),
        Animated.timing(burstScale, { toValue: 2.4, duration: 960, useNativeDriver: true }),
      ]),
    ]).start();

    // 4. Rays appear at 1.1s
    Animated.sequence([
      Animated.delay(1100),
      Animated.timing(raysOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start(() => {
      Animated.loop(
        Animated.timing(raysRotate, { toValue: 1, duration: 22000, useNativeDriver: true })
      ).start();
    });

    // 5. Glow breathe at 2.8s
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.5, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }, 2800);

    // 6. Shimmer at 2.2s
    Animated.sequence([
      Animated.delay(2200),
      Animated.timing(shimmerX, { toValue: 300, duration: 900, useNativeDriver: true }),
    ]).start();

    // 7. Tagline at 2.5s
    Animated.sequence([
      Animated.delay(2500),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(taglineY, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ]).start();

    // 8. Show replay button at 5.0s
    setTimeout(() => setShowReplay(true), 5000);

    // 9. Auto-finish at 5.5s (fade out em 500ms)
    Animated.sequence([
      Animated.delay(5500),
      Animated.timing(screenOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, []);

  useEffect(() => { runAnimation(); }, []);

  const raysRotateDeg = raysRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', zIndex: 999, opacity: screenOpacity }]}>

      {/* Rotating rays — drawn as a repeating conic approximation using multiple thin wedges */}
      <Animated.View
        style={{
          position: 'absolute',
          width: SW * 2.5,
          height: SW * 2.5,
          left: -(SW * 0.75),
          top: CY - SW * 1.25,
          opacity: raysOpacity,
          transform: [{ rotate: raysRotateDeg }],
        }}
        pointerEvents="none"
      >
        {[0, 50, 110, 165, 220, 285, 340].map((angle, i) => (
          <View key={i} style={{
            position: 'absolute',
            width: SW * 2.5,
            height: SW * 2.5,
            left: 0, top: 0,
            transform: [{ rotate: `${angle}deg` }],
          }}>
            <View style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: SW * 2.5,
              height: 2,
              marginTop: -1,
              backgroundColor: `rgba(243,197,68,${0.04 + (i % 3) * 0.015})`,
              shadowColor: '#F3C544',
              shadowOpacity: 0.4,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
            }} />
          </View>
        ))}
      </Animated.View>

      {/* Pulse rings */}
      <PulseRing size={530} delay={2400} borderColor="rgba(243,197,68,0.13)" />
      <PulseRing size={410} delay={2600} borderColor="rgba(243,197,68,0.07)" />

      {/* Burst */}
      <Animated.View style={{
        position: 'absolute',
        width: 720, height: 720,
        left: CX - 360,
        top: CY - 360,
        borderRadius: 360,
        backgroundColor: 'rgba(243,197,68,0.14)',
        opacity: burstOpacity,
        transform: [{ scale: burstScale }],
      }} />

      {/* Particles */}
      {particles.map(p => (
        <Animated.View
          key={p.key}
          style={{
            position: 'absolute',
            width: p.size * 5,
            height: p.size * 5,
            borderRadius: p.size * 2.5,
            backgroundColor: '#FFDC50',
            left: 0, top: 0,
            opacity: p.alpha,
            transform: [
              { translateX: p.x as any },
              { translateY: p.y as any },
            ],
          }}
          pointerEvents="none"
        />
      ))}

      {/* Logo outer with glow */}
      <Animated.View style={{
        position: 'absolute',
        left: CX - 160,
        top: CY - 200,
        width: 320, height: 320,
        borderRadius: 160,
        opacity: logoOpacity,
        transform: [
          { scale: logoScale },
          { translateY: logoTranslateY },
        ],
        shadowColor: '#F3C544',
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 80,
        shadowOpacity: 0, // controlled by glowOpacity below
        elevation: 0,
      }}>
        {/* Glow layer */}
        <Animated.View style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 160,
          shadowColor: '#F3C544',
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 60,
          shadowOpacity: glowOpacity as any,
          elevation: 30,
        }} />

        {/* Shimmer sweep */}
        <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 160, overflow: 'hidden' }}>
          <Animated.View style={{
            position: 'absolute',
            top: '-40%',
            width: '55%',
            height: '180%',
            backgroundColor: 'rgba(255,255,255,0.18)',
            transform: [
              { translateX: shimmerX },
              { skewX: '-20deg' },
            ],
          }} />
        </View>

        <Image
          source={require('../../assets/kingbt-icon.png')}
          style={{ width: 320, height: 320, borderRadius: 160 }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={{
        position: 'absolute',
        left: 0, right: 0,
        top: CY + 140,
        alignItems: 'center',
        opacity: taglineOpacity,
        transform: [{ translateY: taglineY }],
      }}>
        <Text style={st.tagline}>Play com respeito · Evolua sempre</Text>
      </Animated.View>

      {/* Vignette */}
      <View style={st.vignette} pointerEvents="none" />

      {/* Black cover (opens) */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: coverOpacity }]} pointerEvents="none" />

      {/* Replay button */}
      {showReplay && (
        <TouchableOpacity
          style={st.replayBtn}
          onPress={runAnimation}
          activeOpacity={0.75}
        >
          <Text style={st.replayText}>↺  Repetir</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  tagline: {
    fontFamily: FontFamily.numberBold,
    fontSize: 11,
    letterSpacing: 2.5,
    color: 'rgba(243,197,68,0.6)',
    textTransform: 'uppercase',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    // simulated with a dark border overlay
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 120,
    shadowOpacity: 0.9,
    backgroundColor: 'transparent',
  },
  replayBtn: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: 'rgba(243,197,68,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(243,197,68,0.28)',
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 28,
  },
  replayText: {
    fontFamily: FontFamily.titleBold,
    fontSize: 12,
    color: '#F3C544',
    letterSpacing: 0.5,
  },
});
