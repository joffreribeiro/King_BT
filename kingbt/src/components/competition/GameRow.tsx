import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Match, Competition } from '@/logic/types';

export function GameRow({ match: m, index, comp, isNext, onPress, onLongPress }: {
  match: Match; index: number; comp: Competition; isNext: boolean;
  onPress: () => void; onLongPress?: () => void;
}) {
  const { findPlayer } = useGroupPlayers();
  const pA = [findPlayer(m.teamA?.[0] ?? ''), findPlayer(m.teamA?.[1] ?? '')];
  const pB = [findPlayer(m.teamB?.[0] ?? ''), findPlayer(m.teamB?.[1] ?? '')];
  const has = m.scoreA != null;
  const aWon = has && m.scoreA! > m.scoreB!;
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.8}>
      <Card style={isNext ? { ...gRow.card, ...gRow.nextCard } as ViewStyle : gRow.card}>
        {isNext && (
          <View style={gRow.nextBadge}>
            <Text style={gRow.nextBadgeText}>PRÓXIMO</Text>
          </View>
        )}
        {m.liveScore && !has && (
          <View style={gRow.liveBadge}>
            <View style={gRow.liveDot} />
            <Text style={gRow.liveBadgeText}>EM ANDAMENTO  {m.liveScore.gamesA}–{m.liveScore.gamesB}</Text>
          </View>
        )}
        {m.draftSets?.length && !has && !m.liveScore && (
          <View style={gRow.draftBadge}>
            <Text style={gRow.draftBadgeText}>📝 RASCUNHO  {m.draftSets.map(s => `${s.a}–${s.b}`).join('  ')}</Text>
          </View>
        )}
        <View style={gRow.row}>
          <View style={gRow.team}>
            <View style={gRow.pair}>
              {pA.map((p, i) => p && <Avatar key={i} name={p.name} color={p.color} size={28} />)}
            </View>
            <Text style={gRow.names} numberOfLines={1}>
              {pA[0]?.name.split(' ')[0]} / {pA[1]?.name.split(' ')[0]}
            </Text>
          </View>
          <View style={gRow.score}>
            {has
              ? <>
                  <Text style={gRow.scoreText}>
                    <Text style={aWon ? gRow.win : gRow.lose}>{m.scoreA}</Text>
                    {' – '}
                    <Text style={!aWon ? gRow.win : gRow.lose}>{m.scoreB}</Text>
                  </Text>
                  <Text style={gRow.scoreSub}>sets</Text>
                </>
              : m.liveScore
                ? <Text style={gRow.liveScore}>{m.liveScore.setsA}–{m.liveScore.setsB} sets</Text>
                : <Text style={gRow.pending}>Jogo {index + 1}</Text>
            }
          </View>
          <View style={[gRow.team, { alignItems: 'flex-end' }]}>
            <View style={[gRow.pair, { flexDirection: 'row-reverse' }]}>
              {pB.map((p, i) => p && <Avatar key={i} name={p.name} color={p.color} size={28} />)}
            </View>
            <Text style={[gRow.names, { textAlign: 'right' }]} numberOfLines={1}>
              {pB[0]?.name.split(' ')[0]} / {pB[1]?.name.split(' ')[0]}
            </Text>
          </View>
        </View>
        {/* Games por set */}
        {has && m.sets && m.sets.length > 0 && (
          <View style={gRow.setsRow}>
            {m.sets.map((s, i) => {
              const aWonSet = s.a > s.b;
              return (
                <View key={i} style={gRow.setChip}>
                  <Text style={[gRow.setScore, aWonSet && gRow.setScoreWin]}>{s.a}</Text>
                  <Text style={gRow.setDash}>-</Text>
                  <Text style={[gRow.setScore, !aWonSet && gRow.setScoreWin]}>{s.b}</Text>
                </View>
              );
            })}
          </View>
        )}
        {!has && <Text style={gRow.hint}>Toque para registrar placar</Text>}
      </Card>
    </TouchableOpacity>
  );
}

const gRow = StyleSheet.create({
  card: { marginBottom: 0 },
  nextCard: { borderColor: Colors.gold, borderWidth: 1.5 },
  nextBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.gold + '22',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginBottom: 6,
  },
  nextBadgeText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold, letterSpacing: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: Colors.coral + '22', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, marginBottom: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.coral },
  liveBadgeText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.coral, letterSpacing: 1 },
  liveScore:    { fontFamily: FontFamily.numberBold, fontSize: 14, color: Colors.coral },
  draftBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: Colors.muted + '18', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, marginBottom: 6 },
  draftBadgeText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.muted, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  team: { flex: 1, gap: 4 },
  pair: { flexDirection: 'row', gap: -6 },
  names: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  score: { alignItems: 'center', minWidth: 64 },
  scoreText: { fontFamily: FontFamily.numberBold, fontSize: 20 },
  scoreSub:  { fontFamily: FontFamily.body, fontSize: 9, color: Colors.faint, textAlign: 'center', marginTop: -2 },
  win: { color: Colors.teal },
  lose: { color: Colors.muted },
  pending: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.faint },
  hint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, textAlign: 'center', marginTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.xs },
  setsRow:     { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.line },
  setChip:     { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.surf2, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  setScore:    { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.muted },
  setScoreWin: { color: Colors.teal },
  setDash:     { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
});
