import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { FontFamily, Radius, Spacing, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

const BAR_H    = 80;  // altura máxima da barra
const BAR_W    = 44;  // largura fixa de cada barra
const BAR_GAP  = 10;  // espaço entre barras

interface Entry {
  label: string;
  pts: number;
  wins?: number;
  played?: number;
}

interface Props {
  ratings: Entry[] | number[];
}

function normalize(ratings: Entry[] | number[]): Entry[] {
  if (ratings.length === 0) return [];
  if (typeof ratings[0] === 'number') {
    return (ratings as number[]).map((pts, i) => ({ label: `J${i + 1}`, pts }));
  }
  return ratings as Entry[];
}

export function RatingChart({ ratings }: Props) {
  const { colors: Colors } = useTheme();
  const rc = useMemo(() => makeRcStyles(Colors), [Colors]);
  const data = normalize(ratings);
  if (data.length < 2) return null;

  const maxPts = Math.max(...data.map(d => d.pts), 0.01);
  const best   = Math.max(...data.map(d => d.pts));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={rc.scroll}
    >
      {data.map((item, i) => {
        const isLast   = i === data.length - 1;
        const isBest   = item.pts === best && best > 0;
        const barH     = Math.max(6, (item.pts / maxPts) * BAR_H);
        const opacity  = 0.35 + (item.pts / maxPts) * 0.65;
        const barColor = isBest ? Colors.gold : `rgba(243,197,68,${opacity})`;
        const aprov    = item.played ? Math.round((item.wins ?? 0) / item.played * 100) : null;

        return (
          <View key={i} style={rc.col}>
            {/* Valor acima da barra */}
            <Text style={[rc.pts, isBest && rc.ptsBest]}>
              {item.pts.toFixed(1)}
            </Text>

            {/* Badge "melhor" */}
            {isBest && (
              <View style={rc.bestBadge}>
                <Text style={rc.bestTxt}>↑</Text>
              </View>
            )}

            {/* Barra */}
            <View style={rc.barWrap}>
              <View style={[
                rc.bar,
                { height: barH, backgroundColor: barColor },
                isBest && rc.barBest,
              ]} />
            </View>

            {/* Label da competição */}
            <Text style={[rc.label, isBest && rc.labelBest]} numberOfLines={1}>
              {item.label}
            </Text>

            {/* Aproveitamento (se disponível) */}
            {aprov !== null && (
              <Text style={rc.aprov}>{aprov}%</Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const makeRcStyles = (Colors: ThemeColors) => StyleSheet.create({
  scroll: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
    paddingVertical: Spacing.xs,
    paddingHorizontal: 2,
  },
  col: {
    width: BAR_W,
    alignItems: 'center',
    gap: 3,
  },
  pts: {
    fontFamily: FontFamily.numberBold,
    fontSize: 10,
    color: Colors.faint,
  },
  ptsBest: {
    color: Colors.gold,
    fontSize: 11,
  },
  bestBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.gold + '33',
    alignItems: 'center', justifyContent: 'center',
  },
  bestTxt: {
    fontFamily: FontFamily.numberBold,
    fontSize: 9,
    color: Colors.gold,
  },
  barWrap: {
    width: BAR_W,
    height: BAR_H,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: BAR_W - 6,
    borderRadius: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barBest: {
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize: 9,
    color: Colors.faint,
    textAlign: 'center',
    width: BAR_W,
  },
  labelBest: {
    color: Colors.gold,
    fontFamily: FontFamily.bodyMed,
  },
  aprov: {
    fontFamily: FontFamily.number,
    fontSize: 8,
    color: Colors.faint,
  },
});
