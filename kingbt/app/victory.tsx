import { View, Text, Image, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { shareText, notifyCopied } from '@/services/share';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useRef, useMemo } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontFamily, type ThemeColors, Colors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Icon } from '@/components';

export default function VictoryScreen() {
  const params = useLocalSearchParams<{
    winnerName?: string;
    loserName?: string;
    winnerScore?: string;
    loserScore?: string;
    competitionName?: string;
    duration?: string;
    setsGames?: string;
  }>();

  const { colors: Colors } = useTheme();
  const v = useMemo(() => makeStyles(Colors), [Colors]);

  // Games de cada set (na perspectiva vencedor/perdedor) — winnerScore/loserScore
  // acima é o placar em SETS; isto é o detalhe de games dentro de cada set.
  const setsGames = useMemo<{ a: number; b: number }[]>(() => {
    if (!params.setsGames) return [];
    try {
      const parsed = JSON.parse(params.setsGames);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [params.setsGames]);

  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleShare() {
    const result = await shareText(
      `🏆 Resultado King BT\n${params.winnerName ?? 'Vencedor'} ${params.winnerScore ?? '—'} × ${params.loserScore ?? '—'} ${params.loserName ?? ''}\n${params.competitionName ?? ''}\n\n#KingBT #BeachTennis`,
    );
    if (result === 'copied') notifyCopied('Resultado');
  }

  return (
    <SafeAreaView style={v.container} edges={['top', 'bottom']}>
      {/* Mascote King BT no topo — sangra até a borda e dissolve no fundo da tela */}
      <View style={v.banner} pointerEvents="none">
        <Image
          source={require('../assets/kingbt-mascote-fogo.jpg')}
          style={v.bannerImg}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', Colors.bg]}
          style={v.bannerFade}
        />
      </View>

      <ScrollView
        contentContainerStyle={v.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[v.content, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>

          <Text style={v.resultLabel}>RESULTADO FINAL</Text>
          <Icon name="crown" size={40} color={Colors.gold} />
          <Text style={v.title}>VITÓRIA!</Text>

          {/* Score card */}
          <View style={v.scoreCard}>
            <View style={v.scoreCol}>
              <Text style={v.playerName} numberOfLines={1}>
                {params.winnerName ?? 'Vencedor'}
              </Text>
              <Text style={[v.score, { color: Colors.gold }]}>
                {params.winnerScore ?? '—'}
              </Text>
            </View>

            <Text style={v.vs}>×</Text>

            <View style={v.scoreCol}>
              <Text style={v.playerName} numberOfLines={1}>
                {params.loserName ?? 'Perdedor'}
              </Text>
              <Text style={[v.score, { color: Colors.faint }]}>
                {params.loserScore ?? '—'}
              </Text>
            </View>
          </View>

          {setsGames.length > 0 && (
            <View style={v.gamesRow}>
              <Text style={v.gamesLabel}>GAMES</Text>
              <View style={v.gamesChips}>
                {setsGames.map((s, i) => (
                  <Text key={i} style={v.gamesChip}>{s.a}-{s.b}</Text>
                ))}
              </View>
            </View>
          )}

          <Text style={v.meta}>
            {params.competitionName ?? ''}
            {params.duration ? ` · ${params.duration} min` : ''}
          </Text>

          {/* Botões */}
          <TouchableOpacity onPress={handleShare} activeOpacity={0.85} style={v.shareBtn}>
            <LinearGradient
              colors={[Colors.gold, Colors.goldDeep]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={v.shareBtnInner}
            >
              <Text style={v.shareBtnText}>Compartilhar resultado</Text>
            </LinearGradient>
          </TouchableOpacity>

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

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  banner: { position: 'absolute', top: 0, left: 0, right: 0, height: 220 },
  bannerImg: { width: '100%', height: '100%' },
  bannerFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 130 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 150 },
  content: { alignItems: 'center', gap: 16 },
  resultLabel: {
    fontFamily: FontFamily.numberBold,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 2,
  },
  title: {
    fontFamily: FontFamily.titleBold,
    fontSize: 42,
    color: Colors.gold,
    letterSpacing: -1,
    fontWeight: '800',
    textShadowColor: 'rgba(243,197,68,0.4)',
    textShadowRadius: 20,
    textShadowOffset: { width: 0, height: 0 },
  },
  scoreCard: {
    backgroundColor: Colors.surf,
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
    color: Colors.muted,
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
    color: Colors.faint,
  },
  meta: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.muted,
    textAlign: 'center',
  },
  gamesRow: {
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
  },
  gamesLabel: {
    fontFamily: FontFamily.numberBold,
    fontSize: 10,
    color: Colors.faint,
    letterSpacing: 1.5,
  },
  gamesChips: {
    flexDirection: 'row',
    gap: 8,
  },
  gamesChip: {
    fontFamily: FontFamily.numberBold,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.surf,
    borderWidth: 1,
    borderColor: 'rgba(243,197,68,0.18)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    color: Colors.bg,
  },
  continueBtn: {
    width: '100%',
    backgroundColor: Colors.surf,
    borderWidth: 1,
    borderColor: 'rgba(214,175,70,0.18)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  continueBtnText: {
    fontFamily: FontFamily.title,
    fontSize: 15,
    color: Colors.muted,
  },
});
