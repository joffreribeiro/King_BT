import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { shareText, notifyCopied } from '@/services/share';
import { goToPlayer } from '@/logic/nav';
import { buildRanking } from '@/logic/scoring';
import { extractCompetitionGames } from '@/logic/formats';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Card, OptionModal, Icon } from '@/components';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useSettings } from '@/store/SettingsContext';
import type { Match, Competition } from '@/logic/types';
import { firstUnscored, buildBracketShareText } from './helpers';
import { GameRow } from './GameRow';
import { MatchRow } from './MatchRow';
import { StandingsTable, StandingRow, StandingsHeader, StandingsLegend } from './StandingsTable';
import { BracketView } from './BracketView';
import { makeVw, makeTabs } from './viewStyles';

export function RotatingView({ comp, onScore, onMatchActions, onSubstitute }: { comp: Competition; onScore: (m: Match) => void; onMatchActions: (matchId: string) => void; onSubstitute?: (match: Match, originalId: string, substituteId: string) => void }) {
  const { findPlayer, groupPlayers } = useGroupPlayers();
  const { colors: Colors } = useTheme();
  const vw = useMemo(() => makeVw(Colors), [Colors]);
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;
  const nextId = firstUnscored(comp.matches);
  // Fluxo de substituição em 2 etapas num único modal persistente
  // (trocar de um Modal para outro no mesmo instante não é confiável na web)
  const [sub, setSub] = useState<{ match: Match; originalId?: string } | null>(null);

  return (
    <ScrollView contentContainerStyle={vw.scroll}>
        <PlayerRankingTable comp={comp} />

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
                onMatchActions(m.id);
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

// ─── Ranking por jogador (Avulso / Super8) — fonte única: buildRanking ───────
// Componente "plano" (sem ScrollView próprio) para compor com a lista de jogos
// numa única aba, como já se faz em GroupsPhaseView com StandingsTable.
export function PlayerRankingTable({ comp }: { comp: Competition }) {
  const { findPlayer } = useGroupPlayers();
  const { scoringConfig } = useSettings();
  const { colors: Colors } = useTheme();

  const playerIds = [...new Set(comp.matches.flatMap(m => [...(m.teamA ?? []), ...(m.teamB ?? [])]))];
  const players = playerIds.map(pid => {
    const pl = findPlayer(pid);
    return pl
      ? { id: pl.id, name: pl.name, short: pl.name.slice(0, 3), color: pl.color }
      : { id: pid, name: pid, short: pid, color: Colors.gold };
  });
  const rankingStats = buildRanking(players, extractCompetitionGames(comp), scoringConfig);

  if (rankingStats.length === 0) return null;

  return (
    <Card padding={0} style={{ overflow: 'hidden', marginBottom: Spacing.sm }}>
      <StandingsHeader />
      {rankingStats.map((r, i) => {
        const pl = findPlayer(r.id);
        return (
          <StandingRow
            key={r.id}
            pos={i + 1}
            name={pl?.name ?? r.id}
            color={pl?.color ?? Colors.gold}
            played={r.played}
            wins={r.wins}
            losses={r.losses}
            gp={r.gamesPro}
            gc={r.gamesCon}
            sg={r.sg}
            ga={r.ga}
            pts={r.points}
            last={i === rankingStats.length - 1}
            onPress={pl ? () => goToPlayer(r.id) : undefined}
          />
        );
      })}
      <StandingsLegend />
    </Card>
  );
}

export function LeagueView({ comp, onScore, onMatchActions, onSubstitute }: { comp: Competition; onScore: (m: Match) => void; onMatchActions: (matchId: string) => void; onSubstitute?: (match: Match, originalId: string, substituteId: string) => void }) {
  const { colors: Colors } = useTheme();
  const vw = useMemo(() => makeVw(Colors), [Colors]);
  const rounds = [...new Set(comp.matches.map(m => m.round))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const nextId = firstUnscored(comp.matches);
  return (
    <ScrollView contentContainerStyle={vw.scroll}>
      <StandingsTable comp={comp} ids={comp.competitors.map(c => c.id)} matches={comp.matches} />

      {rounds.map(r => (
        <View key={r}>
          <Text style={vw.section}>Rodada {r}</Text>
          {comp.matches.filter(m => m.round === r).map(m => (
            <MatchRow key={m.id} match={m} comp={comp} isNext={m.id === nextId}
              onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onMatchActions(m.id) : undefined} />
          ))}
        </View>
      ))}
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

// Fase de Grupos: classificação + jogos de cada grupo numa única aba
export function GroupsPhaseView({ comp, onScore, onMatchActions }: { comp: Competition; onScore: (m: Match) => void; onMatchActions: (matchId: string) => void }) {
  const { colors: Colors } = useTheme();
  const vw = useMemo(() => makeVw(Colors), [Colors]);
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
              onPress={() => onScore(m)} onLongPress={m.scoreA != null ? () => onMatchActions(m.id) : undefined} />
          ))}
        </View>
      ))}
      <View style={{ height: Spacing.xl }} />
    </ScrollView>
  );
}

export function KOView({ comp, onScore, onMatchActions, preview = false }: { comp: Competition; onScore: (m: Match) => void; onMatchActions: (matchId: string) => void; preview?: boolean }) {
  const { scoringConfig } = useSettings();
  const { colors: Colors } = useTheme();
  const tabs = useMemo(() => makeTabs(Colors), [Colors]);
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
            const result = await shareText(buildBracketShareText(comp, scoringConfig));
            if (result === 'copied') notifyCopied('Chaveamento');
          }}
        >
          <Icon name="arrowUp" size={14} color={Colors.gold} />
        </TouchableOpacity>
      </View>

      {/* Faixa de prévia enquanto a fase de grupos não termina */}
      {preview && (
        <View style={{ backgroundColor: Colors.gold + '15', borderBottomWidth: 1, borderBottomColor: Colors.gold + '33', paddingVertical: 6, paddingHorizontal: Spacing.md }}>
          <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.gold, letterSpacing: 1, textAlign: 'center' }}>
            PRÉVIA — AGUARDANDO CONCLUSÃO DOS GRUPOS
          </Text>
        </View>
      )}

      <BracketView comp={comp} onScore={onScore} onMatchActions={onMatchActions} />
    </View>
  );
}
