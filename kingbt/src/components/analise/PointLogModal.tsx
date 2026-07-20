import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import type { BtPonto } from '@/logic/btTracker';

interface PointGroup {
  setLabel: string;
  gameLabel: string;
  pontos: BtPonto[];
}

// Agrupa os pontos por game: um novo grupo começa sempre que o placar do
// game reseta para "0x0" (o placar de um game nunca volta a 0x0 no meio dele).
function groupPontosByGame(pontos: BtPonto[]): PointGroup[] {
  const groups: PointGroup[] = [];
  let setIdx = 1;
  let gameIdx = 0;

  for (const pt of pontos) {
    const isNewGame = groups.length === 0 || pt.gameScore === '0x0';
    if (isNewGame) {
      const prevGroup = groups[groups.length - 1];
      if (prevGroup) {
        const prevSetScore = prevGroup.pontos[prevGroup.pontos.length - 1].setScore;
        if (pt.setScore !== prevSetScore) { setIdx++; gameIdx = 1; }
        else gameIdx++;
      } else {
        gameIdx = 1;
      }
      groups.push({ setLabel: `Set ${setIdx}`, gameLabel: `Game ${gameIdx}`, pontos: [] });
    }
    groups[groups.length - 1].pontos.push(pt);
  }
  return groups;
}

export function PointLogModal({ visible, onClose, pontos, nameA, nameB }: {
  visible: boolean;
  onClose: () => void;
  pontos: BtPonto[];
  nameA: string;
  nameB: string;
}) {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const groups = useMemo(() => groupPontosByGame(pontos), [pontos]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.header}>
            <Text style={styles.title}>Pontuação por game</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {groups.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>Nenhum ponto registrado ainda.</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {[...groups].reverse().map((group, gi) => (
                <View key={gi} style={styles.group}>
                  <Text style={styles.groupLabel}>{group.setLabel} · {group.gameLabel}</Text>
                  {group.pontos.map(pt => {
                    const cor = pt.vencedorDupla === 'A' ? Colors.gold : Colors.teal;
                    const nome = pt.vencedorDupla === 'A' ? nameA : nameB;
                    return (
                      <View key={pt.id} style={styles.row}>
                        <View style={[styles.dot, { backgroundColor: cor }]} />
                        <Text style={styles.placar}>{pt.gameScore}</Text>
                        <Text style={[styles.vencedor, { color: cor }]} numberOfLines={1}>
                          Ponto: {nome}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  box: { backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { fontSize: 14, color: Colors.muted },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyTxt: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  group: { marginBottom: Spacing.md },
  groupLabel: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.gold, letterSpacing: 0.5, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.line },
  dot: { width: 8, height: 8, borderRadius: 4 },
  placar: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.text, width: 56 },
  vencedor: { fontFamily: FontFamily.bodyMed, fontSize: 13, flex: 1 },
});
