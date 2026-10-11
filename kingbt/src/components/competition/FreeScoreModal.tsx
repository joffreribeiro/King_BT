import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icons';
import { router } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import type { Match, Competition, SetScore } from '@/logic/types';
import { erroTiebreakLivre } from '@/logic/tiebreakManual';
import { carregarAnalise, type BtAnalise } from '@/logic/btTracker';
import { loadAnaliseFs } from '@/firebase/analises';
import { PointLogModal } from '@/components/analise/PointLogModal';

// Placar livre do formato Avulso: games sem limite dentro de cada set. Pode ter
// mais de um set — vence quem ganhar mais sets (o set é de quem fez mais games).
/** Um set no formulário: games de cada lado e, se marcado "Teve tie-break", os pontos dele (obrigatórios). */
type SetRow = { a: string; b: string; comTb?: boolean; tbA?: string; tbB?: string };

export function FreeScoreModal({ match, comp, onClose, onSave, onClear, isAdmin = false }: {
  match: Match | null; comp: Competition;
  onClose: () => void;
  onSave: (id: string, a: number, b: number, sets?: SetScore[]) => void;
  onClear: (matchId: string) => void;
  isAdmin?: boolean;
}) {
  const { findPlayer } = useGroupPlayers();
  const { group } = useAuth();
  const { colors: Colors } = useTheme();
  const sc = useMemo(() => makeSc(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const [sets, setSets] = useState<SetRow[]>([{ a: '', b: '' }]);
  const [analise, setAnalise] = useState<BtAnalise | null>(null);
  const [showPointLog, setShowPointLog] = useState(false);

  const maxSets = comp.config.winRule?.sets ?? 3;

  useEffect(() => {
    if (!match) return;
    if (match.sets?.length) {
      setSets(match.sets.map(s => ({ a: String(s.a), b: String(s.b), ...(s.tb ? { comTb: true, tbA: String(s.tb.a), tbB: String(s.tb.b) } : {}) })));
    } else if (match.scoreA != null && match.scoreB != null) {
      // Avulso antigo: placar guardado como um único número de games
      setSets([{ a: String(match.scoreA), b: String(match.scoreB) }]);
    } else {
      setSets([{ a: '', b: '' }]);
    }
    (group?.id ? loadAnaliseFs(group.id, match.id, comp.id).catch(() => null) : Promise.resolve(null))
      .then(remote => remote ?? carregarAnalise(match.id, comp.id))
      .then(setAnalise);
  }, [match?.id]);

  if (!match) return null;

  const nameA = match.teamA?.map(id => findPlayer(id)?.name.split(' ')[0]).join(' / ') ?? '?';
  const nameB = match.teamB?.map(id => findPlayer(id)?.name.split(' ')[0]).join(' / ') ?? '?';

  const duasLinhas = (n: string) => n.split(' / ').join('\n');
  const num = (v: string) => parseInt(v) || 0;
  // O Avulso não tem formato definido, então não dá para saber pelo placar quando houve tie-break: quem registra
  // marca "Teve tie-break" no set e, marcado, os pontos dele são obrigatórios
  const temTiebreak = (st: SetRow) => !!st.comTb;
  const tbErro = (st: SetRow) => (temTiebreak(st) ? erroTiebreakLivre(num(st.a), num(st.b), st.tbA, st.tbB) : null);
  const validSets: SetScore[] = sets
    .filter(st => num(st.a) > 0 || num(st.b) > 0)
    .map(st => ({ a: num(st.a), b: num(st.b), ...(temTiebreak(st) && !tbErro(st) ? { tb: { a: num(st.tbA ?? ''), b: num(st.tbB ?? '') } } : {}) }));
  const tbInvalido = sets.some(st => (num(st.a) > 0 || num(st.b) > 0) && !!tbErro(st));
  const setsA = validSets.filter(s => s.a > s.b).length;
  const setsB = validSets.filter(s => s.b > s.a).length;
  const alreadyScored = match.scoreA != null;
  const canEdit = !alreadyScored || isAdmin;
  const canAddSet = sets.length < maxSets;
  // Avulso é sessão livre: o placar pode terminar empatado, então só exige algum game e tie-break válido
  const canSave = validSets.length > 0 && canEdit && !tbInvalido;

  function updateSet(i: number, side: 'a' | 'b', val: number) {
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, [side]: String(Math.max(0, val)) } : s));
  }
  function alternarTb(i: number) {
    setSets(prev => prev.map((st, idx) => (idx === i ? (st.comTb ? { a: st.a, b: st.b } : { ...st, comTb: true }) : st)));
  }
  // Tie-break por +/− (o teclado numérico cobria os campos no celular). Vazio conta como 0.
  function stepTb(i: number, side: 'a' | 'b', delta: number) {
    setSets(prev => prev.map((st, idx) => {
      if (idx !== i) return st;
      const key = side === 'a' ? 'tbA' : 'tbB';
      return { ...st, [key]: String(Math.max(0, Math.min(99, num(st[key] ?? '') + delta))) };
    }));
  }
  /** Atalho de placar no set: preenche os games; 7–6 / 6–7 já marca o tie-break. Sem mexer nos outros sets. */
  function aplicarAtalho(i: number, a: number, b: number) {
    setSets(prev => prev.map((st, idx) => {
      if (idx !== i) return st;
      const tb = Math.abs(a - b) === 1 && Math.max(a, b) === 7;
      return tb ? { a: String(a), b: String(b), comTb: true, tbA: st.tbA, tbB: st.tbB } : { a: String(a), b: String(b) };
    }));
  }
  function inverterSet(i: number) {
    setSets(prev => prev.map((st, idx) => (idx === i ? { ...st, a: st.b, b: st.a, tbA: st.tbB, tbB: st.tbA } : st)));
  }
  function addSet() { if (canAddSet) setSets(prev => [...prev, { a: '', b: '' }]); }
  function removeLastSet() { if (sets.length > 1) setSets(prev => prev.slice(0, -1)); }

  function abrirMarcacaoAoVivo() {
    const ir = () => {
      onClose();
      router.push({ pathname: '/court', params: { compId: comp.id, matchId: match!.id } });
    };
    if (!alreadyScored) { ir(); return; }
    const msg = 'Esta partida já tem placar registrado. Entrar na marcação ponto a ponto e marcar um novo ponto vai sobrescrever esse resultado. Continuar?';
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
        <ScrollView style={sc.sheetScroll} contentContainerStyle={[sc.sheet, { paddingBottom: Spacing.xl + Math.max(insets.bottom, 12) }]} keyboardShouldPersistTaps="handled" bounces={false}>
          <Text style={sc.title}>Registrar Placar</Text>
          <Text style={sc.sub}>{comp.name}{match.round ? ` · Rodada ${match.round}` : ''}</Text>

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
          <View style={sc.setRow}>
            <View style={sc.setLabelSpace} />
            <View style={sc.inputBlock}><Text style={sc.inputLabel} numberOfLines={2}>{duasLinhas(nameA)}</Text></View>
            <View style={sc.inputBlock}><Text style={sc.inputLabel} numberOfLines={2}>{duasLinhas(nameB)}</Text></View>
          </View>

          {/* Um par de contadores por set — games livres, sem limite; dá para tocar no número e digitar */}
          {sets.map((s, i) => {
            const a = num(s.a), b = num(s.b);
            const erro = tbErro(s);
            const lado = (side: 'a' | 'b', n: number, outro: number) => {
              const venceu = n > outro;
              return (
                <View style={sc.inputBlock}>
                  <View style={sc.stepper}>
                    <TouchableOpacity style={sc.btn} onPress={() => updateSet(i, side, n - 1)} disabled={!canEdit}>
                      <Icon name="minus" size={18} color={Colors.gold} />
                    </TouchableOpacity>
                    <View
                      style={[sc.gameBox, venceu && { borderColor: Colors.teal }]}
                      accessible accessibilityLabel={`Games de ${side === 'a' ? nameA : nameB} no set ${i + 1}: ${n}`}
                    >
                      <Text style={[sc.gameTxt, venceu && { color: Colors.teal }]}>{n}</Text>
                    </View>
                    <TouchableOpacity style={sc.btn} onPress={() => updateSet(i, side, n + 1)} disabled={!canEdit}>
                      <Icon name="plus" size={18} color={Colors.gold} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            };
            return (
              <View key={i} style={{ gap: 6 }}>
                <View style={sc.setRow}>
                  <Text style={sc.setLabel}>Set {i + 1}</Text>
                  {lado('a', a, b)}
                  {lado('b', b, a)}
                </View>
                {canEdit && (a > 0 || b > 0) && (
                  <View style={sc.setRow}>
                    <TouchableOpacity style={sc.tbCheck} onPress={() => alternarTb(i)} activeOpacity={0.75}
                      accessibilityRole="checkbox" accessibilityState={{ checked: temTiebreak(s) }}>
                      <View style={[sc.tbBox, temTiebreak(s) && { backgroundColor: Colors.gold, borderColor: Colors.gold }]}>
                        {temTiebreak(s) && <Icon name="check" size={12} color={Colors.bg} />}
                      </View>
                      <Text style={sc.tbToggleTxt}>Tie-break</Text>
                    </TouchableOpacity>
                    {temTiebreak(s) ? (
                      (['a', 'b'] as const).map(side => {
                        const n = num((side === 'a' ? s.tbA : s.tbB) ?? '');
                        const nome = side === 'a' ? nameA : nameB;
                        return (
                          <View key={side} style={sc.inputBlock}>
                            <View style={sc.stepper}>
                              <TouchableOpacity style={[sc.btnSm, n === 0 && { opacity: 0.3 }]} onPress={() => stepTb(i, side, -1)} disabled={n === 0}
                                accessibilityRole="button" accessibilityLabel={`Diminuir pontos do tie-break de ${nome} no set ${i + 1}`}>
                                <Icon name="minus" size={14} color={Colors.gold} />
                              </TouchableOpacity>
                              <View style={sc.tbBoxVal} accessible accessibilityLabel={`${nome}, tie-break do set ${i + 1}: ${n} pontos`}>
                                <Text style={sc.tbValTxt}>{n}</Text>
                              </View>
                              <TouchableOpacity style={sc.btnSm} onPress={() => stepTb(i, side, 1)}
                                accessibilityRole="button" accessibilityLabel={`Aumentar pontos do tie-break de ${nome} no set ${i + 1}`}>
                                <Icon name="plus" size={14} color={Colors.gold} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    ) : <View style={{ flex: 2 }} />}
                  </View>
                )}
                {canEdit && i === sets.length - 1 && (
                  <View style={sc.chipsRow}>
                    {([[6, 0], [6, 4], [7, 5], [7, 6]] as const).map(([x, y]) => (
                      <TouchableOpacity key={`${x}-${y}`} style={sc.chip} onPress={() => aplicarAtalho(i, x, y)}
                        accessibilityRole="button" accessibilityLabel={`Placar ${x} a ${y} no set ${i + 1}`}>
                        <Text style={sc.chipTxt}>{x}–{y}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={sc.chip} onPress={() => inverterSet(i)} accessibilityRole="button" accessibilityLabel="Inverter o placar do set">
                      <Text style={sc.chipTxt}>⇄ inverter</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {temTiebreak(s) && !!erro && !erro.startsWith('Informe') && <Text style={sc.tbErro}>{erro}</Text>}
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

          {alreadyScored && !isAdmin && (
            <Text style={sc.lockedText}>🔒 Placar já registrado. Apenas admin pode corrigir.</Text>
          )}

          <View style={sc.btns}>
            <TouchableOpacity onPress={onClose} style={sc.cancel}>
              <Text style={sc.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (canSave) onSave(match.id, setsA, setsB, validSets); }}
              style={[sc.save, !canSave && sc.saveOff]}
              disabled={!canSave}
            >
              <Text style={sc.saveText}>{alreadyScored && isAdmin ? 'Corrigir' : 'Salvar placar'}</Text>
            </TouchableOpacity>
          </View>
          <View style={sc.linksRow}>
            {!!analise?.pontos?.length && (
              <TouchableOpacity onPress={() => setShowPointLog(true)} hitSlop={8} accessibilityRole="button">
                <Text style={sc.linkTxt}>Ver pontos</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={abrirMarcacaoAoVivo} hitSlop={8} accessibilityRole="button">
              <Text style={sc.linkTxt}>Marcar ponto a ponto</Text>
            </TouchableOpacity>
          </View>
          {isAdmin && alreadyScored && (
            <TouchableOpacity onPress={confirmClear} style={sc.clearBtn}>
              <Text style={sc.clearBtnText}>🗑  Apagar placar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
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
  sheetScroll: { flexGrow: 0, maxHeight: '94%', backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg },
  sheet: { paddingHorizontal: Spacing.md + 4, paddingVertical: Spacing.xl, gap: Spacing.md },
  title: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center' },
  sub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-around', gap: Spacing.md },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  setLabel: { width: 80, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  setLabelSpace: { width: 80 },
  gameInput: { width: 42, height: 42, borderRadius: Radius.sm, backgroundColor: Colors.surf2, borderWidth: 1.5, borderColor: Colors.gold, fontFamily: FontFamily.numberBold, fontSize: 24, color: Colors.gold, textAlign: 'center', paddingVertical: 0, paddingHorizontal: 0, textAlignVertical: 'center', includeFontPadding: false },
  gameBox: { width: 48, height: 48, borderRadius: Radius.sm, backgroundColor: Colors.surf2, borderWidth: 1.5, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  gameTxt: { fontFamily: FontFamily.numberBold, fontSize: 24, color: Colors.text },
  btnSm: { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  tbBoxVal: { width: 34, height: 34, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  tbValTxt: { fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.text },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 80 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.surf2 },
  chipTxt: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.teal },
  linksRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },
  linkTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted, textDecorationLine: 'underline' },
  tbCheck: { width: 80, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  tbBox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  tbToggleTxt: { flexShrink: 0, fontFamily: FontFamily.bodyMed, fontSize: 10, color: Colors.text },
  tbInput: { width: 52, height: 36, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.bg, textAlign: 'center', fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.text, paddingVertical: 0, paddingHorizontal: 0, textAlignVertical: 'center', includeFontPadding: false },
  tbErro: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.coral, paddingLeft: 80 },
  inputBlock: { alignItems: 'center', gap: Spacing.sm, flex: 1 },
  inputLabel: { fontFamily: FontFamily.bodyMed, fontSize: 13, lineHeight: 17, color: Colors.text, textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.gold, lineHeight: 26 },
  input: { width: 54, height: 54, borderRadius: Radius.sm, backgroundColor: Colors.surf2, borderWidth: 1.5, borderColor: Colors.gold, fontFamily: FontFamily.numberBold, fontSize: 28, color: Colors.gold, textAlign: 'center', lineHeight: 54, paddingVertical: 0, paddingHorizontal: 0, textAlignVertical: 'center', includeFontPadding: false },
  warn: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral, textAlign: 'center' },
  btns: { flexDirection: 'row', gap: Spacing.md },
  cancel: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, alignItems: 'center' },
  cancelText: { fontFamily: FontFamily.body, color: Colors.muted },
  save: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.gold, alignItems: 'center' },
  saveOff: { opacity: 0.4 },
  saveText: { fontFamily: FontFamily.title, color: Colors.bg },
  lockedText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, textAlign: 'center' },
  pointsBtn: { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  pointsBtnTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  setBtn: { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.sm, paddingVertical: 8, alignItems: 'center' },
  setBtnTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  setTag: { position: 'absolute', left: 0, top: 18, fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.muted, width: 28 },
  setsTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.surf2, borderRadius: Radius.md, paddingVertical: Spacing.sm },
  setsTotalName: { flex: 1, fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  setsTotalVal: { fontFamily: FontFamily.numberBold, fontSize: 28, color: Colors.muted },
  setsTotalLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint },
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.line, marginTop: Spacing.xs },
  clearBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.coral },
});
