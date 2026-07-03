import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef } from 'react';
import { router } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card, ShareStatsCard } from '@/components';
import type { ShareStatsData } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { addGuestPlayer, removeGuestPlayer } from '@/firebase/groupPlayers';
import QRCode from 'react-native-qrcode-svg';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { computeFormatStats } from '@/logic/formatStats';
import { computeRivalries } from '@/logic/rivalries';
import { computeAchievementStats } from '@/logic/achievementStats';
import { ACHIEVEMENTS } from '@/constants/achievements';
import { ResumoTab } from '@/components/profile/ResumoTab';
import { HistoricoTab } from '@/components/profile/HistoricoTab';
import { RivalidadesTab } from '@/components/profile/RivalidadesTab';

const GUEST_COLORS = ['#FFD166', '#2DD4BF', '#A78BFA', '#34D399', '#F472B6', '#94A3B8', '#FB923C', '#60A5FA'];

type Tab = 'resumo' | 'historico' | 'rivalidades';

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { state } = useCompetitions();
  const { logout, leaveGroup, group, user, isAdmin, myPlayerId } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const MY_ID = myPlayerId ?? '';
  const player = groupPlayers.find(p => p.id === MY_ID) ?? null;

  const [activeTab, setActiveTab] = useState<Tab>('resumo');
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [sharingInProgress, setSharingInProgress] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestColor, setGuestColor] = useState(GUEST_COLORS[0]);
  const shareCardRef = useRef<View>(null);

  if (!player) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center', marginBottom: 12 }}>
          Perfil não vinculado
        </Text>
        <Text style={{ fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, textAlign: 'center', marginBottom: 24 }}>
          Saia do grupo e entre novamente para vincular seu perfil.
        </Text>
        <TouchableOpacity onPress={logout} style={{ backgroundColor: Colors.gold, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 }}>
          <Text style={{ fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg }}>Sair da conta</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleLeaveGroup() {
    const doLeave = async () => { await leaveGroup(); router.replace('/(auth)/join'); };
    if (Platform.OS === 'web') {
      if (window.confirm('Sair do grupo atual?')) await doLeave();
    } else {
      Alert.alert('Trocar de grupo', 'Sair do grupo atual?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair do grupo', style: 'destructive', onPress: doLeave },
      ]);
    }
  }

  async function handleLogout() {
    const doLogout = async () => { await logout(); router.replace('/(auth)/login'); };
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
    setGuestName(''); setGuestColor(GUEST_COLORS[0]); setShowAddGuest(false);
  }

  function handleRemoveGuest(pid: string, name: string) {
    if (!group) return;
    const doRemove = () => removeGuestPlayer(group.id, pid);
    if (Platform.OS === 'web') {
      if (window.confirm(`Remover ${name} do grupo?`)) doRemove();
    } else {
      Alert.alert('Remover convidado', `Remover ${name} do grupo?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: doRemove },
      ]);
    }
  }

  async function handleShare() {
    if (!shareCardRef.current || sharingInProgress) return;
    try {
      setSharingInProgress(true);
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      setSharingInProgress(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartilhar stats' });
      }
    } catch { setSharingInProgress(false); }
  }

  // ── Data ────────────────────────────────────────────────────────────────────
  const allGames = state.competitions.flatMap(extractPlayerGames);
  const ranking  = buildRanking(
    groupPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, handicap: p.handicap })),
    allGames
  );
  const me     = ranking.find(r => r.id === MY_ID) ?? ranking[0];
  const myPos  = ranking.findIndex(r => r.id === MY_ID) + 1;
  const winRate = me.played > 0 ? Math.round((me.wins / me.played) * 100) : 0;

  // Match history
  const matchHistory: Array<{ compName: string; format: string; opponents: string; partner: string | null; myScore: number; oppScore: number; won: boolean; isTeam: boolean }> = [];
  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreB == null) return;
      const inA = m.teamA ? m.teamA.includes(MY_ID) : m.aId === MY_ID;
      const inB = m.teamB ? m.teamB.includes(MY_ID) : m.bId === MY_ID;
      if (!inA && !inB) return;
      const myScore = inA ? m.scoreA : m.scoreB;
      const oppScore = inA ? m.scoreB : m.scoreA;
      const won = myScore > oppScore;
      const isTeam = !!(m.teamA && m.teamB);
      let opponents = '?', partner: string | null = null;
      if (m.teamA && m.teamB) {
        const myTeam  = inA ? m.teamA : m.teamB;
        const oppTeam = inA ? m.teamB : m.teamA;
        opponents = oppTeam.map(pid => findPlayer(pid)?.name.split(' ')[0] ?? pid).join(' / ');
        const pid = myTeam.find(id => id !== MY_ID);
        if (pid) partner = findPlayer(pid)?.name.split(' ')[0] ?? pid;
      } else {
        const oppId = inA ? m.bId : m.aId;
        if (oppId) {
          const oppComp = comp.competitors.find(c => c.id === oppId);
          opponents = oppComp?.name ?? findPlayer(oppId)?.name ?? oppId;
        }
      }
      matchHistory.push({ compName: comp.name, format: comp.format, opponents, partner, myScore, oppScore, won, isTeam });
    });
  });
  matchHistory.reverse();

  // Evo points
  const evoPoints: { label: string; pts: number; pos: number }[] = (() => {
    const players = groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color, handicap: p.handicap }));
    const compsWithMe = state.competitions
      .filter(c => c.matches.some(m => {
        const ids = [...(m.teamA ?? []), ...(m.teamB ?? []), m.aId, m.bId].filter(Boolean);
        return ids.includes(MY_ID) && m.scoreA != null;
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return compsWithMe.map((comp, idx) => {
      const compsUpTo = compsWithMe.slice(0, idx + 1);
      const games = compsUpTo.flatMap(extractPlayerGames);
      const rank = buildRanking(players, games);
      const me = rank.find(r => r.id === MY_ID);
      const pos = rank.findIndex(r => r.id === MY_ID) + 1;
      return { label: comp.name.slice(0, 7), pts: me?.points ?? 0, pos };
    });
  })();

  // Activity heatmap
  const activityData: Record<string, number> = {};
  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null) return;
      const inA = m.teamA ? m.teamA.includes(MY_ID) : m.aId === MY_ID;
      const inB = m.teamB ? m.teamB.includes(MY_ID) : m.bId === MY_ID;
      if (!inA && !inB) return;
      const dateKey = (m.playedAt ?? comp.date ?? '').split('T')[0];
      if (!dateKey) return;
      activityData[dateKey] = Math.min(3, (activityData[dateKey] ?? 0) + 1);
    });
  });

  // Rating history
  const ratingHistory: { label: string; pts: number; wins: number; played: number }[] = state.competitions
    .filter(c => c.matches.some(m => m.scoreA != null && (
      m.teamA?.includes(MY_ID) || m.teamB?.includes(MY_ID) || m.aId === MY_ID || m.bId === MY_ID
    )))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8)
    .map(comp => {
      const games = extractPlayerGames(comp).filter(g => g.teamA.includes(MY_ID) || g.teamB.includes(MY_ID));
      let wins = 0, played = 0, gp = 0, gc = 0;
      games.forEach(g => {
        const inA = g.teamA.includes(MY_ID);
        played++;
        if (inA) { gp += g.scoreA; gc += g.scoreB; if (g.scoreA > g.scoreB) wins++; }
        else { gp += g.scoreB; gc += g.scoreA; if (g.scoreB > g.scoreA) wins++; }
      });
      const ga = gc > 0 ? gp / gc : gp > 0 ? 2 : 0;
      const pts = Math.round((wins * 3 + played * 0.5 + ga * 2) * 100) / 100;
      return { label: comp.name.length > 9 ? comp.name.slice(0, 9) + '…' : comp.name, pts, wins, played };
    });

  // Partnerships
  type PairInfo = { partnerId: string; wins: number; losses: number; played: number };
  const partnerMap = new Map<string, PairInfo>();
  state.competitions.forEach(comp => {
    comp.matches.forEach(m => {
      if (m.scoreA == null || !m.teamA || !m.teamB) return;
      const inA = m.teamA.includes(MY_ID), inB = m.teamB.includes(MY_ID);
      if (!inA && !inB) return;
      const myTeam = inA ? m.teamA : m.teamB;
      const partner = myTeam.find(id => id !== MY_ID);
      if (!partner) return;
      const won = inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
      if (!partnerMap.has(partner)) partnerMap.set(partner, { partnerId: partner, wins: 0, losses: 0, played: 0 });
      const ps = partnerMap.get(partner)!;
      ps.played++;
      if (won) ps.wins++; else ps.losses++;
    });
  });
  const partnerships = [...partnerMap.values()]
    .filter(p => p.played >= 2)
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 5);

  const formatStats = computeFormatStats(state.competitions, MY_ID);
  const rivalries   = computeRivalries(MY_ID, state.competitions);

  // Next achievement
  const achStats = computeAchievementStats(state.competitions, MY_ID);
  const achStatsWithRating = { ...achStats, currentRating: me?.points ?? 0 };
  const nextAch = ACHIEVEMENTS
    .map(a => ({ a, prog: a.progress(achStatsWithRating) }))
    .filter(({ prog }) => prog > 0 && prog < 1)
    .sort((a, b) => b.prog - a.prog)[0];
  const nextAchievement = nextAch ? {
    icon:  nextAch.a.icon,
    title: nextAch.a.title,
    color: nextAch.a.color,
    prog:  nextAch.prog,
    label: nextAch.a.progressLabel(achStatsWithRating),
    desc:  nextAch.a.description,
  } : null;

  const unlockedAchievements = ACHIEVEMENTS.filter(a => a.progress(achStatsWithRating) >= 1);

  if (!me) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'resumo',      label: 'RESUMO' },
    { key: 'historico',   label: 'HISTÓRICO' },
    { key: 'rivalidades', label: 'RIVALIDADES' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Hero — sempre visível */}
      <View style={styles.heroBanner}>
        <View style={[styles.heroBg, { backgroundColor: (player?.color ?? '#FFD166') + '22' }]} />
        <View style={styles.heroInner}>
          <Avatar name={player?.name ?? '?'} color={player?.color ?? '#FFD166'} size={64} showCrown={myPos === 1} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{player?.name ?? user?.displayName ?? 'Jogador'}</Text>
            <Text style={styles.titleText} numberOfLines={1}>{user?.email ?? ''}</Text>
            <View style={styles.badges}>
              <Badge label={`${myPos}° lugar`} variant="gold" />
              <Badge label={`${winRate}% aproveit.`} variant="teal" />
            </View>
          </View>
          <TouchableOpacity style={[styles.shareBtn, sharingInProgress && { opacity: 0.5 }]} onPress={handleShare} activeOpacity={0.75} disabled={sharingInProgress}>
            <Text style={styles.shareBtnText}>{sharingInProgress ? '...' : '↑'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar sticky */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={styles.tabItem} onPress={() => setActiveTab(t.key)}>
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
            {activeTab === t.key && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Scroll content */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {activeTab === 'resumo' && (
          <ResumoTab
            me={me} myPos={myPos} winRate={winRate}
            matchHistory={matchHistory} evoPoints={evoPoints}
            activityData={activityData} ratingHistory={ratingHistory}
            nextAchievement={nextAchievement}
            unlockedAchievements={unlockedAchievements}
          />
        )}
        {activeTab === 'historico' && (
          <HistoricoTab matchHistory={matchHistory} formatStats={formatStats} />
        )}
        {activeTab === 'rivalidades' && (
          <RivalidadesTab rivalries={rivalries} partnerships={partnerships} findPlayer={findPlayer} />
        )}

        <Card style={styles.accountCard}>
          <Text style={styles.accountEmail}>{user?.email ?? user?.displayName}</Text>
          {group && (
            <TouchableOpacity onPress={() => setShowQR(true)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.groupInfo}>Grupo: {group.name} · {group.code}</Text>
              <Text style={{ fontSize: 14 }}>⊞</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/(app)/settings')} activeOpacity={0.8}>
            <Text style={styles.settingsBtnText}>⚙️  Configurações</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.leaveGroupBtn} onPress={() => router.push('/(auth)/groups')} activeOpacity={0.8}>
            <Text style={styles.leaveGroupText}>Trocar de grupo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>
        </Card>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Share card fora da tela */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <View ref={shareCardRef} collapsable={false}>
          <ShareStatsCard data={{
            name: player?.name ?? user?.displayName ?? 'Jogador',
            color: player?.color ?? '#FFD166',
            position: myPos, points: me.points,
            played: me.played, wins: me.wins, losses: me.losses,
            winRate, sg: me.sg, ga: me.ga, groupName: group?.name ?? 'King BT',
          }} />
        </View>
      </View>

      {/* Modal QR */}
      <Modal visible={showQR} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setShowQR(false)} activeOpacity={1}>
          <View style={{ backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, margin: Spacing.xl }}>
            <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text }}>Convidar para o grupo</Text>
            <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12 }}>
              <QRCode value={group?.code ?? ''} size={200} color="#0B0B0D" backgroundColor="#ffffff" />
            </View>
            <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 26, color: Colors.gold, letterSpacing: 6 }}>{group?.code}</Text>
            <TouchableOpacity style={{ paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl }} onPress={() => setShowQR(false)}>
              <Text style={{ fontFamily: FontFamily.bodyMed, color: Colors.coral }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },

  heroBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, position: 'relative', overflow: 'hidden' },
  heroBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  name: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text },
  titleText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  badges: { flexDirection: 'row', gap: Spacing.xs, marginTop: 3, flexWrap: 'wrap' },
  shareBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: Colors.gold + '55', backgroundColor: Colors.gold + '11' },
  shareBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.gold },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.line, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md },
  tabItem: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', position: 'relative' },
  tabLabel: { fontFamily: FontFamily.bodyMed, fontSize: 11, color: Colors.faint },
  tabLabelActive: { color: Colors.gold, fontWeight: '700' },
  tabIndicator: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2.5, backgroundColor: Colors.gold, borderRadius: 1 },

  accountCard: { gap: Spacing.sm, alignItems: 'center' },
  accountEmail: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  groupInfo: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.gold },
  settingsBtn: { borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, alignItems: 'center', width: '100%' },
  settingsBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  leaveGroupBtn: { borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, alignItems: 'center', width: '100%' },
  leaveGroupText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },
  logoutBtn: { borderWidth: 1, borderColor: Colors.coral + '66', borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, alignItems: 'center', width: '100%' },
  logoutText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.coral },
});
