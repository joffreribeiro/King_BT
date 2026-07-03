import { View, Text, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import { groupComplete, koRoundName } from '@/logic/formats';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Match, Competition } from '@/logic/types';
import { firstUnscored, buildBracketShareText } from './helpers';
import { GameRow } from './GameRow';
import { MatchRow } from './MatchRow';
import { StandingsTable, stRow } from './StandingsTable';
import { BracketView } from './BracketView';
import { vw, tabs } from './viewStyles';

export function RotatingView({ comp, onScore, onClear, onSubstitute }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void; onSubstitute?: (match: Match, playerId: string) => void }) {
  const { findPlayer, groupPlayers: gp } = useGroupPlayers();
  const isDuplas = comp.unit === 'duplas';
  const [tab, setTab] = useState<'ranking' | 'jogos' | 'duplas'>('ranking');
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;
  const nextId = firstUnscored(comp.matches);

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
    const sg = gf - gc;
    const pts = wins * 3 + played * 0.5 + ga * 2;
    return { pid, wins, losses, played, gf, gc, ga, sg, pts };
  });

  function h2hRotating(pidA: string, pidB: string): number {
    let wA = 0, wB = 0;
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreA === m.scoreB) return;
      const aHasA = m.teamA?.includes(pidA) && m.teamB?.includes(pidB);
      const aHasB = m.teamA?.includes(pidB) && m.teamB?.includes(pidA);
      if (!aHasA && !aHasB) return;
      const aWon = m.scoreA! > m.scoreB!;
      if (aHasA) { if (aWon) wA++; else wB++; }
      else       { if (aWon) wB++; else wA++; }
    });
    if (wA !== wB) return wA > wB ? -1 : 1;
    return 0;
  }

  const EPS = 1e-9;
  rankingStats.sort((a, b) => {
    const byPts = b.pts  - a.pts;  if (Math.abs(byPts) > EPS) return byPts;
    const byGa  = b.ga   - a.ga;   if (Math.abs(byGa)  > EPS) return byGa;
    const bySg  = b.sg   - a.sg;   if (bySg  !== 0) return bySg;
    const byW   = b.wins - a.wins; if (byW   !== 0) return byW;
    const byH2H = h2hRotating(a.pid, b.pid); if (byH2H !== 0) return byH2H;
    const nA = findPlayer(a.pid)?.name ?? a.pid;
    const nB = findPlayer(b.pid)?.name ?? b.pid;
    return nA.localeCompare(nB, 'pt-BR', { sensitivity: 'base' });
  });

  // Duplas partnership stats
  type PairStat = { key: string; ids: [string, string]; wins: number; losses: number; played: number; gf: number; gc: number };
  const duplasStats: PairStat[] = [];
  if (isDuplas) {
    const map = new Map<string, PairStat>();
    comp.matches.filter(m => m.scoreA != null && m.teamA?.length === 2 && m.teamB?.length === 2).forEach(m => {
      const aWon = m.scoreA! > m.scoreB!;
      const keyA = [...m.teamA!].sort().join('|');
      const keyB = [...m.teamB!].sort().join('|');
      if (!map.has(keyA)) map.set(keyA, { key: keyA, ids: [...m.teamA!].sort() as [string, string], wins: 0, losses: 0, played: 0, gf: 0, gc: 0 });
      if (!map.has(keyB)) map.set(keyB, { key: keyB, ids: [...m.teamB!].sort() as [string, string], wins: 0, losses: 0, played: 0, gf: 0, gc: 0 });
      const gA = m.sets?.length ? m.sets.reduce((s, x) => s + x.a, 0) : m.scoreA!;
      const gB = m.sets?.length ? m.sets.reduce((s, x) => s + x.b, 0) : m.scoreB!;
      const sa = map.get(keyA)!;
      if (aWon) sa.wins++; else sa.losses++;
      sa.played++; sa.gf += gA; sa.gc += gB;
      const sb = map.get(keyB)!;
      if (!aWon) sb.wins++; else sb.losses++;
      sb.played++; sb.gf += gB; sb.gc += gA;
    });
    duplasStats.push(...[...map.values()].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const gaA = a.gc > 0 ? a.gf / a.gc : 0;
      const gaB = b.gc > 0 ? b.gf / b.gc : 0;
      return gaB - gaA;
    }));
  }

  return (
    <ScrollView contentContainerStyle={vw.scroll}>
        <Card style={vw.prog}>
          <View style={vw.progRow}>
            <Text style={vw.progLabel}>Progresso</Text>
            <Text style={vw.progCount}>{done}/{total} jogos</Text>
          </View>
          <View style={vw.track}>
            <View style={[vw.fill, { width: `${total ? done / total * 100 : 0}%` }]} />
          </View>
          {done === total && total > 0 && <Text style={vw.rei}>👑 Todos os jogos concluídos!</Text>}
        </Card>

        {false && (
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <View style={[stRow.row, stRow.header]}>
              <Text style={[stRow.c0, stRow.th]}>#</Text>
              <Text style={[stRow.cName, stRow.th]}>JOGADOR</Text>
              <Text style={[stRow.cN, stRow.th]}>J</Text>
              <Text style={[stRow.cN, stRow.th]}>V</Text>
              <Text style={[stRow.cNw, stRow.th]}>SG</Text>
              <Text style={[stRow.cN, stRow.th]}>GA</Text>
              <Text style={[stRow.cPts, stRow.th]}>PTS</Text>
            </View>
            {rankingStats.map((s, i) => {
              const pl = findPlayer(s.pid);
              const sgColor = s.sg > 0 ? Colors.teal : s.sg < 0 ? Colors.coral : Colors.muted;
              return (
                <View key={s.pid} style={[stRow.row, i < rankingStats.length - 1 && stRow.border]}>
                  <Text style={[stRow.c0, stRow.pos]}>{i + 1}</Text>
                  <View style={[stRow.cName, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
                    {pl && <Avatar name={pl.name} color={pl.color} size={20} />}
                    <Text style={stRow.name} numberOfLines={1}>{pl?.name ?? s.pid}</Text>
                  </View>
                  <Text style={stRow.cN}>{s.played}</Text>
                  <Text style={stRow.cN}>{s.wins}</Text>
                  <Text style={[stRow.cNw, { color: sgColor }]}>{s.sg > 0 ? '+' : ''}{s.sg}</Text>
                  <Text style={stRow.cN}>{s.ga.toFixed(2)}</Text>
                  <Text style={[stRow.cPts, { color: Colors.gold, fontFamily: FontFamily.numberBold }]}>
                    {s.pts.toFixed(2)}
                  </Text>
                </View>
              );
            })}
            {rankingStats.length > 0 && (
              <View style={stRow.legend}>
                <Text style={stRow.legendText}>GP: Games Pró · GC: Games Contra · SG: Saldo · GA: GP÷GC · PTS = V×3 + J×0,5 + GA×2</Text>
              </View>
            )}
          </Card>
        )}

        {false && (
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <View style={[stRow.row, stRow.header]}>
              {['#', 'DUPLA', 'J', 'V', '%'].map(h => (
                <Text key={h} style={[h === 'DUPLA' ? stRow.cName : h === '#' ? stRow.c0 : stRow.cN, stRow.th]}>{h}</Text>
              ))}
            </View>
            {duplasStats.length === 0 && (
              <View style={[stRow.row, { paddingVertical: Spacing.md }]}>
                <Text style={[stRow.cName, { color: Colors.faint, fontFamily: FontFamily.body, fontSize: 12 }]}>
                  Nenhum jogo registrado ainda.
                </Text>
              </View>
            )}
            {duplasStats.map((dp, i) => {
              const p0 = findPlayer(dp.ids[0]);
              const p1 = findPlayer(dp.ids[1]);
              const wr = dp.played > 0 ? Math.round(dp.wins / dp.played * 100) : 0;
              return (
                <View key={dp.key} style={[stRow.row, i < duplasStats.length - 1 && stRow.border]}>
                  <Text style={[stRow.c0, stRow.pos]}>{i + 1}</Text>
                  <View style={[stRow.cName, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                    <View style={{ flexDirection: 'row', gap: -6 }}>
                      {p0 && <Avatar name={p0.name} color={p0.color} size={22} />}
                      {p1 && <Avatar name={p1.name} color={p1.color} size={22} />}
                    </View>
                    <Text style={stRow.name} numberOfLines={1}>
                      {p0?.name.split(' ')[0] ?? '?'} & {p1?.name.split(' ')[0] ?? '?'}
                    </Text>
                  </View>
                  <Text style={stRow.cN}>{dp.played}</Text>
                  <Text style={stRow.cN}>{dp.wins}</Text>
                  <Text style={[stRow.cN, { color: wr >= 60 ? Colors.teal : wr >= 40 ? Colors.text : Colors.coral, fontFamily: FontFamily.numberBold }]}>
                    {wr}%
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {comp.matches.map((m, i) => (
          <GameRow key={m.id} match={m} index={i} comp={comp} isNext={m.id === nextId}
            onPress={() => onScore(m)}
            onLongPress={() => {
              if (m.scoreA != null) {
                onClear(m.id);
              } else if (onSubstitute) {
                const ids = [...(m.teamA ?? []), ...(m.teamB ?? [])].filter(Boolean);
                Alert.alert('Substituir jogador', 'Qual jogador deseja substituir?', [
                  { text: 'Cancelar', style: 'cancel' },
                  ...ids.slice(0, 5).map(pid => ({
                    text: findPlayer(pid)?.name ?? pid,
                    onPress: () => onSubstitute(m, pid),
                  })),
                ]);
              }
            }} />
        ))}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
  );
}

// ─── Classificação unificada ──────────────────────────────────────────────────
export function ClassificacaoView({ comp }: { comp: Competition }) {
  const { findPlayer } = useGroupPlayers();

  // Liga
  if (comp.format === 'liga') {
    return (
      <ScrollView contentContainerStyle={vw.scroll}>
        <StandingsTable comp={comp} ids={comp.competitors.map(c => c.id)} matches={comp.matches} />
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    );
  }

  // Grupos
  if (comp.format === 'grupos') {
    return (
      <ScrollView contentContainerStyle={vw.scroll}>
        {comp.groupDefs?.map((gd, gi) => (
          <View key={gi}>
            <Text style={vw.section}>{gd.name}</Text>
            <StandingsTable comp={comp} ids={gd.ids}
              matches={comp.matches.filter(m => m.stage === 'group' && m.groupIdx === gi)} />
          </View>
        ))}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    );
  }

  // Avulso / Super8 — ranking por jogador
  const playerIds = [...new Set(comp.matches.flatMap(m => [...(m.teamA ?? []), ...(m.teamB ?? [])]))];
  const rankingStats = playerIds.map(pid => {
    let wins = 0, losses = 0, gf = 0, gc = 0;
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreA === m.scoreB) return;
      const inA = m.teamA?.includes(pid), inB = m.teamB?.includes(pid);
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
    <ScrollView contentContainerStyle={vw.scroll}>
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <View style={[stRow.row, stRow.header]}>
          <Text style={[stRow.c0, stRow.th]}>#</Text>
          <Text style={[stRow.cName, stRow.th]}>JOGADOR</Text>
          <Text style={[stRow.cN, stRow.th]}>J</Text>
          <Text style={[stRow.cN, stRow.th]}>V</Text>
          <Text style={[stRow.cNw, stRow.th]}>SG</Text>
          <Text style={[stRow.cPts, stRow.th]}>PTS</Text>
        </View>
        {rankingStats.map((r, i) => {
          const pl = findPlayer(r.pid);
          const sg = r.gf - r.gc;
          const sgColor = sg > 0 ? Colors.teal : sg < 0 ? Colors.coral : Colors.muted;
          return (
            <View key={r.pid} style={[stRow.row, i < rankingStats.length - 1 && stRow.border]}>
              <Text style={[stRow.c0, stRow.pos]}>{i + 1}</Text>
              <View style={[stRow.cName, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                {pl && <Avatar name={pl.name} color={pl.color} size={22} />}
                <Text style={stRow.name} numberOfLines={1}>{pl?.name ?? r.pid}</Text>
              </View>
              <Text style={stRow.cN}>{r.played}</Text>
              <Text style={stRow.cN}>{r.wins}</Text>
              <Text style={[stRow.cNw, { color: sgColor }]}>{sg > 0 ? '+' : ''}{sg}</Text>
              <Text style={[stRow.cPts, { color: Colors.gold, fontFamily: FontFamily.numberBold }]}>{r.pts.toFixed(2)}</Text>
            </View>
          );
        })}
      </Card>
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

export function LeagueView({ comp, onScore, onClear, onSubstitute }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void; onSubstitute?: (match: Match, playerId: string) => void }) {
  const rounds = [...new Set(comp.matches.map(m => m.round))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const nextId = firstUnscored(comp.matches);
  return (
    <ScrollView contentContainerStyle={vw.scroll}>
      {rounds.map(r => (
        <View key={r}>
          <Text style={vw.section}>Rodada {r}</Text>
          {comp.matches.filter(m => m.round === r).map(m => (
            <MatchRow key={m.id} match={m} comp={comp} isNext={m.id === nextId}
              onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
          ))}
        </View>
      ))}
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

export function GroupsView({ comp, onScore, onClear }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void }) {
  const allGroupsDone = comp.status === 'done' ||
    (comp.groupDefs?.every((_, gi) => groupComplete(comp.matches, gi)) ?? false);
  const groupMatches = (gi: number) => comp.matches.filter(m => m.stage === 'group' && m.groupIdx === gi);
  const nextId = firstUnscored(comp.matches);
  const hasKO = comp.matches.some(m => m.stage === 'ko');

  return (
    <ScrollView contentContainerStyle={vw.scroll}>
      {/* Jogos por grupo */}
      {comp.groupDefs?.map((gd, gi) => (
        <View key={gi}>
          <Text style={vw.section}>{gd.name}</Text>
          {groupMatches(gi).map(m => (
            <MatchRow key={m.id} match={m} comp={comp} isNext={m.id === nextId}
              onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
          ))}
        </View>
      ))}

      {/* Mata-mata — sempre visível, com placeholders quando grupos ainda não terminaram */}
      {hasKO && (
        <View style={{ marginTop: Spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.xs }}>
            <Text style={vw.section}>⚔️ Mata-mata</Text>
            {!allGroupsDone && (
              <View style={{ backgroundColor: Colors.gold + '22', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: Colors.gold + '55' }}>
                <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold }}>PRÉVIA</Text>
              </View>
            )}
          </View>
          <KOView comp={comp} onScore={onScore} onClear={onClear} preview={!allGroupsDone} />
        </View>
      )}

      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

export function KOView({ comp, onScore, onClear, preview = false }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void; preview?: boolean }) {
  const [viewMode, setViewMode] = useState<'chave' | 'lista'>('chave');
  const koRounds = [...new Set(comp.matches.filter(m => m.stage === 'ko').map(m => m.koRound))]
    .sort((a, b) => (a ?? 0) - (b ?? 0));
  const nextId = firstUnscored(comp.matches.filter(m => m.stage === 'ko'));

  return (
    <View style={{ flex: 1 }}>
      <View style={tabs.bar}>
        {(['chave', 'lista'] as const).map(t => (
          <TouchableOpacity key={t} style={[tabs.tab, viewMode === t && tabs.active]} onPress={() => setViewMode(t)}>
            <Text style={[tabs.text, viewMode === t && tabs.textActive]}>
              {t === 'chave' ? '⚔️ Chaveamento' : '🎾 Jogos'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[tabs.tab, { flex: 0, paddingHorizontal: Spacing.md }]}
          onPress={() => Share.share({ message: buildBracketShareText(comp) }).catch(() => {})}
        >
          <Text style={[tabs.text, { fontSize: 16 }]}>↑</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'chave' && <BracketView comp={comp} onScore={onScore} onClear={onClear} />}

      {viewMode === 'lista' && (
        <ScrollView contentContainerStyle={vw.scroll}>
          {koRounds.map(r => {
            const rMatches = comp.matches.filter(m => m.koRound === r);
            const main  = rMatches.filter(m => !m.third);
            const third = rMatches.filter(m => m.third);
            const cnt = main[0]?.cnt ?? 0;
            return (
              <View key={r}>
                <Text style={vw.section}>{koRoundName(cnt)}</Text>
                {main.map(m => <MatchRow key={m.id} match={m} comp={comp} isNext={m.id === nextId}
                  onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />)}
                {third.map(m => (
                  <View key={m.id}>
                    <Text style={vw.section}>Disputa de 3º Lugar</Text>
                    <MatchRow match={m} comp={comp} isNext={m.id === nextId}
                      onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
                  </View>
                ))}
              </View>
            );
          })}
          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      )}
    </View>
  );
}
