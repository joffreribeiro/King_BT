import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { shareText, notifyCopied } from '@/services/share';
import { goToPlayer } from '@/logic/nav';
import { gameAverage } from '@/logic/scoring';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card, OptionModal } from '@/components';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Match, Competition } from '@/logic/types';
import { firstUnscored, buildBracketShareText, sgColor } from './helpers';
import { GameRow } from './GameRow';
import { MatchRow } from './MatchRow';
import { StandingsTable, stRow } from './StandingsTable';
import { BracketView } from './BracketView';
import { vw, tabs } from './viewStyles';

export function RotatingView({ comp, onScore, onClear, onSubstitute }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void; onSubstitute?: (match: Match, originalId: string, substituteId: string) => void }) {
  const { findPlayer, groupPlayers } = useGroupPlayers();
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;
  const nextId = firstUnscored(comp.matches);
  // Fluxo de substituição em 2 etapas num único modal persistente
  // (trocar de um Modal para outro no mesmo instante não é confiável na web)
  const [sub, setSub] = useState<{ match: Match; originalId?: string } | null>(null);

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

        {comp.matches.map((m, i) => (
          <GameRow key={m.id} match={m} index={i} comp={comp} isNext={m.id === nextId}
            onPress={() => onScore(m)}
            onLongPress={() => {
              if (m.scoreA != null) {
                onClear(m.id);
              } else if (onSubstitute) {
                setSub({ match: m });
              }
            }} />
        ))}

        <View style={{ height: Spacing.xl }} />

        {/* Substituição em 2 etapas — modal próprio porque Alert.alert não funciona na web */}
        {sub && onSubstitute && (
          <OptionModal
            title="Substituir jogador"
            message={sub.originalId
              ? `Escolha quem entra no lugar de ${findPlayer(sub.originalId)?.name ?? '?'}:`
              : 'Qual jogador deseja substituir?'}
            options={sub.originalId
              // Etapa 2: quem entra — jogadores do grupo fora da partida
              ? groupPlayers
                  .filter(p =>
                    p.id !== sub.originalId &&
                    !(sub.match.teamA ?? []).includes(p.id) &&
                    !(sub.match.teamB ?? []).includes(p.id))
                  .map(p => ({ key: p.id, label: p.name, avatarColor: p.color }))
              // Etapa 1: quem sai — jogadores da partida
              : [...(sub.match.teamA ?? []), ...(sub.match.teamB ?? [])]
                  .filter(Boolean)
                  .map(pid => {
                    const pl = findPlayer(pid);
                    return { key: pid, label: pl?.name ?? pid, avatarColor: pl?.color ?? Colors.gold };
                  })}
            onSelect={(pid) => {
              if (!sub.originalId) {
                setSub({ ...sub, originalId: pid }); // avança para etapa 2 sem fechar o modal
              } else {
                onSubstitute(sub.match, sub.originalId, pid);
                setSub(null);
              }
            }}
            onClose={() => setSub(null)}
          />
        )}
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
    const ga = gameAverage({ gamesPro: gf, gamesCon: gc });
    const pts = wins * 3 + played * 0.5 + ga * 2;
    return { pid, wins, losses, played, gf, gc, ga, pts };
  }).sort((a, b) => b.pts - a.pts);

  return (
    <ScrollView contentContainerStyle={vw.scroll}>
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <View style={[stRow.row, stRow.header]}>
          <Text style={[stRow.c0, stRow.th]}>#</Text>
          <Text style={[stRow.cName, stRow.th]}>JOGADOR</Text>
          <Text style={[stRow.cN, stRow.th]}>V</Text>
          <Text style={[stRow.cN, stRow.th]}>D</Text>
          <Text style={[stRow.cN, stRow.th]}>GP</Text>
          <Text style={[stRow.cN, stRow.th]}>GC</Text>
          <Text style={[stRow.cN, stRow.th]}>SG</Text>
          <Text style={[stRow.cNw, stRow.th]}>GA</Text>
          <Text style={[stRow.cPts, stRow.th]}>PTS</Text>
        </View>
        {rankingStats.map((r, i) => {
          const pl = findPlayer(r.pid);
          const sg = r.gf - r.gc;
          const winRate = r.played > 0 ? Math.round((r.wins / r.played) * 100) : 0;
          return (
            <View key={r.pid} style={[stRow.row, i < rankingStats.length - 1 && stRow.border]}>
              <Text style={[stRow.c0, stRow.pos]}>{i + 1}</Text>
              <TouchableOpacity
                style={[stRow.cName, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                onPress={() => pl && goToPlayer(r.pid)}
                disabled={!pl}
                activeOpacity={0.7}
              >
                {pl && <Avatar name={pl.name} color={pl.color} size={22} />}
                <View style={{ flex: 1 }}>
                  <Text style={stRow.name} numberOfLines={1}>{pl?.name ?? r.pid}</Text>
                  <Text style={stRow.meta}>{r.played}J · {winRate}% aprov.</Text>
                </View>
              </TouchableOpacity>
              <Text style={stRow.cN}>{r.wins}</Text>
              <Text style={stRow.cN}>{r.losses}</Text>
              <Text style={stRow.cN}>{r.gf}</Text>
              <Text style={stRow.cN}>{r.gc}</Text>
              <Text style={[stRow.cN, { color: sgColor(sg) }]}>{sg > 0 ? '+' : ''}{sg}</Text>
              <Text style={stRow.cNw} numberOfLines={1}>
                {r.ga >= 10 ? r.ga.toFixed(1) : r.ga.toFixed(2)}
              </Text>
              <Text style={[stRow.cPts, { color: Colors.gold, fontFamily: FontFamily.numberBold }]}>{r.pts.toFixed(2)}</Text>
            </View>
          );
        })}
        {/* Legenda */}
        <View style={stRow.legend}>
          <Text style={stRow.legendText}>V: Vitórias · D: Derrotas · GP: Games Pró · GC: Games Contra · SG: Saldo · GA: Game Average · PTS: Pontuação</Text>
        </View>
      </Card>
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

export function LeagueView({ comp, onScore, onClear, onSubstitute }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void; onSubstitute?: (match: Match, originalId: string, substituteId: string) => void }) {
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

// Fase de Grupos: classificação + jogos de cada grupo numa única aba
export function GroupsPhaseView({ comp, onScore, onClear }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void }) {
  const groupMatches = (gi: number) => comp.matches.filter(m => m.stage === 'group' && m.groupIdx === gi);
  const nextId = firstUnscored(comp.matches.filter(m => m.stage === 'group'));

  return (
    <ScrollView contentContainerStyle={vw.scroll}>
      {comp.groupDefs?.map((gd, gi) => (
        <View key={gi}>
          <Text style={vw.section}>{gd.name}</Text>
          <StandingsTable comp={comp} ids={gd.ids} matches={groupMatches(gi)} />
          {groupMatches(gi).map(m => (
            <MatchRow key={m.id} match={m} comp={comp} isNext={m.id === nextId}
              onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onClear(m.id) : undefined} />
          ))}
        </View>
      ))}
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

export function KOView({ comp, onScore, onClear, preview = false }: { comp: Competition; onScore: (m: Match) => void; onClear: (matchId: string) => void; preview?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      {/* Barra fina: título + compartilhar chaveamento */}
      <View style={tabs.bar}>
        <View style={[tabs.tab, { alignItems: 'flex-start', paddingHorizontal: Spacing.md }]}>
          <Text style={tabs.text}>⚔️ Chaveamento · toque no jogo para registrar</Text>
        </View>
        <TouchableOpacity
          style={[tabs.tab, { flex: 0, paddingHorizontal: Spacing.md }]}
          onPress={async () => {
            const result = await shareText(buildBracketShareText(comp));
            if (result === 'copied') notifyCopied('Chaveamento');
          }}
        >
          <Text style={[tabs.text, { fontSize: 16 }]}>↑</Text>
        </TouchableOpacity>
      </View>

      {/* Faixa de prévia enquanto a fase de grupos não termina */}
      {preview && (
        <View style={{ backgroundColor: Colors.gold + '15', borderBottomWidth: 1, borderBottomColor: Colors.gold + '33', paddingVertical: 6, paddingHorizontal: Spacing.md }}>
          <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold, letterSpacing: 1, textAlign: 'center' }}>
            PRÉVIA — AGUARDANDO CONCLUSÃO DOS GRUPOS
          </Text>
        </View>
      )}

      <BracketView comp={comp} onScore={onScore} onClear={onClear} />
    </View>
  );
}
