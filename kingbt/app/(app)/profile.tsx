import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MANUAL_URL } from '@/constants/manual';
import { useState, useRef, useMemo, useCallback } from 'react';
import { router } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { FontFamily, Spacing, centeredContent, wideContent, Radius, type ThemeColors, PLAYER_COLORS } from '@/theme';
import { useIsWide } from '@/hooks/useIsWide';
import { useTheme } from '@/store/ThemeContext';
import { ShareStatsCard, Icon } from '@/components';
import { computeStreakHistory } from '@/logic/streak';
import { useCompetitions } from '@/store/CompetitionsContext';
import { matchGames } from '@/logic/setOutcome';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useSettings } from '@/store/SettingsContext';
import { updatePlayerAbout, updatePlayerSkills } from '@/firebase/groupPlayers';
import { notify } from '@/services/notify';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { computeFormatStats } from '@/logic/formatStats';
import { ResumoTab } from '@/components/profile/ResumoTab';
import { HistoricoTab } from '@/components/profile/HistoricoTab';
import { BatalhasTab } from '@/components/profile/BatalhasTab';
import { HonrariasForPlayer } from '@/components/profile/HonrariasTab';
import { SobreTab } from '@/components/profile/SobreTab';
import { useCategorySuggestion } from '@/hooks/useCategorySuggestion';
import { PlayerHeroCard } from '@/components/profile/ProfileHeroCard';
import { RadarTab } from '@/components/profile/RadarTab';
import { EditProfileModal } from '@/components/profile/EditProfileModal';


type Tab = 'resumo' | 'historico' | 'batalhas' | 'honrarias' | 'sobre' | 'radar';

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const wide = useIsWide();
  const { state, refresh } = useCompetitions();
  const { logout, group, user, myPlayerId, updateProfileName } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const { scoringConfig } = useSettings();
  const MY_ID = myPlayerId ?? '';
  const player = groupPlayers.find(p => p.id === MY_ID) ?? null;
  const catSuggestion = useCategorySuggestion(player?.id, player?.skills, player?.about?.category);

  const [activeTab, setActiveTab] = useState<Tab>('sobre');
  const [] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [sharingInProgress, setSharingInProgress] = useState(false);
  const [] = useState('');
  const [] = useState(PLAYER_COLORS[0]);
  const [refreshing, setRefreshing] = useState(false);
  const shareCardRef = useRef<View>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); }
    finally { setRefreshing(false); }
  }, [refresh]);

  // ── Handlers ────────────────────────────────────────────────────────────────


  async function handleShare() {
    if (!shareCardRef.current || sharingInProgress) return;
    try {
      setSharingInProgress(true);
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      setSharingInProgress(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartilhar stats' });
      }
    } catch {
      setSharingInProgress(false);
      notify('Erro', 'Não foi possível gerar a imagem.');
    }
  }

  // ── Data ────────────────────────────────────────────────────────────────────
  // Tudo abaixo é memoizado por depender só de state.competitions/groupPlayers/
  // scoringConfig/MY_ID — antes recalculava tudo a cada render (inclusive só
  // trocando de aba Resumo/Histórico/Rivalidades, sem nenhum desses mudar).
  const allGames = useMemo(() => state.competitions.flatMap(extractPlayerGames), [state.competitions]);

  const ranking = useMemo(() => buildRanking(
    groupPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, handicap: p.handicap })),
    allGames,
    scoringConfig,
    { groupMinimum: true },
  ), [groupPlayers, allGames, scoringConfig]);

  const me     = ranking.find(r => r.id === MY_ID) ?? ranking[0];
  // Quem ainda não atingiu o mínimo de jogos fica sem posição ("#—").
  const myPos  = me?.provisional ? 0 : ranking.findIndex(r => r.id === MY_ID) + 1;
  const streakHist = useMemo(() => computeStreakHistory(state.competitions, MY_ID ?? ''), [state.competitions, MY_ID]);
  const winRate = me && me.played > 0 ? Math.round((me.wins / me.played) * 100) : 0;

  const matchHistory = useMemo(() => {
    const list: Array<{ id: string; compName: string; format: string; opponents: string; partner: string | null; myScore: number; oppScore: number; won: boolean; isTeam: boolean; gender: string; date: string }> = [];
    state.competitions.forEach(comp => {
      comp.matches.forEach(m => {
        if (m.scoreA == null || m.scoreB == null) return;
        const inA = m.teamA ? m.teamA.includes(MY_ID) : m.aId === MY_ID;
        const inB = m.teamB ? m.teamB.includes(MY_ID) : m.bId === MY_ID;
        if (!inA && !inB) return;
        const won = (inA ? m.scoreA : m.scoreB) > (inA ? m.scoreB : m.scoreA);
        const { a: gA, b: gB } = matchGames(m, comp.config?.winRule);
        const myScore = inA ? gA : gB;
        const oppScore = inA ? gB : gA;
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
        list.push({
          id: `${comp.id}_${m.id}`, compName: comp.name, format: comp.format, opponents, partner,
          myScore, oppScore, won, isTeam, gender: comp.gender, date: m.playedAt ?? comp.date ?? '',
        });
      });
    });
    // Ordena ascendente (data + ordem de criação dentro da competição) e inverte —
    // um sort estável descendente não reordenaria partidas com a mesma data (mesma competição).
    list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    list.reverse();
    return list;
  }, [state.competitions, MY_ID, findPlayer]);

  const evoPoints = useMemo(() => {
    const players = groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color, handicap: p.handicap }));
    const compsWithMe = state.competitions
      .filter(c => c.matches.some(m => {
        const ids = [...(m.teamA ?? []), ...(m.teamB ?? []), m.aId, m.bId].filter(Boolean);
        return ids.includes(MY_ID) && m.scoreA != null;
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Acumula os jogos incrementalmente em vez de re-extrair e re-somar tudo
    // desde o início a cada competição (era O(n²): re-fazia flatMap+buildRanking
    // sobre as competições inteiras de novo pra cada uma das n competições).
    const runningGames: ReturnType<typeof extractPlayerGames> = [];
    return compsWithMe.map(comp => {
      runningGames.push(...extractPlayerGames(comp));
      const rank = buildRanking(players, runningGames, scoringConfig);
      const meAtPoint = rank.find(r => r.id === MY_ID);
      const pos = rank.findIndex(r => r.id === MY_ID) + 1;
      return { label: comp.name.slice(0, 7), pts: meAtPoint?.points ?? 0, pos };
    }).slice(-8); // últimas 8 competições (mesmo corte do "Pontos por competição")
  }, [state.competitions, groupPlayers, MY_ID, scoringConfig]);

  const activityData = useMemo(() => {
    const data: Record<string, number> = {};
    state.competitions.forEach(comp => {
      comp.matches.forEach(m => {
        if (m.scoreA == null) return;
        const inA = m.teamA ? m.teamA.includes(MY_ID) : m.aId === MY_ID;
        const inB = m.teamB ? m.teamB.includes(MY_ID) : m.bId === MY_ID;
        if (!inA && !inB) return;
        const dateKey = (m.playedAt ?? comp.date ?? '').split('T')[0];
        if (!dateKey) return;
        data[dateKey] = Math.min(3, (data[dateKey] ?? 0) + 1);
      });
    });
    return data;
  }, [state.competitions, MY_ID]);

  const ratingHistory = useMemo(() => state.competitions
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
        // Vitória vem de g.winner (sets da partida); os games só somam GP/GC.
        if (inA) { gp += g.gamesA; gc += g.gamesB; if (g.winner === 'A') wins++; }
        else { gp += g.gamesB; gc += g.gamesA; if (g.winner === 'B') wins++; }
      });
      const ga = gc > 0 ? gp / gc : gp > 0 ? 2 : 0;
      const pts = Math.round((wins * scoringConfig.winCoef + played * scoringConfig.playedCoef + ga * scoringConfig.gaCoef) * 100) / 100;
      return { label: comp.name.length > 9 ? comp.name.slice(0, 9) + '…' : comp.name, pts, wins, played };
    }), [state.competitions, MY_ID, scoringConfig]);

  const formatStats = useMemo(() => computeFormatStats(state.competitions, MY_ID), [state.competitions, MY_ID]);


  // Estatísticas das conquistas, já com o rating atual (usadas na aba Honrarias).

  const TABS: { key: Tab; label: string }[] = [
    { key: 'sobre',       label: 'Sobre' },
    { key: 'radar',       label: 'Avaliação' },
    { key: 'honrarias',   label: 'Conquistas' },
    { key: 'batalhas',    label: 'Rivalidade' },
    { key: 'resumo',      label: 'Estatísticas' },
    { key: 'historico',   label: 'Histórico' },
  ];

  if (!player) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center', marginBottom: 12 }}>
          Perfil não vinculado
        </Text>
        <Text style={{ fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted, textAlign: 'center', marginBottom: 24 }}>
          Saia do grupo e entre novamente para vincular seu perfil.
        </Text>
        <TouchableOpacity onPress={logout} style={{ backgroundColor: Colors.gold, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 }}>
          <Text style={{ fontFamily: FontFamily.title, fontSize: 17, color: Colors.bg }}>Sair da conta</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!me) return null;

  return (
    <SafeAreaView style={[styles.container, wide && styles.containerWide]} edges={[]}>
      {/* Topo: o mesmo card do perfil dos outros jogadores. Computador: coluna da esquerda. */}
      <View style={wide ? styles.colLeft : { marginHorizontal: Spacing.md }}>
        <PlayerHeroCard
          playerId={player?.id ?? ''}
          skills={player?.skills}
          ratedCount={player?.ratedIds?.length ?? 0}
          name={player?.name ?? user?.displayName ?? 'Jogador'}
          avatarColor={player?.color ?? '#FFD166'}
          position={myPos}
          points={me?.points ?? 0}
          winRate={winRate}
          played={me?.played ?? 0}
          groupName={group?.name ?? 'King BT'}
          onEdit={() => setShowEditName(true)}
          onAddGroup={() => router.push('/(auth)/groups')}
          onShare={handleShare}
          sharing={sharingInProgress}
        />
      </View>

      {/* Abas e conteúdo. Computador: coluna da direita. */}
      <View style={wide ? styles.colRight : { flex: 1 }}>
      {/* Abas com sublinhado dourado na ativa, como no Atlas. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, activeTab === t.key && styles.tabItemActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Scroll content */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold} />}
      >
        {activeTab === 'resumo' && (
          <ResumoTab
            me={me} myPos={myPos} winRate={winRate}
            matchHistory={matchHistory} evoPoints={evoPoints}
            activityData={activityData} ratingHistory={ratingHistory}
            streak={{ current: streakHist.current, max: streakHist.max }}
          />
        )}
        {activeTab === 'historico' && (
          <HistoricoTab matchHistory={matchHistory} formatStats={formatStats} />
        )}
        {activeTab === 'honrarias' && <HonrariasForPlayer playerId={player?.id ?? ''} points={me?.points ?? 0} ratedCount={player?.ratedIds?.length ?? 0} played={me?.played ?? 0} skills={player?.skills} />}
        {activeTab === 'batalhas' && (
          <BatalhasTab playerId={MY_ID} competitions={state.competitions} findPlayer={findPlayer} />
        )}
        {activeTab === 'sobre' && (
          <SobreTab
            about={player?.about}
            suggestion={catSuggestion}
            onApplyCategory={async (category) => { if (group && player) await updatePlayerAbout(group.id, player.id, { ...(player.about ?? {}), category }); }}
          />
        )}
        {activeTab === 'radar' && (
          <RadarTab
            playerId={player?.id ?? ''}
            playerName={player?.name ?? ''}
            skills={player?.skills}
            onSave={async (sk) => { if (group && player) await updatePlayerSkills(group.id, player.id, sk); }}
          />
        )}

        {/* Análise por formato, situação e percentil — não é o que o Resumo mostra (que é por tipo de jogo e por competição). */}
        {activeTab === 'resumo' && (
          <>
          <TouchableOpacity style={styles.shortcut} onPress={() => router.push('/(app)/stats')} activeOpacity={0.8}>
            <Icon name="chart" size={20} color={Colors.teal} />
            <View style={{ flex: 1 }}>
              <Text style={styles.shortcutLabel}>Análise por Formato</Text>
              <Text style={styles.shortcutSub}>Por formato de competição, por situação de jogo e seu percentil no grupo</Text>
            </View>
            <Icon name="chevronRight" size={16} color={Colors.faint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.shortcut} onPress={() => router.push('/analise')} activeOpacity={0.8}>
            <Icon name="chart" size={20} color={Colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.shortcutLabel}>King Scout</Text>
              <Text style={styles.shortcutSub}>Jogos gravados ponto a ponto, relatórios em PDF e análise por atleta</Text>
            </View>
            <Icon name="chevronRight" size={16} color={Colors.faint} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/desempenho-geral')} activeOpacity={0.8}>
            <Icon name="chart" size={16} color={Colors.text} />
            <Text style={styles.settingsBtnText}>Desempenho em todos os grupos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => Linking.openURL(MANUAL_URL)} activeOpacity={0.8}>
            <Icon name="share" size={16} color={Colors.text} />
            <Text style={styles.settingsBtnText}>Manual do usuário (PDF)</Text>
          </TouchableOpacity>
          </>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>
      </View>

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

      {/* Modal editar nome (só nesse grupo) */}
      {showEditName && (
        <EditProfileModal
          name={player?.name ?? user?.displayName ?? ''}
          about={player?.about}
          suggested={catSuggestion?.category}
          onClose={() => setShowEditName(false)}
          onSaveName={(name) => updateProfileName(name)}
          onSaveAbout={async (about) => { if (group && player) await updatePlayerAbout(group.id, player.id, about); }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  containerWide: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', maxWidth: wideContent.maxWidth, alignSelf: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.lg },
  colLeft: { width: 400 },
  colRight: { flex: 1, minWidth: 0, alignSelf: 'stretch' },
  scroll: { ...centeredContent, padding: Spacing.md, paddingTop: Spacing.xs, gap: Spacing.md },

  // Rola na horizontal: com 4 abas em 15px, "RIVALIDADES" não cabe em celular estreito.
  tabScroll: { flexGrow: 0, flexShrink: 0, marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line },
  tabBar: { flexGrow: 1 },
  tabItem: { flexGrow: 1, paddingHorizontal: 14, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabItemActive: { borderBottomColor: Colors.gold },
  tabLabel: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.muted },
  tabLabelActive: { color: Colors.gold, fontFamily: FontFamily.title },

  shortcut: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surf, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
  },
  shortcutLabel: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  shortcutSub: { fontFamily: FontFamily.body, fontSize: 12, lineHeight: 16, color: Colors.muted, marginTop: 2 },

  accountCard: { gap: Spacing.sm, alignItems: 'center' },
  accountEmail: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  groupInfo: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.gold },
  settingsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, width: '100%',
  },
  settingsBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text },

  accountDivider: { height: 1, backgroundColor: Colors.line, width: '100%', marginVertical: Spacing.xs },
  accountActions: { flexDirection: 'row', gap: Spacing.sm, width: '100%' },
  leaveGroupBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm,
  },
  leaveGroupText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.coral + '66', borderRadius: Radius.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
  },
  logoutText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.coral },
});
