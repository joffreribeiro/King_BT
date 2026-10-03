import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontFamily, PODIUM_COLORS, type ThemeColors, Spacing } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { AnimatedNumber } from './AnimatedNumber';
import Avatar from './Avatar';
import { Icon } from './icons';
import { TrendBadge } from './TrendBadge';

export interface PodiumEntry {
  name: string;
  points: number;
  color: string;
  /** Subiu/desceu no ranking e quantas posições (omitido se não mudou). */
  trend?: { dir: 'up' | 'down'; diff: number };
}

interface PodiumHQProps {
  first:  PodiumEntry;
  second: PodiumEntry;
  third:  PodiumEntry;
}

// Altura dos degraus: 1º mais alto, 2º no meio, 3º mais baixo.
const STEP_HEIGHT = { 1: 120, 2: 84, 3: 56 } as const;

/**
 * Pódio clássico de degraus: 2º à esquerda, 1º no centro (mais alto), 3º à
 * direita, degraus colados. Degrau escuro com só a faixa de cima na cor da
 * posição (ouro/prata/bronze), para combinar com o fundo preto.
 */
function Slot({ entry, rank, Colors }: { entry: PodiumEntry; rank: 1 | 2 | 3; Colors: ThemeColors }) {
  const s = styles(Colors);
  const medal = PODIUM_COLORS[rank - 1];
  const isFirst = rank === 1;
  const size = isFirst ? 66 : 52;

  return (
    <View style={s.slot}>
      <View style={s.who}>
        {isFirst && <View style={{ marginBottom: 2 }}><Icon name="crown" size={22} color={medal} /></View>}
        <View style={[s.ring, { borderColor: medal, width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }]}>
          <Avatar name={entry.name} color={entry.color} size={size} />
        </View>
        <Text numberOfLines={1} style={[s.name, isFirst && s.nameFirst]}>{entry.name}</Text>
        <View style={s.ptsRow}>
          <AnimatedNumber value={entry.points} decimals={0} duration={700} color={Colors.gold} style={isFirst ? s.ptsFirst : s.pts} />
          <Text style={s.ptsSuffix}> pts</Text>
        </View>
        {entry.trend && <View style={{ marginTop: 4 }}><TrendBadge direction={entry.trend.dir} diff={entry.trend.diff} /></View>}
      </View>
      <View style={[s.step, { height: STEP_HEIGHT[rank], borderTopColor: medal }]}>
        <Text style={[s.stepNum, { color: medal }]}>{rank}º</Text>
      </View>
    </View>
  );
}

export function PodiumHQ({ first, second, third }: PodiumHQProps) {
  const { colors: Colors } = useTheme();
  const s = styles(Colors);
  return (
    <View style={s.container}>
      <View style={s.row}>
        <Slot entry={second} rank={2} Colors={Colors} />
        <Slot entry={first}  rank={1} Colors={Colors} />
        <Slot entry={third}  rank={3} Colors={Colors} />
      </View>
      <View style={s.base} />
    </View>
  );
}

const styles = (Colors: ThemeColors) => StyleSheet.create({
  container: { marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  slot: { flex: 1, minWidth: 0, alignItems: 'center' },
  who: { alignItems: 'center', paddingHorizontal: 2, paddingBottom: 8, maxWidth: '100%' },
  ring: { borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text, marginTop: 6, maxWidth: '100%' },
  nameFirst: { fontFamily: FontFamily.title, fontSize: 16 },
  ptsRow: { flexDirection: 'row', alignItems: 'baseline' },
  pts: { fontFamily: FontFamily.numberBold, fontSize: 16 },
  ptsFirst: { fontFamily: FontFamily.numberBold, fontSize: 20 },
  ptsSuffix: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  step: {
    width: '100%', backgroundColor: Colors.surf,
    borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.line, borderTopWidth: 3,
    borderTopLeftRadius: 6, borderTopRightRadius: 6,
    alignItems: 'center', paddingTop: 10,
  },
  stepNum: { fontFamily: FontFamily.numberBold, fontSize: 32 },
  base: { height: 3, backgroundColor: Colors.line, marginHorizontal: 4 },
});
