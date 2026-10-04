import { View, Text, StyleSheet, Image } from 'react-native';
import { useMemo, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Radius, Type, FontFamily, formatAccent, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { parseStoredDate } from '@/logic/format';
import type { Competition } from '@/logic/types';
import { Icon } from './icons';

export const FORMAT_LABEL: Record<string, string> = {
  avulso: 'Avulso', liga: 'Liga', grupos: 'Grupos + Eliminatórias', mata: 'Mata-Mata', super8: 'Super 8',
};

/** Peças de data prontas para exibir: "30 SET", "Quarta-feira", "20:00". */
export function eventWhen(c: Pick<Competition, 'date' | 'time'>) {
  const d = parseStoredDate(c.date);
  const day = `${d.getDate()} ${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()}`;
  const wk = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  return { day, weekday: wk.charAt(0).toUpperCase() + wk.slice(1), time: c.time ?? null };
}

/**
 * Arte do evento: a vespa inteira à vista, selos no topo e o nome do evento
 * sobre um degradê no rodapé da imagem. O texto fica só na parte de baixo, que
 * é escura, para nunca cobrir o mascote. Cores fixas — a arte é escura nos
 * dois temas.
 */
export function EventHero({ comp, statusLabel, statusColor, height = 240, top, showMeta = false }: {
  comp: Competition; statusLabel: string; statusColor: string; height?: number; top?: ReactNode;
  /** Mostra data, dia da semana, horário e local sobre a imagem, abaixo do título (no lugar das caixas EventTiles). */
  showMeta?: boolean;
}) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const accent = formatAccent(Colors, comp.format);
  const w = eventWhen(comp);
  return (
    <View style={[s.hero, { height }]}>
      <Image source={require('../../assets/kingbt-mascote-fogo.jpg')} style={s.img} resizeMode="cover" accessibilityIgnoresInvertColors />
      <LinearGradient
        colors={['rgba(11,11,13,0.35)', 'rgba(11,11,13,0)', 'rgba(11,11,13,0.55)', 'rgba(11,11,13,0.96)']}
        locations={[0, 0.3, 0.68, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={s.pills}>
        <View style={[s.pill, { borderColor: accent + '80' }]}><Text style={[s.pillText, { color: accent }]}>{FORMAT_LABEL[comp.format] ?? comp.format}</Text></View>
        <View style={[s.pill, { borderColor: statusColor + '80' }]}><Text style={[s.pillText, { color: statusColor }]}>{statusLabel}</Text></View>
      </View>
      {top}
      <View style={s.titleBox}>
        <Text style={[s.title, showMeta && s.titleCompact]} numberOfLines={2}>{comp.name}</Text>
        {showMeta && (
          <View style={s.meta}>
            <View style={s.metaItem}>
              <Icon name="calendar" size={15} color={Colors.gold} />
              <Text style={s.metaText} numberOfLines={1}>{w.day} · {w.weekday}{w.time ? ` · ${w.time}` : ''}</Text>
            </View>
            <View style={s.metaItem}>
              <Text style={s.metaEmoji}>📍</Text>
              <Text style={s.metaText} numberOfLines={1}>{comp.location?.trim() || 'Local a definir'}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

/** Três blocos como no Atlas: data/horário, local e formato. */
export function EventTiles({ comp }: { comp: Competition }) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const w = eventWhen(comp);
  return (
    <View style={s.tiles}>
      <View style={[s.tile, { flex: 1.15 }]}>
        <Icon name="calendar" size={20} color={Colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={s.tileMain} numberOfLines={1}>{w.day}</Text>
          <Text style={s.tileSub} numberOfLines={1}>{w.weekday}{w.time ? ` · ${w.time}` : ''}</Text>
        </View>
      </View>
      <View style={s.tile}>
        <Text style={s.tileEmoji}>📍</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.tileMain} numberOfLines={1}>{comp.location?.trim() || 'A definir'}</Text>
          <Text style={s.tileSub}>Local</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  hero: { backgroundColor: '#0B0B0D', overflow: 'hidden', justifyContent: 'flex-end' },
  img: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  pills: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(11,11,13,0.7)', borderWidth: 1 },
  pillText: { ...Type.label, fontSize: 11, lineHeight: 14 },
  titleBox: { paddingHorizontal: 16, paddingBottom: 14 },
  title: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 32, lineHeight: 36, color: '#F6EFDD', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },

  titleCompact: { fontSize: 28, lineHeight: 32 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 4, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  metaEmoji: { fontSize: 14 },
  metaText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: '#F6EFDD', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },

  tiles: { flexDirection: 'row', gap: Spacing.sm },
  tile: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surf2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line,
    paddingVertical: 14, paddingHorizontal: 14,
  },
  tileEmoji: { fontSize: 18 },
  tileMain: { fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.text },
  tileSub: { ...Type.body, fontSize: 12, color: Colors.muted, marginTop: 2 },
});
