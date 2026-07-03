import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import type { Match, Competition } from '@/logic/types';
import { getPlayer, getCompetitor, srcLabel, isByeSlot } from './helpers';

export function MatchRow({ match: m, comp, isNext, onPress, onLongPress }: {
  match: Match; comp: Competition; isNext: boolean;
  onPress: () => void; onLongPress?: () => void;
}) {
  const cA = m.aId ? getCompetitor(comp, m.aId) : null;
  const cB = m.bId ? getCompetitor(comp, m.bId) : null;
  const pA = cA?.members[0] ? getPlayer(cA.members[0]) : null;
  const pB = cB?.members[0] ? getPlayer(cB.members[0]) : null;
  const has = m.scoreA != null && m.scoreB != null;
  const aWon = has && m.scoreA! > m.scoreB!;
  const byeA = isByeSlot(m.aId, m.aSrc);
  const byeB = isByeSlot(m.bId, m.bSrc);
  const pending = !cA || !cB;

  const nameA = cA?.name ?? (byeA ? 'BYE' : srcLabel(comp, m.aSrc) ?? '?');
  const nameB = cB?.name ?? (byeB ? 'BYE' : srcLabel(comp, m.bSrc) ?? '?');

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} disabled={pending} activeOpacity={0.8}>
      <Card style={{ ...mRow.card, ...(pending ? mRow.disabled : {}), ...(isNext ? mRow.nextCard : {}) } as ViewStyle}>
        {isNext && (
          <View style={mRow.nextBadge}>
            <Text style={mRow.nextBadgeText}>PRÓXIMO</Text>
          </View>
        )}
        {m.liveScore && !has && (
          <View style={mRow.liveBadge}>
            <View style={mRow.liveDot} />
            <Text style={mRow.liveBadgeText}>EM ANDAMENTO  {m.liveScore.gamesA}–{m.liveScore.gamesB}</Text>
          </View>
        )}
        <View style={mRow.row}>
          <View style={mRow.side}>
            {pA && !byeA && <Avatar name={pA.name} color={pA.color} size={28} />}
            <Text style={[mRow.name, aWon && { color: Colors.gold }, byeA && mRow.byeText, !cA && !byeA && mRow.placeholderText]} numberOfLines={1}>
              {nameA}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={mRow.vs}>
              {has ? `${m.scoreA} – ${m.scoreB}` : (byeA || byeB) ? 'BYE' : pending ? 'A definir' : 'vs'}
            </Text>
            {has && <Text style={{ fontFamily: FontFamily.body, fontSize: 9, color: Colors.faint }}>sets</Text>}
          </View>
          <View style={[mRow.side, mRow.sideRight]}>
            <Text style={[mRow.name, { textAlign: 'right' }, !aWon && has && { color: Colors.gold }, byeB && mRow.byeText, !cB && !byeB && mRow.placeholderText]} numberOfLines={1}>
              {nameB}
            </Text>
            {pB && !byeB && <Avatar name={pB.name} color={pB.color} size={28} />}
          </View>
        </View>
        {/* Games por set */}
        {has && m.sets && m.sets.length > 0 && (
          <View style={mRow.setsRow}>
            {m.sets.map((s, i) => {
              const aWonSet = s.a > s.b;
              return (
                <View key={i} style={mRow.setChip}>
                  <Text style={[mRow.setScore, aWonSet && mRow.setScoreWin]}>{s.a}</Text>
                  <Text style={mRow.setDash}>-</Text>
                  <Text style={[mRow.setScore, !aWonSet && mRow.setScoreWin]}>{s.b}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

const mRow = StyleSheet.create({
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
  setsRow:     { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.line, marginTop: 4 },
  setChip:     { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.surf2, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  setScore:    { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.muted },
  setScoreWin: { color: Colors.teal },
  setDash:     { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  disabled: { opacity: 0.9 },
  byeText: { color: '#FFFFFF', fontFamily: FontFamily.numberBold, fontSize: 11, letterSpacing: 1 },
  placeholderText: { color: '#FFFFFF', fontStyle: 'italic', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  sideRight: { justifyContent: 'flex-end' },
  name: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: '#FFFFFF' },
  vs: { fontFamily: FontFamily.numberBold, fontSize: 15, color: '#FFFFFF', minWidth: 56, textAlign: 'center' },
});
