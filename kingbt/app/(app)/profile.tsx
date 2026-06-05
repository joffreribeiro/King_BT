import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { PLAYERS } from '@/mocks/data';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <View style={bar.row}>
      <Text style={bar.label}>{label}</Text>
      <View style={bar.track}>
        <View style={[bar.fill, { width: `${Math.min(value / Math.max(max, 1), 1) * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={bar.val}>{typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}</Text>
    </View>
  );
}
const bar = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, width: 80 },
  track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: Colors.line },
  fill: { height: 5, borderRadius: 3 },
  val: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.text, width: 40, textAlign: 'right' },
});

export default function ProfileScreen() {
  const MY_ID = 'p1';
  const player = PLAYERS.find(p => p.id === MY_ID)!;
  const { state } = useCompetitions();
  const { logout, leaveGroup, group, user } = useAuth();

  async function handleLeaveGroup() {
    const doLeave = async () => {
      await leaveGroup();
      router.replace('/(auth)/join');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Sair do grupo atual? Você poderá entrar em outro grupo.')) await doLeave();
    } else {
      Alert.alert('Trocar de grupo', 'Sair do grupo atual?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair do grupo', style: 'destructive', onPress: doLeave },
      ]);
    }
  }

  async function handleLogout() {
    const doLogout = async () => {
      await logout();
      router.replace('/(auth)/login');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Deseja sair da sua conta?')) await doLogout();
    } else {
      Alert.alert('Sair', 'Deseja sair da sua conta?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: doLogout },
      ]);
    }
  }
  const allGames = state.competitions.flatMap(extractPlayerGames);
  const ranking = buildRanking(
    PLAYERS.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0,3).toUpperCase(), color: p.color })),
    allGames
  );
  const me = ranking.find(r => r.id === MY_ID) ?? ranking[0];
  const myPos = ranking.findIndex(r => r.id === MY_ID) + 1;
  const winRate = me.played > 0 ? Math.round((me.wins / me.played) * 100) : 0;
  const wPts = me.wins * 3;
  const jPts = Math.round(me.played * 0.5 * 10) / 10;
  const gaPts = Math.round(me.ga * 2 * 100) / 100;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.hero}>
          <Avatar name={player.name} color={player.color} size={80} showCrown={myPos === 1} />
          <Text style={styles.name}>{player.name}</Text>
          <Text style={styles.title}>{player.titleEmoji} {player.title}</Text>
          <View style={styles.badges}>
            <Badge label={`${myPos}° lugar`} variant="gold" />
            <Badge label={`${winRate}% aproveit.`} variant="teal" />
          </View>
        </View>

        {/* Pontuação */}
        <Card elevated style={styles.ptsCard}>
          <Text style={styles.ptsLabel}>PONTUAÇÃO KING BT</Text>
          <Text style={styles.ptsVal}>{me.points.toFixed(2)}</Text>
          <Text style={styles.ptsEq}>
            ({me.wins}×3) + ({me.played}×0,5) + ({me.ga.toFixed(2)}×2)
          </Text>
        </Card>

        {/* Grid de stats */}
        <View style={styles.grid}>
          {[
            { l: 'Vitórias',     v: me.wins,             c: Colors.teal },
            { l: 'Derrotas',     v: me.losses,            c: Colors.coral },
            { l: 'Partidas',     v: me.played,            c: Colors.text },
            { l: 'Game Avg',     v: me.ga.toFixed(2),    c: Colors.gold },
            { l: 'Games Pró',   v: me.gamesPro,          c: Colors.teal },
            { l: 'Games Contra', v: me.gamesCon,          c: Colors.coral },
            { l: 'Saldo',        v: (me.sg >= 0 ? '+' : '') + me.sg, c: me.sg >= 0 ? Colors.teal : Colors.coral },
            { l: 'Win Rate',     v: `${winRate}%`,        c: Colors.goldBright },
          ].map(item => (
            <Card key={item.l} style={styles.cell}>
              <Text style={[styles.cellVal, { color: item.c }]}>{item.v}</Text>
              <Text style={styles.cellLabel}>{item.l}</Text>
            </Card>
          ))}
        </View>

        {/* Quebra de pontos */}
        <Card>
          <Text style={styles.sectionTitle}>Quebra dos Pontos</Text>
          <Bar label="Vitórias ×3" value={wPts} max={me.points} color={Colors.teal} />
          <Bar label="Partidas ×0,5" value={jPts} max={me.points} color={Colors.text} />
          <Bar label="GA ×2" value={gaPts} max={me.points} color={Colors.gold} />
        </Card>

        {/* Conta */}
        <Card style={styles.accountCard}>
          <Text style={styles.accountEmail}>{user?.email ?? user?.displayName}</Text>
          {group && (
            <Text style={styles.groupInfo}>Grupo: {group.name} · {group.code}</Text>
          )}
          <TouchableOpacity style={styles.leaveGroupBtn} onPress={() => router.push('/(auth)/groups')} activeOpacity={0.8}>
            <Text style={styles.leaveGroupText}>Trocar de grupo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>
        </Card>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  hero: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.sm },
  name: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text },
  title: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  badges: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  ptsCard: { alignItems: 'center', gap: 4 },
  ptsLabel: { fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted, letterSpacing: 2 },
  ptsVal: { fontFamily: FontFamily.titleBold, fontSize: 52, color: Colors.gold, lineHeight: 60 },
  ptsEq: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cell: { width: '47%', alignItems: 'center', gap: 2, padding: Spacing.md },
  cellVal: { fontFamily: FontFamily.titleBold, fontSize: 26 },
  cellLabel: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  sectionTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text, marginBottom: Spacing.sm },
  accountCard: { gap: Spacing.sm, alignItems: 'center' },
  accountEmail: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  groupInfo: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.gold },
  leaveGroupBtn: {
    borderWidth: 1, borderColor: Colors.line,
    borderRadius: Radius.md, paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl, alignItems: 'center',
  },
  leaveGroupText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  logoutBtn: {
    borderWidth: 1, borderColor: Colors.coral + '66',
    borderRadius: Radius.md, paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl, alignItems: 'center',
  },
  logoutText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.coral },
});
