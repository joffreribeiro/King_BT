import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo } from 'react';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { computeAchievementStats } from '@/logic/achievementStats';
import { ACHIEVEMENTS, CATEGORY_LABELS, type AchievementCategory } from '@/constants/achievements';
import { AchievementCard } from '@/components/AchievementCard';
import { AchievementUnlockedModal } from '@/components/AchievementUnlockedModal';
import type { Achievement } from '@/constants/achievements';

const CATEGORY_ORDER: AchievementCategory[] = ['wins', 'streak', 'rating', 'titles', 'formats', 'social'];

export default function AchievementsScreen() {
  const { state } = useCompetitions();
  const { myPlayerId } = useAuth();
  const { groupPlayers } = useGroupPlayers();
  const MY_ID = myPlayerId ?? '';

  const [previewAch, setPreviewAch] = useState<Achievement | null>(null);

  // Build stats
  const stats = useMemo(() => {
    const base = computeAchievementStats(state.competitions, MY_ID);
    // Inject current rating from ranking
    const allGames = state.competitions.flatMap(extractPlayerGames);
    const ranking  = buildRanking(
      groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color, handicap: p.handicap })),
      allGames
    );
    const myRank = ranking.find(r => r.id === MY_ID);
    return { ...base, currentRating: myRank?.points ?? 0 };
  }, [state.competitions, MY_ID, groupPlayers]);

  // Group by category
  const grouped = useMemo(() => {
    const map: Partial<Record<AchievementCategory, Achievement[]>> = {};
    for (const ach of ACHIEVEMENTS) {
      if (!map[ach.category]) map[ach.category] = [];
      map[ach.category]!.push(ach);
    }
    return map;
  }, []);

  const unlockedCount = ACHIEVEMENTS.filter(a => a.progress(stats) >= 1).length;
  const totalCount    = ACHIEVEMENTS.length;
  const overallPct    = Math.round((unlockedCount / totalCount) * 100);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate("/(app)/profile")}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Conquistas</Text>
          <Text style={s.subtitle}>{unlockedCount}/{totalCount} desbloqueadas</Text>
        </View>
        <View style={s.pctBadge}>
          <Text style={s.pctText}>{overallPct}%</Text>
        </View>
      </View>

      {/* Overall progress bar */}
      <View style={s.overallBar}>
        <View style={s.overallTrack}>
          <View style={[s.overallFill, { width: `${overallPct}%` as any }]} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {CATEGORY_ORDER.map(cat => {
          const list = grouped[cat];
          if (!list || list.length === 0) return null;
          const catUnlocked = list.filter(a => a.progress(stats) >= 1).length;
          return (
            <View key={cat}>
              <View style={s.catHeader}>
                <Text style={s.catLabel}>{CATEGORY_LABELS[cat].toUpperCase()}</Text>
                <Text style={s.catCount}>{catUnlocked}/{list.length}</Text>
              </View>
              {list.map(ach => (
                <TouchableOpacity
                  key={ach.id}
                  activeOpacity={0.85}
                  onPress={() => ach.progress(stats) >= 1 && setPreviewAch(ach)}
                >
                  <AchievementCard achievement={ach} stats={stats} />
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Preview modal when tapping an unlocked badge */}
      <AchievementUnlockedModal
        achievement={previewAch}
        visible={!!previewAch}
        onClose={() => setPreviewAch(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  back:     { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title:    { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted, marginTop: 1 },
  pctBadge: {
    backgroundColor: 'rgba(243,197,68,0.12)', borderWidth: 1,
    borderColor: 'rgba(243,197,68,0.3)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  pctText: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.gold },

  overallBar: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.line },
  overallTrack: { height: 4, backgroundColor: '#221C12', borderRadius: 2, overflow: 'hidden' },
  overallFill:  { height: 4, backgroundColor: Colors.gold, borderRadius: 2 },

  scroll: { padding: Spacing.md },

  catHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: Spacing.md, marginBottom: Spacing.sm,
  },
  catLabel: {
    fontFamily: FontFamily.numberBold, fontSize: 9,
    color: Colors.faint, letterSpacing: 1.5,
  },
  catCount: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.muted },
});
