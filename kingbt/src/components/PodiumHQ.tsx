import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontFamily, PODIUM_COLORS, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { AnimatedNumber } from './AnimatedNumber';
import Avatar from './Avatar';
import { Icon } from './icons';

export interface PodiumEntry {
  name: string;
  points: number;
  color: string;
}

interface PodiumHQProps {
  first:  PodiumEntry;
  second: PodiumEntry;
  third:  PodiumEntry;
}

/**
 * Top-3 compacto. Era um pódio decorativo de ~290px (coroas SVG, pedestais
 * animados, cores fixas #F5C842/#C0CAD2/#D08840); a mesma informação — quem
 * está em 1º/2º/3º e a distância entre eles — cabe numa faixa de card com a
 * barra proporcional ao líder, e usa PODIUM_COLORS em vez de hex duplicado.
 */
function Slot({
  entry, rank, Colors, leaderPoints,
}: {
  entry: PodiumEntry;
  rank: 1 | 2 | 3;
  Colors: ThemeColors;
  leaderPoints: number;
}) {
  const s = styles(Colors);
  const medal = PODIUM_COLORS[rank - 1];
  const pct = leaderPoints > 0 ? Math.max(6, Math.round((entry.points / leaderPoints) * 100)) : 100;
  const isFirst = rank === 1;

  return (
    <View style={[s.slot, isFirst && s.slotFirst]}>
      {isFirst && (
        <View style={{ marginBottom: 2 }}>
          <Icon name="crown" size={16} color={medal} />
        </View>
      )}
      <View style={[s.ring, { borderColor: medal, width: (isFirst ? 44 : 36) + 4, height: (isFirst ? 44 : 36) + 4, borderRadius: ((isFirst ? 44 : 36) + 4) / 2 }]}>
        <Avatar name={entry.name} color={entry.color} size={isFirst ? 44 : 36} />
      </View>
      <Text numberOfLines={1} style={[s.name, isFirst && s.nameFirst]}>{entry.name}</Text>
      <AnimatedNumber
        value={entry.points}
        decimals={2}
        duration={700}
        color={medal}
        style={isFirst ? s.ptsFirst : s.pts}
      />
      <View style={s.track}>
        <View style={[s.fill, { width: `${pct}%`, backgroundColor: medal }]} />
      </View>
    </View>
  );
}

export function PodiumHQ({ first, second, third }: PodiumHQProps) {
  const { colors: Colors } = useTheme();
  const s = styles(Colors);
  return (
    <View style={s.card}>
      <Slot entry={second} rank={2} Colors={Colors} leaderPoints={first.points} />
      <Slot entry={first}  rank={1} Colors={Colors} leaderPoints={first.points} />
      <Slot entry={third}  rank={3} Colors={Colors} leaderPoints={first.points} />
    </View>
  );
}

const styles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    marginHorizontal: 12, marginBottom: 8, borderRadius: 14, padding: 12,
    backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line,
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
  },
  slot: { flex: 1, alignItems: 'center' },
  slotFirst: { flex: 1.15 },
  ring: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.muted, marginTop: 6, maxWidth: '100%' },
  nameFirst: { fontSize: 12, color: Colors.text },
  pts: { fontSize: 13, letterSpacing: 0.3 },
  ptsFirst: { fontSize: 15, letterSpacing: 0.3 },
  track: { width: '100%', height: 3, borderRadius: 2, backgroundColor: Colors.line, marginTop: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});
