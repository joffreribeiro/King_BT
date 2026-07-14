import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, type LayoutChangeEvent } from 'react-native';
import { FontFamily, Radius, Spacing, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

const BAR_H    = 80;  // altura máxima da barra
const BAR_W    = 44;  // largura fixa de cada barra (modo scroll)
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
  const [containerW, setContainerW] = useState(0);
  const data = normalize(ratings);
  if (data.length < 2) return null;

  const maxPts = Math.max(...data.map(d => d.pts), 0.01);
  const best   = Math.max(...data.map(d => d.pts));

  // Se as barras couberem na largura disponível, distribui por toda a tela;
  // senão, mantém o scroll horizontal.
  const naturalW = data.length * BAR_W + (data.length - 1) * BAR_GAP;
  const fitsFullWidth = containerW > 0 && naturalW <= containerW;

  const onLayout = (e: LayoutChangeEvent) => setContainerW(e.nativeEvent.layout.width);

  const column = (item: Entry, i: number, flex: boolean) => {
    const isBest   = item.pts === best && best > 0;
    const barH     = Math.max(6, (item.pts / maxPts) * BAR_H);
    const opacity  = 0.35 + (item.pts / maxPts) * 0.65;
    const barColor = isBest ? Colors.gold : `rgba(243,197,68,${opacity})`;
    const aprov    = item.played ? Math.round((item.wins ?? 0) / item.played * 100) : null;

    return (
      <View key={i} style={[rc.col, flex ? { flex: 1 } : { width: BAR_W }]}>
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
  };

  if (fitsFullWidth) {
    return (
      <View onLayout={onLayout} style={rc.fullRow}>
        {data.map((item, i) => column(item, i, true))}
      </View>
    );
  }

  return (
    <View onLayout={onLayout}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={rc.scroll}
      >
        {data.map((item, i) => column(item, i, false))}
      </ScrollView>
    </View>
  );
}

const makeRcStyles = (Colors: ThemeColors) => StyleSheet.create({
  fullRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
    paddingVertical: Spacing.xs,
  },
  scroll: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
    paddingVertical: Spacing.xs,
    paddingHorizontal: 2,
  },
  col: {
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
    width: '100%',
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
    width: '100%',
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
