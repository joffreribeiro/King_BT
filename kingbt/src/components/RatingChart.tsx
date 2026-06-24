import { View, Text, StyleSheet } from 'react-native';
import { FontFamily } from '@/theme';

const MAX_HEIGHT = 60;

interface Props {
  ratings: number[];
}

export function RatingChart({ ratings }: Props) {
  if (ratings.length < 2) return null;

  const max = Math.max(...ratings);
  const min = Math.min(...ratings) * 0.95;
  const range = Math.max(max - min, 0.01);

  return (
    <View style={rc.container}>
      {ratings.map((r, i) => {
        const height = Math.max(4, ((r - min) / range) * MAX_HEIGHT);
        const isLast = i === ratings.length - 1;
        return (
          <View key={i} style={rc.barCol}>
            {isLast && (
              <Text style={rc.valLabel}>{r.toFixed(1)}</Text>
            )}
            <View style={[
              rc.bar,
              {
                height,
                backgroundColor: isLast
                  ? '#F3C544'
                  : `rgba(243,197,68,${0.2 + (i / ratings.length) * 0.5})`,
              },
            ]} />
            <Text style={rc.barLabel}>J{i + 1}</Text>
          </View>
        );
      })}
    </View>
  );
}

const rc = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: MAX_HEIGHT + 32,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  bar: {
    width: '80%',
    borderRadius: 3,
    minHeight: 4,
  },
  barLabel: {
    fontFamily: FontFamily.number,
    fontSize: 9,
    color: '#6E6452',
  },
  valLabel: {
    fontFamily: FontFamily.numberBold,
    fontSize: 9,
    color: '#F3C544',
  },
});
