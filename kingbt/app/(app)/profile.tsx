import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform, TextInput, Modal, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef } from 'react';
import { router } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card, ShareStatsCard, ActivityHeatmap, RatingChart } from '@/components';
import type { ShareStatsData } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { addGuestPlayer, removeGuestPlayer, updatePlayerHandicap } from '@/firebase/groupPlayers';
import QRCode from 'react-native-qrcode-svg';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { computeFormatStats } from '@/logic/formatStats';
import { computeRivalries } from '@/logic/rivalries';
import { computeAchievementStats } from '@/logic/achievementStats';
import { ACHIEVEMENTS } from '@/constants/achievements';
import Svg, { Polyline, Line, Circle, Text as SvgText, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const GUEST_COLORS = ['#FFD166', '#2DD4BF', '#A78BFA', '#34D399', '#F472B6', '#94A3B8', '#FB923C', '#60A5FA'];
const screenW = Dimensions.get('window').width - Spacing.md * 4 - 32;
const chartFullW = Dimensions.get('window').width - Spacing.md * 2;

type Tab = 'resumo' | 'historico' | 'rivalidades';

// ─── Gráfico de Evolução de Pontos ────────────────────────────────────────────
function PointsTimeline({ data }: { data: { label: string; pts: number; pos: number }[] }) {
  const [selected, setSelected] = useState<number | null>(null);

  if (data.length < 2) return null;

  const W = chartFullW;
  const H = 150;
  const PAD = { top: 16, bottom: 28, left: 28, right: 12 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxPts = Math.max(...data.map(d => d.pts), 1);
  const minPts = Math.min(...data.map(d => d.pts), 0);
  const range  = maxPts - minPts || 1;

  const pts = data.map((d, i) => ({
    x: PAD.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: PAD.top + chartH - ((d.pts - minPts) / range) * chartH,
    ...d,
  }));

  const linePoints = pts.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath = `M${pts[0].x},${PAD.top + chartH} ` +
    pts.map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${pts[pts.length - 1].x},${PAD.top + chartH} Z`;

  const trend = data[data.length - 1].pts - data[0].pts;
  const trendColor = trend > 0 ? Colors.teal : trend < 0 ? Colors.coral : Colors.muted;

  return (
    <Card style={{ gap: 6, paddingHorizontal: 0, paddingTop: Spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md }}>
        <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.muted, letterSpacing: 1.5 }}>
          EVOLUÇÃO DE PONTOS
        </Text>
        <View style={{ backgroundColor: trendColor + '22', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 11, color: trendColor }}>
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '—'} {Math.abs(trend).toFixed(2)}
          </Text>
        </View>
      </View>

      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="profAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={Colors.gold} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={Colors.gold} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid */}
        {[0, 0.5, 1].map((t, i) => {
          const y = PAD.top + chartH * (1 - t);
          const val = (minPts + range * t).toFixed(0);
          return (
            <Line key={i} x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
              stroke={Colors.line} strokeWidth="1" />
          );
        })}
        {[0, 0.5, 1].map((t, i) => (
          <SvgText key={i} x={PAD.left - 4} y={PAD.top + chartH * (1 - t) + 4}
            fontSize="8" fill={Colors.faint} textAnchor="end">
            {(minPts + range * t).toFixed(0)}
          </SvgText>
        ))}

        {/* Área + linha */}
        <Path d={areaPath} fill="url(#profAreaGrad)" />
        <Polyline points={linePoints} fill="none"
          stroke={Colors.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Pontos */}
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={selected === i ? 7 : 4}
            fill={selected === i ? Colors.gold : Colors.bg}
            stroke={Colors.gold} strokeWidth="2"
            onPress={() => setSelected(selected === i ? null : i)} />
        ))}

        {/* Labels X */}
        {pts.map((p, i) => (
          <SvgText key={i} x={p.x} y={H - 4} fontSize="8"
            fill={selected === i ? Colors.gold : Colors.faint} textAnchor="middle">
            {p.label}
          </SvgText>
        ))}

        {/* Tooltip */}
        {selected !== null && (() => {
          const p = pts[selected];
          const bx = Math.min(Math.max(p.x - 40, 0), W - 92);
          const by = Math.max(p.y - 44, 0);
          return (
            <>
              <Line x1={p.x} y1={p.y} x2={p.x} y2={PAD.top + chartH}
                stroke={Colors.gold} strokeWidth="1" strokeDasharray="3,3" />
              <Path d={`M${bx},${by} h80 a4,4 0 0 1 4,4 v24 a4,4 0 0 1 -4,4 h-80 a4,4 0 0 1 -4,-4 v-24 a4,4 0 0 1 4,-4 z`}
                fill="#1C1810" />
              <SvgText x={bx + 40} y={by + 14} fontSize="10" fill={Colors.gold}
                textAnchor="middle" fontWeight="700">{p.pts.toFixed(2)} pts</SvgText>
              <SvgText x={bx + 40} y={by + 26} fontSize="8" fill={Colors.muted}
                textAnchor="middle">{p.pos}° lugar</SvgText>
            </>
          );
        })()}
      </Svg>
    </Card>
  );
}

// ─── Aba Resumo ───────────────────────────────────────────────────────────────
function ResumoTab({ me, myPos, winRate, matchHistory, evoPoints, activityData, ratingHistory, nextAchievement, unlockedAchievements }: any) {
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

function HistoricoTab({ matchHistory }: any) {
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

// ─── Aba Rivalidades ──────────────────────────────────────────────────────────
function RivalidadesTab({ rivalries, partnerships, findPlayer }: any) {
  const rivalItems = [
    rivalries.biggestRival  && { ...rivalries.biggestRival,  icon: '⚔️', label: 'Maior Rival',   sub: 'Quem você mais enfrentou' },
    rivalries.carrasco      && { ...rivalries.carrasco,      icon: '👹', label: 'Carrasco',        sub: 'Quem mais te venceu' },
    rivalries.fregues       && { ...rivalries.fregues,       icon: '😅', label: 'Freguês',         sub: 'Quem você mais venceu' },
  ].filter(Boolean) as any[];

  const partnerItems = [
    rivalries.biggestPartner && { ...rivalries.biggestPartner, icon: '🎾', label: 'Maior Parceiro',        sub: 'Com quem você mais jogou' },
    rivalries.bestPartner    && { ...rivalries.bestPartner,    icon: '🤝', label: 'Parceiro Mais Eficiente', sub: 'Com quem você mais venceu' },
    ...partnerships.map((p: any) => ({ ...p, id: p.partnerId, icon: '🎾', label: 'Parceria', sub: `${p.wins}V / ${p.losses}D` })),
  ].filter(Boolean).slice(0, 5) as any[];

  function H2HCard({ item, type }: { item: any; type: 'rival' | 'partner' }) {
    const pl = findPlayer(item.id);
    if (!pl) return null;
    const total = (item.wins ?? 0) + (item.losses ?? 0);
    const wr = total > 0 ? Math.round(((item.wins ?? 0) / total) * 100) : 0;
    const played = item.played ?? total;
    return (
      <TouchableOpacity
        style={rv.card}
        onPress={() => router.push({ pathname: '/player/[id]', params: { id: item.id } })}
        activeOpacity={0.8}
      >
        <View style={rv.cardTop}>
          <Text style={rv.icon}>{item.icon}</Text>
          <Avatar name={pl.name} color={pl.color} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={rv.name} numberOfLines={1}>{pl.name}</Text>
            <Text style={rv.sub}>{item.label} · {item.sub}</Text>
          </View>
          <Text style={rv.arrow}>›</Text>
        </View>
        <View style={rv.stats}>
          <View style={rv.statCell}>
            <Text style={[rv.statVal, { color: Colors.teal }]}>{item.wins ?? 0}</Text>
            <Text style={rv.statLbl}>Vitórias</Text>
          </View>
          <View style={[rv.statCell, rv.statBorder]}>
            <Text style={[rv.statVal, { color: Colors.coral }]}>{item.losses ?? 0}</Text>
            <Text style={rv.statLbl}>Derrotas</Text>
          </View>
          <View style={[rv.statCell, rv.statBorder]}>
            <Text style={[rv.statVal, { color: Colors.gold }]}>{played}</Text>
            <Text style={rv.statLbl}>Jogos</Text>
          </View>
          <View style={[rv.statCell, rv.statBorder]}>
            <Text style={[rv.statVal, { color: wr >= 50 ? Colors.teal : Colors.coral }]}>{wr}%</Text>
            <Text style={rv.statLbl}>Taxa</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={tab.content}>
      {rivalItems.length > 0 && (
        <View style={{ gap: Spacing.sm }}>
          <Text style={tab.sectionTitle}>Seus Maiores Rivais</Text>
          {rivalItems.map((r: any, i: number) => <H2HCard key={i} item={r} type="rival" />)}
        </View>
      )}

      {partnerItems.length > 0 && (
        <View style={{ gap: Spacing.sm, marginTop: rivalItems.length > 0 ? Spacing.md : 0 }}>
          <Text style={tab.sectionTitle}>Melhores Parcerias</Text>
          {partnerItems.map((p: any, i: number) => <H2HCard key={i} item={p} type="partner" />)}
        </View>
      )}

      {rivalItems.length === 0 && partnerItems.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm }}>
          <Text style={{ fontSize: 36 }}>⚔️</Text>
          <Text style={{ fontFamily: FontFamily.title, fontSize: 16, color: Colors.text }}>Sem rivalidades ainda</Text>
          <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' }}>
            Dispute partidas para ver seus rivais e parceiros aqui.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { state } = useCompetitions();
  const { logout, leaveGroup, group, user, isAdmin, myPlayerId } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const MY_ID = myPlayerId ?? '';
  const player = groupPlayers.find(p => p.id === MY_ID) ?? null;

  const [activeTab, setActiveTab] = useState<Tab>('resumo');
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [sharingInProgress, setSharingInProgress] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestColor, setGuestColor] = useState(GUEST_COLORS[0]);
  const shareCardRef = useRef<View>(null);

  if (!player) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center', marginBottom: 12 }}>
          Perfil não vinculado
        </Text>
        <Text style={{ fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, textAlign: 'center', marginBottom: 24 }}>
          Saia do grupo e entre novamente para vincular seu perfil.
        </Text>
        <TouchableOpacity onPress={logout} style={{ backgroundColor: Colors.gold, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 }}>
          <Text style={{ fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg }}>Sair da conta</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleLeaveGroup() {
    const doLeave = async () => { await leaveGroup(); router.replace('/(auth)/join'); };
    if (Platform.OS === 'web') {
      if (window.confirm('Sair do grupo atual?')) await doLeave();
    } else {
      Alert.alert('Trocar de grupo', 'Sair do grupo atual?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair do grupo', style: 'destructive', onPress: doLeave },
      ]);
    }
  }

  async function handleLogout() {
    const doLogout = async () => { await logout(); router.replace('/(auth)/login'); };
    if (Platform.OS === 'web') {
      if (window.confirm('Deseja sair da sua conta?')) await doLogout();
    } else {
      Alert.alert('Sair', 'Deseja sair da sua conta?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: doLogout },
      ]);
    }
  }

  async function handleAddGuest() {
    if (!guestName.trim() || !group) return;
    await addGuestPlayer(group.id, guestName.trim(), guestColor);
    setGuestName(''); setGuestColor(GUEST_COLORS[0]); setShowAddGuest(false);
  }

  function handleRemoveGuest(pid: string, name: string) {
    if (!group) return;
    const doRemove = () => removeGuestPlayer(group.id, pid);
    if (Platform.OS === 'web') {
      if (window.confirm(`Remover ${name} do grupo?`)) doRemove();
    } else {
      Alert.alert('Remover convidado', `Remover ${name} do grupo?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: doRemove },
      ]);
    }
  }

  async function handleShare() {
    if (!shareCardRef.current || sharingInProgress) return;
    try {
      setSharingInProgress(true);
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      setSharingInProgress(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartilhar stats' });
      }
    } catch { setSharingInProgress(false); }
  }

  // ── Data ────────────────────────────────────────────────────────────────────
  const allGames = state.competitions.flatMap(extractPlayerGames);
  const ranking  = buildRanking(
    groupPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, handicap: p.handicap })),
    allGames
  );
  const me     = ranking.find(r => r.id === MY_ID) ?? ranking[0];
  const myPos  = ranking.findIndex(r => r.id === MY_ID) + 1;
  const winRate = me.played > 0 ? Math.round((me.wins / me.played) * 100) : 0;

  // Match history
  const matchHistory: Array<{ compName: string; format: string; opponents: string; partner: string | null; myScore: number; oppScore: number; won: boolean; isTeam: boolean }> = [];
  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreB == null) return;
      const inA = m.teamA ? m.teamA.includes(MY_ID) : m.aId === MY_ID;
      const inB = m.teamB ? m.teamB.includes(MY_ID) : m.bId === MY_ID;
      if (!inA && !inB) return;
      const myScore = inA ? m.scoreA : m.scoreB;
      const oppScore = inA ? m.scoreB : m.scoreA;
      const won = myScore > oppScore;
      const isTeam = !!(m.teamA && m.teamB);
      let opponents = '?', partner: string | null = null;
      if (m.teamA && m.teamB) {
        const myTeam  = inA ? m.teamA : m.teamB;
        const oppTeam = inA ? m.teamB : m.teamA;
        opponents = oppTeam.map(pid => findPlayer(pid)?.name.split(' ')[0] ?? pid).join(' / ');
        const pid = myTeam.find(id => id !== MY_ID);
        if (pid) partner = findPlayer(pid)?.name.split(' ')[0] ?? pid;
      } else {
        const oppId = inA ? m.bId : m.aId;
        if (oppId) {
          const oppComp = comp.competitors.find(c => c.id === oppId);
          opponents = oppComp?.name ?? findPlayer(oppId)?.name ?? oppId;
        }
      }
      matchHistory.push({ compName: comp.name, format: comp.format, opponents, partner, myScore, oppScore, won, isTeam });
    });
  });
  matchHistory.reverse();

  // Evo points
  const evoPoints: { label: string; pts: number; pos: number }[] = (() => {
    const players = groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color, handicap: p.handicap }));
    const compsWithMe = state.competitions
      .filter(c => c.matches.some(m => {
        const ids = [...(m.teamA ?? []), ...(m.teamB ?? []), m.aId, m.bId].filter(Boolean);
        return ids.includes(MY_ID) && m.scoreA != null;
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return compsWithMe.map((comp, idx) => {
      const compsUpTo = compsWithMe.slice(0, idx + 1);
      const games = compsUpTo.flatMap(extractPlayerGames);
      const rank = buildRanking(players, games);
      const me = rank.find(r => r.id === MY_ID);
      const pos = rank.findIndex(r => r.id === MY_ID) + 1;
      return { label: comp.name.slice(0, 7), pts: me?.points ?? 0, pos };
    });
  })();

  // Activity heatmap
  const activityData: Record<string, number> = {};
  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null) return;
      const inA = m.teamA ? m.teamA.includes(MY_ID) : m.aId === MY_ID;
      const inB = m.teamB ? m.teamB.includes(MY_ID) : m.bId === MY_ID;
      if (!inA && !inB) return;
      const dateKey = (m.playedAt ?? comp.date ?? '').split('T')[0];
      if (!dateKey) return;
      activityData[dateKey] = Math.min(3, (activityData[dateKey] ?? 0) + 1);
    });
  });

  // Rating history
  const ratingHistory: { label: string; pts: number; wins: number; played: number }[] = state.competitions
    .filter(c => c.matches.some(m => m.scoreA != null && (
      m.teamA?.includes(MY_ID) || m.teamB?.includes(MY_ID) || m.aId === MY_ID || m.bId === MY_ID
    )))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8)
    .map(comp => {
      const games = extractPlayerGames(comp).filter(g => g.teamA.includes(MY_ID) || g.teamB.includes(MY_ID));
      let wins = 0, played = 0, gp = 0, gc = 0;
      games.forEach(g => {
        const inA = g.teamA.includes(MY_ID);
        played++;
        if (inA) { gp += g.scoreA; gc += g.scoreB; if (g.scoreA > g.scoreB) wins++; }
        else { gp += g.scoreB; gc += g.scoreA; if (g.scoreB > g.scoreA) wins++; }
      });
      const ga = gc > 0 ? gp / gc : gp > 0 ? 2 : 0;
      const pts = Math.round((wins * 3 + played * 0.5 + ga * 2) * 100) / 100;
      return { label: comp.name.length > 9 ? comp.name.slice(0, 9) + '…' : comp.name, pts, wins, played };
    });

  // Partnerships
  type PairInfo = { partnerId: string; wins: number; losses: number; played: number };
  const partnerMap = new Map<string, PairInfo>();
  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || !m.teamA || !m.teamB) return;
      const inA = m.teamA.includes(MY_ID), inB = m.teamB.includes(MY_ID);
      if (!inA && !inB) return;
      const myTeam = inA ? m.teamA : m.teamB;
      const partner = myTeam.find(id => id !== MY_ID);
      if (!partner) return;
      const won = inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
      if (!partnerMap.has(partner)) partnerMap.set(partner, { partnerId: partner, wins: 0, losses: 0, played: 0 });
      const ps = partnerMap.get(partner)!;
      ps.played++;
      if (won) ps.wins++; else ps.losses++;
    });
  });
  const partnerships = [...partnerMap.values()]
    .filter(p => p.played >= 2)
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 5);

  const formatStats = computeFormatStats(state.competitions, MY_ID);
  const rivalries   = computeRivalries(MY_ID, state.competitions);

  // Next achievement
  const achStats = computeAchievementStats(state.competitions, MY_ID);
  const achStatsWithRating = { ...achStats, currentRating: me?.points ?? 0 };
  const nextAch = ACHIEVEMENTS
    .map(a => ({ a, prog: a.progress(achStatsWithRating) }))
    .filter(({ prog }) => prog > 0 && prog < 1)
    .sort((a, b) => b.prog - a.prog)[0];
  const nextAchievement = nextAch ? {
    icon:  nextAch.a.icon,
    title: nextAch.a.title,
    color: nextAch.a.color,
    prog:  nextAch.prog,
    label: nextAch.a.progressLabel(achStatsWithRating),
    desc:  nextAch.a.description,
  } : null;

  const unlockedAchievements = ACHIEVEMENTS.filter(a => a.progress(achStatsWithRating) >= 1);

  if (!me) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'resumo',      label: 'RESUMO' },
    { key: 'historico',   label: 'HISTÓRICO' },
    { key: 'rivalidades', label: 'RIVALIDADES' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Hero — sempre visível */}
      <View style={styles.heroBanner}>
        <View style={[styles.heroBg, { backgroundColor: (player?.color ?? '#FFD166') + '22' }]} />
        <View style={styles.heroInner}>
          <Avatar name={player?.name ?? '?'} color={player?.color ?? '#FFD166'} size={64} showCrown={myPos === 1} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{player?.name ?? user?.displayName ?? 'Jogador'}</Text>
            <Text style={styles.titleText} numberOfLines={1}>{user?.email ?? ''}</Text>
            <View style={styles.badges}>
              <Badge label={`${myPos}° lugar`} variant="gold" />
              <Badge label={`${winRate}% aproveit.`} variant="teal" />
            </View>
          </View>
          <TouchableOpacity style={[styles.shareBtn, sharingInProgress && { opacity: 0.5 }]} onPress={handleShare} activeOpacity={0.75} disabled={sharingInProgress}>
            <Text style={styles.shareBtnText}>{sharingInProgress ? '...' : '↑'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar sticky */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setActiveTab(t.key)}>
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
            {activeTab === t.key && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Scroll content */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {activeTab === 'resumo' && (
          <ResumoTab
            me={me} myPos={myPos} winRate={winRate}
            matchHistory={matchHistory} evoPoints={evoPoints}
            activityData={activityData} ratingHistory={ratingHistory}
            nextAchievement={nextAchievement}
            unlockedAchievements={unlockedAchievements}
          />
        )}
        {activeTab === 'historico' && (
          <HistoricoTab matchHistory={matchHistory} formatStats={formatStats} />
        )}
        {activeTab === 'rivalidades' && (
          <RivalidadesTab rivalries={rivalries} partnerships={partnerships} findPlayer={findPlayer} />
        )}

        <Card style={styles.accountCard}>
          <Text style={styles.accountEmail}>{user?.email ?? user?.displayName}</Text>
          {group && (
            <TouchableOpacity onPress={() => setShowQR(true)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.groupInfo}>Grupo: {group.name} · {group.code}</Text>
              <Text style={{ fontSize: 14 }}>⊞</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/(app)/settings')} activeOpacity={0.8}>
            <Text style={styles.settingsBtnText}>⚙️  Configurações</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.leaveGroupBtn} onPress={() => router.push('/(auth)/groups')} activeOpacity={0.8}>
            <Text style={styles.leaveGroupText}>Trocar de grupo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>
        </Card>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Share card fora da tela */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <View ref={shareCardRef} collapsable={false}>
          <ShareStatsCard data={{
            name: player?.name ?? user?.displayName ?? 'Jogador',
            color: player?.color ?? '#FFD166',
            position: myPos, points: me.points,
            played: me.played, wins: me.wins, losses: me.losses,
            winRate, sg: me.sg, ga: me.ga, groupName: group?.name ?? 'King BT',
          }} />
        </View>
      </View>

      {/* Modal QR */}
      <Modal visible={showQR} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setShowQR(false)} activeOpacity={1}>
          <View style={{ backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, margin: Spacing.xl }}>
            <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text }}>Convidar para o grupo</Text>
            <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12 }}>
              <QRCode value={group?.code ?? ''} size={200} color="#0B0B0D" backgroundColor="#ffffff" />
            </View>
            <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 26, color: Colors.gold, letterSpacing: 6 }}>{group?.code}</Text>
            <TouchableOpacity style={{ paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl }} onPress={() => setShowQR(false)}>
              <Text style={{ fontFamily: FontFamily.bodyMed, color: Colors.coral }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },

  heroBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, position: 'relative', overflow: 'hidden' },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  name: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  titleText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  badges: { flexDirection: 'row', gap: Spacing.xs, marginTop: 3, flexWrap: 'wrap' },
  shareBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: Colors.gold + '55', backgroundColor: Colors.gold + '11' },
  shareBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.gold },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.line, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md },
  tabItem: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', position: 'relative' },
  tabLabel: { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.faint },
  tabLabelActive: { color: Colors.gold, fontWeight: '700' },
  tabIndicator: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2.5, backgroundColor: Colors.gold, borderRadius: 1 },

  accountCard: { gap: Spacing.sm, alignItems: 'center' },
  accountEmail: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  groupInfo: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.gold },
  settingsBtn: { borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, alignItems: 'center', width: '100%' },
  settingsBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  leaveGroupBtn: { borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, alignItems: 'center', width: '100%' },
  leaveGroupText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  logoutBtn: { borderWidth: 1, borderColor: Colors.coral + '66', borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, alignItems: 'center', width: '100%' },
  logoutText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.coral },
});

const tab = StyleSheet.create({
  content: { gap: Spacing.md },
  sectionTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text, marginBottom: Spacing.xs },
  filterBtn: { flex: 1, paddingVertical: Spacing.xs + 2, borderRadius: Radius.sm, backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line, alignItems: 'center' },
  filterBtnActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  filterLabel: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.faint },
  filterLabelActive: { color: Colors.bg, fontWeight: '700' },
});

const statRow = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center' },
  cell:    { flex: 1, alignItems: 'center', gap: 3, paddingVertical: Spacing.sm },
  divider: { borderRightWidth: 1, borderRightColor: Colors.line },
  val:     { fontFamily: FontFamily.numberBold, fontSize: 18 },
  lbl:     { fontFamily: FontFamily.number, fontSize: 9, color: Colors.faint, letterSpacing: 0.5 },
});

const hist = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  border:    { borderBottomWidth: 1, borderBottomColor: Colors.line },
  badge:     { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: FontFamily.numberBold, fontSize: 12 },
  info:      { flex: 1, gap: 2 },
  opp:       { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  compName:  { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  score:     { fontFamily: FontFamily.numberBold, fontSize: 15 },
});

const rv = StyleSheet.create({
  card:      { backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, overflow: 'hidden', marginBottom: 4 },
  cardTop:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm },
  icon:      { fontSize: 20, width: 26 },
  name:      { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  sub:       { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint },
  arrow:     { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.faint },
  stats:     { flexDirection: 'row', backgroundColor: Colors.surf2, borderTopWidth: 1, borderTopColor: Colors.line },
  statCell:  { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  statBorder:{ borderLeftWidth: 1, borderLeftColor: Colors.line },
  statVal:   { fontFamily: FontFamily.numberBold, fontSize: 14 },
  statLbl:   { fontFamily: FontFamily.number, fontSize: 9, color: Colors.faint },
});

const l20 = StyleSheet.create({
  resultBox: { flex: 1, alignItems: 'center', backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.sm, gap: 2 },
  resultIcon: { fontSize: 18 },
  resultNum:  { fontFamily: FontFamily.titleBold, fontSize: 22 },
  resultLbl:  { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
});

const guest = StyleSheet.create({
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  addBtn:     { paddingHorizontal: Spacing.sm, paddingVertical: 3, backgroundColor: Colors.surf2, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line },
  addBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.teal },
  empty:      { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', paddingVertical: Spacing.sm },
  playerRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  border:     { borderBottomWidth: 1, borderBottomColor: Colors.line },
  playerName: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  guestBadge: { backgroundColor: Colors.gold + '22', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  guestText:  { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold },
  removeBtn:  { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.coral, lineHeight: 20, paddingHorizontal: 4 },
  form:       { borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.md, gap: Spacing.sm, marginTop: Spacing.sm },
  input:      { backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: 10, fontFamily: FontFamily.body, fontSize: 15, color: Colors.text },
  colorRow:   { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  colorDot:   { width: 28, height: 28, borderRadius: 14 },
  colorDotSel:{ borderWidth: 3, borderColor: Colors.text },
  confirmBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  confirmText:{ fontFamily: FontFamily.title, fontSize: 14, color: Colors.bg },
  hcRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hcBtn:      { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.line },
  hcBtnText:  { fontFamily: FontFamily.titleBold, fontSize: 14, color: Colors.text, lineHeight: 18 },
  hcVal:      { fontFamily: FontFamily.numberBold, fontSize: 13, width: 24, textAlign: 'center' },
});
