import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { koRoundName, matchWinner } from '@/logic/formats';
import { getCompetitor } from '@/components/competition/helpers';

export default function TrilhaScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { competitionId, playerId } = useLocalSearchParams<{ competitionId: string; playerId: string }>();
  const { state } = useCompetitions();

  const comp = state.competitions.find(c => c.id === competitionId);
  const myComp = comp?.competitors.find(c => c.members.includes(playerId ?? ''));

  const myMatches = comp && myComp
    ? comp.matches
        .filter(m => m.stage === 'ko' && !m.third && (m.aId === myComp.id || m.bId === myComp.id))
        .sort((a, b) => (a.koRound ?? 0) - (b.koRound ?? 0))
    : [];

  if (!comp || !myComp || myMatches.length === 0) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>Trilha no chaveamento</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg }}>
          <Text style={{ fontSize: 32 }}>🗺️</Text>
          <Text style={{ color: Colors.muted, fontFamily: FontFamily.body, textAlign: 'center', marginTop: Spacing.sm }}>
            Sem partidas de chaveamento para esse jogador nessa competição.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Trilha no chaveamento</Text>
          <Text style={s.subtitle} numberOfLines={1}>{comp.name}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {myMatches.map((m, i) => {
          const opponentId = m.aId === myComp.id ? m.bId : m.aId;
          const opponent = opponentId ? getCompetitor(comp, opponentId) : null;
          const myScore = m.aId === myComp.id ? m.scoreA : m.scoreB;
          const oppScore = m.aId === myComp.id ? m.scoreB : m.scoreA;
          const played = m.scoreA != null && m.scoreB != null;
          const winnerId = matchWinner(m);
          const won = played && winnerId === myComp.id;
          const lost = played && winnerId != null && winnerId !== myComp.id;

          return (
            <View key={m.id} style={s.stepRow}>
              <View style={s.stepLine}>
                <View style={[
                  s.stepDot,
                  won && { backgroundColor: Colors.teal },
                  lost && { backgroundColor: Colors.coral },
                ]} />
                {i < myMatches.length - 1 && <View style={s.stepConnector} />}
              </View>

              <View style={[
                s.card,
                won && { borderColor: `${Colors.teal}55` },
                lost && { borderColor: `${Colors.coral}55` },
              ]}>
                <View style={s.cardHeader}>
                  <Text style={s.round}>{koRoundName(m.cnt ?? 0)}</Text>
                  {played && (
                    <Text style={[s.result, { color: won ? Colors.teal : Colors.coral }]}>
                      {won ? 'VITÓRIA' : 'DERROTA'}
                    </Text>
                  )}
                </View>
                <View style={s.matchup}>
                  <Text style={s.opponentName} numberOfLines={1}>
                    {opponent?.name ?? 'A definir'}
                  </Text>
                  <Text style={[s.score, played && { color: Colors.text }]}>
                    {played ? `${myScore} – ${oppScore}` : '–'}
                  </Text>
                </View>
                {m.playedAt && <Text style={s.date}>{m.playedAt}</Text>}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  back:     { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title:    { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: 1 },
  scroll:   { padding: Spacing.md, paddingBottom: Spacing.xl },

  stepRow: { flexDirection: 'row', gap: Spacing.sm },
  stepLine: { alignItems: 'center', width: 16 },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.surf2, borderWidth: 2, borderColor: Colors.line, marginTop: 14 },
  stepConnector: { flex: 1, width: 2, backgroundColor: Colors.line, minHeight: 24 },

  card: {
    flex: 1, backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line,
    borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm, gap: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  round:      { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.faint, letterSpacing: 1 },
  result:     { fontFamily: FontFamily.numberBold, fontSize: 10, letterSpacing: 1 },
  matchup:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  opponentName: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  score:      { fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.faint },
  date:       { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
});
