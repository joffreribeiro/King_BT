import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import { koRoundName, competitionChampion } from '@/logic/formats';
import type { Match, Competition } from '@/logic/types';

const BK_CARD_H  = 62;
const BK_GAP     = 12;
const BK_ROUND_W = 140;
const BK_CONN_W  = 28;

function getCompetitor(comp: Competition, id: string) {
  return comp.competitors.find(c => c.id === id) ?? null;
}

// ── Match card (read-only) ────────────────────────────────────────────────────
function MatchCard({ match: m, comp }: { match: Match; comp: Competition }) {
  const cA = m.aId ? getCompetitor(comp, m.aId) : null;
  const cB = m.bId ? getCompetitor(comp, m.bId) : null;
  const has    = m.scoreA != null && m.scoreB != null;
  const aWon   = has && m.scoreA! > m.scoreB!;
  const bWon   = has && m.scoreB! > m.scoreA!;
  const pending = !cA || !cB;
  const colorA  = cA?.color ?? Colors.gold;

  return (
    <View style={[
      bk.card,
      pending && bk.cardPending,
      has && { borderColor: `${colorA}44` },
    ]}>
      {/* Side A */}
      <View style={[bk.row, aWon && { backgroundColor: `${colorA}18` }]}>
        <Text style={[bk.name, aWon && { color: colorA, fontFamily: FontFamily.bodyMed }]} numberOfLines={1}>
          {cA?.name ?? '—'}
        </Text>
        <Text style={[bk.score, { color: aWon ? colorA : Colors.faint }]}>
          {has ? m.scoreA : '–'}
        </Text>
      </View>

      <View style={bk.div} />

      {/* Side B */}
      <View style={[bk.row, bWon && { backgroundColor: 'rgba(84,185,129,0.12)' }]}>
        <Text style={[bk.name, bWon && { color: Colors.teal, fontFamily: FontFamily.bodyMed }]} numberOfLines={1}>
          {cB?.name ?? 'A definir'}
        </Text>
        <Text style={[bk.score, { color: bWon ? Colors.teal : Colors.faint }]}>
          {has ? m.scoreB : '–'}
        </Text>
      </View>

      {/* Live indicator */}
      {!has && cA && cB && (
        <View style={bk.liveDot} />
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BracketScreen() {
  const { competitionId } = useLocalSearchParams<{ competitionId: string }>();
  const { state } = useCompetitions();
  const { findPlayer } = useGroupPlayers();
  const { myPlayerId } = useAuth();

  const comp = state.competitions.find(c => c.id === competitionId);

  if (!comp) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <Text style={s.title}>Chaveamento</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: Colors.muted, fontFamily: FontFamily.body }}>Competição não encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const koMatches = comp.matches.filter(m => m.stage === 'ko' && !m.third);
  const thirdMatch = comp.matches.find(m => m.stage === 'ko' && m.third);

  const roundNums = [...new Set(koMatches.map(m => m.koRound ?? 0))].sort((a, b) => a - b);
  const rounds = roundNums.map(r =>
    koMatches.filter(m => m.koRound === r).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
  );

  const doneMatches  = koMatches.filter(m => m.scoreA != null).length;
  const totalMatches = koMatches.length;
  const pct = totalMatches > 0 ? doneMatches / totalMatches : 0;

  // Champion
  const champRaw = comp.status === 'done'
    ? competitionChampion(comp, id => findPlayer(id)?.name ?? id)
    : null;
  const champName = champRaw
    ? ((champRaw as any).name ?? findPlayer(champRaw.members[0])?.name ?? '—')
    : null;

  // Current phase
  const lastDoneRound = koMatches
    .filter(m => m.scoreA != null)
    .reduce((max, m) => Math.max(max, m.koRound ?? 0), 0);
  const currentRoundMatches = rounds.find(r => r[0]?.koRound === lastDoneRound + 1) ?? rounds[0];
  const phaseName = currentRoundMatches
    ? koRoundName(currentRoundMatches[0]?.cnt ?? 0)
    : '—';

  // Next match for logged user
  const myNextMatch = koMatches.find(m => {
    if (m.scoreA != null) return false;
    const ids = [m.aId, m.bId].filter(Boolean);
    const myComp = comp.competitors.find(c => c.members.includes(myPlayerId ?? ''));
    return myComp ? ids.includes(myComp.id) : false;
  });
  const myNextComp = myNextMatch
    ? { a: getCompetitor(comp, myNextMatch.aId ?? ''), b: getCompetitor(comp, myNextMatch.bId ?? '') }
    : null;

  // Bracket layout
  if (rounds.length === 0) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{comp.name}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl }}>
          <Text style={{ fontSize: 32 }}>⏳</Text>
          <Text style={{ fontFamily: FontFamily.title, fontSize: 16, color: Colors.text, marginTop: 12 }}>
            Chaveamento ainda não definido
          </Text>
          <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 6 }}>
            Conclua a fase de grupos para liberar o mata-mata.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const firstRoundCount = rounds[0].length;
  const slotH0  = BK_CARD_H + BK_GAP;
  const totalH  = firstRoundCount * slotH0 - BK_GAP;

  function slotH(rIdx: number)             { return slotH0 * Math.pow(2, rIdx); }
  function cardTop(rIdx: number, mIdx: number) {
    const sh = slotH(rIdx);
    return mIdx * sh + (sh - BK_CARD_H) / 2;
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{comp.name}</Text>
          <View style={s.statusRow}>
            <View style={[s.statusBadge, { backgroundColor: comp.status === 'done' ? Colors.teal + '22' : Colors.gold + '22', borderColor: comp.status === 'done' ? Colors.teal + '55' : Colors.gold + '55' }]}>
              <Text style={[s.statusText, { color: comp.status === 'done' ? Colors.teal : Colors.gold }]}>
                {comp.status === 'done' ? 'Encerrada' : 'Em andamento'}
              </Text>
            </View>
            <Text style={s.phaseName}>Fase: {phaseName}</Text>
          </View>
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${pct * 100}%` as any }]} />
        </View>
        <Text style={s.progressText}>{doneMatches}/{totalMatches} jogos</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Bracket */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ padding: Spacing.md, paddingBottom: Spacing.xl }}>
            {/* Round labels */}
            <View style={{ flexDirection: 'row' }}>
              {rounds.map((rMatches, rIdx) => (
                <View key={rIdx} style={{ flexDirection: 'row' }}>
                  <View style={{ width: BK_ROUND_W, alignItems: 'center' }}>
                    <Text style={bk.roundLabel}>{koRoundName(rMatches[0]?.cnt ?? 0)}</Text>
                  </View>
                  {rIdx < rounds.length - 1 && <View style={{ width: BK_CONN_W }} />}
                </View>
              ))}
              {/* Champion column label */}
              <View style={{ width: 90, alignItems: 'center', marginLeft: BK_CONN_W }}>
                <Text style={bk.roundLabel}>CAMPEÃO</Text>
              </View>
            </View>

            {/* Bracket body */}
            <View style={{ flexDirection: 'row', height: totalH, marginTop: 4, alignItems: 'flex-start' }}>
              {rounds.map((roundMatches, rIdx) => (
                <View key={rIdx} style={{ flexDirection: 'row' }}>
                  {/* Match cards */}
                  <View style={{ width: BK_ROUND_W, height: totalH, position: 'relative' }}>
                    {roundMatches.map((m, mIdx) => (
                      <View key={m.id} style={{ position: 'absolute', top: cardTop(rIdx, mIdx) }}>
                        <MatchCard match={m} comp={comp} />
                      </View>
                    ))}
                  </View>

                  {/* Connectors */}
                  {rIdx < rounds.length - 1 && (
                    <View style={{ width: BK_CONN_W, height: totalH, position: 'relative' }}>
                      {Array.from({ length: Math.ceil(roundMatches.length / 2) }).map((_, pairIdx) => {
                        const topIdx = pairIdx * 2;
                        const botIdx = pairIdx * 2 + 1;
                        if (botIdx >= roundMatches.length) return null;
                        const topCenter = cardTop(rIdx, topIdx) + BK_CARD_H / 2;
                        const botCenter = cardTop(rIdx, botIdx) + BK_CARD_H / 2;
                        const midY = (topCenter + botCenter) / 2;
                        const topDone = roundMatches[topIdx]?.scoreA != null;
                        const botDone = roundMatches[botIdx]?.scoreA != null;
                        const lineColor = (topDone && botDone) ? Colors.gold : Colors.line;
                        return (
                          <View key={pairIdx}>
                            <View style={{ position: 'absolute', top: topCenter - 0.5, left: 0, width: BK_CONN_W / 2, height: 1, backgroundColor: topDone ? Colors.gold : Colors.line }} />
                            <View style={{ position: 'absolute', top: botCenter - 0.5, left: 0, width: BK_CONN_W / 2, height: 1, backgroundColor: botDone ? Colors.gold : Colors.line }} />
                            <View style={{ position: 'absolute', top: topCenter, left: BK_CONN_W / 2 - 0.5, width: 1, height: botCenter - topCenter, backgroundColor: lineColor }} />
                            <View style={{ position: 'absolute', top: midY - 0.5, left: BK_CONN_W / 2, width: BK_CONN_W / 2, height: 1, backgroundColor: lineColor }} />
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}

              {/* Champion badge */}
              <View style={{ width: 90, height: totalH, alignItems: 'center', justifyContent: 'center', marginLeft: BK_CONN_W }}>
                <View style={bk.champBadge}>
                  <Text style={{ fontSize: 26 }}>👑</Text>
                  <Text style={bk.champName} numberOfLines={2}>
                    {champName ?? 'A definir'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* 3rd place */}
        {thirdMatch && (
          <View style={s.thirdSection}>
            <Text style={s.sectionLabel}>DISPUTA DE 3º LUGAR</Text>
            <MatchCard match={thirdMatch} comp={comp} />
          </View>
        )}

        {/* Legend */}
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={{ width: 16, height: 2, backgroundColor: Colors.gold, borderRadius: 1 }} />
            <Text style={s.legendText}>Realizado</Text>
          </View>
          <View style={s.legendItem}>
            <View style={{ width: 16, height: 1, borderStyle: 'dashed', borderTopWidth: 1, borderColor: Colors.faint }} />
            <Text style={s.legendText}>Aguardando</Text>
          </View>
        </View>

        {/* Próxima partida do usuário */}
        {myNextComp && myNextComp.a && myNextComp.b && (
          <View style={s.nextCard}>
            <Text style={s.nextLabel}>SUA PRÓXIMA PARTIDA</Text>
            <Text style={s.nextTitle}>
              {myNextComp.a.name} vs. {myNextComp.b.name}
            </Text>
            <Text style={s.nextSub}>
              {myNextMatch ? koRoundName(myNextMatch.cnt ?? 0) : ''}
            </Text>
          </View>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const bk = StyleSheet.create({
  roundLabel: {
    fontFamily: FontFamily.numberBold, fontSize: 9,
    color: Colors.faint, letterSpacing: 1.5, textAlign: 'center', marginBottom: 8,
  },
  card: {
    width: BK_ROUND_W,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(214,175,70,0.16)',
    backgroundColor: '#16140F',
    overflow: 'hidden',
    position: 'relative',
  },
  cardPending: {
    borderStyle: 'dashed',
    borderColor: 'rgba(110,100,82,0.30)',
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, height: (BK_CARD_H - 1) / 2,
  },
  div:  { height: 1, backgroundColor: 'rgba(214,175,70,0.1)' },
  name: { flex: 1, fontFamily: FontFamily.body, fontSize: 10, color: Colors.muted },
  score:{ fontFamily: FontFamily.numberBold, fontSize: 12 },
  liveDot: {
    position: 'absolute', top: 4, right: 4,
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: Colors.teal,
  },
  champBadge: {
    alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(243,197,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(243,197,68,0.2)',
    borderRadius: 12, padding: 12,
    width: 80,
  },
  champName: {
    fontFamily: FontFamily.numberBold, fontSize: 9,
    color: Colors.gold, textAlign: 'center',
  },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  back:  { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title: { fontFamily: FontFamily.titleBold, fontSize: 17, color: Colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1 },
  statusText:  { fontFamily: FontFamily.numberBold, fontSize: 10 },
  phaseName:   { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  progressWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  progressTrack: { flex: 1, height: 4, backgroundColor: '#221C12', borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 4, backgroundColor: Colors.gold, borderRadius: 2 },
  progressText:  { fontFamily: FontFamily.number, fontSize: 11, color: Colors.muted, width: 64, textAlign: 'right' },
  thirdSection: { paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  sectionLabel: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.faint, letterSpacing: 1.5, marginBottom: 8 },
  legend: {
    flexDirection: 'row', gap: Spacing.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  nextCard: {
    margin: Spacing.md,
    backgroundColor: 'rgba(107,127,215,0.12)',
    borderWidth: 1, borderColor: 'rgba(107,127,215,0.25)',
    borderRadius: 12, padding: 14,
  },
  nextLabel: { fontFamily: FontFamily.numberBold, fontSize: 8, color: '#6B7FD7', letterSpacing: 1.5, marginBottom: 4 },
  nextTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text, fontWeight: '700' },
  nextSub:   { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted, marginTop: 2 },
});
