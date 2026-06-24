import { View, StyleSheet } from 'react-native';

const WEEKS = 4;
const DAYS = 7;

function getColor(intensity: number): string {
  if (intensity <= 0) return 'rgba(243,197,68,0.08)';
  if (intensity === 1) return 'rgba(243,197,68,0.30)';
  if (intensity === 2) return 'rgba(243,197,68,0.60)';
  return '#F3C544';
}

interface Props {
  activityData: Record<string, number>; // 'YYYY-MM-DD' → 0-3
}

export function ActivityHeatmap({ activityData }: Props) {
  const dates = Array.from({ length: WEEKS * DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (WEEKS * DAYS - 1 - i));
    return d.toISOString().split('T')[0];
  });

  return (
    <View style={hm.grid}>
      {dates.map(date => {
        const intensity = activityData[date] ?? 0;
        return (
          <View
            key={date}
            style={[hm.cell, { backgroundColor: getColor(intensity) }]}
          />
        );
      })}
    </View>
  );
}

const hm = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    width: DAYS * 17,
  },
  cell: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
});
