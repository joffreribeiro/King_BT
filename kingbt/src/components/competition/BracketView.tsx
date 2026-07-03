import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, FontFamily, Spacing } from '@/theme';
import { Card } from '@/components';
import { koRoundName } from '@/logic/formats';
import type { Match, Competition } from '@/logic/types';
import { getCompetitor, srcLabel, isByeSlot, firstUnscored } from './helpers';
import { MatchRow } from './MatchRow';
import { vw } from './viewStyles';

const BK_CARD_H  = 62;
const BK_GAP     = 10;
const BK_ROUND_W = 150;
const BK_CONN_W  = 30;

function BracketMatchCard({ match: m, comp, onPress }: {
  match: Match; comp: Competition; onPress: () => void;
}) {
  const cA = m.aId ? getCompetitor(comp, m.aId) : null;
  const cB = m.bId ? getCompetitor(comp, m.bId) : null;
  const has = m.scoreA != null && m.scoreB != null;
  const aWon = has && m.scoreA! > m.scoreB!;
  const byeA = isByeSlot(m.aId, m.aSrc);
  const byeB = isByeSlot(m.bId, m.bSrc);
  const pending = !cA || !cB;

  const nameA = cA?.name ?? (byeA ? 'BYE' : srcLabel(comp, m.aSrc) ?? '—');
  const nameB = cB?.name ?? (byeB ? 'BYE' : srcLabel(comp, m.bSrc) ?? '—');
  const isPlaceholderA = !cA && !byeA;
  const isPlaceholderB = !cB && !byeB;

  return (
    <TouchableOpacity onPress={onPress} disabled={pending} activeOpacity={0.8}>
      <View style={[bkCard.card, pending && !byeA && !byeB && { opacity: 0.9 }]}>
        <View style={[bkCard.row, aWon && bkCard.winRow, byeA && bkCard.byeRow]}>
          <Text style={[bkCard.name, aWon && bkCard.winName, byeA && bkCard.byeName, isPlaceholderA && bkCard.placeholderName]} numberOfLines={1}>{nameA}</Text>
          <Text style={[bkCard.score, aWon && bkCard.winScore]}>{has && !byeA ? m.scoreA : byeA ? '' : '–'}</Text>
        </View>
        <View style={bkCard.div} />
        <View style={[bkCard.row, !aWon && has && bkCard.winRow, byeB && bkCard.byeRow]}>
          <Text style={[bkCard.name, !aWon && has && bkCard.winName, byeB && bkCard.byeName, isPlaceholderB && bkCard.placeholderName]} numberOfLines={1}>{nameB}</Text>
          <Text style={[bkCard.score, !aWon && has && bkCard.winScore]}>{has && !byeB ? m.scoreB : byeB ? '' : '–'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
const bkCard = StyleSheet.create({
  card: {
    width: BK_ROUND_W,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surf,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: (BK_CARD_H - 1) / 2 },
  winRow: { backgroundColor: Colors.gold + '22' },
  div: { height: 1, backgroundColor: Colors.line },
  name: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 11, color: '#FFFFFF' },
  winName: { color: Colors.gold, fontFamily: FontFamily.bodyMed },
  byeRow: { backgroundColor: Colors.surf2 },
  byeName: { color: '#FFFFFF', fontFamily: FontFamily.numberBold, fontSize: 10, letterSpacing: 1 },
  placeholderName: { color: '#FFFFFF', fontStyle: 'italic', fontSize: 11 },
  score: { fontFamily: FontFamily.numberBold, fontSize: 13, color: '#FFFFFF' },
  winScore: { color: Colors.gold },
});

export function BracketView({ comp, onScore, onClear }: {
  comp: Competition; onScore: (m: Match) => void; onClear: (id: string) => void;
}) {
  const koMatches = comp.matches.filter(m => m.stage === 'ko' && !m.third);
  const thirdMatch = comp.matches.find(m => m.stage === 'ko' && m.third);
  const nextId = firstUnscored(comp.matches.filter(m => m.stage === 'ko'));

  const roundNums = [...new Set(koMatches.map(m => m.koRound ?? 0))].sort((a, b) => a - b);
  const rounds = roundNums.map(r =>
    koMatches.filter(m => m.koRound === r).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
  );

  if (rounds.length === 0) {
    return (
      <View style={{ padding: Spacing.md }}>
        <Card style={vw.locked}>
          <Text style={vw.lockedText}>Sem jogos de mata-mata definidos ainda.</Text>
        </Card>
      </View>
    );
  }

  const firstRoundCount = rounds[0].length;
  const slotH0 = BK_CARD_H + BK_GAP;
  const totalH = firstRoundCount * slotH0 - BK_GAP;

  function slotH(rIdx: number) { return slotH0 * Math.pow(2, rIdx); }
  function cardTop(rIdx: number, mIdx: number) {
    const sh = slotH(rIdx);
    return mIdx * sh + (sh - BK_CARD_H) / 2;
  }

  const LABEL_H = 22;

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ padding: Spacing.md, paddingBottom: Spacing.xl }}>
          {/* Round labels row */}
          <View style={{ flexDirection: 'row' }}>
            {rounds.map((rMatches, rIdx) => (
              <View key={rIdx} style={{ flexDirection: 'row' }}>
                <View style={{ width: BK_ROUND_W, alignItems: 'center' }}>
                  <Text style={bk.roundLabel}>{koRoundName(rMatches[0]?.cnt ?? 0)}</Text>
                </View>
                {rIdx < rounds.length - 1 && <View style={{ width: BK_CONN_W }} />}
              </View>
            ))}
          </View>

          {/* Bracket body */}
          <View style={{ flexDirection: 'row', height: totalH, marginTop: 4 }}>
            {rounds.map((roundMatches, rIdx) => (
              <View key={rIdx} style={{ flexDirection: 'row' }}>
                {/* Round column — match cards */}
                <View style={{ width: BK_ROUND_W, height: totalH, position: 'relative' }}>
                  {roundMatches.map((m, mIdx) => (
                    <View key={m.id} style={{ position: 'absolute', top: cardTop(rIdx, mIdx) }}>
                      <BracketMatchCard match={m} comp={comp} onPress={() => onScore(m)} />
                    </View>
                  ))}
                </View>

                {/* Connector zone */}
                {rIdx < rounds.length - 1 && (
                  <View style={{ width: BK_CONN_W, height: totalH, position: 'relative' }}>
                    {Array.from({ length: Math.ceil(roundMatches.length / 2) }).map((_, pairIdx) => {
                      const topIdx = pairIdx * 2;
                      const botIdx = pairIdx * 2 + 1;
                      if (botIdx >= roundMatches.length) return null;
                      const topCenter = cardTop(rIdx, topIdx) + BK_CARD_H / 2;
                      const botCenter = cardTop(rIdx, botIdx) + BK_CARD_H / 2;
                      const midY = (topCenter + botCenter) / 2;
                      return (
                        <>
                          {/* Top inbound */}
                          <View key={`ti-${pairIdx}`} style={{ position: 'absolute', top: topCenter - 0.5, left: 0, width: BK_CONN_W / 2, height: 1, backgroundColor: Colors.line }} />
                          {/* Bottom inbound */}
                          <View key={`bi-${pairIdx}`} style={{ position: 'absolute', top: botCenter - 0.5, left: 0, width: BK_CONN_W / 2, height: 1, backgroundColor: Colors.line }} />
                          {/* Vertical connector */}
                          <View key={`v-${pairIdx}`} style={{ position: 'absolute', top: topCenter, left: BK_CONN_W / 2 - 0.5, width: 1, height: botCenter - topCenter, backgroundColor: Colors.line }} />
                          {/* Outbound */}
                          <View key={`o-${pairIdx}`} style={{ position: 'absolute', top: midY - 0.5, left: BK_CONN_W / 2, width: BK_CONN_W / 2, height: 1, backgroundColor: Colors.line }} />
                        </>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 3rd place match */}
      {thirdMatch && (
        <View style={{ paddingHorizontal: Spacing.md }}>
          <Text style={vw.section}>Disputa de 3º Lugar</Text>
          <MatchRow match={thirdMatch} comp={comp} isNext={thirdMatch.id === nextId}
            onPress={() => onScore(thirdMatch)}
            onLongPress={thirdMatch.scoreA != null ? () => onClear(thirdMatch.id) : undefined} />
          <View style={{ height: Spacing.xl }} />
        </View>
      )}
    </>
  );
}

const bk = StyleSheet.create({
  roundLabel: {
    fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.muted,
    letterSpacing: 1, textAlign: 'center',
  },
});
