import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRef, useEffect } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import type { StreakInfo } from '@/logic/streak';

interface StreakBannerProps {
  streak: StreakInfo;
  onPress?: () => void;
}

export function StreakBanner({ streak, onPress }: StreakBannerProps) {
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  if (streak.type === 'none') return null;

  const isWinning   = streak.type === 'winning';
  const icon        = isWinning ? '🔥' : '💪';
  const accent      = isWinning ? Colors.gold : Colors.teal;
  const bgColor     = isWinning ? 'rgba(243,197,68,0.10)' : 'rgba(84,185,129,0.10)';
  const borderColor = isWinning ? 'rgba(243,197,68,0.30)' : 'rgba(84,185,129,0.25)';
  const message     = isWinning
    ? `Você está em ${streak.count} vitórias seguidas!`
    : `Sua última vitória foi há ${streak.daysSince} dias — bora jogar!`;

  return (
    <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[s.banner, { backgroundColor: bgColor, borderColor }]}
      >
        <Text style={s.icon}>{icon}</Text>
        <Text style={[s.message, { color: accent }]}>{message}</Text>
        <Text style={[s.arrow, { color: accent }]}>→</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  icon:    { fontSize: 18 },
  message: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, lineHeight: 18 },
  arrow:   { fontFamily: FontFamily.titleBold, fontSize: 16 },
});
