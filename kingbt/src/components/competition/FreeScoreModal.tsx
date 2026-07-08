import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Platform } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Match, Competition } from '@/logic/types';

// Placar livre para o formato Avulso: sem sets/tie-break, só o placar final de games de cada lado.
export function FreeScoreModal({ match, comp, onClose, onSave, onClear, isAdmin = false }: {
  match: Match | null; comp: Competition;
  onClose: () => void;
  onSave: (id: string, a: number, b: number) => void;
  onClear: (matchId: string) => void;
  isAdmin?: boolean;
}) {
  const { findPlayer } = useGroupPlayers();
  const { colors: Colors } = useTheme();
  const sc = useMemo(() => makeSc(Colors), [Colors]);
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  useEffect(() => {
    if (!match) return;
    setA(match.scoreA != null ? String(match.scoreA) : '');
    setB(match.scoreB != null ? String(match.scoreB) : '');
  }, [match?.id]);

  if (!match) return null;

  const nameA = match.teamA?.map(id => findPlayer(id)?.name.split(' ')[0]).join(' / ') ?? '?';
  const nameB = match.teamB?.map(id => findPlayer(id)?.name.split(' ')[0]).join(' / ') ?? '?';

  const gA = parseInt(a) || 0;
  const gB = parseInt(b) || 0;
  const alreadyScored = match.scoreA != null;
  const canEdit = !alreadyScored || isAdmin;
  const canSave = (gA > 0 || gB > 0) && gA !== gB && canEdit;

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
          <Text style={sc.sub}>{nameA}{'\nvs\n'}{nameB}</Text>

          <View style={sc.inputRow}>
            <View style={sc.inputBlock}>
              <Text style={sc.inputLabel} numberOfLines={1}>{nameA}</Text>
              <View style={sc.stepper}>
                <TouchableOpacity style={sc.btn} onPress={() => setA(String(Math.max(0, gA - 1)))} disabled={!canEdit}>
                  <Text style={sc.btnText}>−</Text>
                </TouchableOpacity>
                <Text style={sc.input}>{a || '0'}</Text>
                <TouchableOpacity style={sc.btn} onPress={() => setA(String(gA + 1))} disabled={!canEdit}>
                  <Text style={sc.btnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={sc.inputBlock}>
              <Text style={sc.inputLabel} numberOfLines={1}>{nameB}</Text>
              <View style={sc.stepper}>
                <TouchableOpacity style={sc.btn} onPress={() => setB(String(Math.max(0, gB - 1)))} disabled={!canEdit}>
                  <Text style={sc.btnText}>−</Text>
                </TouchableOpacity>
                <Text style={sc.input}>{b || '0'}</Text>
                <TouchableOpacity style={sc.btn} onPress={() => setB(String(gB + 1))} disabled={!canEdit}>
                  <Text style={sc.btnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {gA === gB && (gA > 0 || gB > 0) && <Text style={sc.warn}>⚠️ Empate não é permitido</Text>}

          {alreadyScored && !isAdmin && (
            <Text style={sc.lockedText}>🔒 Placar já registrado. Apenas admin pode corrigir.</Text>
          )}

          <View style={sc.btns}>
            <TouchableOpacity onPress={onClose} style={sc.cancel}>
              <Text style={sc.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (canSave) onSave(match.id, gA, gB); }}
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
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.xs },
  clearBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.coral },
});
