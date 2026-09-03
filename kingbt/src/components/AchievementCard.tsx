import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef, useMemo } from 'react';
import { FontFamily, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import type { Achievement, UserAchievementStats } from '@/constants/achievements';

interface Props {
  achievement: Achievement;
  stats: UserAchievementStats;
}

export function AchievementCard({ achievement, stats }: Props) {
  const { colors: Colors } = useTheme();
  const ac = useMemo(() => makeStyles(Colors), [Colors]);
  const prog         = achievement.progress(stats);
  const isUnlocked   = prog >= 1;
  const isClose      = prog > 0.65 && !isUnlocked;
  const barAnim      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: prog,
      duration: 600,
      delay: 120,
      useNativeDriver: false,
    }).start();
  }, [prog]);

  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[
      ac.card,
      {
        backgroundColor: isUnlocked ? `${achievement.color}1A` : Colors.surf,
        borderColor:      isUnlocked ? `${achievement.color}44` : Colors.line,
        opacity:          isUnlocked || isClose || prog > 0 ? 1 : 0.55,
      },
    ]}>
      <View style={ac.header}>
        <Text style={ac.icon}>{achievement.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[ac.title, { color: isUnlocked ? achievement.color : Colors.text }]}>
            {achievement.title}
          </Text>
          <Text style={ac.desc}>{achievement.description}</Text>
        </View>
        {isUnlocked && (
          <View style={[ac.checkBadge, { backgroundColor: `${achievement.color}22`, borderColor: `${achievement.color}55` }]}>
            <Text style={[ac.checkText, { color: achievement.color }]}>✓</Text>
          </View>
        )}
      </View>

      {!isUnlocked && (
        <View style={ac.progressSection}>
          <View style={ac.trackRow}>
            <View style={ac.track}>
              <Animated.View style={[
                ac.bar,
                {
                  width: barWidth,
                  backgroundColor: isClose ? achievement.color : Colors.accentLiga,
                },
              ]} />
            </View>
            <Text style={[ac.pctText, { color: isClose ? achievement.color : Colors.muted }]}>
              {achievement.progressLabel(stats)}
            </Text>
          </View>
          {isClose && (
            <Text style={[ac.nearlyText, { color: achievement.color }]}>Quase lá! 🔥</Text>
          )}
        </View>
      )}

      {isUnlocked && (
        <Text style={[ac.unlockedText, { color: achievement.color }]}>
          Conquistado! 🎉
        </Text>
      )}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    borderWidth: 1, borderRadius: 12,
    padding: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', gap: 10,
    alignItems: 'flex-start', marginBottom: 8,
  },
  icon:  { fontSize: 26, lineHeight: 30 },
  title: { fontFamily: FontFamily.title, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  desc:  { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, lineHeight: 14 },
  checkBadge: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  checkText: { fontFamily: FontFamily.numberBold, fontSize: 13 },

  progressSection: { gap: 4 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: {
    flex: 1, height: 5,
    backgroundColor: Colors.surf2, borderRadius: 3, overflow: 'hidden',
  },
  bar: { height: 5, borderRadius: 3 },
  pctText: { fontFamily: FontFamily.numberBold, fontSize: 9, minWidth: 36, textAlign: 'right' },
  nearlyText: { fontFamily: FontFamily.bodyMed, fontSize: 9, fontWeight: '600' },
  unlockedText: { fontFamily: FontFamily.bodyMed, fontSize: 11, fontWeight: '700', marginTop: 4 },
});
