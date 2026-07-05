import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { goToPlayer } from '@/logic/nav';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { computeGroupRivalries } from '@/logic/rivalries';

export default function DashboardScreen() {
  const { state } = useCompetitions();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const { myPlayerId } = useAuth();

  // Saudação por hora
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const greetingEmoji = hour < 12 ? '☀️' : hour < 18 ? '👊' : '🌙';

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

  // Rivalidades do grupo (top 5 pares com mais confrontos)
  const groupRivalries = computeGroupRivalries(state.competitions).slice(0, 5);

  // Stats pessoais do usuário logado
  const myStats = myPlayerId ? ranking.find(r => r.id === myPlayerId) : null;
  const myPos = myPlayerId ? ranking.findIndex(r => r.id === myPlayerId) + 1 : 0;
  const myPlayer = myPlayerId ? findPlayer(myPlayerId) : null;

  // Próxima competição (status active com jogos pendentes)
  const nextComp = state.competitions.find(c =>
    c.status === 'active' && c.matches.some(m => m.scoreA == null)
  ) ?? state.competitions.find(c => c.status === 'upcoming');
  const nextCompDaysLeft = nextComp
    ? Math.max(0, Math.ceil((new Date(nextComp.date + 'T12:00:00').getTime() - Date.now()) / 86400000))
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* Saudação */}
        <View>
          <Text style={ds.greetingLine}>{greeting} {greetingEmoji}</Text>
          <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.text }}>
            Nosso grupo 👑
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
              <Text style={ds.statValue}>
                {(() => {
                  let streak = 0;
                  const pm = state.competitions.flatMap(c => c.matches)
                    .filter(m => m.scoreA != null && (
                      m.teamA?.includes(myPlayerId!) || m.teamB?.includes(myPlayerId!) ||
                      m.aId === myPlayerId || m.bId === myPlayerId
                    ));
                  for (let i = pm.length - 1; i >= 0; i--) {
                    const m = pm[i];
                    const inA = m.teamA?.includes(myPlayerId!) || m.aId === myPlayerId;
                    const won = inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
                    if (won) streak++; else break;
                  }
                  return streak;
                })()}
              </Text>
              <Text style={ds.statLabel}>SEQUÊNCIA</Text>
              <Text style={[ds.statSub, { color: Colors.teal }]}>🔥 vitórias</Text>
            </View>
            <View style={ds.statCard}>
              <Text style={ds.statValue}>{myPos > 0 ? `${myPos}°` : '—'}</Text>
              <Text style={ds.statLabel}>POSIÇÃO</Text>
              <Text style={[ds.statSub, { color: myPos <= 3 ? Colors.gold : Colors.muted }]}>
                {myPos === 1 ? '👑 líder' : myPos <= 3 ? '🏅 top 3' : `de ${ranking.length}`}
              </Text>
            </View>
          </View>
        )}

        {/* Card próxima partida */}
        {nextComp && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push({ pathname: '/competitions/[id]', params: { id: nextComp.id } })}
            style={ds.nextCard}
          >
            <View style={{ flex: 1 }}>
              <Text style={ds.nextLabel}>PRÓXIMA PARTIDA</Text>
              <Text style={ds.nextName} numberOfLines={1}>{nextComp.name}</Text>
              <Text style={ds.nextMeta}>
                {new Date(nextComp.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                {' · '}{nextComp.status === 'active' ? 'Em andamento' : 'Agendada'}
              </Text>
            </View>
            <View style={ds.nextBadge}>
              <Text style={ds.nextBadgeText}>
                {nextCompDaysLeft === 0 ? 'hoje' : `${nextCompDaysLeft}d`}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Barra W/L pessoal */}
        {myStats && myStats.played > 0 && (
          <View style={ds.wlWrap}>
            <View style={ds.wlLabels}>
              <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.teal }}>
                {myStats.wins}V
              </Text>
              <Text style={{ fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted }}>
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
            <Text style={{ fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted,
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

        {/* Rivalidades do grupo */}
        {groupRivalries.length > 0 && (
          <Card>
            <Text style={{ fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted,
              marginBottom: Spacing.sm, letterSpacing: 1.5 }}>RIVALIDADES DO GRUPO ⚔️</Text>
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
                      <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.text }} numberOfLines={1}>
                        {pA.name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>

                    <View style={{ alignItems: 'center', gap: 1 }}>
                      <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.text }}>
                        <Text style={{ color: rv.winsA >= rv.winsB ? Colors.teal : Colors.muted }}>{rv.winsA}</Text>
                        <Text style={{ color: Colors.faint }}> × </Text>
                        <Text style={{ color: rv.winsB > rv.winsA ? Colors.teal : Colors.muted }}>{rv.winsB}</Text>
                      </Text>
                      <Text style={{ fontFamily: FontFamily.number, fontSize: 10, color: Colors.faint }}>
                        {rv.played} confrontos
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}
                      onPress={() => goToPlayer(rv.idB)}
                      activeOpacity={0.75}
                    >
                      <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.text }} numberOfLines={1}>
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
                  onPress={() => goToPlayer(r.id)}
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

        {/* Hall dos Campeões */}
        <TouchableOpacity
          onPress={() => router.push('/hall')}
          activeOpacity={0.8}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: 'rgba(243,197,68,0.08)', borderWidth: 1,
            borderColor: 'rgba(243,197,68,0.22)', borderRadius: 12, padding: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 22 }}>👑</Text>
            <View>
              <Text style={{ fontFamily: FontFamily.title, fontSize: 14, color: Colors.gold }}>Hall dos Campeões</Text>
              <Text style={{ fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted }}>
                {state.competitions.filter(c => c.status === 'done').length} competições encerradas
              </Text>
            </View>
          </View>
          <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.gold }}>›</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const ds = StyleSheet.create({
  greetingLine: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#6E6452',
    marginBottom: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#16140F',
    borderWidth: 1,
    borderColor: 'rgba(243,197,68,0.15)',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FontFamily.titleBold,
    fontSize: 16,
    color: '#F3C544',
    fontWeight: '700',
  },
  statLabel: {
    fontFamily: FontFamily.numberBold,
    fontSize: 8,
    color: '#6E6452',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statSub: {
    fontFamily: FontFamily.numberBold,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107,127,215,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(107,127,215,0.25)',
    borderRadius: 12,
    padding: 12,
  },
  nextLabel: {
    fontFamily: FontFamily.numberBold,
    fontSize: 8,
    color: '#6B7FD7',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  nextName: {
    fontFamily: FontFamily.title,
    fontSize: 13,
    color: Colors.text,
    fontWeight: '700',
  },
  nextMeta: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: '#A99B7C',
    marginTop: 2,
  },
  nextBadge: {
    backgroundColor: 'rgba(107,127,215,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(107,127,215,0.35)',
    marginLeft: 12,
  },
  nextBadgeText: {
    fontFamily: FontFamily.numberBold,
    fontSize: 13,
    color: '#6B7FD7',
    fontWeight: '700',
  },
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
    backgroundColor: '#221C12',
    borderRadius: 3,
    overflow: 'hidden',
  },
  wlFill: {
    height: 5,
    backgroundColor: Colors.teal,
    borderRadius: 3,
  },
});
