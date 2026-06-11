import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';

export default function DashboardScreen() {
  const { state } = useCompetitions();
  const { groupPlayers, findPlayer } = useGroupPlayers();

  const allMatches = state.competitions.flatMap(c => c.matches);
  const playedMatches = allMatches.filter(m => m.scoreA != null && m.scoreB != null);
  const totalGames = playedMatches.length;
  const totalComps = state.competitions.length;
  const doneComps = state.competitions.filter(c => c.status === 'done').length;

  const allGames = state.competitions.flatMap(extractPlayerGames);
  const rankPlayers = groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color, handicap: p.handicap }));
  const ranking = buildRanking(rankPlayers, allGames);
  const mostActive = [...ranking].sort((a, b) => b.played - a.played)[0];
  const mostActivePlayer = mostActive ? findPlayer(mostActive.id) : null;

  // Sequência de vitórias ativa por jogador
  let longestStreak = { id: '', streak: 0 };
  groupPlayers.forEach(player => {
    const playerMatches = playedMatches
      .filter(m =>
        m.teamA?.includes(player.id) || m.teamB?.includes(player.id) ||
        m.aId === player.id || m.bId === player.id
      );
    let streak = 0;
    for (let i = playerMatches.length - 1; i >= 0; i--) {
      const m = playerMatches[i];
      const inA = m.teamA?.includes(player.id) || m.aId === player.id;
      const won = inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
      if (won) streak++; else break;
    }
    if (streak > longestStreak.streak) longestStreak = { id: player.id, streak };
  });
  const streakPlayer = longestStreak.id ? findPlayer(longestStreak.id) : null;

  // Maior rivalidade (par com mais confrontos diretos)
  const h2hMap: Record<string, number> = {};
  playedMatches.forEach(m => {
    const idA = m.aId ?? m.teamA?.[0];
    const idB = m.bId ?? m.teamB?.[0];
    if (!idA || !idB) return;
    const key = [idA, idB].sort().join('|');
    h2hMap[key] = (h2hMap[key] ?? 0) + 1;
  });
  const topRivalry = Object.entries(h2hMap).sort((a, b) => b[1] - a[1])[0];
  const rivalIds = topRivalry?.[0].split('|') ?? [];
  const rival0 = rivalIds[0] ? findPlayer(rivalIds[0]) : null;
  const rival1 = rivalIds[1] ? findPlayer(rivalIds[1]) : null;

  // Jogo mais disputado (menor diferença de placar)
  const closest = [...playedMatches]
    .filter(m => m.scoreA != null && m.scoreB != null)
    .sort((a, b) => Math.abs(a.scoreA! - a.scoreB!) - Math.abs(b.scoreA! - b.scoreB!))[0];
  const closestComp = closest
    ? state.competitions.find(c => c.matches.some(m => m.id === closest.id))
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.text }}>
          Nosso grupo 👑
        </Text>

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
            <Text style={{ fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted,
              marginBottom: Spacing.sm, letterSpacing: 1.5 }}>MAIS ATIVO DO GRUPO</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}
              onPress={() => router.push({ pathname: '/player/[id]', params: { id: mostActive.id } })}
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
              <Text style={{ fontSize: 24 }}>🏃</Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Sequência ativa */}
        {streakPlayer && longestStreak.streak >= 2 && (
          <Card style={{ borderColor: Colors.gold + '44', borderWidth: 1 }}>
            <Text style={{ fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted,
              marginBottom: Spacing.sm, letterSpacing: 1.5 }}>SEQUÊNCIA ATIVA 🔥</Text>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}
              onPress={() => router.push({ pathname: '/player/[id]', params: { id: longestStreak.id } })}
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
                {longestStreak.streak}🏆
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Maior rivalidade */}
        {rival0 && rival1 && topRivalry && (
          <Card>
            <Text style={{ fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted,
              marginBottom: Spacing.sm, letterSpacing: 1.5 }}>MAIOR RIVALIDADE ⚔️</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Avatar name={rival0.name} color={rival0.color} size={40} />
                <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.text }}>
                  {rival0.name.split(' ')[0]}
                </Text>
              </View>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.faint }}>vs</Text>
                <Text style={{ fontFamily: FontFamily.number, fontSize: 11, color: Colors.muted }}>
                  {topRivalry[1]} confrontos
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Avatar name={rival1.name} color={rival1.color} size={40} />
                <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.text }}>
                  {rival1.name.split(' ')[0]}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Jogo mais disputado */}
        {closest && closestComp && (
          <Card>
            <Text style={{ fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted,
              marginBottom: Spacing.sm, letterSpacing: 1.5 }}>JOGO MAIS DISPUTADO 🎯</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.text }}>
                <Text style={{ color: Colors.teal }}>{closest.scoreA}</Text>
                <Text style={{ color: Colors.faint }}> – </Text>
                <Text style={{ color: Colors.coral }}>{closest.scoreB}</Text>
              </Text>
              <Text style={{ fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, flex: 1 }}>
                em {closestComp.name}
              </Text>
            </View>
          </Card>
        )}

        {/* Ranking resumido */}
        {ranking.length > 0 && (
          <Card>
            <Text style={{ fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted,
              marginBottom: Spacing.sm, letterSpacing: 1.5 }}>TOP 3 RANKING</Text>
            {ranking.slice(0, 3).map((r, i) => {
              const pl = findPlayer(r.id);
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <TouchableOpacity
                  key={r.id}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
                    paddingVertical: 6, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: Colors.line }}
                  onPress={() => router.push({ pathname: '/player/[id]', params: { id: r.id } })}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontSize: 20, width: 28 }}>{medals[i]}</Text>
                  <Avatar name={pl?.name ?? '?'} color={pl?.color ?? '#888'} size={32} />
                  <Text style={{ flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text }}>
                    {pl?.name ?? r.id}
                  </Text>
                  <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 14, color: Colors.gold }}>
                    {r.points.toFixed(2)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Card>
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}
