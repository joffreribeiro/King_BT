import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { PLAYERS } from '@/mocks/data';
import { standings, groupComplete, matchWinner, matchLoser, koRoundName } from '@/logic/formats';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import type { Match, Competition, SetScore } from '@/logic/types';

type ScoreDetailInput = { sets?: SetScore[] | null; playedAt?: string | null; note?: string | null };

function getPlayer(id: string) {
  return PLAYERS.find(p => p.id === id);
}
function getCompetitor(comp: Competition, id: string) {
  return comp.competitors.find(c => c.id === id);
}

/** "6-4  3-6  10-7" — detalhe set a set, ou null se não houver. */
function fmtSets(m: Match): string | null {
  if (!m.sets || m.sets.length === 0) return null;
  return m.sets.map(s => `${s.a}-${s.b}`).join('  ');
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

function GameRow({ match: m, index, comp, onPress, onLongPress }: {
  match: Match; index: number; comp: Competition; onPress: () => void; onLongPress?: () => void;
}) {
  const pA = [getPlayer(m.teamA?.[0] ?? ''), getPlayer(m.teamA?.[1] ?? '')];
  const pB = [getPlayer(m.teamB?.[0] ?? ''), getPlayer(m.teamB?.[1] ?? '')];
  const has = m.scoreA != null;
  const aWon = has && m.scoreA! > m.scoreB!;
  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.8}>
      <Card style={gRow.card}>
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
        {has && fmtSets(m) && <Text style={gRow.setLine}>{fmtSets(m)}</Text>}
        {has && (m.playedAt || m.note) ? (
          <Text style={gRow.meta} numberOfLines={2}>
            {[m.playedAt, m.note].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {!has && <Text style={gRow.hint}>Toque para registrar placar</Text>}
      </Card>
    </TouchableOpacity>
  );
}
const gRow = StyleSheet.create({
  card: { marginBottom: 0 },
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
  setLine: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted, textAlign: 'center', marginTop: Spacing.xs },
  meta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, textAlign: 'center', marginTop: 2 },
});

// ─── Match Row (liga/grupos/mata-mata) ────────────────────────────────────────

function MatchRow({ match: m, comp, onPress, onLongPress }: {
  match: Match; comp: Competition; onPress: () => void; onLongPress?: () => void;
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
      <Card style={pending ? { ...mRow.card, ...mRow.disabled } : mRow.card}>
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
        {has && fmtSets(m) && <Text style={mRow.setLine}>{fmtSets(m)}</Text>}
        {has && (m.playedAt || m.note) ? (
          <Text style={mRow.meta} numberOfLines={2}>
            {[m.playedAt, m.note].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </Card>
    </TouchableOpacity>
  );
}
const mRow = StyleSheet.create({
  card: { marginBottom: 0 },
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  sideRight: { justifyContent: 'flex-end' },
  name: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  vs: { fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.muted, minWidth: 56, textAlign: 'center' },
  setLine: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted, textAlign: 'center', marginTop: Spacing.xs },
  meta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, textAlign: 'center', marginTop: 2 },
});

// ─── Views por formato ────────────────────────────────────────────────────────

function RotatingView({ comp, onScore, onClear }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void }) {
  const [tab, setTab] = useState<'ranking' | 'jogos'>('ranking');
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;

  // Ranking dos jogadores baseado nos placares
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

  return (
    <View style={{ flex: 1 }}>
      {/* Abas */}
      <View style={tabs.bar}>
        {(['ranking', 'jogos'] as const).map(t => (
          <TouchableOpacity key={t} style={[tabs.tab, tab === t && tabs.active]} onPress={() => setTab(t)}>
            <Text style={[tabs.text, tab === t && tabs.textActive]}>
              {t === 'ranking' ? 'Ranking' : 'Jogos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={vw.scroll}>
        {/* Progresso */}
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
              const pl = getPlayer(s.pid);
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

        {tab === 'jogos' && comp.matches.map((m, i) => (
          <GameRow key={m.id} match={m} index={i} comp={comp} onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
        ))}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

function LeagueView({ comp, onScore, onClear }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void }) {
  const rounds = [...new Set(comp.matches.map(m => m.round))].sort((a, b) => (a ?? 0) - (b ?? 0));
  return (
    <ScrollView contentContainerStyle={vw.scroll}>
      <Text style={vw.section}>Classificação</Text>
      <StandingsTable comp={comp} ids={comp.competitors.map(c => c.id)} matches={comp.matches} />
      {rounds.map(r => (
        <View key={r}>
          <Text style={vw.section}>Rodada {r}</Text>
          {comp.matches.filter(m => m.round === r).map(m => (
            <MatchRow key={m.id} match={m} comp={comp} onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
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

  return (
    <View style={{ flex: 1 }}>
      {/* Tab selector */}
      <View style={tabs.bar}>
        {(['grupos', 'jogos', 'chave'] as const).map(t => (
          <TouchableOpacity key={t} style={[tabs.tab, tab === t && tabs.active]} onPress={() => setTab(t)}>
            <Text style={[tabs.text, tab === t && tabs.textActive]}>
              {t === 'grupos' ? 'Grupos' : t === 'jogos' ? 'Jogos' : 'Mata-mata'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={vw.scroll}>
        {tab === 'grupos' && comp.groupDefs?.map((gd, gi) => (
          <View key={gi}>
            <Text style={vw.section}>{gd.name}</Text>
            <StandingsTable comp={comp} ids={gd.ids} matches={groupMatches(gi)} highlightTop={comp.config.qualifiers} />
          </View>
        ))}

        {tab === 'jogos' && comp.groupDefs?.map((gd, gi) => (
          <View key={gi}>
            <Text style={vw.section}>{gd.name}</Text>
            {groupMatches(gi).map(m => (
              <MatchRow key={m.id} match={m} comp={comp} onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
            ))}
          </View>
        ))}

        {tab === 'chave' && (
          allGroupsDone
            ? <KOView comp={comp} onScore={onScore} onClear={onClear} />
            : <Card style={vw.locked}>
                <Text style={vw.lockedText}>⏳ Termine a fase de grupos para desbloquear o mata-mata.</Text>
              </Card>
        )}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

function KOView({ comp, onScore, onClear }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void }) {
  const rounds = [...new Set(comp.matches.filter(m => m.stage === 'ko').map(m => m.koRound))]
    .sort((a, b) => (a ?? 0) - (b ?? 0));
  return (
    <ScrollView contentContainerStyle={vw.scroll}>
      {rounds.map(r => {
        const rMatches = comp.matches.filter(m => m.koRound === r);
        const main = rMatches.filter(m => !m.third);
        const third = rMatches.filter(m => m.third);
        const cnt = main[0]?.cnt ?? 0;
        return (
          <View key={r}>
            <Text style={vw.section}>{koRoundName(cnt)}</Text>
            {main.map(m => <MatchRow key={m.id} match={m} comp={comp} onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />)}
            {third.map(m => (
              <View key={m.id}>
                <Text style={vw.section}>Disputa de 3º Lugar</Text>
                <MatchRow match={m} comp={comp} onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
              </View>
            ))}
          </View>
        );
      })}
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
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
});

const tabs = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: Colors.surf2, borderBottomWidth: 1, borderBottomColor: Colors.line },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center' },
  active: { borderBottomWidth: 2, borderBottomColor: Colors.gold },
  text: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.faint },
  textActive: { color: Colors.gold },
});

// ─── Scorer Modal ─────────────────────────────────────────────────────────────

function StepBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={sc.stepper}>
      <TouchableOpacity style={sc.btn} onPress={() => onChange(String(Math.max(0, parseInt(value || '0', 10) - 1)))}>
        <Text style={sc.btnText}>−</Text>
      </TouchableOpacity>
      <TextInput style={sc.input} value={value} onChangeText={onChange} keyboardType="number-pad" maxLength={2} />
      <TouchableOpacity style={sc.btn} onPress={() => onChange(String(parseInt(value || '0', 10) + 1))}>
        <Text style={sc.btnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function ScorerModal({ match, comp, onClose, onSave, isAdmin = false }: {
  match: Match | null; comp: Competition;
  onClose: () => void;
  onSave: (id: string, a: number, b: number, detail: ScoreDetailInput) => void;
  isAdmin?: boolean;
}) {
  const wr = comp.config?.winRule ?? {};
  const nSets = wr.sets ?? 0;
  const useSets = nSets > 0;

  const [setRows, setSetRows] = useState<{ a: string; b: string }[]>(() => {
    const base = Array.from({ length: Math.max(1, nSets) }, () => ({ a: '', b: '' }));
    if (match?.sets) match.sets.forEach((s, i) => { if (i < base.length) base[i] = { a: String(s.a), b: String(s.b) }; });
    return base;
  });
  const [sA, setSA] = useState(!useSets && match?.scoreA != null ? String(match.scoreA) : '');
  const [sB, setSB] = useState(!useSets && match?.scoreB != null ? String(match.scoreB) : '');
  const [playedAt, setPlayedAt] = useState(match?.playedAt ?? '');
  const [note, setNote] = useState(match?.note ?? '');

  if (!match) return null;

  const alreadyScored = match.scoreA != null;
  const canEdit = !alreadyScored || isAdmin;

  const nameA = match.teamA
    ? match.teamA.map(id => getPlayer(id)?.name.split(' ')[0]).join(' / ')
    : (match.aId ? getCompetitor(comp, match.aId)?.name : '?') ?? '?';
  const nameB = match.teamB
    ? match.teamB.map(id => getPlayer(id)?.name.split(' ')[0]).join(' / ')
    : (match.bId ? getCompetitor(comp, match.bId)?.name : '?') ?? '?';

  // Cálculo do resultado
  let valid = false, draw = false, setsA = 0, setsB = 0, legacyA = 0, legacyB = 0;
  const filledSets: SetScore[] = [];
  if (useSets) {
    setRows.forEach(r => {
      const ra = parseInt(r.a, 10), rb = parseInt(r.b, 10);
      if (!isNaN(ra) && !isNaN(rb)) {
        filledSets.push({ a: ra, b: rb });
        if (ra > rb) setsA++; else if (rb > ra) setsB++;
      }
    });
    draw = filledSets.length > 0 && setsA === setsB;
    valid = filledSets.length > 0 && setsA !== setsB;
  } else {
    legacyA = parseInt(sA, 10); legacyB = parseInt(sB, 10);
    valid = !isNaN(legacyA) && !isNaN(legacyB) && legacyA >= 0 && legacyB >= 0 && legacyA !== legacyB;
    draw = !isNaN(legacyA) && !isNaN(legacyB) && legacyA === legacyB;
  }

  const detail: ScoreDetailInput = {
    playedAt: playedAt.trim() || null,
    note: note.trim() || null,
    ...(useSets ? { sets: filledSets } : {}),
  };

  function submit() {
    if (!valid || !canEdit || !match) return;
    if (useSets) onSave(match.id, setsA, setsB, detail);
    else onSave(match.id, legacyA, legacyB, detail);
  }

  const updateSet = (i: number, side: 'a' | 'b', v: string) =>
    setSetRows(rows => rows.map((r, idx) => idx === i ? { ...r, [side]: v } : r));

  return (
    <Modal visible transparent animationType="slide">
      <View style={sc.overlay}>
        <View style={sc.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.md }}>
            <Text style={sc.title}>Registrar Placar</Text>
            <Text style={sc.sub}>{nameA}{'  vs  '}{nameB}</Text>

            {useSets ? (
              <>
                {setRows.map((r, i) => (
                  <View key={i} style={sc.setRow}>
                    <Text style={sc.setLabel}>Set {i + 1}</Text>
                    <View style={sc.setInputs}>
                      <StepBox value={r.a} onChange={(v) => updateSet(i, 'a', v)} />
                      <Text style={sc.dash}>–</Text>
                      <StepBox value={r.b} onChange={(v) => updateSet(i, 'b', v)} />
                    </View>
                  </View>
                ))}
                {filledSets.length > 0 && (
                  <Text style={sc.setsTotal}>Sets: {setsA} – {setsB}</Text>
                )}
              </>
            ) : (
              <View style={sc.inputRow}>
                {[{ val: sA, set: setSA, label: nameA }, { val: sB, set: setSB, label: nameB }].map(({ val, set, label }, idx) => (
                  <View key={idx} style={sc.inputBlock}>
                    <Text style={sc.inputLabel} numberOfLines={1}>{label}</Text>
                    <StepBox value={val} onChange={set} />
                  </View>
                ))}
              </View>
            )}

            <TextInput
              style={sc.metaInput}
              value={playedAt}
              onChangeText={setPlayedAt}
              placeholder="Data e horário (opcional) — ex: 14/06 16:30"
              placeholderTextColor={Colors.faint}
            />
            <TextInput
              style={sc.metaInput}
              value={note}
              onChangeText={setNote}
              placeholder="Observações (opcional)"
              placeholderTextColor={Colors.faint}
            />

            {draw && <Text style={sc.warn}>⚠️ Empate não permitido</Text>}
            {alreadyScored && !isAdmin && (
              <Text style={sc.lockedText}>🔒 Placar já registrado. Apenas admin pode corrigir.</Text>
            )}
            {isAdmin && alreadyScored && (
              <Text style={sc.adminNote}>⚙️ Admin — você pode corrigir este placar.</Text>
            )}
            <View style={sc.btns}>
              <TouchableOpacity onPress={onClose} style={sc.cancel}>
                <Text style={sc.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submit}
                style={[sc.save, (!valid || !canEdit) && sc.saveOff]}
                disabled={!valid || !canEdit}
              >
                <Text style={sc.saveText}>{alreadyScored && isAdmin ? 'Corrigir' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const sc = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.xl, maxHeight: '90%' },
  title: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center' },
  sub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  setLabel: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  setInputs: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dash: { fontFamily: FontFamily.numberBold, fontSize: 18, color: Colors.muted },
  setsTotal: { fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.gold, textAlign: 'center' },
  metaInput: { backgroundColor: Colors.surf2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: FontFamily.body, fontSize: 14, color: Colors.text },
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
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CompetitionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useCompetitions();
  const { isAdmin } = useAuth();
  const comp = state.competitions.find(c => c.id === id);
  const [scoring, setScoring] = useState<Match | null>(null);
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  if (!comp) {
    return (
      <SafeAreaView style={main.container}>
        <Text style={{ color: Colors.coral, padding: Spacing.md }}>Competição não encontrada.</Text>
      </SafeAreaView>
    );
  }

  function handleSave(matchId: string, a: number, b: number, detail?: ScoreDetailInput) {
    dispatch({ type: 'SAVE_SCORE', compId: id!, matchId, scoreA: a, scoreB: b, detail });
    setScoring(null);
  }

  function handleCorrect(matchId: string, a: number, b: number, detail?: ScoreDetailInput) {
    dispatch({ type: 'CORRECT_SCORE', compId: id!, matchId, scoreA: a, scoreB: b, detail });
    setScoring(null);
  }

  function handleClear(matchId: string) {
    const doClear = () => dispatch({ type: 'CLEAR_SCORE', compId: id!, matchId });
    if (Platform.OS === 'web') {
      if (window.confirm('Apagar placar? O resultado será removido.')) doClear();
    } else {
      Alert.alert('Apagar placar?', 'O resultado será removido.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: doClear },
      ]);
    }
  }

  function handleDelete() {
    const { Platform } = require('react-native');
    const doDelete = () => {
      dispatch({ type: 'DELETE', compId: id! });
      router.replace('/(app)');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Excluir competição? Esta ação não pode ser desfeita.')) doDelete();
    } else {
      const { Alert } = require('react-native');
      Alert.alert('Excluir competição', 'Tem certeza?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  return (
    <SafeAreaView style={main.container} edges={['top']}>
      {/* Header */}
      <View style={main.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')}>
          <Text style={main.back}>←</Text>
        </TouchableOpacity>
        <View style={main.headerInfo}>
          <Text style={main.compName} numberOfLines={1}>{comp.name}</Text>
          <Badge
            label={comp.status === 'done' ? 'Concluída' : 'Ativa'}
            variant={comp.status === 'done' ? 'teal' : 'gold'}
            small
          />
        </View>
        {isAdmin && (
          <TouchableOpacity onPress={() => setShowAdminMenu(true)} style={main.adminBtn}>
            <Text style={main.adminBtnText}>⚙️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Menu admin */}
      {showAdminMenu && (
        <View style={main.adminMenu}>
          <TouchableOpacity style={main.adminMenuItem} onPress={() => setShowAdminMenu(false)}>
            <Text style={main.adminMenuClose}>✕ Fechar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={main.adminMenuAction} onPress={() => { setShowAdminMenu(false); handleDelete(); }}>
            <Text style={main.adminMenuDanger}>🗑️ Excluir competição</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Local / observações da competição */}
      {(comp.location || comp.notes) ? (
        <View style={main.infoBar}>
          {comp.location ? <Text style={main.infoText}>📍 {comp.location}</Text> : null}
          {comp.notes ? <Text style={main.infoNote}>{comp.notes}</Text> : null}
        </View>
      ) : null}

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
        key={scoring?.id ?? 'none'}
        match={scoring}
        comp={comp}
        onClose={() => setScoring(null)}
        onSave={isAdmin && scoring?.scoreA != null ? handleCorrect : handleSave}
        isAdmin={isAdmin}
      />
    </SafeAreaView>
  );
}

const main = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line },
  back: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  compName: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text, flex: 1 },
  adminBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  adminBtnText: { fontSize: 18 },
  adminMenu: { backgroundColor: Colors.surf2, borderBottomWidth: 1, borderBottomColor: Colors.line, padding: Spacing.sm, gap: Spacing.xs },
  adminMenuItem: { alignSelf: 'flex-end' },
  adminMenuClose: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  adminMenuAction: { paddingVertical: Spacing.xs },
  adminMenuDanger: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.coral },
  infoBar: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 2, borderBottomWidth: 1, borderBottomColor: Colors.line },
  infoText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  infoNote: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
});
