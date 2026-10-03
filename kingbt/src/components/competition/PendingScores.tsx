import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { AppInput } from '@/components/competition/FormKit';
import { matchSides } from '@/logic/playedWith';
import { canConfirmScore, canDisputeScore, pendingOf, DISPUTE_REASON_MAX } from '@/logic/scoreValidation';
import type { Competition, Match } from '@/logic/types';

/**
 * Placares aguardando confirmação (só em competições que exigem). Quem jogou do outro lado confirma ou
 * contesta; contestado, o admin decide. Some quando não há nada pendente.
 */
export function PendingScores({ comp }: { comp: Competition }) {
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { isAdmin } = useAuth();
  const { dispatch } = useCompetitions();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const { user } = useAuth();
  const [disputing, setDisputing] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const pending = pendingOf(comp);
  if (pending.length === 0) return null;

  const myId = groupPlayers.find(p => p.uid === user?.uid)?.id ?? null;
  const canManage = isAdmin || (!!myId && comp.createdBy === myId);
  const first = (id: string) => (findPlayer(id)?.name ?? comp.competitors.find(c => c.id === id)?.name ?? id).split(' ')[0];
  const sideName = (ids: string[]) => ids.map(first).join(' / ') || '?';

  function confirm(m: Match) {
    const p = m.pendingScore;
    if (!p) return;
    dispatch({ type: 'SAVE_SCORE', compId: comp.id, matchId: m.id, scoreA: p.scoreA, scoreB: p.scoreB, ...(p.sets ? { sets: p.sets } : {}), confirmed: true });
  }
  function dispute(m: Match) {
    if (!myId) return;
    dispatch({ type: 'VALIDATE_SCORE', compId: comp.id, op: { kind: 'dispute', matchId: m.id, by: myId, reason, at: new Date().toISOString() } });
    setDisputing(null); setReason('');
  }
  function discard(m: Match) {
    dispatch({ type: 'VALIDATE_SCORE', compId: comp.id, op: { kind: 'discard', matchId: m.id } });
  }

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Placares para confirmar</Text>
      {pending.map(m => {
        const p = m.pendingScore!;
        const [a, b] = matchSides(comp, m);
        const iConfirm = canConfirmScore(comp, m, myId, canManage);
        const iDispute = canDisputeScore(comp, m, myId);
        const mine = !!myId && p.by === myId;
        return (
          <View key={m.id} style={[s.row, p.disputed && s.rowDisputed]}>
            <Text style={s.names}>{sideName(a)} <Text style={s.score}>{p.scoreA} × {p.scoreB}</Text> {sideName(b)}</Text>
            <Text style={s.meta}>
              Lançado por {first(p.by)}
              {p.disputed ? ` · contestado por ${first(p.disputedBy ?? '')}${p.reason ? `: "${p.reason}"` : ''}` : ' · aguardando confirmação'}
            </Text>
            {p.disputed && !canManage ? <Text style={s.meta}>O admin vai decidir.</Text> : null}
            {!iConfirm && !p.disputed && mine ? <Text style={s.meta}>Esperando o adversário confirmar.</Text> : null}

            {disputing === m.id ? (
              <View style={{ gap: Spacing.xs }}>
                <AppInput value={reason} onChangeText={t => setReason(t.slice(0, DISPUTE_REASON_MAX))} placeholder="O que está errado? (opcional)" />
                <View style={s.actions}>
                  <TouchableOpacity style={s.ghost} onPress={() => { setDisputing(null); setReason(''); }}><Text style={s.ghostText}>Voltar</Text></TouchableOpacity>
                  <TouchableOpacity style={s.danger} onPress={() => dispute(m)}><Text style={s.dangerText}>Enviar contestação</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={s.actions}>
                {iDispute && <TouchableOpacity style={s.ghost} onPress={() => setDisputing(m.id)} accessibilityRole="button"><Text style={s.ghostText}>Contestar</Text></TouchableOpacity>}
                {(canManage || mine) && <TouchableOpacity style={s.ghost} onPress={() => discard(m)} accessibilityRole="button"><Text style={s.ghostText}>{canManage ? 'Descartar' : 'Cancelar'}</Text></TouchableOpacity>}
                {iConfirm && <TouchableOpacity style={s.primary} onPress={() => confirm(m)} accessibilityRole="button"><Text style={s.primaryText}>{canManage ? 'Aceitar placar' : 'Confirmar'}</Text></TouchableOpacity>}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  wrap: { marginHorizontal: Spacing.md, marginTop: Spacing.sm, gap: Spacing.sm },
  title: { fontFamily: FontFamily.titleBold, fontSize: 13, letterSpacing: 1.3, color: C.gold, textTransform: 'uppercase' },
  row: { backgroundColor: C.surf, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.gold + '66', padding: Spacing.md, gap: 6 },
  rowDisputed: { borderColor: C.coral + '99' },
  names: { fontFamily: FontFamily.bodyMed, fontSize: 16, color: C.text },
  score: { fontFamily: FontFamily.numberBold, fontSize: 18, color: C.gold },
  meta: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: C.muted },
  actions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end', flexWrap: 'wrap' },
  primary: { minHeight: 44, paddingHorizontal: 18, borderRadius: Radius.full, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FontFamily.titleBold, fontSize: 15, color: C.bg },
  ghost: { minHeight: 44, paddingHorizontal: 16, borderRadius: Radius.full, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.muted },
  danger: { minHeight: 44, paddingHorizontal: 16, borderRadius: Radius.full, borderWidth: 1, borderColor: C.coral, alignItems: 'center', justifyContent: 'center' },
  dangerText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.coral },
});
