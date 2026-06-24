import { View, Text, StyleSheet } from 'react-native';
import { FontFamily } from '@/theme';

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
  { id: 'top3',    icon: '🥉', label: 'Top 3',         color: '#CD7F32', condition: s => s.rankPosition <= 3 },
];

interface Props {
  stats: BadgeStats;
}

export function BadgeGrid({ stats }: Props) {
  return (
    <View style={bg.grid}>
      {BADGE_RULES.map(rule => {
        const unlocked = rule.condition(stats);
        return (
          <View key={rule.id} style={[bg.item, !unlocked && bg.locked]}>
            <Text style={[bg.emoji, !unlocked && bg.emojiLocked]}>{rule.icon}</Text>
            <Text style={[bg.label, { color: unlocked ? rule.color : '#6E6452' }]} numberOfLines={2}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const bg = StyleSheet.create({
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
    backgroundColor: '#16140F',
    borderColor: 'rgba(214,175,70,0.1)',
    opacity: 0.5,
  },
  emoji: { fontSize: 22 },
  emojiLocked: { opacity: 0.4 },
  label: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    textAlign: 'center',
  },
});
