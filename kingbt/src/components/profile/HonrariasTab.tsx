import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, PODIUM_COLORS, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Card } from '@/components';
import { ProgressBar } from '@/components/ProgressBar';
import { ACHIEVEMENTS, type UserAchievementStats } from '@/constants/achievements';
import { RARITY_COLOR, RARITY_LABEL, RARITY_ORDER, rarityOf } from '@/constants/rarity';
import { HALL_CATEGORIES, hallCategoryOf, type HallCategory } from '@/constants/hall';
import { useAchievementStats } from '@/hooks/useAchievementStats';
import { useSettings } from '@/store/SettingsContext';
import { seasonPlacements } from '@/logic/seasons';
import { makeTab } from './profileStyles';
import { PlayerHonors } from './PlayerHonors';
import { LevelsCard } from './LevelsCard';
import { usePlayerXp } from '@/hooks/usePlayerXp';
import type { Skills } from '@/logic/skills';

/**
 * Aba "Conquistas": as conquistas em quatro categorias (Coroas, Insígnias,
 * Favos e Provas da Rainha), cada uma com a sua raridade. Contadores no topo;
 * abaixo, a categoria escolhida com as desbloqueadas primeiro (das mais raras
 * para as mais comuns) e, nas bloqueadas, quanto falta.
 */
export function HonrariasTab({ stats }: { stats: UserAchievementStats }) {
  const { colors: Colors } = useTheme();
  const tab = useMemo(() => makeTab(Colors), [Colors]);
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const [cat, setCat] = useState<HallCategory>('coroas');

  const items = useMemo(() => ACHIEVEMENTS.map(a => {
    const prog = Math.max(0, Math.min(1, a.progress(stats)));
    return { a, prog, unlocked: prog >= 1, rarity: rarityOf(a.id), category: hallCategoryOf(a.id), label: a.progressLabel(stats) };
  }), [stats]);

  const unlockedCount = items.filter(i => i.unlocked).length;
  const catInfo = HALL_CATEGORIES.find(c => c.id === cat)!;
  const shown = useMemo(() => items
    .filter(i => i.category === cat)
    .sort((x, y) =>
      Number(y.unlocked) - Number(x.unlocked)
      || RARITY_ORDER.indexOf(y.rarity) - RARITY_ORDER.indexOf(x.rarity)
      || y.prog - x.prog), [items, cat]);

  return (
    <View style={tab.content}>
      <Card>
        <View style={s.summaryTop}>
          <Text style={tab.sectionTitle}>Suas conquistas</Text>
          <Text style={s.summaryCount}>{unlockedCount}<Text style={s.summaryOf}> / {items.length}</Text></Text>
        </View>
        <ProgressBar pct={(unlockedCount / Math.max(1, items.length)) * 100} height={8} />

        <View style={s.counters}>
          {HALL_CATEGORIES.map(c => {
            const total = items.filter(i => i.category === c.id).length;
            const got = items.filter(i => i.category === c.id && i.unlocked).length;
            return (
              <View key={c.id} style={s.counter}>
                <Text style={s.counterNum}>{got}<Text style={s.counterOf}>/{total}</Text></Text>
                <Text style={s.counterLabel} numberOfLines={1}>{c.icon} {c.label}</Text>
              </View>
            );
          })}
        </View>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {HALL_CATEGORIES.map(c => (
          <TouchableOpacity key={c.id} style={[s.chip, cat === c.id && s.chipOn]} onPress={() => setCat(c.id)} activeOpacity={0.8}>
            <Text style={[s.chipText, cat === c.id && s.chipTextOn]}>{c.icon} {c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={s.hint}>{catInfo.hint}</Text>

      <View style={s.grid}>
        {shown.map(({ a, prog, unlocked: on, rarity, label }) => {
          const color = RARITY_COLOR[rarity];
          return (
            <View key={a.id} style={[s.card, { borderColor: on ? color + '99' : Colors.line }, !on && { opacity: 0.7 }]}>
              <View style={s.cardTop}>
                <Text style={s.icon}>{a.icon}</Text>
                <View style={[s.pill, { borderColor: color + '80', backgroundColor: color + '1F' }]}>
                  <Text style={[s.pillText, { color }]}>{RARITY_LABEL[rarity].toUpperCase()}</Text>
                </View>
              </View>
              <Text style={s.title} numberOfLines={2}>{a.title}</Text>
              <Text style={s.desc} numberOfLines={4}>{a.description}</Text>
              {on ? (
                <Text style={[s.status, { color }]}>Desbloqueada</Text>
              ) : (
                <View style={{ gap: 4 }}>
                  <ProgressBar pct={prog * 100} color={color} height={5} />
                  <Text style={s.progressLabel}>{label}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** A aba já com as estatísticas calculadas (competições + avaliações da comunidade). */
export function HonrariasForPlayer({ playerId, points, ratedCount, played = 0, skills }: { playerId: string; points: number; ratedCount: number; played?: number; skills?: Skills }) {
  const stats = useAchievementStats(playerId, points, ratedCount);
  const { xp } = usePlayerXp(playerId, played, skills, points, ratedCount);
  return (
    <View style={{ gap: Spacing.md }}>
      <LevelsCard xp={xp} />
      <PlayerHonors playerId={playerId} />
      <SeasonPlacements playerId={playerId} />
      <HonrariasTab stats={stats} />
    </View>
  );
}

/** Campeão e vice das temporadas encerradas em que o jogador terminou no pódio. Some se não houver. */
function SeasonPlacements({ playerId }: { playerId: string }) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { seasons } = useSettings();
  const { titles, runnerUps, entries } = useMemo(() => seasonPlacements(seasons, playerId), [seasons, playerId]);
  if (entries.length === 0) return null;
  return (
    <Card>
      <Text style={s.spTitle}>Temporadas</Text>
      <Text style={s.hint}>
        {titles > 0 ? `${titles} ${titles === 1 ? 'título' : 'títulos'}` : ''}
        {titles > 0 && runnerUps > 0 ? ' · ' : ''}
        {runnerUps > 0 ? `${runnerUps} ${runnerUps === 1 ? 'vice' : 'vices'}` : ''}
      </Text>
      <View style={s.spList}>
        {[...entries].reverse().map(e => (
          <View key={e.number} style={[s.spRow, { borderColor: (e.pos === 1 ? PODIUM_COLORS[0] : PODIUM_COLORS[1]) + '66' }]}>
            <Text style={s.spIcon}>{e.pos === 1 ? '🏆' : '🥈'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.spName}>{e.pos === 1 ? 'Campeão' : 'Vice-campeão'}</Text>
              <Text style={s.hint}>Temporada {e.number}</Text>
            </View>
            <Text style={s.spPts}>{e.points.toFixed(2).replace('.', ',')}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  spTitle: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 22, color: Colors.text },
  spList: { gap: Spacing.sm, marginTop: Spacing.sm },
  spRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surf2, borderWidth: 1 },
  spIcon: { fontSize: 26 },
  spName: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  spPts: { fontFamily: FontFamily.numberBold, fontSize: 17, color: Colors.gold },
  summaryTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  summaryCount: { fontFamily: FontFamily.numberBold, fontSize: 26, color: Colors.gold },
  summaryOf: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  counters: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  counter: { flexBasis: '47%', flexGrow: 1, paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.md, backgroundColor: Colors.surf2 },
  counterNum: { fontFamily: FontFamily.numberBold, fontSize: 22, color: Colors.text },
  counterOf: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  counterLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, marginTop: 2 },

  chips: { gap: Spacing.sm, paddingVertical: 2 },
  chip: { paddingHorizontal: 16, minHeight: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line },
  chipOn: { backgroundColor: Colors.gold + '26', borderColor: Colors.gold },
  chipText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  chipTextOn: { fontFamily: FontFamily.title, color: Colors.gold },
  hint: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 18, color: Colors.muted },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: { flexBasis: '48%', flexGrow: 1, minWidth: 150, gap: 8, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surf, borderWidth: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon: { fontSize: 30 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  pillText: { fontFamily: FontFamily.titleBold, fontSize: 10, letterSpacing: 0.8 },
  title: { fontFamily: FontFamily.titleBold, fontSize: 16, lineHeight: 21, color: Colors.text },
  desc: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 18, color: Colors.muted },
  status: { fontFamily: FontFamily.title, fontSize: 13 },
  progressLabel: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted },
});
