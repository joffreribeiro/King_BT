import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, PODIUM_COLORS, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { BottomSheet } from './BottomSheet';
import type { Season } from '@/logic/seasons';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Temporadas já encerradas, da mais antiga para a mais recente. */
  seasons: Season[];
  /** Número da temporada em andamento. */
  currentNumber: number;
  isAdmin: boolean;
  /** Quantos jogadores já pontuaram na temporada em andamento. */
  currentPlayers: number;
  /** Competições não concluídas que ficarão na temporada encerrada. */
  unfinishedCount: number;
  /** Grava o encerramento. Lança se falhar. */
  onEnd: () => Promise<void>;
  /** Remove a última temporada encerrada. Lança se falhar. */
  onUndo: () => Promise<void>;
}

const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const fmtPts = (n: number) => n.toFixed(2).replace('.', ',');

/**
 * Temporadas do grupo: lista das encerradas (com o ranking final gravado) e,
 * para o admin, o botão de encerrar a atual. O encerramento pede confirmação
 * dentro da própria folha (sem Alert, que se comporta diferente na web).
 */
export function SeasonsSheet({ visible, onClose, seasons, currentNumber, isAdmin, currentPlayers, unfinishedCount, onEnd, onUndo }: Props) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const [open, setOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  const past = [...seasons].reverse();

  async function confirmEnd() {
    setBusy(true);
    setError(null);
    try {
      await onEnd();
      setConfirming(false);
    } catch {
      setError('Não foi possível encerrar. Verifique a internet e tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmUndo() {
    setBusy(true);
    setError(null);
    try {
      await onUndo();
      setUndoing(false);
    } catch {
      setError('Não foi possível desfazer. Verifique a internet e tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={() => { setConfirming(false); setUndoing(false); setError(null); onClose(); }} height={560}>
      <ScrollView style={{ paddingHorizontal: Spacing.md }} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Temporadas</Text>

        <View style={s.current}>
          <Text style={s.currentLabel}>EM ANDAMENTO</Text>
          <Text style={s.currentName}>Temporada {currentNumber}</Text>
          <Text style={s.muted}>
            {seasons.length === 0 ? 'Desde o início do grupo' : `Desde ${fmtDate(seasons[seasons.length - 1].endedAt)}`}
            {' · '}{currentPlayers} {currentPlayers === 1 ? 'jogador' : 'jogadores'} no ranking
          </Text>

          {isAdmin && !confirming && (
            <TouchableOpacity
              style={[s.endBtn, currentPlayers === 0 && { opacity: 0.4 }]}
              disabled={currentPlayers === 0}
              onPress={() => setConfirming(true)}
              accessibilityRole="button"
            >
              <Text style={s.endBtnText}>Encerrar temporada {currentNumber}</Text>
            </TouchableOpacity>
          )}

          {isAdmin && confirming && (
            <View style={s.confirm}>
              <Text style={s.confirmTitle}>Encerrar a Temporada {currentNumber}?</Text>
              <Text style={s.confirmText}>
                O ranking de hoje é gravado como o resultado final e o ranking começa do zero.
                Os jogos e o histórico continuam guardados, e o ranking acumulado segue disponível.
                Isso não pode ser desfeito.
              </Text>
              {unfinishedCount > 0 && (
                <Text style={[s.confirmText, { color: Colors.coral }]}>
                  Atenção: há {unfinishedCount} {unfinishedCount === 1 ? 'competição' : 'competições'} não concluída{unfinishedCount === 1 ? '' : 's'} com data até hoje.
                  {' '}Elas ficam nesta temporada, não na próxima.
                </Text>
              )}
              {error && <Text style={[s.confirmText, { color: Colors.coral }]}>{error}</Text>}
              <View style={s.confirmRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setConfirming(false)} disabled={busy}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.okBtn} onPress={confirmEnd} disabled={busy}>
                  {busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={s.okText}>Encerrar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <Text style={s.section}>TEMPORADAS ANTERIORES</Text>
        {past.length === 0 && <Text style={s.muted}>Nenhuma temporada encerrada ainda.</Text>}
        {past.map(se => {
          const champ = se.ranking[0];
          const expanded = open === se.id;
          return (
            <View key={se.id} style={s.card}>
              <TouchableOpacity style={s.cardTop} onPress={() => setOpen(expanded ? null : se.id)} activeOpacity={0.8} accessibilityRole="button">
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Temporada {se.number}</Text>
                  <Text style={s.muted}>
                    {se.startedAt ? `${fmtDate(se.startedAt)} a ` : 'Até '}{fmtDate(se.endedAt)}
                  </Text>
                </View>
                {champ && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.champLabel}>CAMPEÃO</Text>
                    <Text style={s.champName} numberOfLines={1}>{champ.name}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {expanded && (
                <View style={s.rows}>
                  {se.ranking.map((r, i) => (
                    <View key={r.id + i} style={s.row}>
                      <Text style={[s.pos, i < 3 && { color: PODIUM_COLORS[i] }]}>{i + 1}º</Text>
                      <Text style={s.rowName} numberOfLines={1}>{r.name}</Text>
                      <Text style={s.rowRec}>{r.wins}V · {r.losses}D</Text>
                      <Text style={s.rowPts}>{fmtPts(r.points)}</Text>
                    </View>
                  ))}
                  {se.ranking.length === 0 && <Text style={s.muted}>Sem jogadores neste ranking.</Text>}
                </View>
              )}
            </View>
          );
        })}
        {isAdmin && past.length > 0 && !undoing && (
          <TouchableOpacity style={s.undoLink} onPress={() => setUndoing(true)} accessibilityRole="button">
            <Text style={s.undoLinkText}>Desfazer o encerramento da Temporada {past[0].number}</Text>
          </TouchableOpacity>
        )}
        {isAdmin && past.length > 0 && undoing && (
          <View style={[s.confirm, s.undoBox]}>
            <Text style={s.confirmTitle}>Desfazer o encerramento da Temporada {past[0].number}?</Text>
            <Text style={s.confirmText}>
              O ranking final gravado é apagado e os jogos dessa temporada voltam a contar no ranking atual.
              Se alguém já ganhou o título de campeão dela, ele some. Os jogos em si não são apagados.
            </Text>
            {error && <Text style={[s.confirmText, { color: Colors.coral }]}>{error}</Text>}
            <View style={s.confirmRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setUndoing(false); setError(null); }} disabled={busy}>
                <Text style={s.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.okBtn} onPress={confirmUndo} disabled={busy}>
                {busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={s.okText}>Desfazer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={{ height: Spacing.lg }} />
      </ScrollView>
    </BottomSheet>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  title: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 26, color: Colors.text, marginBottom: Spacing.md },
  muted: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  current: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold + '66', padding: Spacing.md, gap: 4 },
  currentLabel: { fontFamily: FontFamily.titleBold, fontSize: 12, letterSpacing: 1.3, color: Colors.gold },
  currentName: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 22, color: Colors.text },
  endBtn: { marginTop: Spacing.sm, minHeight: 46, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  endBtnText: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.gold },
  confirm: { marginTop: Spacing.sm, gap: Spacing.sm },
  confirmTitle: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  confirmText: { fontFamily: FontFamily.body, fontSize: 13, lineHeight: 19, color: Colors.muted },
  confirmRow: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, minHeight: 46, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.muted },
  okBtn: { flex: 1, minHeight: 46, borderRadius: Radius.md, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  okText: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },
  undoLink: { marginTop: Spacing.md, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  undoLinkText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textDecorationLine: 'underline' },
  undoBox: { marginTop: Spacing.md, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.surf },
  section: { fontFamily: FontFamily.titleBold, fontSize: 12, letterSpacing: 1.3, color: Colors.muted, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, marginBottom: Spacing.sm, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  cardTitle: { fontFamily: FontFamily.serif, fontVariant: ['lining-nums' as const], fontSize: 20, color: Colors.text },
  champLabel: { fontFamily: FontFamily.titleBold, fontSize: 11, letterSpacing: 1.2, color: PODIUM_COLORS[0] },
  champName: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text, maxWidth: 140 },
  rows: { borderTopWidth: 1, borderTopColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 9 },
  pos: { width: 30, fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.muted },
  rowName: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text },
  rowRec: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  rowPts: { minWidth: 54, textAlign: 'right', fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.gold },
});
