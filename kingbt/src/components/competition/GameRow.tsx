import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Card } from '@/components';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Match, Competition } from '@/logic/types';

// Junta os nomes de uma dupla (ou o único nome, se for individual) sem barra sobrando
function teamName(players: ({ name: string } | undefined)[]): string {
  return players.filter((p): p is { name: string } => !!p).map(p => p.name.split(' ')[0]).join(' / ') || '?';
}

export function GameRow({ match: m, index, comp, isNext, onPress, onLongPress }: {
  match: Match; index: number; comp: Competition; isNext: boolean;
  onPress: () => void; onLongPress?: () => void;
}) {
  const { findPlayer } = useGroupPlayers();
  const pA = [findPlayer(m.teamA?.[0] ?? ''), findPlayer(m.teamA?.[1] ?? '')];
  const pB = [findPlayer(m.teamB?.[0] ?? ''), findPlayer(m.teamB?.[1] ?? '')];
  const nameA = teamName(pA);
  const nameB = teamName(pB);
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
          <View style={gRow.side}>
            <Text style={[gRow.name, aWon && { color: Colors.gold }]} numberOfLines={1}>{nameA}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={gRow.vs}>
              {has ? `${m.scoreA} – ${m.scoreB}` : m.liveScore ? `${m.liveScore.setsA}–${m.liveScore.setsB}` : 'vs'}
            </Text>
            {(has || m.liveScore) && <Text style={gRow.vsSub}>sets</Text>}
          </View>
          <View style={[gRow.side, gRow.sideRight]}>
            <Text style={[gRow.name, { textAlign: 'right' }, !aWon && has && { color: Colors.gold }]} numberOfLines={1}>{nameB}</Text>
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
  draftBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: Colors.muted + '18', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, marginBottom: 6 },
  draftBadgeText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.muted, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  sideRight: { justifyContent: 'flex-end' },
  name: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: '#FFFFFF' },
  vs: { fontFamily: FontFamily.numberBold, fontSize: 15, color: '#FFFFFF', minWidth: 56, textAlign: 'center' },
  vsSub: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.faint, textAlign: 'center', marginTop: -2 },
  hint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, textAlign: 'center', marginTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.xs },
  setsRow:     { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.line, marginTop: 4 },
  setChip:     { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.surf2, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  setScore:    { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.muted },
  setScoreWin: { color: Colors.teal },
  setDash:     { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
});
