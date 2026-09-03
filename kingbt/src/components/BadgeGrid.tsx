import { View, Text, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { FontFamily, PODIUM_COLORS, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

interface BadgeStats {
  currentStreak: number;
  rankPosition: number;
  hasWonSuper8: boolean;
  totalWins: number;
}

const BADGE_RULES: {
  id: string;
  icon: string;
  label: string;
  color: string;
  condition: (s: BadgeStats) => boolean;
}[] = [
  { id: 'first',   icon: '⭐', label: '1ª Vitória',    color: '#6B7FD7', condition: s => s.totalWins >= 1 },
  { id: 'streak3', icon: '🔥', label: '3× Seguidas',  color: '#54B981', condition: s => s.currentStreak >= 3 },
  { id: 'king',    icon: '👑', label: 'Rei da Quadra', color: '#F3C544', condition: s => s.rankPosition === 1 },
  { id: 'mvp',     icon: '🏆', label: 'Super 8 MVP',   color: '#C084FC', condition: s => s.hasWonSuper8 },
  { id: 'streak5', icon: '⚡', label: '5× Seguidas',  color: '#F3C544', condition: s => s.currentStreak >= 5 },
  { id: 'top3',    icon: '🥉', label: 'Top 3',         color: PODIUM_COLORS[2], condition: s => s.rankPosition <= 3 },
];

interface Props {
  stats: BadgeStats;
}

export function BadgeGrid({ stats }: Props) {
  const { colors: Colors } = useTheme();
  const bg = useMemo(() => makeStyles(Colors), [Colors]);
  return (
    <View style={bg.grid}>
      {BADGE_RULES.map(rule => {
        const unlocked = rule.condition(stats);
        return (
          <View key={rule.id} style={[bg.item, !unlocked && bg.locked]}>
            <Text style={[bg.emoji, !unlocked && bg.emojiLocked]}>{rule.icon}</Text>
            <Text style={[bg.label, { color: unlocked ? rule.color : Colors.faint }]} numberOfLines={2}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  item: {
    width: '30%',
    alignItems: 'center',
    gap: 4,
    padding: 10,
    backgroundColor: 'rgba(243,197,68,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(243,197,68,0.2)',
  },
  locked: {
    backgroundColor: Colors.surf,
    borderColor: Colors.line,
    opacity: 0.5,
  },
  emoji: { fontSize: 22 },
  emojiLocked: { opacity: 0.4 },
  label: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    textAlign: 'center',
  },
});
