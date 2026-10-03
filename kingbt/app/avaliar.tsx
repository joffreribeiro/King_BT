import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { HexBackground } from '@/components/HexBackground';
import { Avatar, ScreenHeader } from '@/components';
import { FontFamily, Spacing, Radius, centeredContent, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import { useSettings } from '@/store/SettingsContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useRateDismissed } from '@/hooks/useRateDismissed';
import { playersToRate } from '@/logic/ratePrompt';
import { todayLocal } from '@/logic/eventDateTime';

/** Depois da competição: quem jogou com ou contra você e ainda não foi avaliado. Cada avaliação rende XP. */
export default function AvaliarScreen() {
  useRequireAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { state } = useCompetitions();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const { myPlayerId } = useAuth();
  const { xpConfig } = useSettings();
  const { dismissed, dismiss } = useRateDismissed();

  const me = groupPlayers.find(p => p.id === myPlayerId);
  const items = useMemo(
    () => playersToRate(state.competitions, myPlayerId, me?.ratedIds ?? [], todayLocal().iso, 30, dismissed, true),
    [state.competitions, myPlayerId, me?.ratedIds, dismissed],
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(app)/home'));

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <HexBackground />
      <ScreenHeader title="Avaliar colegas" onBack={back} />
      <ScrollView contentContainerStyle={[s.scroll, centeredContent]} showsVerticalScrollIndicator={false}>
        <Text style={s.lead}>
          Quem jogou com ou contra você nas últimas competições. A nota de cada um ajuda a definir o nível e a categoria
          dele{xpConfig.rating > 0 ? `, e cada avaliação rende +${xpConfig.rating} XP para você` : ''}.
        </Text>

        {items.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Tudo em dia</Text>
            <Text style={s.emptyText}>Você já avaliou quem jogou com você nas últimas duas semanas.</Text>
          </View>
        ) : (
          <>
            {items.map(it => {
              const pl = findPlayer(it.playerId);
              if (!pl) return null;
              return (
                <TouchableOpacity
                  key={it.playerId} style={s.row} activeOpacity={0.8}
                  onPress={() => router.push({ pathname: '/player/[id]', params: { id: it.playerId, tab: 'radar' } })}
                  accessibilityRole="button" accessibilityLabel={`Avaliar ${pl.name}`}
                >
                  <Avatar name={pl.name} color={pl.color} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={1}>{pl.name}</Text>
                    <Text style={s.sub} numberOfLines={1}>{it.compName}</Text>
                  </View>
                  <View style={s.pill}><Text style={s.pillText}>Avaliar</Text></View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={s.dismiss} activeOpacity={0.8} accessibilityRole="button"
              onPress={() => { dismiss(Array.from(new Set(items.map(i => i.compId)))); back(); }}
            >
              <Text style={s.dismissText}>Dispensar este aviso</Text>
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  lead: { fontFamily: FontFamily.body, fontSize: 15, lineHeight: 22, color: C.muted, marginBottom: Spacing.xs },
  row: {
    minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: C.surf,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: C.line, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  name: { fontFamily: FontFamily.titleBold, fontSize: 16, color: C.text },
  sub: { fontFamily: FontFamily.body, fontSize: 14, color: C.muted },
  pill: { minHeight: 40, paddingHorizontal: 16, borderRadius: Radius.full, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontFamily: FontFamily.titleBold, fontSize: 14, color: C.bg },
  dismiss: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  dismissText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.muted },
  empty: { backgroundColor: C.surf, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.line, padding: Spacing.lg, alignItems: 'center', gap: 4 },
  emptyTitle: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 24, color: C.text },
  emptyText: { fontFamily: FontFamily.body, fontSize: 15, lineHeight: 22, color: C.muted, textAlign: 'center' },
});
