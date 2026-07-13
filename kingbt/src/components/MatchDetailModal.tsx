import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';

export interface MatchDetail {
  won: boolean;
  myScore: number;
  oppScore: number;
  opponent: string;
  /** Parceiro de dupla, quando o jogo é em duplas (null/undefined = jogo individual). */
  partner?: string | null;
  compName: string;
  groupName?: string;
  date?: string;
}

/** Modal de placar/adversário — usado nos quadrados clicáveis de "Sequência de Resultados" (perfil, jogador e desempenho geral). */
export function MatchDetailModal({ match, onClose }: { match: MatchDetail | null; onClose: () => void }) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);

  return (
    <Modal visible={!!match} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.box} activeOpacity={1}>
          {match && (
            <>
              <Text style={[s.result, { color: match.won ? Colors.teal : Colors.coral }]}>
                {match.won ? 'Vitória' : 'Derrota'}
              </Text>
              <Text style={s.score}>{match.myScore} – {match.oppScore}</Text>
              {match.partner && <Text style={s.partner}>com {match.partner}</Text>}
              <Text style={s.opponent}>vs {match.opponent}</Text>
              <View style={s.divider} />
              <Text style={s.meta}>{match.compName}</Text>
              {(match.groupName || match.date) && (
                <Text style={s.meta}>{[match.groupName, match.date].filter(Boolean).join(' · ')}</Text>
              )}
              <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                <Text style={s.closeTxt}>Fechar</Text>
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  box: { backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.lg, gap: 4, width: '100%', maxWidth: 340, alignItems: 'center' },
  result: { fontFamily: FontFamily.numberBold, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
  score: { fontFamily: FontFamily.titleBold, fontSize: 36, color: Colors.text, marginTop: 2 },
  partner: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: 6 },
  opponent: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text, marginTop: 1 },
  divider: { height: 1, backgroundColor: Colors.line, width: '100%', marginVertical: Spacing.sm },
  meta: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  closeBtn: { marginTop: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl },
  closeTxt: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.gold },
});
