import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import type { Match, Competition } from '@/logic/types';
import { carregarAnalise, type BtAnalise } from '@/logic/btTracker';
import { loadAnaliseFs } from '@/firebase/analises';
import { PointLogModal } from '@/components/analise/PointLogModal';

// Placar livre do formato Avulso: games sem limite dentro de cada set. Pode ter
// mais de um set — vence quem ganhar mais sets (o set é de quem fez mais games).
export function FreeScoreModal({ match, comp, onClose, onSave, onClear, isAdmin = false }: {
  match: Match | null; comp: Competition;
  onClose: () => void;
  onSave: (id: string, a: number, b: number, sets?: { a: number; b: number }[]) => void;
  onClear: (matchId: string) => void;
  isAdmin?: boolean;
}) {
  const { findPlayer } = useGroupPlayers();
  const { group } = useAuth();
  const { colors: Colors } = useTheme();
  const sc = useMemo(() => makeSc(Colors), [Colors]);
  const [sets, setSets] = useState<{ a: string; b: string }[]>([{ a: '', b: '' }]);
  const [analise, setAnalise] = useState<BtAnalise | null>(null);
  const [showPointLog, setShowPointLog] = useState(false);

  const maxSets = comp.config.winRule?.sets ?? 3;

  useEffect(() => {
    if (!match) return;
    if (match.sets?.length) {
      setSets(match.sets.map(s => ({ a: String(s.a), b: String(s.b) })));
    } else if (match.scoreA != null && match.scoreB != null) {
      // Avulso antigo: placar guardado como um único número de games
      setSets([{ a: String(match.scoreA), b: String(match.scoreB) }]);
    } else {
      setSets([{ a: '', b: '' }]);
    }
    (group?.id ? loadAnaliseFs(group.id, match.id).catch(() => null) : Promise.resolve(null))
      .then(remote => remote ?? carregarAnalise(match.id, comp.id))
      .then(setAnalise);
  }, [match?.id]);

  if (!match) return null;

  const nameA = match.teamA?.map(id => findPlayer(id)?.name.split(' ')[0]).join(' / ') ?? '?';
  const nameB = match.teamB?.map(id => findPlayer(id)?.name.split(' ')[0]).join(' / ') ?? '?';

  const num = (v: string) => parseInt(v) || 0;
  const validSets = sets
    .map(s => ({ a: num(s.a), b: num(s.b) }))
    .filter(s => s.a > 0 || s.b > 0);
  const setsA = validSets.filter(s => s.a > s.b).length;
  const setsB = validSets.filter(s => s.b > s.a).length;
  const alreadyScored = match.scoreA != null;
  const canEdit = !alreadyScored || isAdmin;
  const canAddSet = sets.length < maxSets;
  const canSave = validSets.length > 0 && setsA !== setsB && canEdit;

  function updateSet(i: number, side: 'a' | 'b', val: number) {
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, [side]: String(Math.max(0, val)) } : s));
  }
  function addSet() { if (canAddSet) setSets(prev => [...prev, { a: '', b: '' }]); }
  function removeLastSet() { if (sets.length > 1) setSets(prev => prev.slice(0, -1)); }

  function abrirMarcacaoAoVivo() {
    const ir = () => {
      onClose();
      router.push({ pathname: '/court', params: { compId: comp.id, matchId: match!.id } });
    };
    if (!alreadyScored) { ir(); return; }
    const msg = 'Esta partida já tem placar registrado. Entrar na marcação ao vivo e marcar um novo ponto vai sobrescrever esse resultado. Continuar?';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) ir();
    } else {
      Alert.alert('Sobrescrever placar?', msg, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', style: 'destructive', onPress: ir },
      ]);
    }
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

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={sc.overlay}>
        <View style={sc.sheet}>
          <Text style={sc.title}>Registrar Placar</Text>
          <Text style={sc.sub}>{nameA} vs {nameB}</Text>

          {/* Placar de sets (só aparece quando há mais de um set) */}
          {sets.length > 1 && (
            <View style={sc.setsTotal}>
              <Text style={sc.setsTotalName} numberOfLines={1}>{nameA}</Text>
              <Text style={[sc.setsTotalVal, setsA > setsB && { color: Colors.teal }]}>{setsA}</Text>
              <Text style={sc.setsTotalLabel}>sets</Text>
              <Text style={[sc.setsTotalVal, setsB > setsA && { color: Colors.teal }]}>{setsB}</Text>
              <Text style={sc.setsTotalName} numberOfLines={1}>{nameB}</Text>
            </View>
          )}

          {/* Cabeçalho de nomes */}
          <View style={sc.inputRow}>
            <View style={sc.inputBlock}><Text style={sc.inputLabel} numberOfLines={1}>{nameA}</Text></View>
            <View style={sc.inputBlock}><Text style={sc.inputLabel} numberOfLines={1}>{nameB}</Text></View>
          </View>

          {/* Um par de contadores por set — games livres, sem limite */}
          {sets.map((s, i) => {
            const a = num(s.a), b = num(s.b);
            return (
              <View key={i} style={sc.inputRow}>
                {sets.length > 1 && <Text style={sc.setTag}>{i + 1}º</Text>}
                <View style={sc.inputBlock}>
                  <View style={sc.stepper}>
                    <TouchableOpacity style={sc.btn} onPress={() => updateSet(i, 'a', a - 1)} disabled={!canEdit}>
                      <Text style={sc.btnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={sc.input}>{s.a || '0'}</Text>
                    <TouchableOpacity style={sc.btn} onPress={() => updateSet(i, 'a', a + 1)} disabled={!canEdit}>
                      <Text style={sc.btnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={sc.inputBlock}>
                  <View style={sc.stepper}>
                    <TouchableOpacity style={sc.btn} onPress={() => updateSet(i, 'b', b - 1)} disabled={!canEdit}>
                      <Text style={sc.btnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={sc.input}>{s.b || '0'}</Text>
                    <TouchableOpacity style={sc.btn} onPress={() => updateSet(i, 'b', b + 1)} disabled={!canEdit}>
                      <Text style={sc.btnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Adicionar / remover set */}
          {canEdit && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {canAddSet && (
                <TouchableOpacity style={sc.setBtn} onPress={addSet}>
                  <Text style={sc.setBtnTxt}>+ Adicionar set</Text>
                </TouchableOpacity>
              )}
              {sets.length > 1 && (
                <TouchableOpacity style={[sc.setBtn, { borderColor: Colors.coral + '55' }]} onPress={removeLastSet}>
                  <Text style={[sc.setBtnTxt, { color: Colors.coral }]}>− Remover set</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {validSets.length > 0 && setsA === setsB && (
            <Text style={sc.warn}>⚠️ Empate não é permitido — decida em mais um set</Text>
          )}

          {alreadyScored && !isAdmin && (
            <Text style={sc.lockedText}>🔒 Placar já registrado. Apenas admin pode corrigir.</Text>
          )}

          {/* Ver pontos (log simples) e marcação ao vivo */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!!analise?.pontos?.length && (
              <TouchableOpacity style={sc.pointsBtn} onPress={() => setShowPointLog(true)}>
                <Text style={sc.pointsBtnTxt}>📋 Ver pontos</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={sc.pointsBtn} onPress={abrirMarcacaoAoVivo}>
              <Text style={sc.pointsBtnTxt}>🔴 Marcação ao vivo</Text>
            </TouchableOpacity>
          </View>

          <View style={sc.btns}>
            <TouchableOpacity onPress={onClose} style={sc.cancel}>
              <Text style={sc.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (canSave) onSave(match.id, setsA, setsB, validSets); }}
              style={[sc.save, !canSave && sc.saveOff]}
              disabled={!canSave}
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
      <PointLogModal
        visible={showPointLog}
        onClose={() => setShowPointLog(false)}
        pontos={analise?.pontos ?? []}
        nameA={nameA}
        nameB={nameB}
      />
    </Modal>
  );
}

const makeSc = (Colors: ThemeColors) => StyleSheet.create({
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
  input: { width: 54, height: 54, borderRadius: Radius.sm, backgroundColor: Colors.surf2, borderWidth: 1.5, borderColor: Colors.gold, fontFamily: FontFamily.numberBold, fontSize: 28, color: Colors.gold, textAlign: 'center', textAlignVertical: 'center', lineHeight: 54 },
  warn: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral, textAlign: 'center' },
  btns: { flexDirection: 'row', gap: Spacing.md },
  cancel: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, alignItems: 'center' },
  cancelText: { fontFamily: FontFamily.body, color: Colors.muted },
  save: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.gold, alignItems: 'center' },
  saveOff: { opacity: 0.4 },
  saveText: { fontFamily: FontFamily.title, color: Colors.bg },
  lockedText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.faint, textAlign: 'center' },
  pointsBtn: { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  pointsBtnTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  setBtn: { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.sm, paddingVertical: 8, alignItems: 'center' },
  setBtnTxt: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted },
  setTag: { position: 'absolute', left: 0, top: 18, fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.faint, width: 22 },
  setsTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.surf2, borderRadius: Radius.md, paddingVertical: Spacing.sm },
  setsTotalName: { flex: 1, fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted, textAlign: 'center' },
  setsTotalVal: { fontFamily: FontFamily.numberBold, fontSize: 28, color: Colors.muted },
  setsTotalLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.xs },
  clearBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.coral },
});
