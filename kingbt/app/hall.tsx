import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Avatar, Card } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { competitionChampion } from '@/logic/formats';

export default function HallScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { state } = useCompetitions();
  const { findPlayer } = useGroupPlayers();

  const champions = state.competitions
    .filter(c => c.status === 'done')
    .map(c => {
      const champ = competitionChampion(c, id => findPlayer(id)?.name ?? id);
      if (!champ) return null;
      const player = findPlayer(champ.members[0]);
      const champName = (champ as any).name ?? player?.name ?? champ.members[0];
      return {
        compId: c.id,
        compName: c.name,
        compDate: c.date,
        format: c.format,
        champName,
        player,
      };
    })
    .filter(Boolean)
    .reverse() as Array<{
      compId: string;
      compName: string;
      compDate: string;
      format: string;
      champName: string;
      player: { name: string; color: string } | undefined;
    }>;

  const formatLabel: Record<string, string> = {
    liga: 'Liga', grupos: 'Grupos + KO', mata: 'Mata-mata', avulso: 'Avulso', super8: 'Super 8',
  };

  // Contar conquistas por jogador
  const trophies: Record<string, number> = {};
  champions.forEach(c => {
    const key = c.champName;
    trophies[key] = (trophies[key] ?? 0) + 1;
  });
  const topWinners = Object.entries(trophies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Hall dos Campeões</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {champions.length === 0 && (
          <Card style={{ alignItems: 'center', padding: Spacing.xl }}>
            <Text style={{ fontSize: 40 }}>🏆</Text>
            <Text style={s.emptyTitle}>Sem campeões ainda</Text>
            <Text style={s.emptySub}>Conclua uma competição para ver o campeão aqui.</Text>
          </Card>
        )}

        {topWinners.length > 0 && (
          <Card style={s.rankCard}>
            <Text style={s.sectionLabel}>MAIS TÍTULOS</Text>
            {topWinners.map(([name, count], i) => {
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <View key={name} style={s.topRow}>
                  <Text style={s.medal}>{medals[i] ?? '🏅'}</Text>
                  <Text style={s.topName}>{name}</Text>
                  <Text style={s.topCount}>{count} {count === 1 ? 'título' : 'títulos'}</Text>
                </View>
              );
            })}
          </Card>
        )}

        <Text style={s.sectionLabel}>HISTÓRICO DE CAMPEÕES</Text>

        {champions.map(c => (
          <TouchableOpacity
            key={c.compId}
            onPress={() => router.push(`/competitions/${c.compId}`)}
            activeOpacity={0.8}
          >
            <Card style={s.champCard}>
              <View style={s.champLeft}>
                <Text style={s.crown}>👑</Text>
                <View>
                  <Text style={s.champCompName}>{c.compName}</Text>
                  <Text style={s.champMeta}>{formatLabel[c.format] ?? c.format} · {c.compDate}</Text>
                </View>
              </View>
              <View style={s.champRight}>
                <Avatar name={c.player?.name ?? c.champName} color={c.player?.color ?? Colors.gold} size={36} />
                <Text style={s.champWinner} numberOfLines={1}>{c.champName}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line },
  back: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.gold, flex: 1 },
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  sectionLabel: { fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted, letterSpacing: 2, marginTop: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 18, color: Colors.text, marginTop: Spacing.sm },
  emptySub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 4 },
  rankCard: { gap: Spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  medal: { fontSize: 22, width: 30 },
  topName: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  topCount: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.gold },
  champCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  champLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  crown: { fontSize: 24 },
  champCompName: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  champMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  champRight: { alignItems: 'center', gap: 4, maxWidth: 80 },
  champWinner: { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.gold, textAlign: 'center' },
});
