import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { goToPlayer } from '@/logic/nav';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { computeBadges } from '@/logic/badges';
import { computeFormatStats } from '@/logic/formatStats';
import { computeRivalries } from '@/logic/rivalries';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';


export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useCompetitions();
  const { groupPlayers, findPlayer } = useGroupPlayers();

  const player = groupPlayers.find(p => p.id === id);
  if (!player) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity style={styles.backRow} onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/ranking')}>
          <Text style={styles.backText}>← Ranking</Text>
        </TouchableOpacity>
        <Text style={{ color: Colors.coral, padding: Spacing.md }}>Jogador não encontrado.</Text>
      </SafeAreaView>
    );
  }

  const allGames = state.competitions.flatMap(extractPlayerGames);
  const ranking = buildRanking(
    groupPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, handicap: p.handicap })),
    allGames
  );
  const me = ranking.find(r => r.id === id) ?? ranking[0];
  const myPos = ranking.findIndex(r => r.id === id) + 1;
  const winRate = me.played > 0 ? Math.round((me.wins / me.played) * 100) : 0;

  // Match history
  const matchHistory: Array<{ compName: string; opponents: string; myScore: number; oppScore: number; won: boolean; date: string; isTeam: boolean }> = [];
  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreB == null) return;
      const inA = m.teamA ? m.teamA.includes(id!) : m.aId === id;
      const inB = m.teamB ? m.teamB.includes(id!) : m.bId === id;
      if (!inA && !inB) return;
      const myScore = inA ? m.scoreA : m.scoreB;
      const oppScore = inA ? m.scoreB : m.scoreA;
      const won = myScore > oppScore;
      let opponents = '?';
      if (m.teamA && m.teamB) {
        const oppTeam = inA ? m.teamB : m.teamA;
        opponents = oppTeam.map(pid => findPlayer(pid)?.name.split(' ')[0] ?? pid).join(' / ');
      } else {
        const oppId = inA ? m.bId : m.aId;
        if (oppId) {
          const oppComp = comp.competitors.find(c => c.id === oppId);
          opponents = oppComp?.name ?? findPlayer(oppId)?.name ?? oppId;
        }
      }
      matchHistory.push({ compName: comp.name, opponents, myScore, oppScore, won, date: m.playedAt ?? comp.date ?? '', isTeam: !!(m.teamA && m.teamB) });
    });
  });
  matchHistory.sort((a, b) => b.date.localeCompare(a.date));

  // Últimos 20 jogos
  const last20 = matchHistory.slice(0, 20);
  const last20Wins = last20.filter(g => g.won).length;
  const last20Losses = last20.filter(g => !g.won).length;

  // Simples = partidas individuais (aId/bId), Duplas = partidas com teamA/teamB
  const simplesGames = last20.filter(g => !g.isTeam);
  const duplasGames  = last20.filter(g => g.isTeam);
  const formatBreakdown = [
    { label: 'Simples', wins: simplesGames.filter(g => g.won).length, losses: simplesGames.filter(g => !g.won).length, total: simplesGames.length },
    { label: 'Duplas',  wins: duplasGames.filter(g => g.won).length,  losses: duplasGames.filter(g => !g.won).length,  total: duplasGames.length },
  ];

  // Jogos por mês nos últimos 12 meses
  const now = new Date();
  const monthlyData: { label: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const shortMonth = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const label = `${shortMonth}/${String(d.getFullYear()).slice(2)}`;
    const count = matchHistory.filter(g => g.date.startsWith(key)).length;
    monthlyData.push({ label, count });
  }
  const maxMonthly = Math.max(...monthlyData.map(m => m.count), 1);

  // Evolution chart
  const screenW = Dimensions.get('window').width - Spacing.md * 2 - Spacing.md * 2 - 32;
  const evoPoints: { label: string; pts: number }[] = state.competitions
    .filter(c => c.status === 'done' || c.matches.some(m => m.scoreA != null))
    .map(comp => {
      const games = extractPlayerGames(comp);
      const myGames = games.filter(g => g.teamA.includes(id!) || g.teamB.includes(id!));
      if (myGames.length === 0) return null;
      let wins = 0, played = 0, gp = 0, gc = 0;
      myGames.forEach(g => {
        const inA = g.teamA.includes(id!);
        played++;
        if (inA) { gp += g.scoreA; gc += g.scoreB; if (g.scoreA > g.scoreB) wins++; }
        else { gp += g.scoreB; gc += g.scoreA; if (g.scoreB > g.scoreA) wins++; }
      });
      const ga = gc > 0 ? gp / gc : gp > 0 ? 999 : 0;
      const pts = Math.round((wins * 3 + played * 0.5 + ga * 2) * 100) / 100;
      return { label: comp.name.slice(0, 8), pts };
    })
    .filter(Boolean) as { label: string; pts: number }[];
  evoPoints.reverse();

  // Best partnerships
  type PairInfo = { partnerId: string; wins: number; losses: number; played: number };
  const partnerMap = new Map<string, PairInfo>();
  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || !m.teamA || !m.teamB) return;
      const inA = m.teamA.includes(id!);
      const inB = m.teamB.includes(id!);
      if (!inA && !inB) return;
      const myTeam = inA ? m.teamA : m.teamB;
      const partner = myTeam.find(pid => pid !== id);
      if (!partner) return;
      const myScore = inA ? m.scoreA! : m.scoreB!;
      const oppScore = inA ? m.scoreB! : m.scoreA!;
      const won = myScore > oppScore;
      if (!partnerMap.has(partner)) partnerMap.set(partner, { partnerId: partner, wins: 0, losses: 0, played: 0 });
      const ps = partnerMap.get(partner)!;
      ps.played++;
      if (won) ps.wins++; else ps.losses++;
    });
  });
  const partnerships = [...partnerMap.values()]
    .filter(p => p.played >= 2)
    .sort((a, b) => b.wins - a.wins || (b.wins / b.played) - (a.wins / a.played))
    .slice(0, 5);

  const badges = computeBadges(id!, state.competitions, pid => findPlayer(pid)?.name ?? pid);
  const unlockedBadges = badges.filter(b => b.unlocked);
  const formatStats = computeFormatStats(state.competitions, id!);
  const rivalries = computeRivalries(id!, state.competitions);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <TouchableOpacity style={styles.backRow} onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/ranking')}>
          <Text style={styles.backText}>← Ranking</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.heroBanner}>
          <View style={[styles.heroBg, { backgroundColor: player.color + '22' }]} />
          <View style={styles.heroInner}>
            <Avatar name={player.name} color={player.color} size={88} showCrown={myPos === 1} />
            <Text style={styles.name}>{player.name}</Text>
            <View style={styles.badgeRow}>
              <Badge label={`${myPos}° lugar`} variant="gold" />
              <Badge label={`${winRate}% aproveit.`} variant="teal" />
            </View>
          </View>
        </View>

        {/* Pontuação */}
        <Card elevated style={styles.ptsCard}>
          <Text style={styles.ptsLabel}>PONTUAÇÃO KING BT</Text>
          <Text style={styles.ptsVal}>{me.points.toFixed(2)}</Text>
        </Card>

        {/* Stats compactas */}
        <Card style={{ paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs }}>
          <View style={statRow.row}>
            {[
              { l: 'J',    v: me.played,                        c: Colors.text },
              { l: 'V',    v: me.wins,                          c: Colors.teal },
              { l: 'D',    v: me.losses,                        c: Colors.coral },
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

        {/* Forma recente — mais recente à direita */}
        {(() => {
          const recentGames = [...matchHistory.slice(0, 7)].reverse();
          if (recentGames.length === 0) return null;
          return (
            <Card>
              <Text style={styles.sectionTitle}>Forma recente</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {recentGames.map((g, i) => (
                  <View key={i} style={{
                    width: 32, height: 32, borderRadius: 8,
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
          );
        })()}

        {/* Últimos 20 jogos por formato */}
        {last20.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Últimos 20 jogos</Text>

            {/* Por formato */}
            {formatBreakdown.map(f => (
              <View key={f.label} style={l20.row}>
                <Text style={l20.label}>{f.label}</Text>
                <View style={l20.bar}>
                  <View style={[l20.barWin, { flex: f.wins || 0.001 }]}>
                    {f.wins > 0 && <Text style={l20.barNum}>{f.wins}</Text>}
                  </View>
                  <View style={[l20.barLoss, { flex: f.losses || 0.001 }]}>
                    {f.losses > 0 && <Text style={l20.barNum}>{f.losses}</Text>}
                  </View>
                </View>
              </View>
            ))}


            {/* Resultado */}
            <View style={{ flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.md }}>
              <View style={l20.resultBox}>
                <Text style={[l20.resultIcon]}>✅</Text>
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

        {/* Jogos nos últimos 12 meses */}
        {monthlyData.some(m => m.count > 0) && (
          <Card>
            <Text style={styles.sectionTitle}>Jogos nos últimos 12 meses</Text>
            <View style={monthly.chart}>
              {monthlyData.map((m, i) => (
                <View key={i} style={monthly.col}>
                  {m.count > 0 && (
                    <Text style={monthly.count}>{m.count}</Text>
                  )}
                  <View style={monthly.barWrap}>
                    <View style={[monthly.bar, {
                      height: maxMonthly > 0 ? Math.max((m.count / maxMonthly) * 80, m.count > 0 ? 4 : 0) : 0,
                      backgroundColor: m.count > 0 ? Colors.gold : 'transparent',
                    }]} />
                  </View>
                  <Text style={monthly.label}>{m.label.split('/')[0]}</Text>
                  <Text style={monthly.year}>/{m.label.split('/')[1]}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Conquistas */}
        <Card>
          <Text style={styles.sectionTitle}>Conquistas</Text>
          <View style={bdg.grid}>
            {badges.map(b => (
              <View key={b.id} style={[bdg.item, !b.unlocked && bdg.locked]}>
                <Text style={bdg.emoji}>{b.emoji}</Text>
                <Text style={[bdg.name, !b.unlocked && bdg.nameLocked]} numberOfLines={2}>{b.name}</Text>
              </View>
            ))}
          </View>
          {unlockedBadges.length === 0 && (
            <Text style={bdg.empty}>Nenhuma conquista desbloqueada ainda.</Text>
          )}
        </Card>

        {/* Aproveitamento por formato */}
        {formatStats.length > 0 && (
          <Card style={{ gap: Spacing.sm }}>
            <Text style={styles.sectionTitle}>Aproveitamento por Formato</Text>
            {formatStats.map(fs => (
              <View key={fs.format} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text }}>{fs.label}</Text>
                  <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 13, color: fs.color }}>{fs.pct}%</Text>
                </View>
                <View style={{ height: 5, backgroundColor: Colors.line, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 5, width: `${fs.pct}%`, backgroundColor: fs.color, borderRadius: 3 }} />
                </View>
                <Text style={{ fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint }}>
                  {fs.wins}V · {fs.played - fs.wins}D · {fs.played} jogos
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Gráfico de evolução */}
        {evoPoints.length >= 2 && (() => {
          const chartH = 100;
          const chartW = screenW;
          const maxPts = Math.max(...evoPoints.map(p => p.pts));
          const minPts = Math.min(...evoPoints.map(p => p.pts));
          const range = Math.max(maxPts - minPts, 1);
          const pad = 12;
          const xStep = evoPoints.length > 1 ? (chartW - pad * 2) / (evoPoints.length - 1) : chartW - pad * 2;
          const toY = (pts: number) => pad + ((maxPts - pts) / range) * (chartH - pad * 2);
          const pts = evoPoints.map((p, i) => `${pad + i * xStep},${toY(p.pts)}`).join(' ');
          return (
            <Card>
              <Text style={styles.sectionTitle}>Evolução de pontos</Text>
              <Svg width={chartW} height={chartH}>
                <Line x1={pad} y1={chartH - pad} x2={chartW - pad} y2={chartH - pad} stroke={Colors.line} strokeWidth={1} />
                <Polyline points={pts} fill="none" stroke={Colors.gold} strokeWidth={2} />
                {evoPoints.map((p, i) => (
                  <Circle key={i} cx={pad + i * xStep} cy={toY(p.pts)} r={4} fill={Colors.gold} />
                ))}
                {evoPoints.map((p, i) => (
                  <SvgText key={i} x={pad + i * xStep} y={chartH - 2} fontSize={9} fill={Colors.faint} textAnchor="middle">
                    {p.label}
                  </SvgText>
                ))}
              </Svg>
            </Card>
          );
        })()}

        {/* Melhores parcerias */}
        {partnerships.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Melhores parcerias</Text>
            {partnerships.map((ps, i) => {
              const p = findPlayer(ps.partnerId);
              const wr = Math.round((ps.wins / ps.played) * 100);
              return (
                <View key={ps.partnerId} style={[pship.row, i < partnerships.length - 1 && pship.border]}>
                  <Avatar name={p?.name ?? '?'} color={p?.color ?? Colors.gold} size={30} />
                  <Text style={pship.name} numberOfLines={1}>{p?.name ?? ps.partnerId}</Text>
                  <Text style={pship.rec}>{ps.wins}V / {ps.losses}D</Text>
                  <Text style={[pship.wr, { color: wr >= 60 ? Colors.teal : wr >= 40 ? Colors.text : Colors.coral }]}>{wr}%</Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Identidade na Quadra */}
        {(rivalries.biggestPartner || rivalries.biggestRival || rivalries.carrasco || rivalries.fregues) && (
          <Card>
            <Text style={styles.sectionTitle}>Identidade na Quadra</Text>
            <View style={{ gap: Spacing.sm }}>
              {[
                { emoji: '🎾', label: 'Maior Parceiro',          sub: 'Com quem mais jogou',  stat: rivalries.biggestPartner, detail: (s: any) => `${s.played} jogo${s.played !== 1 ? 's' : ''} juntos` },
                { emoji: '🤝', label: 'Parceiro Mais Eficiente', sub: 'Com quem mais venceu', stat: rivalries.bestPartner,    detail: (s: any) => `${s.wins}V / ${s.played - s.wins}D · ${Math.round(s.pct * 100)}%` },
                { emoji: '⚔️', label: 'Maior Rival',             sub: 'Quem mais enfrentou',  stat: rivalries.biggestRival,   detail: (s: any) => `${s.played} confronto${s.played !== 1 ? 's' : ''}` },
                { emoji: '👹', label: 'Carrasco',                sub: 'Quem mais o venceu',   stat: rivalries.carrasco,       detail: (s: any) => `${s.wins} derrota${s.wins !== 1 ? 's' : ''}` },
                { emoji: '😅', label: 'Freguês',                 sub: 'Quem mais venceu',     stat: rivalries.fregues,        detail: (s: any) => `${s.wins} vitória${s.wins !== 1 ? 's' : ''}` },
              ].map(({ emoji, label, sub, stat, detail }) => {
                if (!stat) return null;
                const p = findPlayer(stat.id);
                if (!p) return null;
                return (
                  <TouchableOpacity
                    key={label}
                    style={ident.row}
                    onPress={() => goToPlayer(stat.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={ident.emoji}>{emoji}</Text>
                    <View style={ident.mid}>
                      <Text style={ident.label}>{label}</Text>
                      <Text style={ident.sub}>{sub}</Text>
                    </View>
                    <View style={ident.right}>
                      <Avatar name={p.name} color={p.color} size={32} />
                      <View style={{ alignItems: 'flex-end', gap: 2, width: 90 }}>
                        <Text style={ident.name} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
                        <Text style={ident.detail} numberOfLines={1}>{detail(stat)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        )}

        {/* Histórico de partidas */}
        {matchHistory.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Histórico de partidas</Text>
            {matchHistory.map((h, i) => (
              <View key={i} style={[hist.row, i < matchHistory.length - 1 && hist.border]}>
                <View style={[hist.badge, { backgroundColor: h.won ? Colors.teal + '33' : Colors.coral + '33' }]}>
                  <Text style={[hist.badgeText, { color: h.won ? Colors.teal : Colors.coral }]}>{h.won ? 'V' : 'D'}</Text>
                </View>
                <View style={hist.info}>
                  <Text style={hist.opp} numberOfLines={1}>vs {h.opponents}</Text>
                  <Text style={hist.compName} numberOfLines={1}>{h.compName}</Text>
                </View>
                <Text style={[hist.score, { color: h.won ? Colors.teal : Colors.coral }]}>{h.myScore}–{h.oppScore}</Text>
              </View>
            ))}
          </Card>
        )}

        {matchHistory.length === 0 && (
          <Card style={{ alignItems: 'center', padding: Spacing.lg }}>
            <Text style={{ fontFamily: FontFamily.body, fontSize: 14, color: Colors.faint }}>
              Nenhuma partida registrada ainda.
            </Text>
          </Card>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const monthly = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingTop: Spacing.sm },
  col: { flex: 1, alignItems: 'center', gap: 2 },
  barWrap: { height: 80, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  bar: { width: '80%', borderRadius: 3 },
  count: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold },
  label: { fontFamily: FontFamily.body, fontSize: 9, color: Colors.muted },
  year: { fontFamily: FontFamily.body, fontSize: 8, color: Colors.faint, marginTop: -2 },
});

const l20 = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
  label: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, width: 60 },
  bar: { flex: 1, flexDirection: 'row', height: 18, borderRadius: 4, overflow: 'hidden' },
  barWin: { backgroundColor: Colors.teal + 'CC' },
  barLoss: { backgroundColor: Colors.coral + 'CC' },
  num: { fontFamily: FontFamily.numberBold, fontSize: 13, width: 22, textAlign: 'center' },
  barNum: { fontFamily: FontFamily.numberBold, fontSize: 12, color: '#fff', paddingHorizontal: 6, alignSelf: 'center' },
  resultBox: { flex: 1, alignItems: 'center', backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.sm, gap: 2 },
  resultIcon: { fontSize: 18 },
  resultNum: { fontFamily: FontFamily.titleBold, fontSize: 22 },
  resultLbl: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
});

const statRow = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.xs },
  divider: { borderRightWidth: 1, borderRightColor: Colors.line },
  val: { fontFamily: FontFamily.numberBold, fontSize: 14 },
  lbl: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.muted, marginTop: 2 },
});

const bdg = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  item: { width: 72, alignItems: 'center', gap: 4, padding: Spacing.sm, backgroundColor: Colors.surf2, borderRadius: Radius.md },
  locked: { opacity: 0.35 },
  emoji: { fontSize: 28 },
  name: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.text, textAlign: 'center' },
  nameLocked: { color: Colors.faint },
  empty: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, textAlign: 'center', paddingVertical: Spacing.sm },
});

const pship = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  name: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  rec: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted },
  wr: { fontFamily: FontFamily.numberBold, fontSize: 13, width: 36, textAlign: 'right' },
});

const ident = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  emoji: { fontSize: 22, width: 30, textAlign: 'center' },
  mid: { flex: 1, gap: 2 },
  label: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  sub: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, width: 140, justifyContent: 'flex-end' },
  name: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text, textAlign: 'right' },
  detail: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted, textAlign: 'right' },
});

const hist = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  badge: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: FontFamily.numberBold, fontSize: 12 },
  info: { flex: 1, gap: 2 },
  opp: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  compName: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  score: { fontFamily: FontFamily.numberBold, fontSize: 15 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  backText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.teal },
  heroBanner: { position: 'relative', overflow: 'hidden', borderRadius: Radius.lg, marginBottom: Spacing.sm },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  heroInner: { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.sm },
  name: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  ptsCard: { alignItems: 'center', gap: 4 },
  ptsLabel: { fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted, letterSpacing: 2 },
  ptsVal: { fontFamily: FontFamily.titleBold, fontSize: 52, color: Colors.gold, lineHeight: 60 },
  ptsEq: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted },
  sectionTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text, marginBottom: Spacing.sm },
});
