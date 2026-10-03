import { currentSeasonComps } from '@/logic/seasons';
import { JoinRequestsCard } from '@/components/JoinRequestsCard';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { Spacing, Radius, Type, FontFamily, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import { useSettings } from '@/store/SettingsContext';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { rankGap, myPendingMatches, pendingJoinRequests, type RankGap } from '@/logic/homeSummary';
import { playersToRate } from '@/logic/ratePrompt';
import { todayLocal } from '@/logic/eventDateTime';
import { useRateDismissed } from '@/hooks/useRateDismissed';
import { useChallenges } from '@/hooks/useChallenges';
import { attentionCount } from '@/logic/challenges';
import { awaitingMyConfirmation } from '@/logic/scoreValidation';
import { Icon, type IconName } from './icons';
import { ProgressBar } from './ProgressBar';

const pts = (n: number) => (Math.round(n * 100) / 100).toString().replace('.', ',');

function gapMessage(g: RankGap): string {
  if (g.kind === 'leader') {
    return g.lead > 0 ? `Você lidera o grupo, ${pts(g.lead)} pts à frente do 2º` : 'Você lidera o grupo, empatado com o 2º';
  }
  if (g.kind === 'inside') return 'Você está no Top 5 do grupo';
  return g.tied ? 'Você está empatado em pontos com o 5º' : `Você está a ${pts(g.gap)} pontos do Top 5`;
}

/**
 * Bloco de resumo pessoal da Home: pendências (o que exige ação sua) e posição
 * no ranking com uma meta concreta. Cada parte some sozinha quando não há o que
 * mostrar — jogador sem jogos não vê "posição", e sem pendência não sobra um
 * cartão de zeros ocupando a primeira dobra da tela.
 */

export function HomeSummary() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { state } = useCompetitions();
  const { groupPlayers } = useGroupPlayers();
  const { myPlayerId, isAdmin, isMember } = useAuth();
  const { scoringConfig, seasons } = useSettings();

  // Mesma base do ranking da temporada: competições desde o último encerramento, fórmula do grupo.
  const gap = useMemo(() => {
    if (!myPlayerId) return null;
    const ranking = buildRanking(
      groupPlayers.map(p => ({ id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(), color: p.color, handicap: p.handicap })),
      currentSeasonComps(state.competitions, seasons).flatMap(extractPlayerGames),
      scoringConfig,
      { groupMinimum: true },
    );
    return rankGap(ranking, myPlayerId);
  }, [state.competitions, seasons, groupPlayers, scoringConfig, myPlayerId]);

  const pending = useMemo(() => myPendingMatches(state.competitions, myPlayerId), [state.competitions, myPlayerId]);
  // Placares lançados pelo adversário que esperam a minha confirmação.
  const toConfirm = useMemo(() => awaitingMyConfirmation(state.competitions, myPlayerId), [state.competitions, myPlayerId]);

  // Desafios que pedem uma ação sua: responder ou marcar o jogo.
  const { challenges } = useChallenges();
  const challengeCount = useMemo(() => attentionCount(challenges, myPlayerId), [challenges, myPlayerId]);

  // Depois da competição: colegas que jogaram com/contra você e ainda não foram avaliados.
  const { dismissed } = useRateDismissed();
  const myRatedIds = groupPlayers.find(p => p.id === myPlayerId)?.ratedIds;
  const toRate = useMemo(
    () => playersToRate(state.competitions, myPlayerId, myRatedIds ?? [], todayLocal().iso, 30, dismissed, true),
    [state.competitions, myPlayerId, myRatedIds, dismissed],
  );
  const requests = useMemo(() => (isAdmin ? pendingJoinRequests(state.competitions) : { count: 0, compId: null }), [state.competitions, isAdmin]);

  if (!isMember || !state.synced) return null;

  const openComp = (id: string | null) => id && router.push({ pathname: '/competitions/[id]', params: { id } });

  const rows: { icon: IconName; title: string; sub: string; n: number; onPress: () => void }[] = [];
  if (myPlayerId) {
    rows.push({
      icon: 'clock', n: pending.count, onPress: () => openComp(pending.compId),
      title: pending.count === 1 ? 'Jogo sem placar' : 'Jogos sem placar',
      sub: pending.compName ?? '',
    });
  }
  if (toConfirm.length > 0) {
    rows.push({
      icon: 'check', n: toConfirm.length, onPress: () => openComp(toConfirm[0].comp.id),
      title: toConfirm.length === 1 ? 'Placar para confirmar' : 'Placares para confirmar',
      sub: toConfirm[0].comp.name,
    });
  }
  if (myPlayerId && challengeCount > 0) {
    rows.push({
      icon: 'swap', n: challengeCount, onPress: () => router.push('/desafios' as never),
      title: challengeCount === 1 ? 'Desafio para você' : 'Desafios para você',
      sub: 'Responda ou marque o jogo',
    });
  }
  if (myPlayerId) {
    rows.push({
      icon: 'users', n: toRate.length, onPress: () => router.push('/avaliar' as never),
      title: toRate.length === 1 ? 'Colega para avaliar' : 'Colegas para avaliar',
      sub: toRate.length > 0 ? `Depois de ${toRate[0].compName}` : '',
    });
  }
  if (isAdmin) {
    rows.push({
      icon: 'users', n: requests.count, onPress: () => openComp(requests.compId),
      title: 'Pedidos de inscrição',
      sub: requests.count > 0 ? 'Aguardando sua aprovação' : '',
    });
  }

  const barPct = gap
    ? gap.kind === 'outside' ? (gap.points / Math.max(gap.target, 0.01)) * 100
    : gap.kind === 'inside' ? (gap.points / Math.max(gap.target, 0.01)) * 100
    : 100
    : 0;

  // O card de pedidos de entrada some sozinho quando não há pedidos (e só o admin o vê).
  if (rows.length === 0 && !gap && !isAdmin) return null;

  return (
    <View style={s.wrap}>
      {isAdmin && <JoinRequestsCard />}
      {rows.length > 0 && (
        <>
          <Text style={s.label}>PENDÊNCIAS</Text>
          <View style={s.card}>
            {rows.map((r, i) => (
              <TouchableOpacity
                key={r.title}
                style={[s.row, i > 0 && s.rowDivider]}
                onPress={r.n > 0 ? r.onPress : undefined}
                disabled={r.n === 0}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${r.title}: ${r.n}`}
              >
                <View style={[s.iconBox, r.n === 0 && { backgroundColor: Colors.surf2 }]}><Icon name={r.icon} size={20} color={r.n > 0 ? Colors.coral : Colors.muted} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{r.title}</Text>
                  {!!r.sub && <Text style={s.rowSub} numberOfLines={1}>{r.sub}</Text>}
                </View>
                <Text style={[s.count, r.n === 0 && { color: Colors.muted }]}>{r.n}</Text>
                <Icon name="chevronRight" size={18} color={Colors.faint} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {gap && (
        <>
          <Text style={[s.label, rows.length > 0 && { marginTop: Spacing.md }]}>SUA POSIÇÃO</Text>
          <TouchableOpacity
            style={[s.card, s.rank]}
            onPress={() => router.push({ pathname: '/(app)/arena', params: { tab: 'ranking' } })}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Posição ${gap.position} no ranking. ${gapMessage(gap)}`}
          >
            <View style={s.rankTop}>
              <Text style={s.pos}>#{gap.position}<Text style={s.posSub}>  no ranking do grupo</Text></Text>
              <Text style={s.pts}>{pts(gap.points)}<Text style={s.ptsSub}> pts</Text></Text>
            </View>
            <View style={{ marginTop: Spacing.sm + 4, marginBottom: Spacing.sm }}>
              <ProgressBar pct={barPct} height={7} />
            </View>
            <Text style={s.msg}>{gapMessage(gap)}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  label: { ...Type.sectionLabel, color: Colors.muted, marginBottom: Spacing.sm, marginLeft: 2 },
  card: {
    backgroundColor: Colors.surf, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 16, paddingHorizontal: 16 },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.line },
  iconBox: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: Colors.coral + '1F', alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { fontFamily: FontFamily.bodyMed, fontSize: 16, lineHeight: 21, color: Colors.text },
  rowSub: { ...Type.body, fontSize: 12, color: Colors.muted, marginTop: 1 },
  count: { fontFamily: FontFamily.numberBold, fontSize: 20, color: Colors.text },

  rank: { padding: 18 },
  rankTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  pos: { fontFamily: FontFamily.titleBold, fontSize: 36, lineHeight: 40, color: Colors.text },
  posSub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  pts: { fontFamily: FontFamily.numberBold, fontSize: 24, color: Colors.gold },
  ptsSub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  msg: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: Colors.muted },
});
