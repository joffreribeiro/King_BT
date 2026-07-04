import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, Spacing } from '@/theme';
import { Avatar, Card } from '@/components';
import { standings } from '@/logic/formats';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Match, Competition } from '@/logic/types';
import { getPlayer, getCompetitor } from './helpers';

export function StandingsTable({ comp, ids, matches, highlightTop = 0 }: {
  comp: Competition; ids: string[]; matches: Match[]; highlightTop?: number;
}) {
  const { findPlayer } = useGroupPlayers();

  function resolveEntry(id: string): { name: string; color: string } {
    const competitor = getCompetitor(comp, id);
    if (competitor) return { name: competitor.name, color: competitor.color };
    const gp = findPlayer(id);
    if (gp) return { name: gp.name, color: gp.color };
    const mock = getPlayer(id);
    if (mock) return { name: mock.name, color: mock.color };
    return { name: id, color: Colors.muted };
  }

  const st = standings(ids, matches, id => resolveEntry(id).name);
  return (
    <Card padding={0} style={{ overflow: 'hidden', marginBottom: Spacing.sm }}>
      {/* Cabeçalho */}
      <View style={[stRow.row, stRow.header]}>
        <Text style={[stRow.c0,    stRow.th]}>#</Text>
        <Text style={[stRow.cName, stRow.th]}>JOGADOR</Text>
        <Text style={[stRow.cN,    stRow.th]}>V</Text>
        <Text style={[stRow.cN,    stRow.th]}>D</Text>
        <Text style={[stRow.cN,    stRow.th]}>J</Text>
        <Text style={[stRow.cN,    stRow.th]}>GP</Text>
        <Text style={[stRow.cN,    stRow.th]}>GC</Text>
        <Text style={[stRow.cN,    stRow.th]}>SG</Text>
        <Text style={[stRow.cNw,   stRow.th]}>GA</Text>
        <Text style={[stRow.cPts,  stRow.th]}>PTS</Text>
      </View>
      {st.map((s, i) => {
        const pl = resolveEntry(s.id);
        const classified = highlightTop > 0 && i < highlightTop;
        const winRate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
        return (
          <View key={s.id} style={[stRow.row, i < st.length - 1 && stRow.border, classified && stRow.classified]}>
            <Text style={[stRow.c0, stRow.pos]}>{i + 1}</Text>
            <View style={[stRow.cName, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              <Avatar name={pl.name} color={pl.color} size={22} />
              <View style={{ flex: 1 }}>
                <Text style={stRow.name} numberOfLines={1}>{pl.name}</Text>
                <Text style={stRow.meta}>{s.played}J · {winRate}% aprov.</Text>
              </View>
            </View>
            <Text style={stRow.cN}>{s.wins}</Text>
            <Text style={stRow.cN}>{s.losses}</Text>
            <Text style={stRow.cN}>{s.played}</Text>
            <Text style={stRow.cN}>{s.gf}</Text>
            <Text style={stRow.cN}>{Math.round(s.gf - s.gd)}</Text>
            <Text style={[stRow.cN, { color: s.gd >= 0 ? Colors.teal : Colors.coral }]}>
              {s.gd >= 0 ? '+' : ''}{s.gd}
            </Text>
            <Text style={stRow.cNw} numberOfLines={1}>
              {Number(s.ga) >= 10 ? Number(s.ga).toFixed(1) : Number(s.ga).toFixed(2)}
            </Text>
            <Text style={[stRow.cPts, { color: Colors.gold, fontFamily: FontFamily.numberBold }]}>{Number(s.pts).toFixed(2)}</Text>
          </View>
        );
      })}
      {/* Legenda */}
      <View style={stRow.legend}>
        <Text style={stRow.legendText}>V: Vitórias · D: Derrotas · J: Partidas · GP: Games Pró · GC: Games Contra · SG: Saldo · GA: Game Average · PTS: Pontuação</Text>
      </View>
    </Card>
  );
}

// Exportado: outras views (Classificação/Rotating) reutilizam estes estilos
export const stRow = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 7 },
  header: { backgroundColor: Colors.surf2, paddingVertical: 5 },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  classified: { borderLeftWidth: 3, borderLeftColor: Colors.teal },
  legend: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.line },
  legendText: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.faint, textAlign: 'center' },
  c0: { width: 22 },
  cName: { flex: 1 },
  cN: { width: 28, textAlign: 'center', fontFamily: FontFamily.number, fontSize: 11, color: Colors.text },
  cNw: { width: 44, textAlign: 'center', fontFamily: FontFamily.number, fontSize: 11, color: Colors.text },
  cPts: { width: 56, textAlign: 'right', fontFamily: FontFamily.number, fontSize: 11, color: Colors.text },
  th: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.faint, letterSpacing: 0.3 },
  pos: { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.muted },
  name: { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.text },
  meta: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.faint, marginTop: 1 },
});
