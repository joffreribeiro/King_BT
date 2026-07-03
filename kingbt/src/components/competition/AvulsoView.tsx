import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Match, Competition } from '@/logic/types';
import { GameRow } from './GameRow';

export function AvulsoView({ comp, onScore, onClear, onAddMatch }: {
  comp: Competition;
  onScore: (m: Match) => void;
  onClear: (matchId: string) => void;
  onAddMatch: () => void;
}) {
  const { findPlayer } = useGroupPlayers();
  const scored = comp.matches.filter(m => m.scoreA != null);
  const pending = comp.matches.filter(m => m.scoreA == null);

  // Ranking igual ao RotatingView
  const playerIds = [...new Set(comp.matches.flatMap(m => [...(m.teamA ?? []), ...(m.teamB ?? [])]))];
  const rankingStats = playerIds.map(pid => {
    let wins = 0, losses = 0, gf = 0, gc = 0;
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreA === m.scoreB) return;
      const inA = m.teamA?.includes(pid);
      const inB = m.teamB?.includes(pid);
      const gA = m.sets?.length ? m.sets.reduce((s, x) => s + x.a, 0) : m.scoreA!;
      const gB = m.sets?.length ? m.sets.reduce((s, x) => s + x.b, 0) : m.scoreB!;
      if (inA) { gf += gA; gc += gB; if (m.scoreA! > m.scoreB!) wins++; else losses++; }
      if (inB) { gf += gB; gc += gA; if (m.scoreB! > m.scoreA!) wins++; else losses++; }
    });
    const played = wins + losses;
    const ga = gc > 0 ? Math.min(9.99, gf / gc) : gf > 0 ? 9.99 : 0;
    const pts = wins * 3 + played * 0.5 + ga * 2;
    return { pid, wins, losses, played, gf, gc, pts };
  }).sort((a, b) => b.pts - a.pts);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
      showsVerticalScrollIndicator={false}>

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

      {/* Ranking */}
      {rankingStats.length > 0 && (
        <View style={{ gap: Spacing.xs }}>
          <Text style={avulsoS.sectionTitle}>RANKING</Text>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            {rankingStats.map((r, i) => {
              const pl = findPlayer(r.pid);
              return (
                <View key={r.pid} style={[avulsoS.rankRow, i < rankingStats.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.line }]}>
                  <Text style={avulsoS.rankPos}>{i + 1}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    {pl && <Avatar name={pl.name} color={pl.color} size={22} />}
                    <Text style={avulsoS.rankName} numberOfLines={1}>{pl?.name ?? r.pid}</Text>
                  </View>
                  <Text style={avulsoS.rankStat}>{r.wins}V {r.losses}D</Text>
                  <Text style={avulsoS.rankPts}>{r.pts.toFixed(2)}</Text>
                </View>
              );
            })}
          </Card>
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

const avulsoS = StyleSheet.create({
  addBtn:      { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  addBtnIcon:  { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.bg },
  addBtnText:  { fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
  sectionTitle:{ fontFamily: FontFamily.title, fontSize: 12, color: Colors.muted, letterSpacing: 1 },
  rankRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  rankPos:     { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.muted, width: 20, textAlign: 'center' },
  rankName:    { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text, flex: 1 },
  rankStat:    { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  rankPts:     { fontFamily: FontFamily.numberBold, fontSize: 14, color: Colors.gold, width: 52, textAlign: 'right' },
  empty:       { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyIcon:   { fontSize: 40 },
  emptyText:   { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  emptyHint:   { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
});
