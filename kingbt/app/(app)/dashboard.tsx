import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { goToPlayer } from '@/logic/nav';
import { FontFamily, Spacing, Radius, type ThemeColors, PODIUM_COLORS } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Avatar, Card, Icon } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import { useSettings } from '@/store/SettingsContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { computeGroupRivalries } from '@/logic/rivalries';
import type { Match } from '@/logic/types';

/**
 * Sequência de vitórias atual do jogador. Antes esta conta existia duas vezes
 * — uma aqui em cima e outra embutida no JSX do card de stats — e percorria os
 * jogos na ordem em que aparecem no array das competições, então "5 vitórias
 * seguidas" podia não ser as 5 últimas partidas de verdade. Agora é uma função
 * só, ordenada por `playedAt` (jogo sem data conta como mais antigo).
 */
function currentStreak(playerId: string, matches: Match[]): number {
  const mine = matches
    .filter(m =>
      m.teamA?.includes(playerId) || m.teamB?.includes(playerId) ||
      m.aId === playerId || m.bId === playerId
    )
    .sort((a, b) => (a.playedAt ?? '').localeCompare(b.playedAt ?? ''));
  let streak = 0;
  for (let i = mine.length - 1; i >= 0; i--) {
    const m = mine[i];
    const inA = m.teamA?.includes(playerId) || m.aId === playerId;
    const won = inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
    if (won) streak++; else break;
  }
  return streak;
}

export default function DashboardScreen() {
  const { colors: Colors } = useTheme();
  const ds = useMemo(() => makeDsStyles(Colors), [Colors]);
  const { state } = useCompetitions();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const { myPlayerId } = useAuth();
  const { scoringConfig } = useSettings();

  // Saudação por hora
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const allMatches = state.competitions.flatMap(c => c.matches);
  const playedMatches = allMatches.filter(m => m.scoreA != null && m.scoreB != null);
  const totalGames = playedMatches.length;
  const totalComps = state.competitions.length;
  const doneComps = state.competitions.filter(c => c.status === 'done').length;

  const allGames = state.competitions.flatMap(extractPlayerGames);
  const rankPlayers = groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color, handicap: p.handicap }));
  const ranking = buildRanking(rankPlayers, allGames, scoringConfig);
  const mostActive = [...ranking].sort((a, b) => b.played - a.played)[0];
  const mostActivePlayer = mostActive ? findPlayer(mostActive.id) : null;

  // Sequência de vitórias ativa por jogador
  let longestStreak = { id: '', streak: 0 };
  groupPlayers.forEach(player => {
    const streak = currentStreak(player.id, playedMatches);
    if (streak > longestStreak.streak) longestStreak = { id: player.id, streak };
  });
  const streakPlayer = longestStreak.id ? findPlayer(longestStreak.id) : null;

  // Jogo mais disputado (menor diferença de games)
  const gamesOf = (m: Match) => ({
    a: m.sets?.length ? m.sets.reduce((s, x) => s + x.a, 0) : m.scoreA!,
    b: m.sets?.length ? m.sets.reduce((s, x) => s + x.b, 0) : m.scoreB!,
  });
  const closest = [...playedMatches]
    .filter(m => m.scoreA != null && m.scoreB != null)
    .sort((a, b) => {
      const ga = gamesOf(a), gb = gamesOf(b);
      return Math.abs(ga.a - ga.b) - Math.abs(gb.a - gb.b);
    })[0];
  const closestGames = closest ? gamesOf(closest) : null;
  const closestComp = closest
    ? state.competitions.find(c => c.matches.some(m => m.id === closest.id))
    : null;

  // Rivalidades do grupo (top 5 pares com mais confrontos)
  const groupRivalries = computeGroupRivalries(state.competitions).slice(0, 5);

  // Stats pessoais do usuário logado
  const myStats = myPlayerId ? ranking.find(r => r.id === myPlayerId) : null;
  const myPos = myPlayerId ? ranking.findIndex(r => r.id === myPlayerId) + 1 : 0;
  const myPlayer = myPlayerId ? findPlayer(myPlayerId) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* Saudação */}
        <View>
          <Text style={ds.greetingLine}>{greeting}</Text>
          <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.text }}>
            Nosso grupo
          </Text>
        </View>

        {/* Strip de 3 stats pessoais */}
        {myStats && (
          <View style={ds.statsRow}>
            <View style={ds.statCard}>
              <Text style={ds.statValue}>{myStats.points.toFixed(1)}</Text>
              <Text style={ds.statLabel}>RATING</Text>
              <Text style={[ds.statSub, { color: Colors.gold }]}>pts King BT</Text>
            </View>
            <View style={ds.statCard}>
              <Text style={ds.statValue}>{currentStreak(myPlayerId!, playedMatches)}</Text>
              <Text style={ds.statLabel}>SEQUÊNCIA</Text>
              <Text style={[ds.statSub, { color: Colors.teal }]}>vitórias</Text>
            </View>
            <View style={ds.statCard}>
              <Text style={ds.statValue}>{myPos > 0 ? `${myPos}°` : '—'}</Text>
              <Text style={ds.statLabel}>POSIÇÃO</Text>
              <Text style={[ds.statSub, { color: myPos <= 3 ? Colors.gold : Colors.muted }]}>
                {myPos === 1 ? 'líder' : myPos <= 3 ? 'top 3' : `de ${ranking.length}`}
              </Text>
            </View>
          </View>
        )}


        {/* Barra W/L pessoal */}
        {myStats && myStats.played > 0 && (
          <View style={ds.wlWrap}>
            <View style={ds.wlLabels}>
              <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.teal }}>
                {myStats.wins}V
              </Text>
              <Text style={{ fontFamily: FontFamily.number, fontSize: 11, color: Colors.muted }}>
                {Math.round((myStats.wins / myStats.played) * 100)}% aproveit.
              </Text>
              <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.coral }}>
                {myStats.losses}D
              </Text>
            </View>
            <View style={ds.wlTrack}>
              <View style={[ds.wlFill, { width: `${(myStats.wins / myStats.played) * 100}%` as any }]} />
            </View>
          </View>
        )}

        {/* Números gerais */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {[
            { label: 'Partidas', value: totalGames, color: Colors.text },
            { label: 'Torneios', value: totalComps, color: Colors.gold },
            { label: 'Concluídos', value: doneComps, color: Colors.teal },
          ].map(stat => (
            <Card key={stat.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 28, color: stat.color }}>
                {stat.value}
              </Text>
              <Text style={{ fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted }}>
                {stat.label}
              </Text>
            </Card>
          ))}
        </View>

        {/* Jogador mais ativo */}
        {mostActivePlayer && mostActive.played > 0 && (
          <Card>
            <Text style={{ fontFamily: FontFamily.number, fontSize: 11, color: Colors.muted,
              marginBottom: Spacing.sm, letterSpacing: 1.5 }}>MAIS ATIVO DO GRUPO</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}
              onPress={() => goToPlayer(mostActive.id)}
              activeOpacity={0.75}
            >
              <Avatar name={mostActivePlayer.name} color={mostActivePlayer.color} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text }}>
                  {mostActivePlayer.name}
                </Text>
                <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted }}>
                  {mostActive.played} partidas disputadas
                </Text>
              </View>
            </TouchableOpacity>
          </Card>
        )}

        {/* Sequência ativa */}
        {streakPlayer && longestStreak.streak >= 2 && (
          <Card style={{ borderColor: Colors.gold + '44', borderWidth: 1 }}>
            <Text style={{ fontFamily: FontFamily.number, fontSize: 11, color: Colors.muted,
              marginBottom: Spacing.sm, letterSpacing: 1.5 }}>SEQUÊNCIA ATIVA</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}
              onPress={() => goToPlayer(longestStreak.id)}
              activeOpacity={0.75}
            >
              <Avatar name={streakPlayer.name} color={streakPlayer.color} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text }}>
                  {streakPlayer.name}
                </Text>
                <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted }}>
                  {longestStreak.streak} vitórias seguidas
                </Text>
              </View>
              <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.gold }}>
                {longestStreak.streak}
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Jogo mais disputado */}
        {closest && closestComp && closestGames && (
          <Card>
            <Text style={{ fontFamily: FontFamily.number, fontSize: 11, color: Colors.muted,
              marginBottom: Spacing.sm, letterSpacing: 1.5 }}>JOGO MAIS DISPUTADO</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.text }}>
                <Text style={{ color: Colors.teal }}>{closestGames.a}</Text>
                <Text style={{ color: Colors.faint }}> – </Text>
                <Text style={{ color: Colors.coral }}>{closestGames.b}</Text>
              </Text>
              <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, flex: 1 }}>
                em {closestComp.name}
              </Text>
            </View>
          </Card>
        )}

        {/* Rivalidades do grupo */}
        {groupRivalries.length > 0 && (
          <Card>
            <Text style={{ fontFamily: FontFamily.number, fontSize: 11, color: Colors.muted,
              marginBottom: Spacing.sm, letterSpacing: 1.5 }}>RIVALIDADES DO GRUPO</Text>
            {groupRivalries.map((rv, i) => {
              const pA = findPlayer(rv.idA);
              const pB = findPlayer(rv.idB);
              if (!pA || !pB) return null;
              const total = rv.winsA + rv.winsB;
              const pctA = total > 0 ? rv.winsA / total : 0.5;
              return (
                <View key={`${rv.idA}|${rv.idB}`} style={{
                  paddingVertical: Spacing.sm,
                  borderBottomWidth: i < groupRivalries.length - 1 ? 1 : 0,
                  borderBottomColor: Colors.line,
                  gap: Spacing.xs,
                }}>
                  {/* Nomes e placar */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                      onPress={() => goToPlayer(rv.idA)}
                      activeOpacity={0.75}
                    >
                      <Avatar name={pA.name} color={pA.color} size={28} />
                      <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text }} numberOfLines={1}>
                        {pA.name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>

                    <View style={{ alignItems: 'center', gap: 1 }}>
                      <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 17, color: Colors.text }}>
                        <Text style={{ color: rv.winsA >= rv.winsB ? Colors.teal : Colors.muted }}>{rv.winsA}</Text>
                        <Text style={{ color: Colors.faint }}> × </Text>
                        <Text style={{ color: rv.winsB > rv.winsA ? Colors.teal : Colors.muted }}>{rv.winsB}</Text>
                      </Text>
                      <Text style={{ fontFamily: FontFamily.number, fontSize: 11, color: Colors.faint }}>
                        {rv.played} confrontos
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}
                      onPress={() => goToPlayer(rv.idB)}
                      activeOpacity={0.75}
                    >
                      <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text }} numberOfLines={1}>
                        {pB.name.split(' ')[0]}
                      </Text>
                      <Avatar name={pB.name} color={pB.color} size={28} />
                    </TouchableOpacity>
                  </View>

                  {/* Barra de dominância */}
                  <View style={{ height: 4, backgroundColor: Colors.line, borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${pctA * 100}%`,
                      backgroundColor: pA.color,
                      borderRadius: 2,
                    }} />
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {/* Ranking resumido */}
        {ranking.length > 0 && (
          <Card>
            <Text style={{ fontFamily: FontFamily.number, fontSize: 11, color: Colors.muted,
              marginBottom: Spacing.sm, letterSpacing: 1.5 }}>TOP 3 RANKING</Text>
            {ranking.slice(0, 3).map((r, i) => {
              const pl = findPlayer(r.id);
              const podium = PODIUM_COLORS;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                    paddingVertical: 6, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: Colors.line }}
                  onPress={() => goToPlayer(r.id)}
                  activeOpacity={0.75}
                >
                  <View style={ds.podiumPos}>
                    <Text style={[ds.podiumNum, { color: podium[i] }]}>{i + 1}</Text>
                  </View>
                  <Avatar name={pl?.name ?? '?'} color={pl?.color ?? '#888'} size={32} />
                  <Text style={{ flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text }}>
                    {pl?.name ?? r.id}
                  </Text>
                  <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 15, color: Colors.gold }}>
                    {r.points.toFixed(2)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Card>
        )}

        {/* Hall dos Campeões */}
        <TouchableOpacity
          onPress={() => router.push('/hall')}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: Colors.gold + '14', borderWidth: 1,
            borderColor: Colors.gold + '38', borderRadius: 12, padding: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="crown" size={20} color={Colors.gold} />
            <View>
              <Text style={{ fontFamily: FontFamily.title, fontSize: 15, color: Colors.gold }}>Hall dos Campeões</Text>
              <Text style={{ fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted }}>
                {state.competitions.filter(c => c.status === 'done').length} competições encerradas
              </Text>
            </View>
          </View>
          <Icon name="chevronRight" size={18} color={Colors.gold} />
        </TouchableOpacity>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeDsStyles = (Colors: ThemeColors) => StyleSheet.create({
  greetingLine: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.faint,
    marginBottom: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surf,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FontFamily.titleBold,
    fontSize: 17,
    color: Colors.gold,
    fontWeight: '700',
  },
  statLabel: {
    fontFamily: FontFamily.numberBold,
    fontSize: 9,
    color: Colors.faint,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statSub: {
    fontFamily: FontFamily.numberBold,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
  },
  podiumPos: { width: 28, height: 22, alignItems: 'center', justifyContent: 'center' },
  podiumNum: { fontFamily: FontFamily.numberBold, fontSize: 15 },
  wlWrap: {
    gap: 6,
  },
  wlLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wlTrack: {
    height: 5,
    backgroundColor: Colors.surf2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  wlFill: {
    height: 5,
    backgroundColor: Colors.teal,
    borderRadius: 3,
  },
});
