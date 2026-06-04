import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { getCompetition, updateCompetition } from '@/mocks/competitionStore';
import { PLAYERS } from '@/mocks/data';
import { standings, matchWinner } from '@/logic/formats';
import type { Match, Competition } from '@/logic/types';

function getPlayer(id: string) {
  return PLAYERS.find(p => p.id === id);
}

function getComp(id: string) {
  return getCompetition(id);
}

function getCompetitor(comp: Competition, id: string) {
  return comp.competitors.find(c => c.id === id);
}

// ─── Sub-views por formato ────────────────────────────────────────────────────

function RotatingView({ comp, onScore }: { comp: Competition; onScore: (m: Match) => void }) {
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={styles.progCard}>
        <View style={styles.progRow}>
          <Text style={styles.progLabel}>Progresso</Text>
          <Text style={styles.progCount}>{done}/{total}</Text>
        </View>
        <View style={styles.progTrack}>
          <View style={[styles.progFill, { width: `${total ? done / total * 100 : 0}%` }]} />
        </View>
        {done === total && total > 0 && (
          <Text style={styles.reiDoDia}>👑 Todos os jogos concluídos!</Text>
        )}
      </Card>

      {comp.matches.map((m, i) => (
        <GameRow key={m.id} match={m} index={i} comp={comp} onPress={() => onScore(m)} />
      ))}
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

function LeagueView({ comp, onScore }: { comp: Competition; onScore: (m: Match) => void }) {
  const rounds = [...new Set(comp.matches.map(m => m.round))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const st = standings(comp.competitors.map(c => c.id), comp.matches);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {/* Classificação */}
      <Text style={styles.sectionTitle}>Classificação</Text>
      <Card padding={0} style={{ overflow: 'hidden', marginBottom: Spacing.md }}>
        <View style={[styles.stRow, styles.stHeader]}>
          {['#','Jogador','J','V','D','SG','Pts'].map(h => (
            <Text key={h} style={[styles.stCell, styles.stTh, h === 'Jogador' && styles.stNameCol]}>{h}</Text>
          ))}
        </View>
        {st.map((s, i) => {
          const pl = getPlayer(s.id);
          return (
            <View key={s.id} style={[styles.stRow, i < st.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.line }]}>
              <Text style={[styles.stCell, styles.stPos]}>{i + 1}</Text>
              <View style={[styles.stNameCol, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                {pl && <Avatar name={pl.name} color={pl.color} size={22} />}
                <Text style={styles.stName} numberOfLines={1}>{pl?.name ?? s.id}</Text>
              </View>
              <Text style={styles.stCell}>{s.played}</Text>
              <Text style={styles.stCell}>{s.wins}</Text>
              <Text style={styles.stCell}>{s.losses}</Text>
              <Text style={[styles.stCell, { color: s.gd >= 0 ? Colors.teal : Colors.coral }]}>{s.gd >= 0 ? '+' : ''}{s.gd}</Text>
              <Text style={[styles.stCell, { color: Colors.gold, fontFamily: FontFamily.numberBold }]}>{s.pts}</Text>
            </View>
          );
        })}
      </Card>

      {/* Jogos por rodada */}
      {rounds.map(r => (
        <View key={r}>
          <Text style={styles.sectionTitle}>Rodada {r}</Text>
          {comp.matches.filter(m => m.round === r).map((m, i) => (
            <MatchRow key={m.id} match={m} comp={comp} onPress={() => onScore(m)} />
          ))}
        </View>
      ))}
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

function KOView({ comp, onScore }: { comp: Competition; onScore: (m: Match) => void }) {
  const rounds = [...new Set(comp.matches.map(m => m.koRound))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const { koRoundName } = require('@/logic/formats');
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {rounds.map(r => {
        const rMatches = comp.matches.filter(m => m.koRound === r);
        const cnt = rMatches.find(m => !m.third)?.cnt ?? 0;
        return (
          <View key={r}>
            <Text style={styles.sectionTitle}>{koRoundName(cnt)}</Text>
            {rMatches.filter(m => !m.third).map(m => (
              <MatchRow key={m.id} match={m} comp={comp} onPress={() => onScore(m)} />
            ))}
            {rMatches.filter(m => m.third).map(m => (
              <View key={m.id}>
                <Text style={styles.sectionTitle}>Disputa de 3º Lugar</Text>
                <MatchRow match={m} comp={comp} onPress={() => onScore(m)} />
              </View>
            ))}
          </View>
        );
      })}
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

function GameRow({ match: m, index, comp, onPress }: { match: Match; index: number; comp: Competition; onPress: () => void }) {
  const pA = [getPlayer(m.teamA?.[0] ?? ''), getPlayer(m.teamA?.[1] ?? '')];
  const pB = [getPlayer(m.teamB?.[0] ?? ''), getPlayer(m.teamB?.[1] ?? '')];
  const has = m.scoreA != null;
  const aWon = has && m.scoreA! > m.scoreB!;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card style={styles.gameCard}>
        <View style={styles.gameRow}>
          <View style={styles.teamSide}>
            <View style={styles.avatarPair}>
              {pA.map((p, i) => p && <Avatar key={i} name={p.name} color={p.color} size={28} />)}
            </View>
            <Text style={styles.teamName} numberOfLines={1}>
              {pA[0]?.name.split(' ')[0]} / {pA[1]?.name.split(' ')[0]}
            </Text>
          </View>
          <View style={styles.scoreCenter}>
            {has
              ? <Text style={styles.scoreText}>
                  <Text style={aWon ? styles.win : styles.lose}>{m.scoreA}</Text>
                  {' – '}
                  <Text style={!aWon ? styles.win : styles.lose}>{m.scoreB}</Text>
                </Text>
              : <Text style={styles.scorePending}>Jogo {index + 1}</Text>
            }
          </View>
          <View style={[styles.teamSide, styles.teamRight]}>
            <View style={[styles.avatarPair, { flexDirection: 'row-reverse' }]}>
              {pB.map((p, i) => p && <Avatar key={i} name={p.name} color={p.color} size={28} />)}
            </View>
            <Text style={[styles.teamName, { textAlign: 'right' }]} numberOfLines={1}>
              {pB[0]?.name.split(' ')[0]} / {pB[1]?.name.split(' ')[0]}
            </Text>
          </View>
        </View>
        {!has && <Text style={styles.tapHint}>Toque para registrar placar</Text>}
      </Card>
    </TouchableOpacity>
  );
}

function MatchRow({ match: m, comp, onPress }: { match: Match; comp: Competition; onPress: () => void }) {
  const cA = m.aId ? getCompetitor(comp, m.aId) : null;
  const cB = m.bId ? getCompetitor(comp, m.bId) : null;
  const pA = cA?.members[0] ? getPlayer(cA.members[0]) : null;
  const pB = cB?.members[0] ? getPlayer(cB.members[0]) : null;
  const has = m.scoreA != null && m.scoreB != null;
  const aWon = has && m.scoreA! > m.scoreB!;
  const pending = !cA || !cB;

  return (
    <TouchableOpacity onPress={onPress} disabled={pending} activeOpacity={0.8}>
      <Card style={pending ? { ...styles.matchCard, ...styles.matchPending } : styles.matchCard}>
        <View style={styles.matchRow}>
          <View style={styles.side}>
            {pA && <Avatar name={pA.name} color={pA.color} size={28} />}
            <Text style={[styles.matchName, aWon && { color: Colors.gold }]} numberOfLines={1}>
              {cA?.name ?? '?'}
            </Text>
          </View>
          <Text style={styles.matchScore}>
            {has
              ? `${m.scoreA} – ${m.scoreB}`
              : pending ? 'A definir' : 'vs'
            }
          </Text>
          <View style={[styles.side, styles.sideRight]}>
            <Text style={[styles.matchName, { textAlign: 'right' }, !aWon && has && { color: Colors.gold }]} numberOfLines={1}>
              {cB?.name ?? '?'}
            </Text>
            {pB && <Avatar name={pB.name} color={pB.color} size={28} />}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Scorer Modal ─────────────────────────────────────────────────────────────

function ScorerModal({
  match, comp, onClose, onSave,
}: {
  match: Match | null;
  comp: Competition;
  onClose: () => void;
  onSave: (id: string, a: number, b: number) => void;
}) {
  const [sA, setSA] = useState(match?.scoreA != null ? String(match.scoreA) : '');
  const [sB, setSB] = useState(match?.scoreB != null ? String(match.scoreB) : '');
  if (!match) return null;

  const a = parseInt(sA), b = parseInt(sB);
  const valid = !isNaN(a) && !isNaN(b) && a >= 0 && b >= 0 && a !== b;
  const draw = !isNaN(a) && !isNaN(b) && a === b;

  const nameA = match.teamA
    ? match.teamA.map(id => getPlayer(id)?.name.split(' ')[0]).join(' / ')
    : (match.aId ? getCompetitor(comp, match.aId)?.name : '?') ?? '?';
  const nameB = match.teamB
    ? match.teamB.map(id => getPlayer(id)?.name.split(' ')[0]).join(' / ')
    : (match.bId ? getCompetitor(comp, match.bId)?.name : '?') ?? '?';

  return (
    <Modal visible transparent animationType="slide">
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.title}>Registrar Placar</Text>
          <Text style={modal.subtitle}>{nameA}{'\nvs\n'}{nameB}</Text>

          <View style={modal.inputRow}>
            {[{ val: sA, set: setSA, label: nameA }, { val: sB, set: setSB, label: nameB }].map(({ val, set, label }, idx) => (
              <View key={idx} style={modal.inputBlock}>
                <Text style={modal.inputLabel} numberOfLines={1}>{label}</Text>
                <View style={modal.stepper}>
                  <TouchableOpacity style={modal.btn} onPress={() => set(s => String(Math.max(0, parseInt(s||'0') - 1)))}>
                    <Text style={modal.btnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={modal.input}
                    value={val}
                    onChangeText={set}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <TouchableOpacity style={modal.btn} onPress={() => set(s => String(parseInt(s||'0') + 1))}>
                    <Text style={modal.btnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {draw && <Text style={modal.warn}>⚠️ Empate não permitido</Text>}

          <View style={modal.btns}>
            <TouchableOpacity onPress={onClose} style={modal.cancel}>
              <Text style={modal.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (valid) onSave(match.id, a, b); }}
              style={[modal.save, !valid && modal.saveDisabled]}
              disabled={!valid}
            >
              <Text style={modal.saveText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CompetitionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const base = getComp(id ?? '');
  const [comp, setComp] = useState<Competition | null>(base ?? null);
  const [scoring, setScoring] = useState<Match | null>(null);

  if (!comp) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.err}>Competição não encontrada.</Text>
      </SafeAreaView>
    );
  }

  function handleSave(matchId: string, a: number, b: number) {
    setComp(prev => {
      if (!prev) return prev;
      const { resolveCompetition } = require('@/logic/formats');
      const updated = resolveCompetition({
        ...prev,
        matches: prev.matches.map(m => m.id === matchId ? { ...m, scoreA: a, scoreB: b } : m),
      });
      updateCompetition(updated);
      return updated;
    });
    setScoring(null);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.compName} numberOfLines={1}>{comp.name}</Text>
          <Badge label={comp.status === 'done' ? 'Concluída' : 'Ativa'} variant={comp.status === 'done' ? 'teal' : 'gold'} small />
        </View>
      </View>

      {(comp.format === 'avulso' || comp.format === 'super8')
        ? <RotatingView comp={comp} onScore={setScoring} />
        : comp.format === 'liga'
          ? <LeagueView comp={comp} onScore={setScoring} />
          : <KOView comp={comp} onScore={setScoring} />
      }

      <ScorerModal
        match={scoring}
        comp={comp}
        onClose={() => setScoring(null)}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line },
  back: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  headerInfo: { flex: 1, gap: 4 },
  compName: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  err: { fontFamily: FontFamily.body, color: Colors.coral, padding: Spacing.md },
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  sectionTitle: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted, letterSpacing: 1, marginTop: Spacing.sm, marginBottom: Spacing.xs },

  progCard: { gap: Spacing.sm },
  progRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  progCount: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.text },
  progTrack: { height: 4, backgroundColor: Colors.line, borderRadius: 2, overflow: 'hidden' },
  progFill: { height: 4, backgroundColor: Colors.teal, borderRadius: 2 },
  reiDoDia: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.gold, textAlign: 'center' },

  gameCard: { marginBottom: 0 },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  teamSide: { flex: 1, gap: 4 },
  teamRight: { alignItems: 'flex-end' },
  avatarPair: { flexDirection: 'row', gap: -6 },
  teamName: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  scoreCenter: { alignItems: 'center', minWidth: 64 },
  scoreText: { fontFamily: FontFamily.numberBold, fontSize: 20 },
  win: { color: Colors.teal },
  lose: { color: Colors.muted },
  scorePending: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.faint },
  tapHint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, textAlign: 'center', marginTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.xs },

  matchCard: { marginBottom: 0 },
  matchPending: { opacity: 0.5 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  sideRight: { justifyContent: 'flex-end' },
  matchName: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  matchScore: { fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.muted, minWidth: 56, textAlign: 'center' },

  stRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 9 },
  stHeader: { backgroundColor: Colors.surf2, paddingVertical: 7 },
  stCell: { width: 28, textAlign: 'center', fontFamily: FontFamily.number, fontSize: 12, color: Colors.text },
  stTh: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.faint, letterSpacing: 0.5 },
  stNameCol: { flex: 1 },
  stPos: { fontFamily: FontFamily.numberBold, fontSize: 12, color: Colors.muted },
  stName: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.text, flex: 1 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.md },
  title: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center' },
  subtitle: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
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
  saveDisabled: { opacity: 0.4 },
  saveText: { fontFamily: FontFamily.title, color: Colors.bg },
});
