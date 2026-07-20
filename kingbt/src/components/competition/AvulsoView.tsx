import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import type { Match, Competition } from '@/logic/types';
import { PlayerRankingTable } from './FormatViews';
import { GameRow } from './GameRow';

export function AvulsoView({ comp, onScore, onClear, onAddMatch }: {
  comp: Competition;
  onScore: (m: Match) => void;
  onClear: (matchId: string) => void;
  onAddMatch: () => void;
}) {
  const { colors: Colors } = useTheme();
  const avulsoS = useMemo(() => makeAvulsoStyles(Colors), [Colors]);
  const scored = comp.matches.filter(m => m.scoreA != null);
  const pending = comp.matches.filter(m => m.scoreA == null);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
      showsVerticalScrollIndicator={false}>

      {/* Classificação */}
      <PlayerRankingTable comp={comp} />

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
          {pending.map(m => (
            <GameRow key={m.id} match={m} comp={comp} isNext={false}
              onPress={() => onScore(m)} />
          ))}
        </View>
      )}

      {/* Jogos com placar */}
      {scored.length > 0 && (
        <View style={{ gap: Spacing.xs }}>
          <Text style={avulsoS.sectionTitle}>JOGOS REGISTRADOS ({scored.length})</Text>
          {scored.map(m => (
            <GameRow key={m.id} match={m} comp={comp} isNext={false}
              onPress={() => onScore(m)} onLongPress={() => onClear(m.id)} />
          ))}
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

const makeAvulsoStyles = (Colors: ThemeColors) => StyleSheet.create({
  addBtn:      { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  addBtnIcon:  { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.bg },
  addBtnText:  { fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
  sectionTitle:{ fontFamily: FontFamily.title, fontSize: 12, color: Colors.muted, letterSpacing: 1 },
  empty:       { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyIcon:   { fontSize: 40 },
  emptyText:   { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  emptyHint:   { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
});
