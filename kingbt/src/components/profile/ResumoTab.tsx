import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Card, RatingChart } from '@/components';
import { PointsTimeline } from './PointsTimeline';
import { makeTab } from './profileStyles';

// ─── Aba Resumo ───────────────────────────────────────────────────────────────
export function ResumoTab({ me, myPos, winRate, matchHistory, evoPoints, activityData, ratingHistory, nextAchievement, unlockedAchievements }: any) {
  const { colors: Colors } = useTheme();
  const tab = useMemo(() => makeTab(Colors), [Colors]);
  const statRow = useMemo(() => makeStatRowStyles(Colors), [Colors]);
  const l20 = useMemo(() => makeL20Styles(Colors), [Colors]);
  const recent7 = [...matchHistory.slice(0, 7)].reverse();
  const last20   = matchHistory.slice(0, 20);
  const last20Wins   = last20.filter((g: any) => g.won).length;
  const last20Losses = last20.filter((g: any) => !g.won).length;

  return (
    <View style={tab.content}>
      {/* Pontuação */}
      <Card elevated style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted, letterSpacing: 2 }}>
          PONTUAÇÃO KING BT
        </Text>
        <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 48, color: Colors.gold, lineHeight: 56 }}>
          {me.points.toFixed(2)}
        </Text>
      </Card>

      {/* Últimos 20 jogos — logo abaixo da pontuação */}
      {last20.length > 0 && (
        <Card>
          <Text style={tab.sectionTitle}>Últimos {last20.length} jogos</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <View style={l20.resultBox}>
              <Text style={l20.resultIcon}>✅</Text>
              <Text style={[l20.resultNum, { color: Colors.teal }]}>{last20Wins}</Text>
              <Text style={l20.resultLbl}>Vitórias</Text>
            </View>
            <View style={l20.resultBox}>
              <Text style={l20.resultIcon}>❌</Text>
              <Text style={[l20.resultNum, { color: Colors.coral }]}>{last20Losses}</Text>
              <Text style={l20.resultLbl}>Derrotas</Text>
            </View>
            <View style={l20.resultBox}>
              <Text style={l20.resultIcon}>📊</Text>
              <Text style={[l20.resultNum, { color: Colors.gold }]}>
                {last20.length > 0 ? Math.round((last20Wins / last20.length) * 100) : 0}%
              </Text>
              <Text style={l20.resultLbl}>Aproveit.</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Stats 3 colunas */}
      <Card style={{ paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs }}>
        <View style={statRow.row}>
          {[
            { l: 'JOGADOS', v: me.played,  c: Colors.text },
            { l: 'VITÓRIAS', v: me.wins,   c: Colors.teal },
            { l: 'DERROTAS', v: me.losses, c: Colors.coral },
          ].map((item, i, arr) => (
            <View key={item.l} style={[statRow.cell, i < arr.length - 1 && statRow.divider]}>
              <Text style={[statRow.val, { color: item.c }]}>{item.v}</Text>
              <Text style={statRow.lbl}>{item.l}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Stats completo */}
      <Card style={{ paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs }}>
        <View style={statRow.row}>
          {[
            { l: 'GP',   v: me.gamesPro,                      c: Colors.teal },
            { l: 'GC',   v: me.gamesCon,                      c: Colors.coral },
            { l: 'SG',   v: (me.sg >= 0 ? '+' : '') + me.sg, c: me.sg >= 0 ? Colors.teal : Colors.coral },
            { l: 'GA',   v: me.ga.toFixed(2),                 c: Colors.gold },
            { l: 'WIN%', v: `${winRate}%`,                    c: Colors.goldBright },
          ].map((item, i, arr) => (
            <View key={item.l} style={[statRow.cell, i < arr.length - 1 && statRow.divider]}>
              <Text style={[statRow.val, { color: item.c }]}>{item.v}</Text>
              <Text style={statRow.lbl}>{item.l}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Próxima conquista */}
      {nextAchievement && (
        <Card>
          <Text style={tab.sectionTitle}>Próxima Conquista</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
            <Text style={{ fontSize: 28 }}>{nextAchievement.icon}</Text>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text }}>
                {nextAchievement.title}
              </Text>
              <View style={{ height: 4, backgroundColor: Colors.line, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{
                  height: 4,
                  width: `${nextAchievement.prog * 100}%` as any,
                  backgroundColor: nextAchievement.color,
                  borderRadius: 2,
                }} />
              </View>
              <Text style={{ fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted }}>
                {nextAchievement.label} · {nextAchievement.desc}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Conquistas desbloqueadas */}
      {unlockedAchievements?.length > 0 && (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Text style={tab.sectionTitle}>Conquistas</Text>
            <TouchableOpacity onPress={() => router.push('/(app)/achievements')}>
              <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.teal }}>Ver todas →</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {unlockedAchievements.map((a: any) => (
              <View key={a.id} style={{
                alignItems: 'center', gap: 4, padding: 8,
                backgroundColor: `${a.color}1A`,
                borderRadius: 10, borderWidth: 1,
                borderColor: `${a.color}44`,
                minWidth: 60,
              }}>
                <Text style={{ fontSize: 22 }}>{a.icon}</Text>
                <Text style={{ fontFamily: FontFamily.body, fontSize: 9, color: a.color, textAlign: 'center' }}
                  numberOfLines={2}>{a.title}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Análise por Formato */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/stats')}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: 'rgba(107,127,215,0.10)', borderWidth: 1,
          borderColor: 'rgba(107,127,215,0.25)', borderRadius: 12, padding: 14,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 20 }}>📊</Text>
          <View>
            <Text style={{ fontFamily: FontFamily.title, fontSize: 14, color: '#6B7FD7' }}>
              Análise por Formato
            </Text>
            <Text style={{ fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted }}>
              Aproveitamento por tipo de competição
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 18, color: '#6B7FD7' }}>›</Text>
      </TouchableOpacity>

      {/* Forma recente */}
      {recent7.length > 0 && (
        <Card>
          <Text style={tab.sectionTitle}>Forma recente</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {recent7.map((g: any, i: number) => (
              <View key={i} style={{
                flex: 1, height: 32, borderRadius: 8,
                backgroundColor: g.won ? Colors.teal + '33' : Colors.coral + '33',
                borderWidth: 1, borderColor: g.won ? Colors.teal + '66' : Colors.coral + '66',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 12, color: g.won ? Colors.teal : Colors.coral }}>
                  {g.won ? 'V' : 'D'}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Evolução de pontos */}
      <PointsTimeline data={evoPoints.map((p: any, i: number) => ({ ...p, pos: i + 1 }))} />



      {/* Pontos por competição */}
      {ratingHistory.length >= 2 && (
        <Card style={{ gap: Spacing.sm }}>
          <Text style={tab.sectionTitle}>Pontos por competição</Text>
          <RatingChart ratings={ratingHistory} />
        </Card>
      )}

    </View>
  );
}

const makeStatRowStyles = (Colors: ThemeColors) => StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center' },
  cell:    { flex: 1, alignItems: 'center', gap: 3, paddingVertical: Spacing.sm },
  divider: { borderRightWidth: 1, borderRightColor: Colors.line },
  val:     { fontFamily: FontFamily.numberBold, fontSize: 18 },
  lbl:     { fontFamily: FontFamily.number, fontSize: 9, color: Colors.faint, letterSpacing: 0.5 },
});

const makeL20Styles = (Colors: ThemeColors) => StyleSheet.create({
  resultBox: { flex: 1, alignItems: 'center', backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.sm, gap: 2 },
  resultIcon: { fontSize: 18 },
  resultNum:  { fontFamily: FontFamily.titleBold, fontSize: 22 },
  resultLbl:  { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
});
