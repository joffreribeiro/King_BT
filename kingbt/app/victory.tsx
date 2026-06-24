import { View, Text, StyleSheet, TouchableOpacity, Share, Animated, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontFamily } from '@/theme';

const CONFETTI_COLORS = ['#F3C544', '#54B981', '#C084FC', '#6B7FD7', '#E5483D', '#FFDD66', '#54B981'];

function Confetti() {
  const items = Array.from({ length: 14 }, (_, i) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 1800 + i * 120, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 1800 + i * 120, useNativeDriver: true }),
        ])
      ).start();
    }, []);
    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
    const opacity = anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0.6] });
    return { anim, translateY, opacity, i };
  });

  return (
    <>
      {items.map(({ translateY, opacity, i }) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: `${8 + (i % 4) * 6}%` as any,
            left: `${5 + (i * 7) % 90}%` as any,
            width: i % 3 === 0 ? 8 : 6,
            height: i % 3 === 0 ? 8 : 5,
            borderRadius: i % 2 === 0 ? 4 : 1,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            opacity,
            transform: [{ translateY }],
          }}
        />
      ))}
    </>
  );
}

export default function VictoryScreen() {
  const params = useLocalSearchParams<{
    winnerName?: string;
    loserName?: string;
    winnerScore?: string;
    loserScore?: string;
    competitionName?: string;
    duration?: string;
  }>();

  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleShare() {
    await Share.share({
      message: `🏆 Resultado King BT\n${params.winnerName ?? 'Vencedor'} ${params.winnerScore ?? '—'} × ${params.loserScore ?? '—'} ${params.loserName ?? ''}\n${params.competitionName ?? ''}\n\n#KingBT #BeachTennis`,
    });
  }

  return (
    <SafeAreaView style={v.container} edges={['top', 'bottom']}>
      <Confetti />

      <ScrollView
        contentContainerStyle={v.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[v.content, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>

          <Text style={v.resultLabel}>RESULTADO FINAL</Text>
          <Text style={v.crown}>👑</Text>
          <Text style={v.title}>VITÓRIA!</Text>

          {/* Score card */}
          <View style={v.scoreCard}>
            <View style={v.scoreCol}>
              <Text style={v.playerName} numberOfLines={1}>
                {params.winnerName ?? 'Vencedor'}
              </Text>
              <Text style={[v.score, { color: '#F3C544' }]}>
                {params.winnerScore ?? '—'}
              </Text>
            </View>

            <Text style={v.vs}>×</Text>

            <View style={v.scoreCol}>
              <Text style={v.playerName} numberOfLines={1}>
                {params.loserName ?? 'Perdedor'}
              </Text>
              <Text style={[v.score, { color: '#6E6452' }]}>
                {params.loserScore ?? '—'}
              </Text>
            </View>
          </View>

          <Text style={v.meta}>
            {params.competitionName ?? ''}
            {params.duration ? ` · ${params.duration} min` : ''}
          </Text>

          {/* Botões */}
          <TouchableOpacity
            onPress={() => router.replace('/(app)')}
            activeOpacity={0.8}
            style={v.continueBtn}
          >
            <Text style={v.continueBtnText}>Continuar</Text>
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const v = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  content: { alignItems: 'center', gap: 16 },
  resultLabel: {
    fontFamily: FontFamily.numberBold,
    fontSize: 10,
    color: '#A99B7C',
    letterSpacing: 2,
  },
  crown: { fontSize: 48 },
  title: {
    fontFamily: FontFamily.titleBold,
    fontSize: 42,
    color: '#F3C544',
    letterSpacing: -1,
    fontWeight: '800',
    textShadowColor: 'rgba(243,197,68,0.4)',
    textShadowRadius: 20,
    textShadowOffset: { width: 0, height: 0 },
  },
  scoreCard: {
    backgroundColor: '#16140F',
    borderWidth: 1,
    borderColor: 'rgba(243,197,68,0.18)',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  scoreCol: { flex: 1, alignItems: 'center', gap: 4 },
  playerName: {
    fontFamily: FontFamily.bodyMed,
    fontSize: 13,
    color: '#A99B7C',
    textAlign: 'center',
  },
  score: {
    fontFamily: FontFamily.titleBold,
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: -2,
    lineHeight: 60,
  },
  vs: {
    fontFamily: FontFamily.numberBold,
    fontSize: 22,
    color: '#6E6452',
  },
  meta: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: '#A99B7C',
    textAlign: 'center',
  },
  shareBtn: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  shareBtnInner: {
    padding: 14,
    alignItems: 'center',
  },
  shareBtnText: {
    fontFamily: FontFamily.title,
    fontSize: 15,
    color: '#fff',
  },
  continueBtn: {
    width: '100%',
    backgroundColor: '#16140F',
    borderWidth: 1,
    borderColor: 'rgba(214,175,70,0.18)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  continueBtnText: {
    fontFamily: FontFamily.title,
    fontSize: 15,
    color: '#A99B7C',
  },
});
