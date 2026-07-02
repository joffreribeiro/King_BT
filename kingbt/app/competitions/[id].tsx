import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Platform, Share,
  Animated, Dimensions,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { PLAYERS } from '@/mocks/data';
import { standings, groupComplete, matchWinner, matchLoser, koRoundName, competitionChampion } from '@/logic/formats';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useSettings } from '@/store/SettingsContext';
import type { Match, Competition } from '@/logic/types';
import ConfettiCannon from 'react-native-confetti-cannon';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { getBeachTennisScoreState, getScoreHint, isValidFinalScore } from '@/logic/btScoring';
import { confirmParticipation, cancelParticipation } from '@/firebase/competitions';
import { carregarAnalise, placardInicial, avancaPonto, winRuleFromComp, type BtAnalise } from '@/logic/btTracker';

function getPlayer(id: string) {
  return PLAYERS.find(p => p.id === id);
}
function getCompetitor(comp: Competition, id: string) {
  return comp.competitors.find(c => c.id === id);
}

// Retorna label de placeholder para um slot ainda não resolvido no bracket
function srcLabel(comp: Competition, src: import('@/logic/types').MatchSource | null | undefined): string | null {
  if (!src) return null;
  const ordinal = (n: number) => n === 1 ? '1º' : n === 2 ? '2º' : n === 3 ? '3º' : `${n}º`;
  if (src.type === 'group') {
    const gName = comp.groupDefs?.[src.g ?? 0]?.name ?? `Grupo ${src.g ?? 0 + 1}`;
    return `${ordinal(src.pos ?? 1)} ${gName}`;
  }
  if (src.type === 'best3') {
    return `${ordinal(src.best3Rank ?? 1)} melhor 3º`;
  }
  if (src.type === 'winner') return 'Vencedor';
  if (src.type === 'loser') return 'Perdedor';
  return null;
}

// Retorna true se o slot é BYE estrutural (não tem src nem id atribuído)
function isByeSlot(id: string | null | undefined, src: import('@/logic/types').MatchSource | null | undefined): boolean {
  return !id && !src;
}

// ─── Standings Table ──────────────────────────────────────────────────────────

function StandingsTable({ comp, ids, matches, highlightTop = 0 }: {
  comp: Competition; ids: string[]; matches: Match[]; highlightTop?: number;
}) {
  const { findPlayer } = useGroupPlayers();

  function resolveEntry(id: string): { name: string; color: string } {
    const competitor = getCompetitor(comp, id);
    if (competitor) return { name: competitor.name, color: competitor.color };
    const gp = findPlayer(id);
    if (gp) return { name: gp.name, color: gp.color };
    const mock = getPlayer(id);
    if (mock) return { name: mock.name, color: mock.color };
    return { name: id, color: Colors.muted };
  }

  const st = standings(ids, matches, id => resolveEntry(id).name);
  return (
    <Card padding={0} style={{ overflow: 'hidden', marginBottom: Spacing.sm }}>
      {/* Cabeçalho */}
      <View style={[stRow.row, stRow.header]}>
        <Text style={[stRow.c0,    stRow.th]}>#</Text>
        <Text style={[stRow.cName, stRow.th]}>JOGADOR</Text>
        <Text style={[stRow.cN,    stRow.th]}>V</Text>
        <Text style={[stRow.cN,    stRow.th]}>D</Text>
        <Text style={[stRow.cN,    stRow.th]}>J</Text>
        <Text style={[stRow.cN,    stRow.th]}>GP</Text>
        <Text style={[stRow.cN,    stRow.th]}>GC</Text>
        <Text style={[stRow.cN,    stRow.th]}>SG</Text>
        <Text style={[stRow.cN,    stRow.th]}>GA</Text>
        <Text style={[stRow.cPts,  stRow.th]}>PTS</Text>
      </View>
      {st.map((s, i) => {
        const pl = resolveEntry(s.id);
        const classified = highlightTop > 0 && i < highlightTop;
        return (
          <View key={s.id} style={[stRow.row, i < st.length - 1 && stRow.border, classified && stRow.classified]}>
            <Text style={[stRow.c0, stRow.pos]}>{i + 1}</Text>
            <View style={[stRow.cName, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              <Avatar name={pl.name} color={pl.color} size={22} />
              <Text style={stRow.name} numberOfLines={1}>{pl.name}</Text>
            </View>
            <Text style={stRow.cN}>{s.wins}</Text>
            <Text style={stRow.cN}>{s.losses}</Text>
            <Text style={stRow.cN}>{s.played}</Text>
            <Text style={stRow.cN}>{s.gf}</Text>
            <Text style={stRow.cN}>{Math.round(s.gf - s.gd)}</Text>
            <Text style={[stRow.cN, { color: s.gd >= 0 ? Colors.teal : Colors.coral }]}>
              {s.gd >= 0 ? '+' : ''}{s.gd}
            </Text>
            <Text style={stRow.cN}>{Number(s.ga).toFixed(2)}</Text>
            <Text style={[stRow.cPts, { color: Colors.gold, fontFamily: FontFamily.numberBold }]}>{Number(s.pts).toFixed(2)}</Text>
          </View>
        );
      })}
      {/* Legenda */}
      <View style={stRow.legend}>
        <Text style={stRow.legendText}>V: Vitórias · D: Derrotas · J: Partidas · GP: Games Pró · GC: Games Contra · SG: Saldo · GA: Game Average · PTS: Pontuação</Text>
      </View>
    </Card>
  );
}
const stRow = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 7 },
  header: { backgroundColor: Colors.surf2, paddingVertical: 5 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  classified: { borderLeftWidth: 3, borderLeftColor: Colors.teal },
  legend: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.line },
  legendText: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.faint, textAlign: 'center' },
  c0: { width: 22 },
  cName: { flex: 1 },
  cN: { width: 28, textAlign: 'center', fontFamily: FontFamily.number, fontSize: 11, color: Colors.text },
  cNw: { width: 44, textAlign: 'center', fontFamily: FontFamily.number, fontSize: 11, color: Colors.text },
  cPts: { width: 56, textAlign: 'right', fontFamily: FontFamily.number, fontSize: 11, color: Colors.text },
  th: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.faint, letterSpacing: 0.3 },
  pos: { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.muted },
  name: { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.text, flex: 1 },
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
  disabled: { opacity: 0.45 },
  byeText: { color: Colors.faint, fontFamily: FontFamily.numberBold, fontSize: 11, letterSpacing: 1 },
  placeholderText: { color: Colors.faint, fontStyle: 'italic', fontSize: 12 },
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
  const byeA = isByeSlot(m.aId, m.aSrc);
  const byeB = isByeSlot(m.bId, m.bSrc);
  const pending = !cA || !cB;

  const nameA = cA?.name ?? (byeA ? 'BYE' : srcLabel(comp, m.aSrc) ?? '—');
  const nameB = cB?.name ?? (byeB ? 'BYE' : srcLabel(comp, m.bSrc) ?? '—');
  const isPlaceholderA = !cA && !byeA;
  const isPlaceholderB = !cB && !byeB;

  return (
    <TouchableOpacity onPress={onPress} disabled={pending} activeOpacity={0.8}>
      <View style={[bkCard.card, pending && !byeA && !byeB && { opacity: 0.65 }]}>
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
  name: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.text },
  winName: { color: Colors.gold, fontFamily: FontFamily.bodyMed },
  byeRow: { backgroundColor: Colors.surf2 },
  byeName: { color: Colors.text, fontFamily: FontFamily.numberBold, fontSize: 10, letterSpacing: 1 },
  placeholderName: { color: Colors.text, fontStyle: 'italic', fontSize: 10 },
  score: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.text },
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

function RotatingView({ comp, onScore, onClear, onSubstitute }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void; onSubstitute?: (match: Match, playerId: string) => void }) {
  const { findPlayer, groupPlayers: gp } = useGroupPlayers();
  const isDuplas = comp.unit === 'duplas';
  const [tab, setTab] = useState<'ranking' | 'jogos' | 'duplas'>('ranking');
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;
  const nextId = firstUnscored(comp.matches);

  const playerIds = [...new Set(comp.matches.flatMap(m => [...(m.teamA ?? []), ...(m.teamB ?? [])]))];
  const rankingStats = playerIds.map(pid => {
    let wins = 0, losses = 0, gf = 0, gc = 0;
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreA === m.scoreB) return;
      const inA = m.teamA?.includes(pid);
      const inB = m.teamB?.includes(pid);
      const gA = m.sets?.length ? m.sets.reduce((s, x) => s + x.a, 0) : m.scoreA!;
      const gB = m.sets?.length ? m.sets.reduce((s, x) => s + x.b, 0) : m.scoreB!;
      if (inA) { gf += gA; gc += gB; if (m.scoreA! > m.scoreB!) wins++; else losses++; }
      if (inB) { gf += gB; gc += gA; if (m.scoreB! > m.scoreA!) wins++; else losses++; }
    });
    const played = wins + losses;
    const ga = gc > 0 ? Math.min(9.99, gf / gc) : gf > 0 ? 9.99 : 0;
    const sg = gf - gc;
    const pts = wins * 3 + played * 0.5 + ga * 2;
    return { pid, wins, losses, played, gf, gc, ga, sg, pts };
  });

  function h2hRotating(pidA: string, pidB: string): number {
    let wA = 0, wB = 0;
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreA === m.scoreB) return;
      const aHasA = m.teamA?.includes(pidA) && m.teamB?.includes(pidB);
      const aHasB = m.teamA?.includes(pidB) && m.teamB?.includes(pidA);
      if (!aHasA && !aHasB) return;
      const aWon = m.scoreA! > m.scoreB!;
      if (aHasA) { if (aWon) wA++; else wB++; }
      else       { if (aWon) wB++; else wA++; }
    });
    if (wA !== wB) return wA > wB ? -1 : 1;
    return 0;
  }

  const EPS = 1e-9;
  rankingStats.sort((a, b) => {
    const byPts = b.pts  - a.pts;  if (Math.abs(byPts) > EPS) return byPts;
    const byGa  = b.ga   - a.ga;   if (Math.abs(byGa)  > EPS) return byGa;
    const bySg  = b.sg   - a.sg;   if (bySg  !== 0) return bySg;
    const byW   = b.wins - a.wins; if (byW   !== 0) return byW;
    const byH2H = h2hRotating(a.pid, b.pid); if (byH2H !== 0) return byH2H;
    const nA = findPlayer(a.pid)?.name ?? a.pid;
    const nB = findPlayer(b.pid)?.name ?? b.pid;
    return nA.localeCompare(nB, 'pt-BR', { sensitivity: 'base' });
  });

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
      const gA = m.sets?.length ? m.sets.reduce((s, x) => s + x.a, 0) : m.scoreA!;
      const gB = m.sets?.length ? m.sets.reduce((s, x) => s + x.b, 0) : m.scoreB!;
      const sa = map.get(keyA)!;
      if (aWon) sa.wins++; else sa.losses++;
      sa.played++; sa.gf += gA; sa.gc += gB;
      const sb = map.get(keyB)!;
      if (!aWon) sb.wins++; else sb.losses++;
      sb.played++; sb.gf += gB; sb.gc += gA;
    });
    duplasStats.push(...[...map.values()].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const gaA = a.gc > 0 ? a.gf / a.gc : 0;
      const gaB = b.gc > 0 ? b.gf / b.gc : 0;
      return gaB - gaA;
    }));
  }

  return (
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

        {false && (
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <View style={[stRow.row, stRow.header]}>
              <Text style={[stRow.c0, stRow.th]}>#</Text>
              <Text style={[stRow.cName, stRow.th]}>JOGADOR</Text>
              <Text style={[stRow.cN, stRow.th]}>J</Text>
              <Text style={[stRow.cN, stRow.th]}>V</Text>
              <Text style={[stRow.cNw, stRow.th]}>SG</Text>
              <Text style={[stRow.cN, stRow.th]}>GA</Text>
              <Text style={[stRow.cPts, stRow.th]}>PTS</Text>
            </View>
            {rankingStats.map((s, i) => {
              const pl = findPlayer(s.pid);
              const sgColor = s.sg > 0 ? Colors.teal : s.sg < 0 ? Colors.coral : Colors.muted;
              return (
                <View key={s.pid} style={[stRow.row, i < rankingStats.length - 1 && stRow.border]}>
                  <Text style={[stRow.c0, stRow.pos]}>{i + 1}</Text>
                  <View style={[stRow.cName, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
                    {pl && <Avatar name={pl.name} color={pl.color} size={20} />}
                    <Text style={stRow.name} numberOfLines={1}>{pl?.name ?? s.pid}</Text>
                  </View>
                  <Text style={stRow.cN}>{s.played}</Text>
                  <Text style={stRow.cN}>{s.wins}</Text>
                  <Text style={[stRow.cNw, { color: sgColor }]}>{s.sg > 0 ? '+' : ''}{s.sg}</Text>
                  <Text style={stRow.cN}>{s.ga.toFixed(2)}</Text>
                  <Text style={[stRow.cPts, { color: Colors.gold, fontFamily: FontFamily.numberBold }]}>
                    {s.pts.toFixed(2)}
                  </Text>
                </View>
              );
            })}
            {rankingStats.length > 0 && (
              <View style={stRow.legend}>
                <Text style={stRow.legendText}>GP: Games Pró · GC: Games Contra · SG: Saldo · GA: GP÷GC · PTS = V×3 + J×0,5 + GA×2</Text>
              </View>
            )}
          </Card>
        )}

        {false && (
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

        {comp.matches.map((m, i) => (
          <GameRow key={m.id} match={m} index={i} comp={comp} isNext={m.id === nextId}
            onPress={() => onScore(m)}
            onLongPress={() => {
              if (m.scoreA != null) {
                onClear(m.id);
              } else if (onSubstitute) {
                const ids = [...(m.teamA ?? []), ...(m.teamB ?? [])].filter(Boolean);
                Alert.alert('Substituir jogador', 'Qual jogador deseja substituir?', [
                  { text: 'Cancelar', style: 'cancel' },
                  ...ids.slice(0, 5).map(pid => ({
                    text: findPlayer(pid)?.name ?? pid,
                    onPress: () => onSubstitute(m, pid),
                  })),
                ]);
              }
            }} />
        ))}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
  );
}

// ─── Classificação unificada ──────────────────────────────────────────────────
function ClassificacaoView({ comp }: { comp: Competition }) {
  const { findPlayer } = useGroupPlayers();

  // Liga
  if (comp.format === 'liga') {
    return (
      <ScrollView contentContainerStyle={vw.scroll}>
        <StandingsTable comp={comp} ids={comp.competitors.map(c => c.id)} matches={comp.matches} />
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    );
  }

  // Grupos
  if (comp.format === 'grupos') {
    return (
      <ScrollView contentContainerStyle={vw.scroll}>
        {comp.groupDefs?.map((gd, gi) => (
          <View key={gi}>
            <Text style={vw.section}>{gd.name}</Text>
            <StandingsTable comp={comp} ids={gd.ids}
              matches={comp.matches.filter(m => m.stage === 'group' && m.groupIdx === gi)} />
          </View>
        ))}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    );
  }

  // Avulso / Super8 — ranking por jogador
  const playerIds = [...new Set(comp.matches.flatMap(m => [...(m.teamA ?? []), ...(m.teamB ?? [])]))];
  const rankingStats = playerIds.map(pid => {
    let wins = 0, losses = 0, gf = 0, gc = 0;
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreA === m.scoreB) return;
      const inA = m.teamA?.includes(pid), inB = m.teamB?.includes(pid);
      const gA = m.sets?.length ? m.sets.reduce((s, x) => s + x.a, 0) : m.scoreA!;
      const gB = m.sets?.length ? m.sets.reduce((s, x) => s + x.b, 0) : m.scoreB!;
      if (inA) { gf += gA; gc += gB; if (m.scoreA! > m.scoreB!) wins++; else losses++; }
      if (inB) { gf += gB; gc += gA; if (m.scoreB! > m.scoreA!) wins++; else losses++; }
    });
    const played = wins + losses;
    const ga = gc > 0 ? Math.min(9.99, gf / gc) : gf > 0 ? 9.99 : 0;
    const pts = wins * 3 + played * 0.5 + ga * 2;
    return { pid, wins, losses, played, gf, gc, pts };
  }).sort((a, b) => b.pts - a.pts);

  return (
    <ScrollView contentContainerStyle={vw.scroll}>
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <View style={[stRow.row, stRow.header]}>
          <Text style={[stRow.c0, stRow.th]}>#</Text>
          <Text style={[stRow.cName, stRow.th]}>JOGADOR</Text>
          <Text style={[stRow.cN, stRow.th]}>J</Text>
          <Text style={[stRow.cN, stRow.th]}>V</Text>
          <Text style={[stRow.cNw, stRow.th]}>SG</Text>
          <Text style={[stRow.cPts, stRow.th]}>PTS</Text>
        </View>
        {rankingStats.map((r, i) => {
          const pl = findPlayer(r.pid);
          const sg = r.gf - r.gc;
          const sgColor = sg > 0 ? Colors.teal : sg < 0 ? Colors.coral : Colors.muted;
          return (
            <View key={r.pid} style={[stRow.row, i < rankingStats.length - 1 && stRow.border]}>
              <Text style={[stRow.c0, stRow.pos]}>{i + 1}</Text>
              <View style={[stRow.cName, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                {pl && <Avatar name={pl.name} color={pl.color} size={22} />}
                <Text style={stRow.name} numberOfLines={1}>{pl?.name ?? r.pid}</Text>
              </View>
              <Text style={stRow.cN}>{r.played}</Text>
              <Text style={stRow.cN}>{r.wins}</Text>
              <Text style={[stRow.cNw, { color: sgColor }]}>{sg > 0 ? '+' : ''}{sg}</Text>
              <Text style={[stRow.cPts, { color: Colors.gold, fontFamily: FontFamily.numberBold }]}>{r.pts.toFixed(2)}</Text>
            </View>
          );
        })}
      </Card>
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

function LeagueView({ comp, onScore, onClear, onSubstitute }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void; onSubstitute?: (match: Match, playerId: string) => void }) {
  const rounds = [...new Set(comp.matches.map(m => m.round))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const nextId = firstUnscored(comp.matches);
  return (
    <ScrollView contentContainerStyle={vw.scroll}>
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
  const allGroupsDone = comp.status === 'done' ||
    (comp.groupDefs?.every((_, gi) => groupComplete(comp.matches, gi)) ?? false);
  const groupMatches = (gi: number) => comp.matches.filter(m => m.stage === 'group' && m.groupIdx === gi);
  const nextId = firstUnscored(comp.matches);
  const hasKO = comp.matches.some(m => m.stage === 'ko');

  return (
    <ScrollView contentContainerStyle={vw.scroll}>
      {/* Jogos por grupo */}
      {comp.groupDefs?.map((gd, gi) => (
        <View key={gi}>
          <Text style={vw.section}>{gd.name}</Text>
          {groupMatches(gi).map(m => (
            <MatchRow key={m.id} match={m} comp={comp} isNext={m.id === nextId}
              onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
          ))}
        </View>
      ))}

      {/* Mata-mata — sempre visível, com placeholders quando grupos ainda não terminaram */}
      {hasKO && (
        <View style={{ marginTop: Spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.xs }}>
            <Text style={vw.section}>⚔️ Mata-mata</Text>
            {!allGroupsDone && (
              <View style={{ backgroundColor: Colors.gold + '22', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: Colors.gold + '55' }}>
                <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold }}>PRÉVIA</Text>
              </View>
            )}
          </View>
          <KOView comp={comp} onScore={onScore} onClear={onClear} preview={!allGroupsDone} />
        </View>
      )}

      <View style={{ height: Spacing.xl }} />
    </ScrollView>
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
  if (champ) {
    const champName = (champ as any).name ?? comp.competitors.find(c => c.id === champ.members[0])?.name ?? champ.members[0];
    lines.push(`\n🥇 Campeão: ${champName}`);
  }
  lines.push('\nEnviado pelo King BT 👑');
  return lines.join('\n');
}

function KOView({ comp, onScore, onClear, preview = false }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void; preview?: boolean }) {
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
              {t === 'chave' ? '⚔️ Chaveamento' : '🎾 Jogos'}
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

function ScorerModal({ match, comp, onClose, onSave, onSaveDraft, onClear, isAdmin = false }: {
  match: Match | null; comp: Competition;
  onClose: () => void;
  onSave: (id: string, a: number, b: number, sets?: { a: number; b: number }[]) => void;
  onSaveDraft: (id: string, sets: { a: number; b: number }[]) => void;
  onClear: (matchId: string) => void;
  isAdmin?: boolean;
}) {
  const { findPlayer } = useGroupPlayers();
  const [analise, setAnalise] = useState<BtAnalise | null>(null);

  const maxSets      = comp.config.winRule?.sets ?? 3;
  const setsToWin    = Math.ceil(maxSets / 2);
  const gamesWin     = comp.config.winRule?.games ?? 6;
  const superTb      = comp.config.winRule?.superTiebreak ?? true;
  const superTbPts   = comp.config.winRule?.superTiebreakPts ?? 10;
  // 'deuce': tie em gamesWin-1 x gamesWin-1 (ex: 3-3 num set de 4 games)
  // 'full':  tie em gamesWin x gamesWin     (ex: 4-4 num set de 4 games)
  const tbAt         = comp.config.winRule?.tiebreakAt ?? 'deuce';
  const tieAt        = tbAt === 'full' ? gamesWin : gamesWin - 1;

  // Estado: games por set. Começa com 1 set vazio.
  const initSets = (): { a: string; b: string }[] => {
    if (match?.sets?.length) return match.sets.map(s => ({ a: String(s.a), b: String(s.b) }));
    return [{ a: '', b: '' }];
  };
  const [setScores, setSetScores] = useState<{ a: string; b: string }[]>(initSets);

  useEffect(() => {
    if (!match) return;

    carregarAnalise(match.id, comp.id).then(a => {
      setAnalise(a);

      // Prioridade 1: placar final do King Scout (partida encerrada)
      if (a?.placarFinal) {
        const { gamesA, gamesB } = a.placarFinal;
        const sets = gamesA.map((gA, i) => ({ a: String(gA), b: String(gamesB[i] ?? 0) }));
        setSetScores(sets.length > 0 ? sets : [{ a: '', b: '' }]);
        return;
      }

      // Prioridade 2: King Scout em andamento — reconstrói placard dos pontos
      if (a?.pontos?.length) {
        const rule = winRuleFromComp(comp.config.winRule);
        let pl = placardInicial(rule);
        for (const p of a.pontos) pl = avancaPonto(pl, p.vencedorDupla, p.sacador);
        // Monta sets encerrados + set atual
        const sets: { a: string; b: string }[] = pl.historicGamesA.map((gA: number, i: number) => ({
          a: String(gA), b: String(pl.historicGamesB[i] ?? 0),
        }));
        sets.push({ a: String(pl.gamesA), b: String(pl.gamesB) });
        setSetScores(sets);
        return;
      }

      // Prioridade 3: rascunho salvo
      if (match.draftSets?.length) {
        setSetScores(match.draftSets.map(s => ({ a: String(s.a), b: String(s.b) })));
        return;
      }

      // Prioridade 4: placar já registrado no Match
      if (match.sets?.length) {
        setSetScores(match.sets.map(s => ({ a: String(s.a), b: String(s.b) })));
        return;
      }

      setSetScores([{ a: '', b: '' }]);
    });
  }, [match?.id]);

  if (!match) return null;

  const teamA = match.teamA ?? (match.aId ? [match.aId] : []);
  const teamB = match.teamB ?? (match.bId ? [match.bId] : []);
  const nameA = match.teamA
    ? match.teamA.map(id => findPlayer(id)?.name.split(' ')[0]).join(' / ')
    : (match.aId ? getCompetitor(comp, match.aId)?.name : '?') ?? '?';
  const nameB = match.teamB
    ? match.teamB.map(id => findPlayer(id)?.name.split(' ')[0]).join(' / ')
    : (match.bId ? getCompetitor(comp, match.bId)?.name : '?') ?? '?';

  // Calcula sets vencidos a partir dos games/pontos
  const computedSets = setScores.reduce(
    (acc, s, idx) => {
      const gA = parseInt(s.a) || 0;
      const gB = parseInt(s.b) || 0;
      if (gA === 0 && gB === 0) return acc;

      if (isDecidingSet(idx)) {
        // Super tie-break: primeiro a superTbPts com diff ≥ 2
        const aWins = gA >= superTbPts && gA - gB >= 2;
        const bWins = gB >= superTbPts && gB - gA >= 2;
        if (aWins) return { a: acc.a + 1, b: acc.b };
        if (bWins) return { a: acc.a, b: acc.b + 1 };
        return acc;
      }

      // Set normal: primeiro a gamesWin vence, tie-break quando ambos chegam em tieAt
      const tied = gA === tieAt && gB === tieAt;
      if (tied) {
        // Após tie: quem chegar a tieAt+1 vence
        if (gA >= tieAt + 1 && gA > gB) return { a: acc.a + 1, b: acc.b };
        if (gB >= tieAt + 1 && gB > gA) return { a: acc.a, b: acc.b + 1 };
        return acc;
      }
      if (gA >= gamesWin && gA > gB) return { a: acc.a + 1, b: acc.b };
      if (gB >= gamesWin && gB > gA) return { a: acc.a, b: acc.b + 1 };
      return acc;
    },
    { a: 0, b: 0 }
  );

  const setsA = computedSets.a;
  const setsB = computedSets.b;
  const totalSetsPlayed = setScores.filter(s => (parseInt(s.a) || 0) + (parseInt(s.b) || 0) > 0).length;
  const matchFinished = setsA >= setsToWin || setsB >= setsToWin;
  const hasWinner = matchFinished && setsA !== setsB;
  const canAddSet = !matchFinished && totalSetsPlayed < maxSets;
  const alreadyScored = match.scoreA != null;
  const canEdit = !alreadyScored || isAdmin;
  const analiseEncerrada = !!analise?.placarFinal;

  const tbPoints = comp.config.winRule?.tiebreak ?? 7;

  // Verifica se o set atual (pelo índice) é o super tie-break decisivo
  function isDecidingSet(setIdx: number): boolean {
    if (!superTb) return false;
    if (setIdx !== maxSets - 1) return false; // só o último set pode ser STB
    // Conta sets vencidos nos sets anteriores (quem tiver mais pontos venceu o set)
    let sA = 0, sB = 0;
    for (let i = 0; i < setIdx; i++) {
      const gA = parseInt(setScores[i]?.a) || 0;
      const gB = parseInt(setScores[i]?.b) || 0;
      if (gA > gB) sA++;
      else if (gB > gA) sB++;
    }
    return sA === setsToWin - 1 && sB === setsToWin - 1;
  }

  // Limite máximo de pontos/games que um lado pode ter num set
  function maxGamesForSide(myVal: number, otherVal: number, setIdx: number): number {
    if (isDecidingSet(setIdx)) {
      const minPts = superTbPts;
      const leading = Math.max(myVal, otherVal);
      if (myVal >= minPts && myVal - otherVal >= 2) return myVal;
      if (otherVal >= minPts && otherVal - myVal >= 2) return myVal;
      return Math.max(minPts, leading + 1);
    }
    // Set normal: tie quando ambos chegam em tieAt
    if (otherVal >= tieAt && myVal >= tieAt) return tieAt + 1; // permite tie-break
    if (otherVal >= tieAt + 1) return tieAt + 2;               // tie-break em andamento
    return gamesWin;
  }

  function updateGame(setIdx: number, side: 'a' | 'b', rawVal: string | number) {
    const newVal = typeof rawVal === 'number' ? rawVal : (parseInt(rawVal) || 0);
    setSetScores(prev => prev.map((s, i) => {
      if (i !== setIdx) return s;
      const other = parseInt(side === 'a' ? s.b : s.a) || 0;
      const max = maxGamesForSide(newVal, other, setIdx);
      const clamped = Math.max(0, Math.min(newVal, max));
      return { ...s, [side]: String(clamped) };
    }));
  }

  function addSet() {
    if (canAddSet) setSetScores(prev => [...prev, { a: '', b: '' }]);
  }

  function removeLastSet() {
    if (setScores.length > 1) setSetScores(prev => prev.slice(0, -1));
  }

  function abrirBtTracker() {
    onClose();
    const wr = comp.config.winRule;
    router.push({
      pathname: '/analise/[matchId]/ponto',
      params: {
        matchId: match!.id, compId: comp.id,
        a1: teamA[0] ?? '', a2: teamA[1] ?? '',
        b1: teamB[0] ?? '', b2: teamB[1] ?? '',
        sets: String(wr?.sets ?? 3), games: String(wr?.games ?? 6),
        tiebreak: String(wr?.tiebreak ?? 7), scoutMode: wr?.scoutMode ?? 'avancado',
      },
    });
  }

  function abrirRelatorio() {
    onClose();
    router.push({ pathname: '/analise/[matchId]/relatorio', params: { matchId: match!.id, compId: comp.id } });
  }

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

  const validSets = setScores.filter(s => {
    const gA = parseInt(s.a) || 0, gB = parseInt(s.b) || 0;
    return gA > 0 || gB > 0;
  }).map(s => ({ a: parseInt(s.a) || 0, b: parseInt(s.b) || 0 }));

  // Só permite salvar se todos os sets do placar têm games preenchidos

  return (
    <Modal visible transparent animationType="slide">
      <View style={sc.overlay}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={sc.sheet}>
          <Text style={sc.title}>Registrar Placar</Text>
          <Text style={sc.sub}>{nameA}{'\nvs\n'}{nameB}</Text>
          <Text style={sc.setsRule}>Melhor de {maxSets} sets · {gamesWin} games por set</Text>

          {/* Placar calculado automaticamente */}
          <View style={sc.autoScore}>
            <View style={sc.autoSide}>
              <Text style={sc.autoName} numberOfLines={1}>{nameA}</Text>
              <Text style={[sc.autoSets, setsA > setsB ? { color: Colors.teal } : {}]}>{setsA}</Text>
            </View>
            <View style={sc.autoCenter}>
              <Text style={sc.autoLabel}>sets</Text>
              {hasWinner && <Text style={sc.autoWinner}>{setsA > setsB ? '🏆 ' + nameA.split('/')[0] : '🏆 ' + nameB.split('/')[0]}</Text>}
              {matchFinished && !hasWinner && <Text style={[sc.autoLabel, { color: Colors.coral }]}>⚠️ Empate</Text>}
            </View>
            <View style={sc.autoSide}>
              <Text style={sc.autoName} numberOfLines={1}>{nameB}</Text>
              <Text style={[sc.autoSets, setsB > setsA ? { color: Colors.teal } : {}]}>{setsB}</Text>
            </View>
          </View>

          {/* Sets com games */}
          <View style={sc.setsSection}>
            <Text style={sc.setsTitle}>GAMES POR SET</Text>
            {setScores.map((s, i) => {
              const gA = parseInt(s.a) || 0, gB = parseInt(s.b) || 0;
              const deciding = isDecidingSet(i);
              const pts = deciding ? superTbPts : gamesWin;
              const aWon = deciding
                ? (gA >= pts && gA - gB >= 2)
                : (gA >= gamesWin && gA > gB);
              const bWon = deciding
                ? (gB >= pts && gB - gA >= 2)
                : (gB >= gamesWin && gB > gA);
              const filled = gA > 0 || gB > 0;
              const maxA = maxGamesForSide(gA, gB, i);
              const maxB = maxGamesForSide(gB, gA, i);
              const canIncA = gA < maxA;
              const canIncB = gB < maxB;
              return (
                <View key={i} style={sc.setRow}>
                  <Text style={[sc.setLabel, deciding && { color: Colors.gold }]}>
                    {deciding ? `STB` : `Set ${i + 1}`}
                  </Text>
                  {/* Games lado A */}
                  <View style={sc.gameStepperWrap}>
                    <TouchableOpacity style={[sc.gameBtn, gA === 0 && { opacity: 0.3 }]} onPress={() => updateGame(i, 'a', gA - 1)} disabled={gA === 0}>
                      <Text style={sc.gameBtnTxt}>−</Text>
                    </TouchableOpacity>
                    <View style={[sc.gameVal, aWon && filled && { borderColor: Colors.teal }]}>
                      <Text style={[sc.gameValTxt, aWon && filled && { color: Colors.teal }]}>{s.a || '0'}</Text>
                    </View>
                    <TouchableOpacity style={[sc.gameBtn, !canIncA && { opacity: 0.3 }]} onPress={() => updateGame(i, 'a', gA + 1)} disabled={!canIncA}>
                      <Text style={sc.gameBtnTxt}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={sc.setDash}>–</Text>
                  {/* Games lado B */}
                  <View style={sc.gameStepperWrap}>
                    <TouchableOpacity style={[sc.gameBtn, gB === 0 && { opacity: 0.3 }]} onPress={() => updateGame(i, 'b', gB - 1)} disabled={gB === 0}>
                      <Text style={sc.gameBtnTxt}>−</Text>
                    </TouchableOpacity>
                    <View style={[sc.gameVal, bWon && filled && { borderColor: Colors.teal }]}>
                      <Text style={[sc.gameValTxt, bWon && filled && { color: Colors.teal }]}>{s.b || '0'}</Text>
                    </View>
                    <TouchableOpacity style={[sc.gameBtn, !canIncB && { opacity: 0.3 }]} onPress={() => updateGame(i, 'b', gB + 1)} disabled={!canIncB}>
                      <Text style={sc.gameBtnTxt}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            {/* Botões add/remove set */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {canAddSet && (
                <TouchableOpacity style={sc.addSetBtn} onPress={addSet}>
                  <Text style={sc.addSetTxt}>+ Adicionar set</Text>
                </TouchableOpacity>
              )}
              {setScores.length > 1 && (
                <TouchableOpacity style={[sc.addSetBtn, { borderColor: Colors.coral + '55' }]} onPress={removeLastSet}>
                  <Text style={[sc.addSetTxt, { color: Colors.coral }]}>− Remover</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Badge de rascunho salvo */}
          {match?.draftSets?.length && !alreadyScored && (
            <View style={sc.draftBadge}>
              <Text style={sc.draftBadgeTxt}>📝 Rascunho salvo — não conta no ranking até finalizar</Text>
            </View>
          )}

          {alreadyScored && !isAdmin && (
            <Text style={sc.lockedText}>🔒 Placar já registrado. Apenas admin pode corrigir.</Text>
          )}
          {isAdmin && alreadyScored && (
            <Text style={sc.adminNote}>⚙️ Admin — você pode corrigir ou apagar este placar.</Text>
          )}

          {/* King Scout */}
          {analise && !analiseEncerrada ? (
            // Análise em andamento — permite continuar ou ver parcial
            <View style={{ gap: 6 }}>
              <TouchableOpacity style={[sc.btBtn, sc.btBtnContinuar]} onPress={abrirBtTracker}>
                <Text style={sc.btBtnTxtContinuar}>▶ Continuar King Scout</Text>
                <Text style={sc.btBtnSub}>{analise.pontos.length} pontos registrados</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sc.btBtnSecundario} onPress={abrirRelatorio}>
                <Text style={sc.btBtnSecundarioTxt}>📊 Ver análise parcial</Text>
              </TouchableOpacity>
            </View>
          ) : analise && analiseEncerrada ? (
            // Análise encerrada — só visualização + opção de nova análise
            <View style={{ gap: 6 }}>
              <TouchableOpacity style={sc.btBtn} onPress={abrirRelatorio}>
                <Text style={sc.btBtnTxt}>📊 Ver análise BT salva</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sc.btBtnSecundario} onPress={abrirBtTracker}>
                <Text style={sc.btBtnSecundarioTxt}>🎾 Nova análise BT</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Sem análise — começa do zero
            <TouchableOpacity style={sc.btBtn} onPress={abrirBtTracker}>
              <Text style={sc.btBtnTxt}>👑 Usar King Scout</Text>
            </TouchableOpacity>
          )}

          <View style={sc.btns}>
            <TouchableOpacity onPress={onClose} style={sc.cancel}>
              <Text style={sc.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            {/* Salvar rascunho — só quando não tem vencedor e tem algum game preenchido */}
            {!hasWinner && !alreadyScored && validSets.length > 0 && (
              <TouchableOpacity
                style={sc.draft}
                onPress={() => {
                  onSaveDraft(match.id, validSets);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Text style={sc.draftText}>📝 Rascunho</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                if (hasWinner && canEdit) {
                  console.log('[KingBT] Salvando placar:', { setsA, setsB, validSets, setScores });
                  onSave(match.id, setsA, setsB, validSets.length > 0 ? validSets : undefined);
                }
              }}
              style={[sc.save, (!hasWinner || !canEdit) && sc.saveOff]}
              disabled={!hasWinner || !canEdit}
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
        </ScrollView>
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
  draft: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.muted + '66', alignItems: 'center' },
  draftText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  draftBadge: { backgroundColor: Colors.surf2, borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.muted + '44' },
  draftBadgeTxt: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, textAlign: 'center' },
  save: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.gold, alignItems: 'center' },
  saveOff: { opacity: 0.4 },
  saveText: { fontFamily: FontFamily.title, color: Colors.bg },
  lockedText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.faint, textAlign: 'center' },
  adminNote: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.gold, textAlign: 'center' },
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.xs },
  clearBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.coral },
  btBtn: { borderWidth: 1, borderColor: Colors.gold + '55', backgroundColor: Colors.gold + '15', borderRadius: Radius.md, padding: Spacing.sm + 2, alignItems: 'center' },
  btBtnTxt: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.gold },
  btBtnContinuar: { borderColor: Colors.teal + '88', backgroundColor: Colors.teal + '22' },
  btBtnTxtContinuar: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.teal },
  btBtnSub: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.teal, opacity: 0.7, marginTop: 2 },
  btBtnSecundario: { alignItems: 'center', paddingVertical: 6 },
  btBtnSecundarioTxt: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  setsRule: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, textAlign: 'center', marginTop: -4 },
  // Auto score display
  autoScore: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.md },
  autoSide: { flex: 1, alignItems: 'center', gap: 4 },
  autoName: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted, textAlign: 'center' },
  autoSets: { fontFamily: FontFamily.numberBold, fontSize: 40, color: Colors.muted },
  autoCenter: { alignItems: 'center', gap: 2, paddingHorizontal: Spacing.sm },
  autoLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  autoWinner: { fontFamily: FontFamily.bodyMed, fontSize: 10, color: Colors.teal, textAlign: 'center' },
  // Sets
  setsSection: { gap: 8 },
  setsTitle: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.muted, letterSpacing: 1, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setLabel: { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.faint, width: 36 },
  setDash: { fontFamily: FontFamily.body, fontSize: 16, color: Colors.faint },
  gameStepperWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  gameBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  gameBtnTxt: { fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.gold, lineHeight: 20 },
  gameVal: { flex: 1, height: 36, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  gameValTxt: { fontFamily: FontFamily.numberBold, fontSize: 18, color: Colors.text },
  addSetBtn: { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.sm, paddingVertical: 6, alignItems: 'center' },
  addSetTxt: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted },
  // Legacy
  setsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  setInput: { width: 36, height: 34, borderRadius: 4, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.line, fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.gold, textAlign: 'center' },
  quickRow: { gap: 6 },
  quickLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, textAlign: 'center' },
  quickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  quickChip: { backgroundColor: Colors.surf2, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.line },
  quickChipText: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.teal },
  stateBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  stateText: { fontFamily: FontFamily.title, fontSize: 12 },
  hint: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, textAlign: 'center', marginTop: 2 },
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

// ─── Avulso View ─────────────────────────────────────────────────────────────

function AvulsoView({ comp, onScore, onClear, onAddMatch }: {
  comp: Competition;
  onScore: (m: Match) => void;
  onClear: (matchId: string) => void;
  onAddMatch: () => void;
}) {
  const { findPlayer } = useGroupPlayers();
  const scored = comp.matches.filter(m => m.scoreA != null);
  const pending = comp.matches.filter(m => m.scoreA == null);

  // Ranking igual ao RotatingView
  const playerIds = [...new Set(comp.matches.flatMap(m => [...(m.teamA ?? []), ...(m.teamB ?? [])]))];
  const rankingStats = playerIds.map(pid => {
    let wins = 0, losses = 0, gf = 0, gc = 0;
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreA === m.scoreB) return;
      const inA = m.teamA?.includes(pid);
      const inB = m.teamB?.includes(pid);
      const gA = m.sets?.length ? m.sets.reduce((s, x) => s + x.a, 0) : m.scoreA!;
      const gB = m.sets?.length ? m.sets.reduce((s, x) => s + x.b, 0) : m.scoreB!;
      if (inA) { gf += gA; gc += gB; if (m.scoreA! > m.scoreB!) wins++; else losses++; }
      if (inB) { gf += gB; gc += gA; if (m.scoreB! > m.scoreA!) wins++; else losses++; }
    });
    const played = wins + losses;
    const ga = gc > 0 ? Math.min(9.99, gf / gc) : gf > 0 ? 9.99 : 0;
    const pts = wins * 3 + played * 0.5 + ga * 2;
    return { pid, wins, losses, played, gf, gc, pts };
  }).sort((a, b) => b.pts - a.pts);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
      showsVerticalScrollIndicator={false}>

      {/* Botão adicionar jogo */}
      {comp.status !== 'done' && (
        <TouchableOpacity style={avulsoS.addBtn} onPress={onAddMatch} activeOpacity={0.85}>
          <Text style={avulsoS.addBtnIcon}>+</Text>
          <Text style={avulsoS.addBtnText}>Registrar jogo</Text>
        </TouchableOpacity>
      )}

      {/* Jogos pendentes */}
      {pending.length > 0 && (
        <View style={{ gap: Spacing.xs }}>
          <Text style={avulsoS.sectionTitle}>AGUARDANDO PLACAR ({pending.length})</Text>
          {pending.map(m => {
            const namesA = (m.teamA ?? []).map(id => findPlayer(id)?.name ?? id).join(' / ');
            const namesB = (m.teamB ?? []).map(id => findPlayer(id)?.name ?? id).join(' / ');
            return (
              <TouchableOpacity key={m.id} onPress={() => onScore(m)} activeOpacity={0.8}>
                <Card style={[avulsoS.matchCard, m.liveScore ? avulsoS.matchCardLive : {}] as any}>
                  {m.liveScore && (
                    <View style={avulsoS.liveRow}>
                      <View style={avulsoS.liveDot} />
                      <Text style={avulsoS.liveText}>EM ANDAMENTO  {m.liveScore.gamesA}–{m.liveScore.gamesB}</Text>
                    </View>
                  )}
                  <View style={avulsoS.matchRow}>
                    <View style={avulsoS.matchSide}><Text style={avulsoS.matchName} numberOfLines={1}>{namesA}</Text></View>
                    <View style={avulsoS.matchCenter}>
                      {m.liveScore
                        ? <Text style={avulsoS.liveScoreText}>{m.liveScore.setsA}–{m.liveScore.setsB}</Text>
                        : <Text style={avulsoS.vsText}>vs</Text>
                      }
                    </View>
                    <View style={[avulsoS.matchSide, { alignItems: 'flex-end' }]}>
                      <Text style={avulsoS.matchName} numberOfLines={1}>{namesB}</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Jogos com placar */}
      {scored.length > 0 && (
        <View style={{ gap: Spacing.xs }}>
          <Text style={avulsoS.sectionTitle}>JOGOS REGISTRADOS ({scored.length})</Text>
          {scored.map(m => {
            const namesA = (m.teamA ?? []).map(id => findPlayer(id)?.name ?? id).join(' / ');
            const namesB = (m.teamB ?? []).map(id => findPlayer(id)?.name ?? id).join(' / ');
            const aWon = (m.scoreA ?? 0) > (m.scoreB ?? 0);
            return (
              <TouchableOpacity key={m.id} onPress={() => onScore(m)} onLongPress={() => onClear(m.id)} activeOpacity={0.8}>
                <Card style={avulsoS.matchCard}>
                  <View style={avulsoS.matchRow}>
                    <View style={avulsoS.matchSide}>
                      <Text style={[avulsoS.matchName, aWon && { color: Colors.teal }]} numberOfLines={1}>{namesA}</Text>
                    </View>
                    <View style={avulsoS.matchCenter}>
                      <Text style={avulsoS.scoreText}>{m.scoreA} – {m.scoreB}</Text>
                      <Text style={avulsoS.scoreSub}>sets</Text>
                    </View>
                    <View style={[avulsoS.matchSide, { alignItems: 'flex-end' }]}>
                      <Text style={[avulsoS.matchName, !aWon && { color: Colors.teal }]} numberOfLines={1}>{namesB}</Text>
                    </View>
                  </View>
                  {m.sets && m.sets.length > 0 && (
                    <View style={avulsoS.setsRow}>
                      {m.sets.map((s, i) => {
                        const aWonSet = s.a > s.b;
                        return (
                          <View key={i} style={avulsoS.setChip}>
                            <Text style={[avulsoS.setScore, aWonSet && avulsoS.setScoreWin]}>{s.a}</Text>
                            <Text style={avulsoS.setDash}>-</Text>
                            <Text style={[avulsoS.setScore, !aWonSet && avulsoS.setScoreWin]}>{s.b}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Ranking */}
      {rankingStats.length > 0 && (
        <View style={{ gap: Spacing.xs }}>
          <Text style={avulsoS.sectionTitle}>RANKING</Text>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            {rankingStats.map((r, i) => {
              const pl = findPlayer(r.pid);
              return (
                <View key={r.pid} style={[avulsoS.rankRow, i < rankingStats.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.line }]}>
                  <Text style={avulsoS.rankPos}>{i + 1}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    {pl && <Avatar name={pl.name} color={pl.color} size={22} />}
                    <Text style={avulsoS.rankName} numberOfLines={1}>{pl?.name ?? r.pid}</Text>
                  </View>
                  <Text style={avulsoS.rankStat}>{r.wins}V {r.losses}D</Text>
                  <Text style={avulsoS.rankPts}>{r.pts.toFixed(2)}</Text>
                </View>
              );
            })}
          </Card>
        </View>
      )}

      {comp.matches.length === 0 && (
        <View style={avulsoS.empty}>
          <Text style={avulsoS.emptyIcon}>📋</Text>
          <Text style={avulsoS.emptyText}>Nenhum jogo registrado ainda.</Text>
          <Text style={avulsoS.emptyHint}>Toque em "Registrar jogo" para adicionar.</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const avulsoS = StyleSheet.create({
  addBtn:      { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  addBtnIcon:  { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.bg },
  addBtnText:  { fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
  sectionTitle:{ fontFamily: FontFamily.title, fontSize: 12, color: Colors.muted, letterSpacing: 1 },
  matchCard:     { gap: 4 },
  matchCardLive: { borderColor: Colors.coral + '55', borderWidth: 1.5 },
  matchRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  matchSide:     { flex: 1 },
  matchCenter:   { alignItems: 'center', paddingHorizontal: Spacing.xs },
  matchName:     { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  vsText:        { fontFamily: FontFamily.body, fontSize: 12, color: Colors.faint },
  liveRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.coral },
  liveText:      { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.coral, letterSpacing: 1 },
  liveScoreText: { fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.coral },
  scoreText:   { fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.gold },
  scoreSub:    { fontFamily: FontFamily.body, fontSize: 9, color: Colors.faint, textAlign: 'center', marginTop: -2 },
  setsRow:     { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.line },
  setChip:     { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Colors.surf2, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  setScore:    { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.muted },
  setScoreWin: { color: Colors.teal },
  setDash:     { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  rankRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  rankPos:     { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.muted, width: 20, textAlign: 'center' },
  rankName:    { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text, flex: 1 },
  rankStat:    { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  rankPts:     { fontFamily: FontFamily.numberBold, fontSize: 14, color: Colors.gold, width: 52, textAlign: 'right' },
  empty:       { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyIcon:   { fontSize: 40 },
  emptyText:   { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  emptyHint:   { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
});

// ─── Rules View ───────────────────────────────────────────────────────────────

function RulesView({ comp }: { comp: Competition }) {
  const wr = comp.config.winRule;

  const formatName: Record<string, string> = {
    liga: 'Liga', grupos: 'Grupos + Mata-mata', mata: 'Mata-mata', avulso: 'Avulso', super8: 'Super 8',
  };
  const unitName: Record<string, string> = { individual: 'Individual', duplas: 'Duplas' };
  const genderName: Record<string, string> = { masculino: 'Masculino', feminino: 'Feminino', misto: 'Misto' };

  const sets = wr.sets ?? 3;
  const games = wr.games ?? 6;
  const tb = wr.tiebreak ?? 7;
  const superTb = wr.superTiebreak ?? false;
  const superTbPts = wr.superTiebreakPts ?? 10;

  function RuleRow({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
    return (
      <View style={rls.row}>
        <Text style={rls.icon}>{icon}</Text>
        <Text style={rls.label}>{label}</Text>
        <Text style={[rls.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      </View>
    );
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <View style={rls.section}>
        <Text style={rls.sectionTitle}>{title}</Text>
        <View style={rls.card}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={rls.scroll} showsVerticalScrollIndicator={false}>

      {/* Informações gerais */}
      <Section title="INFORMAÇÕES GERAIS">
        <RuleRow icon="🏆" label="Formato" value={formatName[comp.format] ?? comp.format} />
        <View style={rls.divider} />
        <RuleRow icon="👥" label="Modalidade" value={unitName[comp.unit] ?? comp.unit} />
        <View style={rls.divider} />
        <RuleRow icon="⚧" label="Categoria" value={genderName[comp.gender] ?? comp.gender} />
        {comp.location && (
          <>
            <View style={rls.divider} />
            <RuleRow icon="📍" label="Local" value={comp.location} />
          </>
        )}
        <View style={rls.divider} />
        <RuleRow icon="📅" label="Data" value={new Date(comp.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} />
        <View style={rls.divider} />
        <RuleRow icon="🎮" label="Participantes" value={`${comp.competitors.length} jogadores`} />
      </Section>

      {/* Regras do jogo */}
      <Section title="REGRAS DO JOGO">
        <RuleRow icon="🎯" label="Sets para vencer" value={`Melhor de ${sets} set${sets > 1 ? 's' : ''}`} valueColor={Colors.gold} />
        <View style={rls.divider} />
        <RuleRow icon="🎾" label="Games por set" value={`${games} games`} valueColor={Colors.gold} />
        <View style={rls.divider} />
        <RuleRow icon="⚡" label="Tie-break" value={`Primeiro a ${tb} pontos`} />
        <View style={rls.divider} />
        <RuleRow
          icon="🔥"
          label={`Set decisivo (${sets}º set)`}
          value={superTb ? `Super Tie-Break (${superTbPts} pts)` : `Set completo (${games} games)`}
          valueColor={superTb ? Colors.coral : Colors.muted}
        />
      </Section>

      {/* Pontuação */}
      <Section title="PONTUAÇÃO">
        <RuleRow icon="🥇" label="Vitória" value="+3 pontos" valueColor={Colors.teal} />
        <View style={rls.divider} />
        <RuleRow icon="🥈" label="Derrota" value="+0 pontos" valueColor={Colors.muted} />
        <View style={rls.divider} />
        <RuleRow icon="📊" label="Jogo disputado" value="+0.5 pontos" />
      </Section>

      {/* Critérios de desempate */}
      <Section title="CRITÉRIOS DE DESEMPATE">
        {[
          { n: '1º', label: 'Confronto direto entre empatados' },
          { n: '2º', label: 'Maior saldo de games (GP − GC)' },
          { n: '3º', label: 'Maior GA (games pró ÷ games contra)' },
          { n: '4º', label: 'Maior número de vitórias' },
          { n: '5º', label: 'Alfabético (último recurso)' },
        ].map((c, i) => (
          <View key={i}>
            {i > 0 && <View style={rls.divider} />}
            <View style={rls.row}>
              <View style={rls.tiebreakBadge}>
                <Text style={rls.tiebreakN}>{c.n}</Text>
              </View>
              <Text style={[rls.label, { flex: 1 }]}>{c.label}</Text>
            </View>
          </View>
        ))}
      </Section>

      {/* Observações */}
      {comp.notes && (
        <Section title="OBSERVAÇÕES">
          <Text style={rls.notes}>{comp.notes}</Text>
        </Section>
      )}

      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

const rls = StyleSheet.create({
  scroll: { padding: Spacing.md, gap: Spacing.md },
  section: { gap: Spacing.xs },
  sectionTitle: { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.muted, letterSpacing: 1.5, paddingLeft: 2 },
  card: { backgroundColor: Colors.surf, borderRadius: Radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.line, marginHorizontal: Spacing.md },
  icon: { fontSize: 16, width: 24, textAlign: 'center' },
  label: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, flex: 1 },
  value: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text, textAlign: 'right', flexShrink: 0, maxWidth: '55%' },
  tiebreakBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.gold + '22', alignItems: 'center', justifyContent: 'center' },
  tiebreakN: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold },
  notes: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, lineHeight: 20, padding: Spacing.md },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CompetitionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useCompetitions();
  const { isAdmin, myPlayerId, group } = useAuth();
  const { findPlayer, groupPlayers } = useGroupPlayers();
  const comp = state.competitions.find(c => c.id === id);
  const [scoring, setScoring]             = useState<Match | null>(null);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showEditName, setShowEditName]   = useState(false);
  const [showConfetti, setShowConfetti]   = useState(false);
  const [showChampion, setShowChampion]   = useState(false);
  const [confirmBusy, setConfirmBusy]     = useState(false);
  const [showAddAvulso, setShowAddAvulso] = useState(false);
  const [activeTab, setActiveTab] = useState<'regras' | 'classificacao' | 'partidas'>('partidas');
  const [avulsoTeamA, setAvulsoTeamA]     = useState<string[]>([]);
  const [avulsoTeamB, setAvulsoTeamB]     = useState<string[]>([]);
  const champAnim  = useRef(new Animated.Value(0)).current;
  const viewShotRef = useRef<View>(null);
  const screenW = Dimensions.get('window').width;
  const confettiFired = useRef(false);

  function triggerChampion() {
    if (confettiFired.current) return;
    confettiFired.current = true;
    setShowConfetti(true);
    setShowChampion(true);
    champAnim.setValue(0);
    Animated.spring(champAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }).start();
    setTimeout(() => setShowConfetti(false), 4000);
  }

  // Dispara quando o status muda para 'done' em tempo real
  useEffect(() => {
    if (comp?.status === 'done' && competitionChampion(comp, id => findPlayer(id)?.name ?? id)) triggerChampion();
  }, [comp?.status]);

  // Dispara ao entrar numa competição já concluída (comp carrega após montagem)
  useEffect(() => {
    if (comp?.status === 'done' && competitionChampion(comp, id => findPlayer(id)?.name ?? id)) triggerChampion();
  }, [!!comp]);

  async function shareChampionImage() {
    try {
      if (!viewShotRef.current) return;
      const uri = await captureRef(viewShotRef, { format: 'png', quality: 0.95 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartilhar resultado' });
      }
    } catch { /* ignore */ }
  }

  if (!comp) {
    return (
      <SafeAreaView style={main.container}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')}>
            <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal }}>←</Text>
          </TouchableOpacity>
          <Text style={{ color: Colors.coral, fontFamily: FontFamily.body, fontSize: 14 }}>
            Competição não encontrada.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const champion = competitionChampion(comp, id => findPlayer(id)?.name ?? id);
  const champPlayer = champion
    ? findPlayer(champion.members[0]) ?? { name: (champion as any).name ?? champion.members[0], color: Colors.gold }
    : null;
  const champDisplayName = champPlayer?.name ?? '';

  function handleSave(matchId: string, a: number, b: number, sets?: { a: number; b: number }[]) {
    // Ao salvar o placar final, limpa o rascunho
    dispatch({ type: 'CLEAR_DRAFT', compId: id!, matchId });
    dispatch({ type: 'SAVE_SCORE', compId: id!, matchId, scoreA: a, scoreB: b, sets });
    setScoring(null);
  }

  function handleCorrect(matchId: string, a: number, b: number, sets?: { a: number; b: number }[]) {
    dispatch({ type: 'CLEAR_DRAFT', compId: id!, matchId });
    dispatch({ type: 'CORRECT_SCORE', compId: id!, matchId, scoreA: a, scoreB: b, sets });
    setScoring(null);
  }

  function handleSaveDraft(matchId: string, draftSets: { a: number; b: number }[]) {
    dispatch({ type: 'SAVE_DRAFT', compId: id!, matchId, draftSets });
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

  async function handleToggleConfirm() {
    if (!group || !myPlayerId || !comp) return;
    setConfirmBusy(true);
    const already = comp.confirmedIds?.includes(myPlayerId);
    if (already) {
      await cancelParticipation(group.id, comp.id, myPlayerId);
    } else {
      await confirmParticipation(group.id, comp.id, myPlayerId);
    }
    setConfirmBusy(false);
  }

  function handleConfirmAddAvulso() {
    if (avulsoTeamA.length === 0 || avulsoTeamB.length === 0) return;
    const newMatch: Match = {
      id: 'av_' + Date.now(),
      stage: 'rotating',
      teamA: avulsoTeamA,
      teamB: avulsoTeamB,
      scoreA: null,
      scoreB: null,
    };
    dispatch({
      type: 'UPDATE',
      comp: { ...comp!, matches: [...comp!.matches, newMatch], status: 'active' },
    });
    setAvulsoTeamA([]);
    setAvulsoTeamB([]);
    setShowAddAvulso(false);
  }

  async function handleStartUpcoming() {
    if (!comp || !group) return;
    // Monta competidores a partir dos jogadores confirmados
    const confirmedPlayers = (comp.confirmedIds ?? [])
      .map(pid => findPlayer(pid))
      .filter(Boolean) as typeof groupPlayers;
    const competitors = confirmedPlayers.map(p => ({
      id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(),
      color: p.color, members: [p.id],
    }));
    dispatch({
      type: 'UPDATE',
      comp: {
        ...comp,
        status: 'active',
        competitors,
        confirmedIds: comp.confirmedIds,
      },
    });
  }

  function handleSubstitute(match: Match, originalId: string) {
    if (!isAdmin) return;
    const options = groupPlayers
      .filter(p => p.id !== originalId)
      .slice(0, 6)
      .map(p => ({
        text: p.name,
        onPress: () => {
          dispatch({
            type: 'SUBSTITUTE_PLAYER',
            compId: comp!.id,
            sub: {
              originalId,
              substituteId: p.id,
              fromMatchId: match.id,
              timestamp: new Date().toISOString(),
            },
          });
        },
      }));
    Alert.alert('Substituir jogador', 'Escolha quem vai entrar:', [
      { text: 'Cancelar', style: 'cancel' },
      ...options,
    ]);
  }

  return (
    <SafeAreaView style={main.container} edges={['top']}>
      {/* Confetti */}
      {showConfetti && (
        <ConfettiCannon
          count={120}
          origin={{ x: screenW / 2, y: -20 }}
          autoStart
          fadeOut
          colors={[Colors.gold, Colors.teal, '#FF6B6B', '#FFFFFF', '#A8DADC']}
        />
      )}

      {/* Champion banner */}
      {showChampion && champPlayer && (
        <Animated.View style={[main.champBanner, {
          opacity: champAnim,
          transform: [{ scale: champAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }]}>
          <View ref={viewShotRef} style={main.champCard}>
            <Text style={main.champCrown}>👑</Text>
            <Avatar name={champPlayer.name} color={champPlayer.color} size={60} />
            <Text style={main.champTitle}>CAMPEÃO</Text>
            <Text style={main.champName}>{champDisplayName}</Text>
            <Text style={main.champComp}>{comp.name}</Text>
          </View>
          <View style={main.champActions}>
            <TouchableOpacity style={main.champBtn} onPress={shareChampionImage}>
              <Text style={main.champBtnText}>📤 Compartilhar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={main.champClose} onPress={() => setShowChampion(false)}>
              <Text style={main.champCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

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
            label={comp.status === 'upcoming' ? 'Agendada' : comp.status === 'done' ? 'Concluída' : 'Ativa'}
            variant={comp.status === 'upcoming' ? 'gold' : comp.status === 'done' ? 'teal' : 'gold'}
            small
          />
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
          {comp.status === 'done' && champPlayer && (
            <TouchableOpacity onPress={() => setShowChampion(true)} style={main.iconBtn}>
              <Text style={main.iconBtnText}>👑</Text>
            </TouchableOpacity>
          )}
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

      {/* Painel de confirmação (upcoming) */}
      {comp.status === 'upcoming' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>

          {/* Banner info */}
          <View style={upcoming.infoBanner}>
            <Text style={upcoming.infoIcon}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={upcoming.infoTitle}>Competição agendada</Text>
              <Text style={upcoming.infoSub}>
                Confirme sua participação. Quando todos estiverem prontos, o criador inicia a competição.
              </Text>
            </View>
          </View>

          {/* Botão confirmar / cancelar */}
          {myPlayerId && (
            <TouchableOpacity
              style={[upcoming.confirmBtn,
                comp.confirmedIds?.includes(myPlayerId) ? upcoming.confirmBtnCancel : upcoming.confirmBtnJoin,
                confirmBusy && { opacity: 0.5 },
              ]}
              onPress={handleToggleConfirm}
              disabled={confirmBusy}
              activeOpacity={0.8}
            >
              <Text style={[upcoming.confirmBtnText, comp.confirmedIds?.includes(myPlayerId) && { color: Colors.muted }]}>
                {comp.confirmedIds?.includes(myPlayerId) ? '✓ Confirmado — cancelar' : '+ Confirmar participação'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Lista de confirmados */}
          <View style={upcoming.section}>
            <Text style={upcoming.sectionTitle}>
              CONFIRMADOS ({(comp.confirmedIds ?? []).length})
            </Text>
            {(comp.confirmedIds ?? []).length === 0 ? (
              <Text style={upcoming.empty}>Nenhum jogador confirmou ainda.</Text>
            ) : (
              (comp.confirmedIds ?? []).map(pid => {
                const pl = findPlayer(pid);
                return (
                  <View key={pid} style={upcoming.playerRow}>
                    {pl && <Avatar name={pl.name} color={pl.color} size={30} />}
                    <Text style={upcoming.playerName}>{pl?.name ?? pid}</Text>
                    <Text style={{ color: Colors.teal, fontSize: 16 }}>✓</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Botão iniciar (criador ou admin) */}
          {(isAdmin || comp.createdBy === myPlayerId) && (comp.confirmedIds ?? []).length >= 2 && (
            <TouchableOpacity style={upcoming.startBtn} onPress={handleStartUpcoming} activeOpacity={0.85}>
              <Text style={upcoming.startBtnIcon}>⚡</Text>
              <Text style={upcoming.startBtnText}>
                Iniciar com {(comp.confirmedIds ?? []).length} jogadores
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Abas unificadas */}
      {comp.status !== 'upcoming' && (
        <View style={{ flex: 1 }}>
          <View style={main.tabBar}>
            {([
              { key: 'regras',        label: '📋 Regras' },
              { key: 'classificacao', label: '🏆 Classificação' },
              { key: 'partidas',      label: '🎾 Partidas' },
            ] as const).map(t => (
              <TouchableOpacity
                key={t.key}
                style={[main.tab, activeTab === t.key && main.tabActive]}
                onPress={() => setActiveTab(t.key)}
                activeOpacity={0.7}
              >
                <Text style={[main.tabLabel, activeTab === t.key && main.tabLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'regras' && <RulesView comp={comp} />}

          {activeTab === 'classificacao' && (
            comp.format === 'liga' || comp.format === 'grupos' || comp.format === 'avulso' || comp.format === 'super8'
              ? <ClassificacaoView comp={comp} />
              : <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                  <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 32 }}>
                    Formato mata-mata não possui classificação.
                  </Text>
                </ScrollView>
          )}

          {activeTab === 'partidas' && (
            comp.format === 'grupos'
              ? <GroupsView comp={comp} onScore={setScoring} onClear={handleClear} />
              : comp.format === 'liga'
                ? <LeagueView comp={comp} onScore={setScoring} onClear={handleClear}
                    onSubstitute={isAdmin ? handleSubstitute : undefined} />
                : comp.format === 'mata'
                  ? <KOView comp={comp} onScore={setScoring} onClear={handleClear} />
                  : comp.format === 'avulso'
                    ? <AvulsoView comp={comp} onScore={setScoring} onClear={handleClear}
                        onAddMatch={() => setShowAddAvulso(true)} />
                    : <RotatingView comp={comp} onScore={setScoring} onClear={handleClear}
                        onSubstitute={isAdmin ? handleSubstitute : undefined} />
          )}
        </View>
      )}

      {/* Modal: adicionar jogo avulso */}
      <Modal visible={showAddAvulso} transparent animationType="slide" onRequestClose={() => setShowAddAvulso(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md, maxHeight: '85%' }}>
            <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text }}>Registrar jogo</Text>

            {(['A', 'B'] as const).map(side => {
              const team = side === 'A' ? avulsoTeamA : avulsoTeamB;
              const setTeam = side === 'A' ? setAvulsoTeamA : setAvulsoTeamB;
              const otherTeam = side === 'A' ? avulsoTeamB : avulsoTeamA;
              return (
                <View key={side} style={{ gap: Spacing.xs }}>
                  <Text style={{ fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted, letterSpacing: 1 }}>
                    DUPLA {side} {team.length > 0 ? `— ${team.map(id => findPlayer(id)?.name ?? id).join(' / ')}` : ''}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
                      {groupPlayers.filter(p => !otherTeam.includes(p.id)).map(p => {
                        const selected = team.includes(p.id);
                        return (
                          <TouchableOpacity
                            key={p.id}
                            onPress={() => {
                              if (selected) setTeam(team.filter(id => id !== p.id));
                              else if (team.length < 2) setTeam([...team, p.id]);
                            }}
                            style={{
                              paddingHorizontal: Spacing.sm, paddingVertical: 6,
                              borderRadius: Radius.full,
                              backgroundColor: selected ? Colors.gold : Colors.surf2,
                              borderWidth: 1,
                              borderColor: selected ? Colors.gold : Colors.line,
                            }}
                          >
                            <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13, color: selected ? Colors.bg : Colors.text }}>
                              {p.name.split(' ')[0]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              );
            })}

            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' }}
                onPress={() => { setShowAddAvulso(false); setAvulsoTeamA([]); setAvulsoTeamB([]); }}
              >
                <Text style={{ fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
                  (avulsoTeamA.length === 0 || avulsoTeamB.length === 0) && { opacity: 0.4 }]}
                onPress={handleConfirmAddAvulso}
                disabled={avulsoTeamA.length === 0 || avulsoTeamB.length === 0}
              >
                <Text style={{ fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg }}>Adicionar jogo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScorerModal
        match={scoring}
        comp={comp}
        onClose={() => setScoring(null)}
        onSave={isAdmin && scoring?.scoreA != null ? handleCorrect : handleSave}
        onSaveDraft={handleSaveDraft}
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
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surf2, borderBottomWidth: 1, borderBottomColor: Colors.line },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.gold },
  tabLabel: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.faint },
  tabLabelActive: { color: Colors.gold },
  // Champion banner
  champBanner: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center',
    padding: Spacing.xl,
  },
  champCard: {
    backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.xl,
    alignItems: 'center', gap: Spacing.md, width: '100%', borderWidth: 2, borderColor: Colors.gold,
  },
  champCrown: { fontSize: 48 },
  champTitle: { fontFamily: FontFamily.titleBold, fontSize: 13, color: Colors.gold, letterSpacing: 3 },
  champName: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text, textAlign: 'center' },
  champComp: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  champActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md, width: '100%' },
  champBtn: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.sm, alignItems: 'center' },
  champBtnText: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.bg },
  champClose: { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.sm, alignItems: 'center' },
  champCloseText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
});

const upcoming = StyleSheet.create({
  infoBanner: { flexDirection: 'row', gap: Spacing.md, backgroundColor: 'rgba(243,197,68,0.08)', borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(243,197,68,0.25)', padding: Spacing.md, alignItems: 'flex-start' },
  infoIcon:   { fontSize: 24 },
  infoTitle:  { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  infoSub:    { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, marginTop: 4, lineHeight: 18 },
  confirmBtn: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  confirmBtnJoin:   { backgroundColor: Colors.gold },
  confirmBtnCancel: { backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line },
  confirmBtnText:   { fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
  section:     { gap: Spacing.sm },
  sectionTitle:{ fontFamily: FontFamily.title, fontSize: 12, color: Colors.muted, letterSpacing: 1 },
  empty:       { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, textAlign: 'center', paddingVertical: Spacing.md },
  playerRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.line },
  playerName:  { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text },
  startBtn:    { backgroundColor: Colors.teal, borderRadius: Radius.md, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 50 },
  startBtnIcon:{ fontSize: 18 },
  startBtnText:{ fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
});
