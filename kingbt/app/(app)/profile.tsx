import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { PLAYERS } from '@/mocks/data';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { addGuestPlayer, removeGuestPlayer } from '@/firebase/groupPlayers';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';

const GUEST_COLORS = ['#FFD166', '#2DD4BF', '#A78BFA', '#34D399', '#F472B6', '#94A3B8', '#FB923C', '#60A5FA'];

const MY_ID = 'p1';

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
  const player = PLAYERS.find(p => p.id === MY_ID)!;
  const { state } = useCompetitions();
  const { logout, leaveGroup, group, user, isAdmin } = useAuth();
  const { groupPlayers } = useGroupPlayers();
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestColor, setGuestColor] = useState(GUEST_COLORS[0]);

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

  async function handleAddGuest() {
    if (!guestName.trim() || !group) return;
    await addGuestPlayer(group.id, guestName.trim(), guestColor);
    setGuestName('');
    setGuestColor(GUEST_COLORS[0]);
    setShowAddGuest(false);
  }

  function handleRemoveGuest(playerId: string, name: string) {
    if (!group) return;
    const doRemove = () => removeGuestPlayer(group.id, playerId);
    if (Platform.OS === 'web') {
      if (window.confirm(`Remover ${name} do grupo?`)) doRemove();
    } else {
      Alert.alert('Remover convidado', `Remover ${name} do grupo?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: doRemove },
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

  // Full match history for MY_ID
  const matchHistory: Array<{
    compName: string;
    opponents: string;
    myScore: number;
    oppScore: number;
    won: boolean;
  }> = [];

  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreB == null) return;
      const inA = m.teamA ? m.teamA.includes(MY_ID) : m.aId === MY_ID;
      const inB = m.teamB ? m.teamB.includes(MY_ID) : m.bId === MY_ID;
      if (!inA && !inB) return;

      const myScore  = inA ? m.scoreA : m.scoreB;
      const oppScore = inA ? m.scoreB : m.scoreA;
      const won = myScore > oppScore;

      let opponents = '?';
      if (m.teamA && m.teamB) {
        const oppTeam = inA ? m.teamB : m.teamA;
        opponents = oppTeam.map(pid => PLAYERS.find(p => p.id === pid)?.name.split(' ')[0] ?? pid).join(' / ');
      } else {
        const oppId = inA ? m.bId : m.aId;
        if (oppId) {
          const oppComp = comp.competitors.find(c => c.id === oppId);
          opponents = oppComp?.name ?? PLAYERS.find(p => p.id === oppId)?.name ?? oppId;
        }
      }

      matchHistory.push({ compName: comp.name, opponents, myScore, oppScore, won });
    });
  });
  matchHistory.reverse();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.heroBanner}>
          <View style={[styles.heroBg, { backgroundColor: player.color + '22' }]} />
          <View style={styles.heroInner}>
            <Avatar name={player.name} color={player.color} size={88} showCrown={myPos === 1} />
            <Text style={styles.name}>{player.name}</Text>
            <Text style={styles.titleText}>{player.titleEmoji} {player.title}</Text>
            <View style={styles.badges}>
              <Badge label={`${myPos}° lugar`} variant="gold" />
              <Badge label={`${winRate}% aproveit.`} variant="teal" />
            </View>
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
            { l: 'Vitórias',      v: me.wins,                         c: Colors.teal },
            { l: 'Derrotas',      v: me.losses,                       c: Colors.coral },
            { l: 'Partidas',      v: me.played,                       c: Colors.text },
            { l: 'Game Avg',      v: me.ga.toFixed(2),                c: Colors.gold },
            { l: 'Games Pró',    v: me.gamesPro,                      c: Colors.teal },
            { l: 'Games Contra', v: me.gamesCon,                      c: Colors.coral },
            { l: 'Saldo',         v: (me.sg >= 0 ? '+' : '') + me.sg, c: me.sg >= 0 ? Colors.teal : Colors.coral },
            { l: 'Win Rate',      v: `${winRate}%`,                    c: Colors.goldBright },
          ].map(item => (
            <View key={item.l} style={[styles.cell, { borderLeftWidth: 3, borderLeftColor: item.c + '88' }]}>
              <Text style={[styles.cellVal, { color: item.c }]}>{item.v}</Text>
              <Text style={styles.cellLabel}>{item.l}</Text>
            </View>
          ))}
        </View>

        {/* Forma recente */}
        {(() => {
          const recentGames = state.competitions
            .flatMap(c => c.matches)
            .filter(m => m.scoreA != null && m.scoreB != null)
            .filter(m => (m.teamA ?? [m.aId]).includes(MY_ID) || (m.teamB ?? [m.bId]).includes(MY_ID))
            .slice(-6);
          if (recentGames.length === 0) return null;
          const results = recentGames.map(m => {
            const inA = (m.teamA ?? [m.aId]).includes(MY_ID);
            return inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
          });
          return (
            <Card>
              <Text style={styles.sectionTitle}>Forma recente</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {results.map((w, i) => (
                  <View key={i} style={{
                    width: 32, height: 32, borderRadius: 8,
                    backgroundColor: w ? Colors.teal + '33' : Colors.coral + '33',
                    borderWidth: 1, borderColor: w ? Colors.teal + '66' : Colors.coral + '66',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 12, color: w ? Colors.teal : Colors.coral }}>
                      {w ? 'V' : 'D'}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          );
        })()}

        {/* Quebra de pontos */}
        <Card>
          <Text style={styles.sectionTitle}>Quebra dos Pontos</Text>
          <Bar label="Vitórias ×3"   value={wPts}  max={me.points} color={Colors.teal} />
          <Bar label="Partidas ×0,5" value={jPts}  max={me.points} color={Colors.text} />
          <Bar label="GA ×2"         value={gaPts} max={me.points} color={Colors.gold} />
        </Card>

        {/* Histórico de partidas */}
        {matchHistory.length > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Histórico de partidas</Text>
            {matchHistory.map((h, i) => (
              <View key={i} style={[hist.row, i < matchHistory.length - 1 && hist.border]}>
                <View style={[hist.badge, { backgroundColor: h.won ? Colors.teal + '33' : Colors.coral + '33' }]}>
                  <Text style={[hist.badgeText, { color: h.won ? Colors.teal : Colors.coral }]}>
                    {h.won ? 'V' : 'D'}
                  </Text>
                </View>
                <View style={hist.info}>
                  <Text style={hist.opp} numberOfLines={1}>vs {h.opponents}</Text>
                  <Text style={hist.compName} numberOfLines={1}>{h.compName}</Text>
                </View>
                <Text style={[hist.score, { color: h.won ? Colors.teal : Colors.coral }]}>
                  {h.myScore}–{h.oppScore}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Jogadores do grupo (admin) */}
        {isAdmin && group && (
          <Card>
            <View style={guest.header}>
              <Text style={styles.sectionTitle}>Jogadores do grupo</Text>
              <TouchableOpacity onPress={() => setShowAddGuest(v => !v)} style={guest.addBtn}>
                <Text style={guest.addBtnText}>{showAddGuest ? '− Cancelar' : '+ Convidado'}</Text>
              </TouchableOpacity>
            </View>

            {groupPlayers.length === 0 && (
              <Text style={guest.empty}>Nenhum jogador cadastrado ainda.</Text>
            )}

            {groupPlayers.map((p, i) => (
              <View key={p.id} style={[guest.playerRow, i < groupPlayers.length - 1 && guest.border]}>
                <Avatar name={p.name} color={p.color} size={30} />
                <Text style={guest.playerName}>{p.name}</Text>
                {p.guest
                  ? <View style={guest.guestBadge}><Text style={guest.guestText}>convidado</Text></View>
                  : <View style={guest.memberBadge}><Text style={guest.memberText}>membro</Text></View>
                }
                {p.guest && (
                  <TouchableOpacity onPress={() => handleRemoveGuest(p.id, p.name)} hitSlop={8}>
                    <Text style={guest.removeBtn}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {showAddGuest && (
              <View style={guest.form}>
                <TextInput
                  style={guest.input}
                  value={guestName}
                  onChangeText={setGuestName}
                  placeholder="Nome do convidado"
                  placeholderTextColor={Colors.faint}
                  autoFocus
                />
                <View style={guest.colorRow}>
                  {GUEST_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setGuestColor(c)}
                      style={[guest.colorDot, { backgroundColor: c }, guestColor === c && guest.colorDotSel]}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  style={[guest.confirmBtn, !guestName.trim() && { opacity: 0.4 }]}
                  onPress={handleAddGuest}
                  disabled={!guestName.trim()}
                >
                  <Text style={guest.confirmText}>Adicionar convidado</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )}

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
  heroBanner: { position: 'relative', overflow: 'hidden', borderRadius: Radius.lg, marginBottom: Spacing.sm },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  heroInner: { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.sm },
  name: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text },
  titleText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  badges: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  ptsCard: { alignItems: 'center', gap: 4 },
  ptsLabel: { fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted, letterSpacing: 2 },
  ptsVal: { fontFamily: FontFamily.titleBold, fontSize: 52, color: Colors.gold, lineHeight: 60 },
  ptsEq: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cell: { width: '47%', alignItems: 'center', gap: 2, padding: Spacing.md, backgroundColor: Colors.surf, borderRadius: Radius.md },
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

const guest = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  addBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 3, backgroundColor: Colors.surf2, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line },
  addBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.teal },
  empty: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, textAlign: 'center', paddingVertical: Spacing.sm },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  playerName: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  guestBadge: { backgroundColor: Colors.gold + '22', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  guestText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold },
  memberBadge: { backgroundColor: Colors.teal + '22', borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  memberText: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.teal },
  removeBtn: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.coral, lineHeight: 20, paddingHorizontal: 4 },
  form: { borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: Spacing.md, gap: Spacing.sm, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontFamily: FontFamily.body, fontSize: 15, color: Colors.text,
  },
  colorRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotSel: { borderWidth: 3, borderColor: Colors.text },
  confirmBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  confirmText: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.bg },
});
