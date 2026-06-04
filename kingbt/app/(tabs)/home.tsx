import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card, KingBTLogo } from '@/components';
import { PLAYERS, SESSIONS, SEASON_STATS, GROUP } from '@/mocks/data';

const TOP3 = SEASON_STATS.slice(0, 3);
const CURRENT_PLAYER = SEASON_STATS[0]; // Joffre (usuário logado no mock)
const LAST_SESSIONS = [...SESSIONS].reverse().slice(0, 3);

function getPlayer(id: string) {
  return PLAYERS.find(p => p.id === id)!;
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function HomeScreen() {
  const myPos = SEASON_STATS.findIndex(s => s.id === CURRENT_PLAYER.id) + 1;
  const myPlayer = getPlayer(CURRENT_PLAYER.id);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <KingBTLogo size="md" showTagline />
          <View style={styles.location}>
            <Text style={styles.locationText}>📍 {GROUP.location}</Text>
          </View>
        </View>

        {/* Minha posição */}
        <Card style={styles.myCard} elevated>
          <View style={styles.myRow}>
            <Avatar name={myPlayer.name} color={myPlayer.color} size={52} showCrown={myPos === 1} />
            <View style={styles.myInfo}>
              <Text style={styles.myName}>{myPlayer.name}</Text>
              <Text style={styles.myTitle}>{myPlayer.titleEmoji} {myPlayer.title}</Text>
            </View>
            <View style={styles.myStats}>
              <Text style={styles.myPts}>{CURRENT_PLAYER.points.toFixed(2)}</Text>
              <Badge label={`${myPos}°`} variant="gold" />
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{CURRENT_PLAYER.wins}</Text>
              <Text style={styles.statLabel}>vitórias</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statVal}>{CURRENT_PLAYER.played}</Text>
              <Text style={styles.statLabel}>partidas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statVal, { color: CURRENT_PLAYER.sg >= 0 ? Colors.teal : Colors.coral }]}>
                {CURRENT_PLAYER.sg >= 0 ? '+' : ''}{CURRENT_PLAYER.sg}
              </Text>
              <Text style={styles.statLabel}>saldo</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statVal}>{CURRENT_PLAYER.ga.toFixed(2)}</Text>
              <Text style={styles.statLabel}>GA</Text>
            </View>
          </View>
        </Card>

        {/* Top 3 do ranking */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏆 Top 3 da Temporada</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/ranking')}>
            <Text style={styles.seeAll}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        <Card>
          {TOP3.map((s, i) => {
            const pl = getPlayer(s.id);
            const medals = ['🥇', '🥈', '🥉'];
            return (
              <View key={s.id} style={[styles.rankRow, i < 2 && styles.rankRowBorder]}>
                <Text style={styles.medal}>{medals[i]}</Text>
                <Avatar name={pl.name} color={pl.color} size={36} />
                <View style={styles.rankInfo}>
                  <Text style={styles.rankName}>{pl.name}</Text>
                  <Text style={styles.rankSub}>V:{s.wins} | J:{s.played} | GA:{s.ga.toFixed(2)}</Text>
                </View>
                <Text style={styles.rankPts}>{s.points.toFixed(2)}</Text>
              </View>
            );
          })}
        </Card>

        {/* Últimas sessões */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🎾 Últimas Sessões</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/sessions')}>
            <Text style={styles.seeAll}>Ver todas</Text>
          </TouchableOpacity>
        </View>

        {LAST_SESSIONS.map(sess => (
          <TouchableOpacity
            key={sess.id}
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: sess.id } })}
          >
            <Card style={styles.sessionCard}>
              <View style={styles.sessionRow}>
                <View>
                  <Text style={styles.sessionLabel}>{sess.label}</Text>
                  <Text style={styles.sessionDate}>{formatDate(sess.date)}</Text>
                </View>
                <View style={styles.sessionRight}>
                  <Badge label={sess.done ? 'Finalizada' : 'Em andamento'} variant={sess.done ? 'teal' : 'gold'} />
                  <Text style={styles.sessionPlayers}>{sess.playerIds.length} jogadores</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))}

        {/* CTA nova sessão */}
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => router.push('/session/new')}
        >
          <Text style={styles.ctaText}>+ Nova Sessão</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  header: { alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.xs },
  location: {},
  locationText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSoft },

  myCard: { gap: Spacing.md },
  myRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  myInfo: { flex: 1 },
  myName: { fontFamily: FontFamily.title, fontSize: 18, color: Colors.text },
  myTitle: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.textSoft, marginTop: 2 },
  myStats: { alignItems: 'flex-end', gap: 4 },
  myPts: { fontFamily: FontFamily.numberBold, fontSize: 24, color: Colors.gold },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.line },
  stat: { alignItems: 'center', gap: 2 },
  statVal: { fontFamily: FontFamily.numberBold, fontSize: 20, color: Colors.text },
  statLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSoft },
  statDivider: { width: 1, backgroundColor: Colors.line },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  seeAll: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.teal },

  rankRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  rankRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  medal: { fontSize: 20, width: 28 },
  rankInfo: { flex: 1 },
  rankName: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  rankSub: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.textSoft },
  rankPts: { fontFamily: FontFamily.numberBold, fontSize: 18, color: Colors.gold },

  sessionCard: { marginBottom: 0 },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionLabel: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  sessionDate: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSoft, marginTop: 2 },
  sessionRight: { alignItems: 'flex-end', gap: 4 },
  sessionPlayers: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSoft },

  ctaBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  ctaText: { fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.bg },
});
