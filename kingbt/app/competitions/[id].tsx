import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Platform, Share,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { PLAYERS } from '@/mocks/data';
import { standings, groupComplete, matchWinner, matchLoser, koRoundName, competitionChampion } from '@/logic/formats';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useSettings } from '@/store/SettingsContext';
import type { Match, Competition } from '@/logic/types';

function getPlayer(id: string) {
  return PLAYERS.find(p => p.id === id);
}
function getCompetitor(comp: Competition, id: string) {
  return comp.competitors.find(c => c.id === id);
}

// ─── Standings Table ──────────────────────────────────────────────────────────

function StandingsTable({ comp, ids, matches, highlightTop = 0 }: {
  comp: Competition; ids: string[]; matches: Match[]; highlightTop?: number;
}) {
  const st = standings(ids, matches);
  return (
    <Card padding={0} style={{ overflow: 'hidden', marginBottom: Spacing.sm }}>
      <View style={[stRow.row, stRow.header]}>
        {['#', 'JOGADOR', 'J', 'V', 'SG', 'PTS'].map(h => (
          <Text key={h} style={[h === 'JOGADOR' ? stRow.cName : h === '#' ? stRow.c0 : stRow.cN, stRow.th]}>{h}</Text>
        ))}
      </View>
      {st.map((s, i) => {
        const pl = getPlayer(s.id);
        const classified = highlightTop > 0 && i < highlightTop;
        return (
          <View key={s.id} style={[stRow.row, i < st.length - 1 && stRow.border, classified && stRow.classified]}>
            <Text style={[stRow.c0, stRow.pos]}>{i + 1}</Text>
            <View style={[stRow.cName, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              {pl && <Avatar name={pl.name} color={pl.color} size={22} />}
              <Text style={stRow.name} numberOfLines={1}>{pl?.name ?? s.id}</Text>
            </View>
            <Text style={stRow.cN}>{s.played}</Text>
            <Text style={stRow.cN}>{s.wins}</Text>
            <Text style={[stRow.cN, { color: s.gd >= 0 ? Colors.teal : Colors.coral }]}>
              {s.gd >= 0 ? '+' : ''}{s.gd}
            </Text>
            <Text style={[stRow.cN, { color: Colors.gold, fontFamily: FontFamily.numberBold }]}>{s.pts}</Text>
          </View>
        );
      })}
    </Card>
  );
}
const stRow = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  header: { backgroundColor: Colors.surf2, paddingVertical: 6 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  classified: { borderLeftWidth: 3, borderLeftColor: Colors.teal },
  c0: { width: 24 },
  cName: { flex: 1 },
  cN: { width: 32, textAlign: 'center', fontFamily: FontFamily.number, fontSize: 12, color: Colors.text },
  th: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.faint, letterSpacing: 0.5 },
  pos: { fontFamily: FontFamily.numberBold, fontSize: 12, color: Colors.muted },
  name: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.text, flex: 1 },
});

// ─── Game Row (avulso/super8) ─────────────────────────────────────────────────

function GameRow({ match: m, index, comp, isNext, onPress, onLongPress }: {
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
              ? <Text style={gRow.scoreText}>
                  <Text style={aWon ? gRow.win : gRow.lose}>{m.scoreA}</Text>
                  {' – '}
                  <Text style={!aWon ? gRow.win : gRow.lose}>{m.scoreB}</Text>
                </Text>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  team: { flex: 1, gap: 4 },
  pair: { flexDirection: 'row', gap: -6 },
  names: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  score: { alignItems: 'center', minWidth: 64 },
  scoreText: { fontFamily: FontFamily.numberBold, fontSize: 20 },
  win: { color: Colors.teal },
  lose: { color: Colors.muted },
  pending: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.faint },
  hint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, textAlign: 'center', marginTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.xs },
});

// ─── Match Row (liga/grupos/mata-mata) ────────────────────────────────────────

function MatchRow({ match: m, comp, isNext, onPress, onLongPress }: {
  match: Match; comp: Competition; isNext: boolean;
  onPress: () => void; onLongPress?: () => void;
}) {
  const cA = m.aId ? getCompetitor(comp, m.aId) : null;
  const cB = m.bId ? getCompetitor(comp, m.bId) : null;
  const pA = cA?.members[0] ? getPlayer(cA.members[0]) : null;
  const pB = cB?.members[0] ? getPlayer(cB.members[0]) : null;
  const has = m.scoreA != null && m.scoreB != null;
  const aWon = has && m.scoreA! > m.scoreB!;
  const pending = !cA || !cB;

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} disabled={pending} activeOpacity={0.8}>
      <Card style={{ ...mRow.card, ...(pending ? mRow.disabled : {}), ...(isNext ? mRow.nextCard : {}) } as ViewStyle}>
        {isNext && (
          <View style={mRow.nextBadge}>
            <Text style={mRow.nextBadgeText}>PRÓXIMO</Text>
          </View>
        )}
        <View style={mRow.row}>
          <View style={mRow.side}>
            {pA && <Avatar name={pA.name} color={pA.color} size={28} />}
            <Text style={[mRow.name, aWon && { color: Colors.gold }]} numberOfLines={1}>
              {cA?.name ?? '?'}
            </Text>
          </View>
          <Text style={mRow.vs}>
            {has ? `${m.scoreA} – ${m.scoreB}` : pending ? 'A definir' : 'vs'}
          </Text>
          <View style={[mRow.side, mRow.sideRight]}>
            <Text style={[mRow.name, { textAlign: 'right' }, !aWon && has && { color: Colors.gold }]} numberOfLines={1}>
              {cB?.name ?? '?'}
            </Text>
            {pB && <Avatar name={pB.name} color={pB.color} size={28} />}
          </View>
        </View>
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
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  sideRight: { justifyContent: 'flex-end' },
  name: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  vs: { fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.muted, minWidth: 56, textAlign: 'center' },
});

// ─── Bracket (chaveamento visual) ─────────────────────────────────────────────

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
  const pending = !cA || !cB;

  return (
    <TouchableOpacity onPress={onPress} disabled={pending} activeOpacity={0.8}>
      <View style={[bkCard.card, pending && { opacity: 0.5 }]}>
        <View style={[bkCard.row, aWon && bkCard.winRow]}>
          <Text style={[bkCard.name, aWon && bkCard.winName]} numberOfLines={1}>{cA?.name ?? '—'}</Text>
          <Text style={[bkCard.score, aWon && bkCard.winScore]}>{has ? m.scoreA : '–'}</Text>
        </View>
        <View style={bkCard.div} />
        <View style={[bkCard.row, !aWon && has && bkCard.winRow]}>
          <Text style={[bkCard.name, !aWon && has && bkCard.winName]} numberOfLines={1}>{cB?.name ?? '—'}</Text>
          <Text style={[bkCard.score, !aWon && has && bkCard.winScore]}>{has ? m.scoreB : '–'}</Text>
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
  name: { flex: 1, fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  winName: { color: Colors.gold, fontFamily: FontFamily.bodyMed },
  score: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.faint },
  winScore: { color: Colors.gold },
});

function BracketView({ comp, onScore, onClear }: {
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
    fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.faint,
    letterSpacing: 1, textAlign: 'center',
  },
});

// ─── Views por formato ────────────────────────────────────────────────────────

function firstUnscored(matches: Match[]): string | null {
  const m = matches.find(m => m.scoreA == null && ((m.aId && m.bId) || (m.teamA && m.teamB)));
  return m?.id ?? null;
}

function RotatingView({ comp, onScore, onClear }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void }) {
  const { findPlayer } = useGroupPlayers();
  const isDuplas = comp.unit === 'duplas';
  const [tab, setTab] = useState<'ranking' | 'jogos' | 'duplas'>('ranking');
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;
  const nextId = firstUnscored(comp.matches);

  const playerIds = [...new Set(comp.matches.flatMap(m => [...(m.teamA ?? []), ...(m.teamB ?? [])]))];
  const rankingStats = playerIds.map(pid => {
    let wins = 0, losses = 0, gf = 0, gc = 0;
    comp.matches.forEach(m => {
      if (m.scoreA == null) return;
      const inA = m.teamA?.includes(pid);
      const inB = m.teamB?.includes(pid);
      if (inA) { gf += m.scoreA!; gc += m.scoreB!; if (m.scoreA! > m.scoreB!) wins++; else losses++; }
      if (inB) { gf += m.scoreB!; gc += m.scoreA!; if (m.scoreB! > m.scoreA!) wins++; else losses++; }
    });
    const played = wins + losses;
    const ga = gc > 0 ? gf / gc : gf > 0 ? 999 : 0;
    return { pid, wins, losses, played, gf, gc, ga };
  }).sort((a, b) => b.wins - a.wins || b.ga - a.ga);

  // Duplas partnership stats
  type PairStat = { key: string; ids: [string, string]; wins: number; losses: number; played: number; gf: number; gc: number };
  const duplasStats: PairStat[] = [];
  if (isDuplas) {
    const map = new Map<string, PairStat>();
    comp.matches.filter(m => m.scoreA != null && m.teamA?.length === 2 && m.teamB?.length === 2).forEach(m => {
      const aWon = m.scoreA! > m.scoreB!;
      const keyA = [...m.teamA!].sort().join('|');
      const keyB = [...m.teamB!].sort().join('|');
      if (!map.has(keyA)) map.set(keyA, { key: keyA, ids: [...m.teamA!].sort() as [string, string], wins: 0, losses: 0, played: 0, gf: 0, gc: 0 });
      if (!map.has(keyB)) map.set(keyB, { key: keyB, ids: [...m.teamB!].sort() as [string, string], wins: 0, losses: 0, played: 0, gf: 0, gc: 0 });
      const sa = map.get(keyA)!;
      if (aWon) sa.wins++; else sa.losses++;
      sa.played++; sa.gf += m.scoreA!; sa.gc += m.scoreB!;
      const sb = map.get(keyB)!;
      if (!aWon) sb.wins++; else sb.losses++;
      sb.played++; sb.gf += m.scoreB!; sb.gc += m.scoreA!;
    });
    duplasStats.push(...[...map.values()].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const gaA = a.gc > 0 ? a.gf / a.gc : 0;
      const gaB = b.gc > 0 ? b.gf / b.gc : 0;
      return gaB - gaA;
    }));
  }

  const tabKeys = isDuplas ? (['ranking', 'duplas', 'jogos'] as const) : (['ranking', 'jogos'] as const);
  const tabLabels: Record<string, string> = { ranking: 'Ranking', duplas: 'Duplas', jogos: 'Jogos' };

  return (
    <View style={{ flex: 1 }}>
      <View style={tabs.bar}>
        {tabKeys.map(t => (
          <TouchableOpacity key={t} style={[tabs.tab, tab === t && tabs.active]} onPress={() => setTab(t as any)}>
            <Text style={[tabs.text, tab === t && tabs.textActive]}>{tabLabels[t]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={vw.scroll}>
        <Card style={vw.prog}>
          <View style={vw.progRow}>
            <Text style={vw.progLabel}>Progresso</Text>
            <Text style={vw.progCount}>{done}/{total} jogos</Text>
          </View>
          <View style={vw.track}>
            <View style={[vw.fill, { width: `${total ? done / total * 100 : 0}%` }]} />
          </View>
          {done === total && total > 0 && <Text style={vw.rei}>👑 Todos os jogos concluídos!</Text>}
        </Card>

        {tab === 'ranking' && (
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <View style={[stRow.row, stRow.header]}>
              {['#', 'JOGADOR', 'J', 'V', 'GA'].map(h => (
                <Text key={h} style={[h === 'JOGADOR' ? stRow.cName : h === '#' ? stRow.c0 : stRow.cN, stRow.th]}>{h}</Text>
              ))}
            </View>
            {rankingStats.map((s, i) => {
              const pl = findPlayer(s.pid);
              return (
                <View key={s.pid} style={[stRow.row, i < rankingStats.length - 1 && stRow.border]}>
                  <Text style={[stRow.c0, stRow.pos]}>{i + 1}</Text>
                  <View style={[stRow.cName, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    {pl && <Avatar name={pl.name} color={pl.color} size={22} />}
                    <Text style={stRow.name} numberOfLines={1}>{pl?.name ?? s.pid}</Text>
                  </View>
                  <Text style={stRow.cN}>{s.played}</Text>
                  <Text style={stRow.cN}>{s.wins}</Text>
                  <Text style={[stRow.cN, { color: Colors.gold, fontFamily: FontFamily.numberBold }]}>
                    {s.gc > 0 ? s.ga.toFixed(2) : '0,00'}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {tab === 'duplas' && (
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <View style={[stRow.row, stRow.header]}>
              {['#', 'DUPLA', 'J', 'V', '%'].map(h => (
                <Text key={h} style={[h === 'DUPLA' ? stRow.cName : h === '#' ? stRow.c0 : stRow.cN, stRow.th]}>{h}</Text>
              ))}
            </View>
            {duplasStats.length === 0 && (
              <View style={[stRow.row, { paddingVertical: Spacing.md }]}>
                <Text style={[stRow.cName, { color: Colors.faint, fontFamily: FontFamily.body, fontSize: 12 }]}>
                  Nenhum jogo registrado ainda.
                </Text>
              </View>
            )}
            {duplasStats.map((dp, i) => {
              const p0 = findPlayer(dp.ids[0]);
              const p1 = findPlayer(dp.ids[1]);
              const wr = dp.played > 0 ? Math.round(dp.wins / dp.played * 100) : 0;
              return (
                <View key={dp.key} style={[stRow.row, i < duplasStats.length - 1 && stRow.border]}>
                  <Text style={[stRow.c0, stRow.pos]}>{i + 1}</Text>
                  <View style={[stRow.cName, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    <View style={{ flexDirection: 'row', gap: -6 }}>
                      {p0 && <Avatar name={p0.name} color={p0.color} size={22} />}
                      {p1 && <Avatar name={p1.name} color={p1.color} size={22} />}
                    </View>
                    <Text style={stRow.name} numberOfLines={1}>
                      {p0?.name.split(' ')[0] ?? '?'} & {p1?.name.split(' ')[0] ?? '?'}
                    </Text>
                  </View>
                  <Text style={stRow.cN}>{dp.played}</Text>
                  <Text style={stRow.cN}>{dp.wins}</Text>
                  <Text style={[stRow.cN, { color: wr >= 60 ? Colors.teal : wr >= 40 ? Colors.text : Colors.coral, fontFamily: FontFamily.numberBold }]}>
                    {wr}%
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {tab === 'jogos' && comp.matches.map((m, i) => (
          <GameRow key={m.id} match={m} index={i} comp={comp} isNext={m.id === nextId}
            onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
        ))}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

function LeagueView({ comp, onScore, onClear }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void }) {
  const rounds = [...new Set(comp.matches.map(m => m.round))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const nextId = firstUnscored(comp.matches);
  return (
    <ScrollView contentContainerStyle={vw.scroll}>
      <Text style={vw.section}>Classificação</Text>
      <StandingsTable comp={comp} ids={comp.competitors.map(c => c.id)} matches={comp.matches} />
      {rounds.map(r => (
        <View key={r}>
          <Text style={vw.section}>Rodada {r}</Text>
          {comp.matches.filter(m => m.round === r).map(m => (
            <MatchRow key={m.id} match={m} comp={comp} isNext={m.id === nextId}
              onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
          ))}
        </View>
      ))}
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

function GroupsView({ comp, onScore, onClear }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void }) {
  const [tab, setTab] = useState<'grupos' | 'jogos' | 'chave'>('grupos');
  const allGroupsDone = comp.groupDefs?.every((_, gi) => groupComplete(comp.matches, gi)) ?? false;
  const groupMatches = (gi: number) => comp.matches.filter(m => m.stage === 'group' && m.groupIdx === gi);
  const nextId = firstUnscored(comp.matches);

  return (
    <View style={{ flex: 1 }}>
      <View style={tabs.bar}>
        {(['grupos', 'jogos', 'chave'] as const).map(t => (
          <TouchableOpacity key={t} style={[tabs.tab, tab === t && tabs.active]} onPress={() => setTab(t)}>
            <Text style={[tabs.text, tab === t && tabs.textActive]}>
              {t === 'grupos' ? 'Grupos' : t === 'jogos' ? 'Jogos' : 'Mata-mata'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chave tab: KOView handles its own scroll */}
      {tab === 'chave' && (
        allGroupsDone
          ? <KOView comp={comp} onScore={onScore} onClear={onClear} />
          : <ScrollView contentContainerStyle={vw.scroll}>
              <Card style={vw.locked}>
                <Text style={vw.lockedText}>⏳ Termine a fase de grupos para desbloquear o mata-mata.</Text>
              </Card>
              <View style={{ height: Spacing.xl }} />
            </ScrollView>
      )}

      {/* Grupos and Jogos tabs */}
      {tab !== 'chave' && (
        <ScrollView contentContainerStyle={vw.scroll}>
          {tab === 'grupos' && comp.groupDefs?.map((gd, gi) => (
            <View key={gi}>
              <Text style={vw.section}>{gd.name}</Text>
              <StandingsTable comp={comp} ids={gd.ids} matches={groupMatches(gi)} highlightTop={comp.config.qualifiers} />
            </View>
          ))}

          {tab === 'grupos' && allGroupsDone && (
            <View style={vw.groupsDoneBanner}>
              <Text style={vw.groupsDoneTitle}>✅ Fase de grupos concluída!</Text>
              <TouchableOpacity style={vw.groupsDoneBtn} onPress={() => setTab('chave')}>
                <Text style={vw.groupsDoneBtnText}>Ver Mata-mata →</Text>
              </TouchableOpacity>
            </View>
          )}

          {tab === 'jogos' && comp.groupDefs?.map((gd, gi) => (
            <View key={gi}>
              <Text style={vw.section}>{gd.name}</Text>
              {groupMatches(gi).map(m => (
                <MatchRow key={m.id} match={m} comp={comp} isNext={m.id === nextId}
                  onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
              ))}
            </View>
          ))}

          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      )}
    </View>
  );
}

function buildBracketShareText(comp: Competition): string {
  const lines: string[] = [`🏆 ${comp.name} — CHAVEAMENTO\n`];
  const roundNums = [...new Set(
    comp.matches.filter(m => m.stage === 'ko' && !m.third).map(m => m.koRound ?? 0)
  )].sort((a, b) => a - b);
  roundNums.forEach(r => {
    const rMatches = comp.matches.filter(m => m.koRound === r && !m.third);
    lines.push(koRoundName(rMatches[0]?.cnt ?? 0) + ':');
    rMatches.forEach(m => {
      const nA = m.aId ? comp.competitors.find(c => c.id === m.aId)?.name ?? '?' : '?';
      const nB = m.bId ? comp.competitors.find(c => c.id === m.bId)?.name ?? '?' : '?';
      if (m.scoreA != null) lines.push(`  ${nA} ${m.scoreA}–${m.scoreB} ${nB}`);
      else lines.push(`  ${nA} vs ${nB}`);
    });
  });
  const third = comp.matches.find(m => m.stage === 'ko' && m.third);
  if (third?.scoreA != null) {
    const nA = third.aId ? comp.competitors.find(c => c.id === third.aId)?.name ?? '?' : '?';
    const nB = third.bId ? comp.competitors.find(c => c.id === third.bId)?.name ?? '?' : '?';
    lines.push(`\n3º Lugar:\n  ${nA} ${third.scoreA}–${third.scoreB} ${nB}`);
  }
  const champ = competitionChampion(comp);
  if (champ) lines.push(`\n🥇 Campeão: ${champ.name}`);
  lines.push('\nEnviado pelo King BT 👑');
  return lines.join('\n');
}

function KOView({ comp, onScore, onClear }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void }) {
  const [viewMode, setViewMode] = useState<'chave' | 'lista'>('chave');
  const koRounds = [...new Set(comp.matches.filter(m => m.stage === 'ko').map(m => m.koRound))]
    .sort((a, b) => (a ?? 0) - (b ?? 0));
  const nextId = firstUnscored(comp.matches.filter(m => m.stage === 'ko'));

  return (
    <View style={{ flex: 1 }}>
      <View style={tabs.bar}>
        {(['chave', 'lista'] as const).map(t => (
          <TouchableOpacity key={t} style={[tabs.tab, viewMode === t && tabs.active]} onPress={() => setViewMode(t)}>
            <Text style={[tabs.text, viewMode === t && tabs.textActive]}>
              {t === 'chave' ? 'Chaveamento' : 'Lista'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[tabs.tab, { flex: 0, paddingHorizontal: Spacing.md }]}
          onPress={() => Share.share({ message: buildBracketShareText(comp) }).catch(() => {})}
        >
          <Text style={[tabs.text, { fontSize: 16 }]}>↑</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'chave' && <BracketView comp={comp} onScore={onScore} onClear={onClear} />}

      {viewMode === 'lista' && (
        <ScrollView contentContainerStyle={vw.scroll}>
          {koRounds.map(r => {
            const rMatches = comp.matches.filter(m => m.koRound === r);
            const main  = rMatches.filter(m => !m.third);
            const third = rMatches.filter(m => m.third);
            const cnt = main[0]?.cnt ?? 0;
            return (
              <View key={r}>
                <Text style={vw.section}>{koRoundName(cnt)}</Text>
                {main.map(m => <MatchRow key={m.id} match={m} comp={comp} isNext={m.id === nextId}
                  onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />)}
                {third.map(m => (
                  <View key={m.id}>
                    <Text style={vw.section}>Disputa de 3º Lugar</Text>
                    <MatchRow match={m} comp={comp} isNext={m.id === nextId}
                      onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
                  </View>
                ))}
              </View>
            );
          })}
          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      )}
    </View>
  );
}

const vw = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  prog: { gap: Spacing.sm, marginBottom: Spacing.sm },
  progRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  progCount: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.text },
  track: { height: 4, backgroundColor: Colors.line, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: Colors.teal, borderRadius: 2 },
  rei: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.gold, textAlign: 'center' },
  section: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted, letterSpacing: 1, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  locked: { alignItems: 'center', padding: Spacing.xl },
  lockedText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, textAlign: 'center' },
  groupsDoneBanner: { backgroundColor: Colors.teal + '18', borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.teal + '44', marginTop: Spacing.sm },
  groupsDoneTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.teal },
  groupsDoneBtn: { backgroundColor: Colors.teal, borderRadius: Radius.md, paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.md },
  groupsDoneBtnText: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.bg },
});

const tabs = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: Colors.surf2, borderBottomWidth: 1, borderBottomColor: Colors.line },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center' },
  active: { borderBottomWidth: 2, borderBottomColor: Colors.gold },
  text: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.faint },
  textActive: { color: Colors.gold },
});

// ─── Scorer Modal ─────────────────────────────────────────────────────────────

function ScorerModal({ match, comp, onClose, onSave, onClear, isAdmin = false }: {
  match: Match | null; comp: Competition;
  onClose: () => void;
  onSave: (id: string, a: number, b: number) => void;
  onClear: (matchId: string) => void;
  isAdmin?: boolean;
}) {
  const { findPlayer } = useGroupPlayers();
  const { defaultMaxScore } = useSettings();
  const [sA, setSA] = useState(match?.scoreA != null ? String(match.scoreA) : '');
  const [sB, setSB] = useState(match?.scoreB != null ? String(match.scoreB) : '');
  if (!match) return null;
  const a = parseInt(sA), b = parseInt(sB);
  const valid = !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0 && a !== b;
  const draw = !isNaN(a) && !isNaN(b) && a === b;
  const alreadyScored = match.scoreA != null;
  const canEdit = !alreadyScored || isAdmin;

  const nameA = match.teamA
    ? match.teamA.map(id => findPlayer(id)?.name.split(' ')[0]).join(' / ')
    : (match.aId ? getCompetitor(comp, match.aId)?.name : '?') ?? '?';
  const nameB = match.teamB
    ? match.teamB.map(id => findPlayer(id)?.name.split(' ')[0]).join(' / ')
    : (match.bId ? getCompetitor(comp, match.bId)?.name : '?') ?? '?';

  function confirmClear() {
    if (Platform.OS === 'web') {
      if (window.confirm('Apagar placar? O resultado será removido.')) { onClear(match!.id); onClose(); }
    } else {
      Alert.alert('Apagar placar?', 'O resultado será removido.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: () => { onClear(match!.id); onClose(); } },
      ]);
    }
  }

  return (
    <Modal visible transparent animationType="slide">
      <View style={sc.overlay}>
        <View style={sc.sheet}>
          <Text style={sc.title}>Registrar Placar</Text>
          <Text style={sc.sub}>{nameA}{'\nvs\n'}{nameB}</Text>
          <View style={sc.inputRow}>
            {[{ val: sA, set: setSA, label: nameA }, { val: sB, set: setSB, label: nameB }].map(({ val, set, label }, idx) => (
              <View key={idx} style={sc.inputBlock}>
                <Text style={sc.inputLabel} numberOfLines={1}>{label}</Text>
                <View style={sc.stepper}>
                  <TouchableOpacity style={sc.btn} onPress={() => set(s => String(Math.max(0, parseInt(s || '0') - 1)))}>
                    <Text style={sc.btnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput style={sc.input} value={val} onChangeText={set} keyboardType="number-pad" maxLength={2} />
                  <TouchableOpacity style={sc.btn} onPress={() => set(s => String(parseInt(s || '0') + 1))}>
                    <Text style={sc.btnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
          {/* Quick score chips */}
          {!alreadyScored && (
            <View style={sc.quickRow}>
              <Text style={sc.quickLabel}>Placar rápido:</Text>
              <View style={sc.quickChips}>
                {Array.from({ length: defaultMaxScore }, (_, i) => i).map(v => (
                  <TouchableOpacity key={v} style={sc.quickChip} onPress={() => { setSA(String(defaultMaxScore)); setSB(String(v)); }}>
                    <Text style={sc.quickChipText}>{defaultMaxScore}-{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          {draw && <Text style={sc.warn}>⚠️ Empate não permitido</Text>}
          {alreadyScored && !isAdmin && (
            <Text style={sc.lockedText}>🔒 Placar já registrado. Apenas admin pode corrigir.</Text>
          )}
          {isAdmin && alreadyScored && (
            <Text style={sc.adminNote}>⚙️ Admin — você pode corrigir ou apagar este placar.</Text>
          )}
          <View style={sc.btns}>
            <TouchableOpacity onPress={onClose} style={sc.cancel}>
              <Text style={sc.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (valid && canEdit) onSave(match.id, a, b); }}
              style={[sc.save, (!valid || !canEdit) && sc.saveOff]}
              disabled={!valid || !canEdit}
            >
              <Text style={sc.saveText}>{alreadyScored && isAdmin ? 'Corrigir' : 'Salvar'}</Text>
            </TouchableOpacity>
          </View>
          {isAdmin && alreadyScored && (
            <TouchableOpacity onPress={confirmClear} style={sc.clearBtn}>
              <Text style={sc.clearBtnText}>🗑  Apagar placar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
const sc = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.md },
  title: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center' },
  sub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-around', gap: Spacing.md },
  inputBlock: { alignItems: 'center', gap: Spacing.sm, flex: 1 },
  inputLabel: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  btn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.gold, lineHeight: 26 },
  input: { width: 54, height: 54, borderRadius: Radius.sm, backgroundColor: Colors.surf2, borderWidth: 1.5, borderColor: Colors.gold, fontFamily: FontFamily.numberBold, fontSize: 28, color: Colors.gold, textAlign: 'center' },
  warn: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral, textAlign: 'center' },
  btns: { flexDirection: 'row', gap: Spacing.md },
  cancel: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, alignItems: 'center' },
  cancelText: { fontFamily: FontFamily.body, color: Colors.muted },
  save: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.gold, alignItems: 'center' },
  saveOff: { opacity: 0.4 },
  saveText: { fontFamily: FontFamily.title, color: Colors.bg },
  lockedText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.faint, textAlign: 'center' },
  adminNote: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.gold, textAlign: 'center' },
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.xs },
  clearBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.coral },
  quickRow: { gap: 6 },
  quickLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, textAlign: 'center' },
  quickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  quickChip: { backgroundColor: Colors.surf2, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.line },
  quickChipText: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.teal },
});

// ─── Edit Name Modal ──────────────────────────────────────────────────────────

function EditNameModal({ current, onClose, onSave }: {
  current: string; onClose: () => void; onSave: (name: string) => void;
}) {
  const [name, setName] = useState(current);
  const valid = name.trim().length > 0 && name.trim() !== current;
  return (
    <Modal visible transparent animationType="fade">
      <TouchableOpacity style={en.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={en.box} activeOpacity={1}>
          <Text style={en.title}>Renomear competição</Text>
          <TextInput
            style={en.input}
            value={name}
            onChangeText={setName}
            autoFocus
            selectTextOnFocus
            placeholderTextColor={Colors.faint}
          />
          <View style={en.btns}>
            <TouchableOpacity style={en.cancel} onPress={onClose}>
              <Text style={en.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[en.save, !valid && en.saveOff]}
              onPress={() => { if (valid) { onSave(name.trim()); onClose(); } }}
              disabled={!valid}
            >
              <Text style={en.saveText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
const en = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  box: { backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', gap: Spacing.md },
  title: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontFamily: FontFamily.body, fontSize: 16, color: Colors.text,
  },
  btns: { flexDirection: 'row', gap: Spacing.sm },
  cancel: { flex: 1, borderWidth: 1.5, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  cancelText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted },
  save: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  saveOff: { opacity: 0.4 },
  saveText: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },
});

// ─── Share helper ──────────────────────────────────────────────────────────────

function buildShareText(comp: Competition, findPlayer: (id: string) => { name: string } | undefined): string {
  const lines: string[] = [`🏆 ${comp.name}\n`];

  if (comp.format === 'liga') {
    lines.push('CLASSIFICAÇÃO:');
    const st = standings(comp.competitors.map(c => c.id), comp.matches);
    st.forEach((s, i) => {
      const c = comp.competitors.find(x => x.id === s.id);
      lines.push(`${i + 1}. ${c?.name ?? s.id}  ${s.pts}pts  ${s.wins}V/${s.losses}D`);
    });
  } else if (comp.format === 'avulso' || comp.format === 'super8') {
    lines.push('RESULTADOS:');
    comp.matches.filter(m => m.scoreA != null).forEach(m => {
      const nA = m.teamA?.map(id => findPlayer(id)?.name.split(' ')[0]).join('/') ?? '?';
      const nB = m.teamB?.map(id => findPlayer(id)?.name.split(' ')[0]).join('/') ?? '?';
      lines.push(`${nA} ${m.scoreA}–${m.scoreB} ${nB}`);
    });
  } else {
    const done = comp.matches.filter(m => m.scoreA != null);
    lines.push(`JOGOS CONCLUÍDOS (${done.length}/${comp.matches.length}):`);
    done.forEach(m => {
      const nA = m.aId ? (getCompetitor(comp, m.aId)?.name ?? '?') : '?';
      const nB = m.bId ? (getCompetitor(comp, m.bId)?.name ?? '?') : '?';
      lines.push(`${nA} ${m.scoreA}–${m.scoreB} ${nB}`);
    });
  }

  const done = comp.matches.filter(m => m.scoreA != null).length;
  lines.push(`\n${done}/${comp.matches.length} jogos registrados`);
  lines.push('Enviado pelo King BT 👑');
  return lines.join('\n');
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CompetitionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useCompetitions();
  const { isAdmin } = useAuth();
  const { findPlayer } = useGroupPlayers();
  const comp = state.competitions.find(c => c.id === id);
  const [scoring, setScoring]         = useState<Match | null>(null);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showEditName, setShowEditName]   = useState(false);

  if (!comp) {
    return (
      <SafeAreaView style={main.container}>
        <Text style={{ color: Colors.coral, padding: Spacing.md }}>Competição não encontrada.</Text>
      </SafeAreaView>
    );
  }

  function handleSave(matchId: string, a: number, b: number) {
    dispatch({ type: 'SAVE_SCORE', compId: id!, matchId, scoreA: a, scoreB: b });
    setScoring(null);
  }

  function handleCorrect(matchId: string, a: number, b: number) {
    dispatch({ type: 'CORRECT_SCORE', compId: id!, matchId, scoreA: a, scoreB: b });
    setScoring(null);
  }

  function handleClear(matchId: string) {
    dispatch({ type: 'CLEAR_SCORE', compId: id!, matchId });
  }

  function handleDelete() {
    const doDelete = () => {
      dispatch({ type: 'DELETE', compId: id! });
      router.replace('/(app)');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Excluir competição? Esta ação não pode ser desfeita.')) doDelete();
    } else {
      Alert.alert('Excluir competição', 'Tem certeza? Esta ação não pode ser desfeita.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  function handleShare() {
    const text = buildShareText(comp!, findPlayer);
    Share.share({ message: text, title: comp!.name }).catch(() => {});
  }

  return (
    <SafeAreaView style={main.container} edges={['top']}>
      {/* Header */}
      <View style={main.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')}>
          <Text style={main.back}>←</Text>
        </TouchableOpacity>
        <View style={main.headerInfo}>
          <TouchableOpacity onLongPress={isAdmin ? () => setShowEditName(true) : undefined} activeOpacity={isAdmin ? 0.7 : 1}>
            <Text style={main.compName} numberOfLines={1}>{comp.name}</Text>
          </TouchableOpacity>
          <Badge
            label={comp.status === 'done' ? 'Concluída' : 'Ativa'}
            variant={comp.status === 'done' ? 'teal' : 'gold'}
            small
          />
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
          <TouchableOpacity onPress={handleShare} style={main.iconBtn}>
            <Text style={main.iconBtnText}>↑</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity onPress={() => setShowAdminMenu(true)} style={main.iconBtn}>
              <Text style={main.iconBtnText}>⚙️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isAdmin && <Text style={main.editHint}>Segure o nome para renomear</Text>}

      {/* Menu admin */}
      {showAdminMenu && (
        <View style={main.adminMenu}>
          <TouchableOpacity style={main.adminMenuItem} onPress={() => setShowAdminMenu(false)}>
            <Text style={main.adminMenuClose}>✕ Fechar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={main.adminMenuAction} onPress={() => { setShowAdminMenu(false); setShowEditName(true); }}>
            <Text style={main.adminMenuText}>✏️ Renomear competição</Text>
          </TouchableOpacity>
          <TouchableOpacity style={main.adminMenuAction} onPress={() => { setShowAdminMenu(false); handleDelete(); }}>
            <Text style={main.adminMenuDanger}>🗑️ Excluir competição</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Conteúdo por formato */}
      {comp.format === 'grupos'
        ? <GroupsView comp={comp} onScore={setScoring} onClear={handleClear} />
        : comp.format === 'liga'
          ? <LeagueView comp={comp} onScore={setScoring} onClear={handleClear} />
          : comp.format === 'mata'
            ? <KOView comp={comp} onScore={setScoring} onClear={handleClear} />
            : <RotatingView comp={comp} onScore={setScoring} onClear={handleClear} />
      }

      <ScorerModal
        match={scoring}
        comp={comp}
        onClose={() => setScoring(null)}
        onSave={isAdmin && scoring?.scoreA != null ? handleCorrect : handleSave}
        onClear={handleClear}
        isAdmin={isAdmin}
      />

      {showEditName && (
        <EditNameModal
          current={comp.name}
          onClose={() => setShowEditName(false)}
          onSave={(name) => dispatch({ type: 'RENAME', compId: id!, name })}
        />
      )}
    </SafeAreaView>
  );
}

const main = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line },
  back: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  compName: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  editHint: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint, textAlign: 'center', paddingVertical: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 18, color: Colors.muted },
  adminMenu: { backgroundColor: Colors.surf2, borderBottomWidth: 1, borderBottomColor: Colors.line, padding: Spacing.sm, gap: Spacing.xs },
  adminMenuItem: { alignSelf: 'flex-end' },
  adminMenuClose: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  adminMenuAction: { paddingVertical: Spacing.xs },
  adminMenuText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  adminMenuDanger: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.coral },
});
