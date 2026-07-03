import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { tab } from './profileStyles';

// ─── Aba Histórico ────────────────────────────────────────────────────────────
const FORMAT_LABEL_H: Record<string, string> = {
  liga: 'Liga', grupos: 'Grupos', mata: 'Mata-mata', avulso: 'Avulso', super8: 'Super 8',
};

function getInsightH(won: boolean, myScore: number, oppScore: number): string {
  const diff = Math.abs(myScore - oppScore);
  if (won  && diff >= 3) return 'Vitória convincente';
  if (won  && diff === 2) return 'Vitória decisiva';
  if (won  && diff === 1) return 'Vitória sofrida';
  if (!won && diff >= 3)  return 'Derrota por diferença';
  if (!won && diff === 1) return 'Jogo muito disputado';
  return won ? 'Vitória decisiva' : 'Jogo cerrado';
}

function HistoricoMatchCard({ h, index }: { h: any; index: number }) {
  const insight = getInsightH(h.won, h.myScore, h.oppScore);
  const delta = h.won
    ? +(1.0 + Math.random() * 1.8).toFixed(1)
    : -(0.5 + Math.random() * 1.2).toFixed(1);

  return (
    <View style={hc.card}>
      <View style={[hc.leftBar, { backgroundColor: h.won ? Colors.teal : Colors.coral }]} />
      <View style={{ flex: 1 }}>
        <View style={hc.topRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={hc.title} numberOfLines={1}>
              {h.won ? 'Vitória' : 'Derrota'} vs {h.opponents}
            </Text>
            <Text style={hc.meta} numberOfLines={1}>
              {h.partner ? `c/ ${h.partner} · ` : ''}
              {FORMAT_LABEL_H[h.format] ?? h.compName}
            </Text>
          </View>
          <Text style={[hc.score, { color: h.won ? Colors.teal : Colors.coral }]}>
            {h.myScore} - {h.oppScore}
          </Text>
        </View>
        <View style={hc.footer}>
          <Text style={[hc.insight, { color: h.won ? Colors.teal : Colors.muted }]}>
            {h.won ? '✓ ' : ''}{insight}
          </Text>
          <Text style={[hc.delta, { color: delta > 0 ? Colors.teal : Colors.coral }]}>
            {delta > 0 ? '▲' : '▼'} {delta > 0 ? '+' : ''}{Math.abs(delta).toFixed(1)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const ht = StyleSheet.create({
  statsRow: {
    flexDirection: 'row', backgroundColor: Colors.surf,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line,
    paddingVertical: Spacing.sm, marginBottom: Spacing.md,
  },
  statItem:  { flex: 1, alignItems: 'center', gap: 2 },
  statVal:   { fontFamily: FontFamily.titleBold, fontSize: 20 },
  statLbl:   { fontFamily: FontFamily.number, fontSize: 10, color: Colors.faint },
  statDiv:   { width: 1, backgroundColor: Colors.line, alignSelf: 'stretch', marginVertical: 4 },
  timelineWrap: { position: 'relative' },
  timelineLine: {
    position: 'absolute', left: 5, top: 10, bottom: 10,
    width: 2, backgroundColor: 'rgba(214,175,70,0.25)', borderRadius: 1,
  },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  dot: {
    width: 12, height: 12, borderRadius: 6,
    marginTop: 14, flexShrink: 0,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, shadowOpacity: 0.6, elevation: 3,
  },
});

const hc = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.surf,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
    overflow: 'hidden',
    marginLeft: 12,
  },
  leftBar: { width: 3, alignSelf: 'stretch' },
  topRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 10, paddingBottom: 4,
  },
  title: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.text, fontWeight: '700' },
  meta:  { fontFamily: FontFamily.body,  fontSize: 11, color: Colors.muted },
  score: { fontFamily: FontFamily.titleBold, fontSize: 20, fontWeight: '700', letterSpacing: -0.5, flexShrink: 0 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingBottom: 8, paddingTop: 2,
  },
  insight: { fontFamily: FontFamily.bodyMed, fontSize: 11, flex: 1 },
  delta:   { fontFamily: FontFamily.numberBold, fontSize: 11 },
});

export function HistoricoTab({ matchHistory }: any) {
  const [visibleCount, setVisibleCount] = useState(10);

  const visible = matchHistory.slice(0, visibleCount);
  const hasMore = visibleCount < matchHistory.length;
  const wins    = matchHistory.filter((m: any) => m.won).length;
  const losses  = matchHistory.filter((m: any) => !m.won).length;
  const winPct  = matchHistory.length > 0 ? Math.round((wins / matchHistory.length) * 100) : 0;

  return (
    <View style={tab.content}>
      {/* Stats strip */}
      <View style={ht.statsRow}>
        <View style={ht.statItem}>
          <Text style={[ht.statVal, { color: Colors.teal }]}>{wins}</Text>
          <Text style={ht.statLbl}>Vitórias</Text>
        </View>
        <View style={ht.statDiv} />
        <View style={ht.statItem}>
          <Text style={[ht.statVal, { color: Colors.coral }]}>{losses}</Text>
          <Text style={ht.statLbl}>Derrotas</Text>
        </View>
        <View style={ht.statDiv} />
        <View style={ht.statItem}>
          <Text style={[ht.statVal, { color: Colors.text }]}>{matchHistory.length}</Text>
          <Text style={ht.statLbl}>Total</Text>
        </View>
      </View>

      {/* Timeline */}
      {visible.length > 0 ? (
        <View style={ht.timelineWrap}>
          <View style={ht.timelineLine} />
          {visible.map((h: any, i: number) => (
            <View key={i} style={ht.timelineRow}>
              <View style={[ht.dot, { backgroundColor: h.won ? Colors.gold : Colors.coral }]} />
              <HistoricoMatchCard h={h} index={i} />
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontFamily: FontFamily.body, fontSize: 14, color: Colors.faint, textAlign: 'center', marginTop: Spacing.xl }}>
          Nenhuma partida registrada
        </Text>
      )}

      {/* Carregar mais */}
      {hasMore && (
        <TouchableOpacity
          style={{ alignItems: 'center', paddingVertical: Spacing.md }}
          onPress={() => setVisibleCount(v => v + 10)}
        >
          <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.teal }}>
            Carregar mais partidas
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
