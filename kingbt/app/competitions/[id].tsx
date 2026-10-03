import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Platform,
  Animated, TextInput,
} from 'react-native';
import { HexBackground } from '@/components/HexBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useRef, useEffect, useMemo } from 'react';
import { FontFamily, Spacing, centeredContent, Radius, type ThemeColors, Type, PLAYER_COLORS } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Avatar, Badge, ScreenHeader, Icon, OptionModal } from '@/components';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { competitionChampion, groupComplete } from '@/logic/formats';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useSettings } from '@/store/SettingsContext';
import type { Match, Competition } from '@/logic/types';
import {
  registerForEvent, cancelEventRegistration,
  requestRegistration, cancelRegistrationRequest, approveJoinRequest, rejectJoinRequest,
} from '@/firebase/competitions';
import { eventView } from '@/logic/eventRegistration';
import { registrationGate, canCancelRegistration, closeRegistration } from '@/logic/competitionPlan';
import { PendingScores } from '@/components/competition/PendingScores';
import { EventHero, EventTiles } from '@/components/EventInfo';
import { notify } from '@/services/notify';
import { addGuestPlayer } from '@/firebase/groupPlayers';
import { shareText, notifyCopied } from '@/services/share';
import { buildShareText } from '@/components/competition/helpers';
import { EditNameModal } from '@/components/competition/EditNameModal';
import { RulesView } from '@/components/competition/RulesView';
import { ScorerModal } from '@/components/competition/ScorerModal';
import { FreeScoreModal } from '@/components/competition/FreeScoreModal';
import { AvulsoView } from '@/components/competition/AvulsoView';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import {
  RotatingView, LeagueView, GroupsPhaseView, KOView,
} from '@/components/competition/FormatViews';

// Cor aleatória para o perfil criado ao aprovar uma solicitação de inscrição

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CompetitionDetail() {
  useRequireAuth();
  const { colors: Colors } = useTheme();
  const main = useMemo(() => makeMainStyles(Colors), [Colors]);
  const upcoming = useMemo(() => makeUpcomingStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch, subscribeLiveMatches } = useCompetitions();
  const { user, isAdmin, myPlayerId, group, isMember } = useAuth();
  const [joinReqBusy, setJoinReqBusy] = useState(false);
  const { findPlayer, groupPlayers } = useGroupPlayers();
  const { scoringConfig } = useSettings();
  const comp = state.competitions.find(c => c.id === id);
  const myCategory = groupPlayers.find(p => p.id === myPlayerId)?.about?.category;

  // Placar ao vivo/rascunho (usado por GameRow/ScoreboardCard/ScorerModal
  // abaixo) não vem mais junto do listener geral de competições — precisa
  // assinar por competição aberta (ver CompetitionsContext).
  useEffect(() => {
    if (!id) return;
    return subscribeLiveMatches(id);
  }, [id]);
  const [scoring, setScoring]             = useState<Match | null>(null);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showEditName, setShowEditName]   = useState(false);
  const [showChampion, setShowChampion]   = useState(false);
  const [confirmBusy, setConfirmBusy]     = useState(false);
  const [showAddAvulso, setShowAddAvulso] = useState(false);
  const [avulsoTeamA, setAvulsoTeamA]     = useState<string[]>([]);
  const [avulsoTeamB, setAvulsoTeamB]     = useState<string[]>([]);
  const [showAddGuest, setShowAddGuest]   = useState(false);
  const [showAdminAdd, setShowAdminAdd]   = useState(false);
  const [guestName, setGuestName]         = useState('');
  const [guestBusy, setGuestBusy]         = useState(false);
  // Edição de um jogo já registrado — só admin (ver handleMatchLongPress).
  const [matchMenu, setMatchMenu]         = useState<Match | null>(null);
  const [editingMatch, setEditingMatch]   = useState<Match | null>(null);
  const [editTeamA, setEditTeamA]         = useState<string[]>([]);
  const [editTeamB, setEditTeamB]         = useState<string[]>([]);
  const champAnim  = useRef(new Animated.Value(0)).current;

  // Para competição tipo "Grupo", inicia na aba correta baseado na fase ativa
  const [activeTab, setActiveTab] = useState<'regras' | 'classificacao' | 'partidas'>(() => {
    if (comp?.format !== 'grupos') return 'partidas';
    // Se há grupos incompletos, abre em "classificacao", senão em "partidas" (mata-mata)
    const allGroupsComplete = comp.groupDefs?.every((_, gi) => groupComplete(comp.matches, gi)) ?? false;
    return allGroupsComplete ? 'partidas' : 'classificacao';
  });


  // O cartão de campeão NÃO abre mais sozinho ao entrar numa competição encerrada:
  // o campeão já aparece no topo da tela, e o botão do troféu abre o cartão quando se quer.

  // Para competição tipo "Grupo", ajusta a aba quando a fase muda (grupos completos → mata-mata)
  useEffect(() => {
    if (comp?.format === 'grupos') {
      const allGroupsComplete = comp.groupDefs?.every((_, gi) => groupComplete(comp.matches, gi)) ?? false;
      setActiveTab(allGroupsComplete ? 'partidas' : 'classificacao');
    }
  }, [comp?.matches]);

  if (!comp) {
    return (
      <SafeAreaView style={main.container}>
      <HexBackground />
        <ScreenHeader
          title="Competição"
          onBack={() => router.canGoBack() ? router.back() : router.replace('/(app)')}
        />
        <View style={{ padding: Spacing.md }}>
          <Text style={{ color: Colors.coral, ...Type.body }}>
            Competição não encontrada.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const champion = competitionChampion(comp, id => findPlayer(id)?.name ?? id, scoringConfig);
  const champPlayer = champion
    ? findPlayer(champion.members[0]) ?? { name: (champion as any).name ?? champion.members[0], color: Colors.gold }
    : null;
  const champDisplayName = champPlayer?.name ?? '';

  function handleSave(matchId: string, a: number, b: number, sets?: { a: number; b: number }[]) {
    // Ao salvar o placar final, limpa o rascunho
    dispatch({ type: 'CLEAR_DRAFT', compId: id!, matchId });
    dispatch({ type: 'SAVE_SCORE', compId: id!, matchId, scoreA: a, scoreB: b, sets });
    setScoring(null);
  }

  function handleCorrect(matchId: string, a: number, b: number, sets?: { a: number; b: number }[]) {
    dispatch({ type: 'CLEAR_DRAFT', compId: id!, matchId });
    dispatch({ type: 'CORRECT_SCORE', compId: id!, matchId, scoreA: a, scoreB: b, sets });
    setScoring(null);
  }

  function handleSaveDraft(matchId: string, draftSets: { a: number; b: number }[]) {
    dispatch({ type: 'SAVE_DRAFT', compId: id!, matchId, draftSets });
  }

  function handleClear(matchId: string) {
    if (!isAdmin) return;
    dispatch({ type: 'CLEAR_SCORE', compId: id!, matchId });
  }

  /**
   * Toque longo num jogo. Antes apagava o placar na hora, sem confirmação e
   * sem checar permissão — qualquer membro podia zerar um resultado sem querer.
   * Agora abre o menu de edição, e só para admin.
   */
  function handleMatchActionsById(matchId: string) {
    if (!isAdmin || !comp) return;
    const m = comp.matches.find(x => x.id === matchId);
    if (m) setMatchMenu(m);
  }

  /**
   * Trocar quem jogou e excluir o jogo só valem onde o confronto foi montado à
   * mão (Avulso / rodízio). Em liga, grupos e mata-mata quem joga contra quem
   * vem da estrutura da competição — mexer num jogo isolado deixaria a chave
   * inconsistente. Nesses formatos o menu oferece só corrigir/limpar placar.
   */
  function isFreeFormMatch(m: Match) {
    return !!(m.teamA && m.teamB) && (comp?.format === 'avulso' || m.stage === 'rotating');
  }

  /** "Joffre / Marcelão vs Roberto / Tiago — 5 a 7", pro cabeçalho do menu. */
  function matchDescription(m: Match) {
    const nameOf = (pid: string) => findPlayer(pid)?.name.split(' ')[0] ?? pid;
    const sideA = (m.teamA ?? (m.aId ? [m.aId] : [])).map(nameOf).join(' / ') || 'A definir';
    const sideB = (m.teamB ?? (m.bId ? [m.bId] : [])).map(nameOf).join(' / ') || 'A definir';
    const score = m.scoreA != null ? ` — ${m.scoreA} a ${m.scoreB}` : ' — sem placar';
    return `${sideA} vs ${sideB}${score}`;
  }

  function openEditPlayers(m: Match) {
    setEditTeamA(m.teamA ?? (m.aId ? [m.aId] : []));
    setEditTeamB(m.teamB ?? (m.bId ? [m.bId] : []));
    setEditingMatch(m);
  }

  function handleConfirmEditPlayers() {
    if (!editingMatch || editTeamA.length === 0 || editTeamB.length === 0) return;
    dispatch({
      type: 'EDIT_MATCH_PLAYERS',
      compId: id!,
      matchId: editingMatch.id,
      teamA: editTeamA,
      teamB: editTeamB,
    });
    setEditingMatch(null);
    setEditTeamA([]);
    setEditTeamB([]);
  }

  function confirmDestructive(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancelar', style: 'cancel' },
        { text: confirmLabel, style: 'destructive', onPress: onConfirm },
      ]);
    }
  }

  function handleMatchMenuSelect(key: string) {
    const m = matchMenu;
    setMatchMenu(null);
    if (!m) return;
    if (key === 'score')   { setScoring(m); return; }
    if (key === 'players') { openEditPlayers(m); return; }
    if (key === 'clear') {
      confirmDestructive(
        'Limpar placar',
        'O jogo continua na competição, mas sem resultado — e sai do ranking até ser marcado de novo.',
        'Limpar',
        () => handleClear(m.id),
      );
      return;
    }
    if (key === 'delete') {
      confirmDestructive(
        'Excluir jogo',
        'O jogo sai da competição e do ranking, e o post dele no feed é apagado — junto com as reações e os comentários. Não dá para desfazer.',
        'Excluir',
        () => dispatch({ type: 'DELETE_MATCH', compId: id!, matchId: m.id }),
      );
    }
  }

  // Visitante de grupo público não pode abrir o registro de placar
  function handleScore(m: Match) {
    if (!isMember) return;
    setScoring(m);
  }

  function handleReopenAvulso() {
    dispatch({ type: 'SET_STATUS', compId: comp!.id, status: 'active' });
  }

  function handleEndAvulso() {
    const doEnd = () => {
      dispatch({ type: 'SET_STATUS', compId: comp!.id, status: 'done' });
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Encerrar sessão? Não será mais possível registrar novos jogos.')) doEnd();
    } else {
      Alert.alert('Encerrar sessão', 'Não será mais possível registrar novos jogos.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Encerrar', style: 'destructive', onPress: doEnd },
      ]);
    }
  }

  function handleDelete() {
    const doDelete = () => {
      dispatch({ type: 'DELETE', compId: id! });
      router.replace('/(app)');
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Excluir competição? Esta ação não pode ser desfeita.')) doDelete();
    } else {
      Alert.alert('Excluir competição', 'Tem certeza? Esta ação não pode ser desfeita.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  async function handleShare() {
    const text = buildShareText(comp!, findPlayer, scoringConfig);
    const result = await shareText(text, comp!.name);
    if (result === 'copied') notifyCopied('Resultados');
  }

  async function handleToggleConfirm() {
    if (!group || !myPlayerId || !comp) return;
    setConfirmBusy(true);
    try {
      const inside = comp.confirmedIds?.includes(myPlayerId) || comp.waitlistIds?.includes(myPlayerId);
      if (inside) await cancelEventRegistration(group.id, comp.id, myPlayerId);
      else await registerForEvent(group.id, comp.id, myPlayerId, myCategory);
    } catch {
      notify('Sem conexão', 'Não foi possível atualizar sua inscrição. Verifique a internet e tente de novo.');
    } finally {
      setConfirmBusy(false);
    }
  }

  // Visitante (não-membro de grupo público) solicita/cancela inscrição
  const myJoinRequest = user ? comp?.joinRequests?.find(r => r.uid === user.uid) : undefined;

  async function handleRequestJoin() {
    if (!group || !user || !comp) return;
    if (!registrationGate(comp, undefined).ok) return;
    setJoinReqBusy(true);
    await requestRegistration(group.id, comp.id, {
      uid: user.uid,
      name: user.displayName ?? 'Jogador',
      requestedAt: new Date().toISOString(),
    });
    setJoinReqBusy(false);
  }

  async function handleCancelJoinRequest() {
    if (!group || !comp || !myJoinRequest) return;
    setJoinReqBusy(true);
    await cancelRegistrationRequest(group.id, comp.id, myJoinRequest);
    setJoinReqBusy(false);
  }

  // Admin aprova/recusa solicitações — aprovar vira membro pleno do grupo
  async function handleApproveJoin(request: NonNullable<typeof myJoinRequest>) {
    if (!group || !comp || !isAdmin) return;
    await approveJoinRequest(group.id, comp.id, request, PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)]);
  }

  async function handleRejectJoin(request: NonNullable<typeof myJoinRequest>) {
    if (!group || !comp || !isAdmin) return;
    await rejectJoinRequest(group.id, comp.id, request);
  }

  async function handleAddGuest() {
    const name = guestName.trim();
    if (!name || !group) return;
    setGuestBusy(true);
    const color = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
    await addGuestPlayer(group.id, name, color);
    setGuestName('');
    setGuestBusy(false);
    setShowAddGuest(false);
  }

  function handleConfirmAddAvulso() {
    if (avulsoTeamA.length === 0 || avulsoTeamB.length === 0) return;
    const newMatch: Match = {
      id: 'av_' + Date.now(),
      stage: 'rotating',
      teamA: avulsoTeamA,
      teamB: avulsoTeamB,
      scoreA: null,
      scoreB: null,
    };
    dispatch({ type: 'ADD_MATCH', compId: comp!.id, match: newMatch });
    setAvulsoTeamA([]);
    setAvulsoTeamB([]);
    setShowAddAvulso(false);
  }

  /** Fecha a lista: Avulso ativa, Super 8 gera os jogos, Liga/Grupos/Mata passam para a fase de montar. */
  function handleCloseRegistration() {
    if (!comp || !group) return;
    const closed = closeRegistration(comp, groupPlayers);
    dispatch({
      type: 'PATCH_COMP', compId: comp.id, onlyIfStatus: ['upcoming'],
      patch: { status: closed.status, competitors: closed.competitors, matches: closed.matches },
    });
    if (closed.status === 'setup') {
      if (closed.competitors.length === 0) router.push({ pathname: '/competitions/new/participants', params: { compId: comp.id } });
      else router.push({ pathname: '/competitions/new/montar', params: { id: comp.id } });
    }
  }

  async function handleAdminAdd(playerId: string) {
    if (!group || !comp) return;
    try { await registerForEvent(group.id, comp.id, playerId, null, true); }
    catch { notify('Sem conexão', 'Não foi possível adicionar o jogador. Verifique a internet e tente de novo.'); }
  }

  function handleSubstitute(match: Match, originalId: string, substituteId: string) {
    if (!isAdmin) return;
    dispatch({
      type: 'SUBSTITUTE_PLAYER',
      compId: comp!.id,
      sub: {
        originalId,
        substituteId,
        fromMatchId: match.id,
        timestamp: new Date().toISOString(),
      },
    });
  }

  const ev = eventView(comp, myPlayerId);
  const gate = registrationGate(comp, myCategory);
  const canLeave = canCancelRegistration(comp);
  const canManage = isAdmin || comp.createdBy === myPlayerId;
  const addable = groupPlayers.filter(p => !(comp.confirmedIds ?? []).includes(p.id) && !(comp.waitlistIds ?? []).includes(p.id));

  return (
    <ErrorBoundary label="CompetitionDetail">
    <SafeAreaView style={main.container} edges={['top']}>
      <HexBackground />
      {/* Champion banner */}
      {showChampion && champPlayer && (
        <Animated.View style={[main.champBanner, {
          opacity: champAnim,
          transform: [{ scale: champAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }]}>
          <View style={main.champCard}>
            <Text style={main.champCrown}>👑</Text>
            <Avatar name={champPlayer.name} color={champPlayer.color} size={60} />
            <Text style={main.champTitle}>CAMPEÃO</Text>
            <Text style={main.champName}>{champDisplayName}</Text>
            <Text style={main.champComp}>{comp.name}</Text>
          </View>
          <View style={main.champActions}>
            <TouchableOpacity style={main.champClose} onPress={() => setShowChampion(false)}>
              <Text style={main.champCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Header */}
      <ScreenHeader
        title={comp.name}
        onBack={() => router.canGoBack() ? router.back() : router.replace('/(app)')}
        onTitleLongPress={isAdmin ? () => setShowEditName(true) : undefined}
        below={
          <View style={{ flexDirection: 'row', marginTop: 3 }}>
            <Badge
              label={comp.status === 'upcoming' ? 'Agendada' : comp.status === 'setup' ? 'Montando' : comp.status === 'done' ? 'Concluída' : 'Ativa'}
              variant={comp.status === 'upcoming' || comp.status === 'setup' ? 'gold' : comp.status === 'done' ? 'teal' : 'gold'}
              small
            />
          </View>
        }
        right={
        <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
          {comp.status === 'done' && champPlayer && (
            <TouchableOpacity onPress={() => setShowChampion(true)} style={main.iconBtn}>
              <Icon name="crown" size={17} color={Colors.gold} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleShare} style={main.iconBtn}>
            <Icon name="share" size={17} color={Colors.muted} />
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity onPress={() => setShowAdminMenu(true)} style={main.iconBtn}>
              <Icon name="settings" size={17} color={Colors.muted} />
            </TouchableOpacity>
          )}
        </View>
        }
      />

      {/* Menu admin */}
      {showAdminMenu && (
        <View style={main.adminMenu}>
          <TouchableOpacity style={main.adminMenuItem} onPress={() => setShowAdminMenu(false)}>
            <Text style={main.adminMenuClose}>✕ Fechar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={main.adminMenuAction} onPress={() => { setShowAdminMenu(false); setShowEditName(true); }}>
            <Text style={main.adminMenuText}>✏️ Renomear competição</Text>
          </TouchableOpacity>
          <TouchableOpacity style={main.adminMenuAction} onPress={() => { setShowAdminMenu(false); router.push({ pathname: '/competitions/new', params: { from: comp.id } }); }}>
            <Text style={main.adminMenuText}>🔁 Repetir na próxima semana</Text>
          </TouchableOpacity>
          {comp.format === 'avulso' && comp.status !== 'done' && (
            <TouchableOpacity style={main.adminMenuAction} onPress={() => { setShowAdminMenu(false); handleEndAvulso(); }}>
              <Text style={main.adminMenuText}>🏁 Encerrar sessão</Text>
            </TouchableOpacity>
          )}
          {comp.format === 'avulso' && comp.status === 'done' && (
            <TouchableOpacity style={main.adminMenuAction} onPress={() => { setShowAdminMenu(false); handleReopenAvulso(); }}>
              <Text style={main.adminMenuText}>▶️ Reabrir sessão</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={main.adminMenuAction}
            onPress={() => { setShowAdminMenu(false); dispatch({ type: 'PATCH_COMP', compId: comp.id, patch: { config: { ...comp.config, requireConfirmation: !comp.config.requireConfirmation } } }); }}
          >
            <Text style={main.adminMenuText}>{comp.config.requireConfirmation ? '✅ Parar de exigir confirmação dos placares' : '✅ Exigir confirmação dos placares'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={main.adminMenuAction} onPress={() => { setShowAdminMenu(false); handleDelete(); }}>
            <Text style={main.adminMenuDanger}>🗑️ Excluir competição</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Painel de confirmação (upcoming) */}
      {comp.status === 'upcoming' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ ...centeredContent, padding: Spacing.md, gap: Spacing.md }}>

          {/* Painel do evento: arte, data/horário/local e inscrição */}
          <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: Colors.line }}>
            <EventHero
              comp={comp}
              statusLabel={ev.me === 'principal' ? 'Você está dentro' : ev.me === 'espera' ? 'Na lista de espera' : ev.full ? 'Lotado' : 'Inscrições abertas'}
              statusColor={ev.me === 'principal' || !ev.full ? Colors.teal : Colors.gold}
              height={220}
            />
          </View>
          <EventTiles comp={comp} />

          {/* Categoria de nível, quando a competição não é aberta */}
          {comp.levelCategory && comp.levelCategory !== 'Aberta' && (
            <Text style={{ ...Type.caption, fontSize: 14, color: Colors.gold, textAlign: 'center' }}>
              Categoria {comp.levelCategory}: só jogadores dessa categoria se inscrevem.
            </Text>
          )}

          {/* Botão confirmar / cancelar — membros do grupo */}
          {myPlayerId && (ev.me ? canLeave : gate.ok && !ev.closedFull) && (
            <TouchableOpacity
              style={[upcoming.confirmBtn,
                ev.me ? upcoming.confirmBtnCancel : upcoming.confirmBtnJoin,
                confirmBusy && { opacity: 0.5 },
              ]}
              onPress={handleToggleConfirm}
              disabled={confirmBusy}
              activeOpacity={0.8}
            >
              <Text style={[upcoming.confirmBtnText, ev.me && { color: Colors.muted }]}>
                {ev.action === 'cancel' ? 'Cancelar inscrição'
                  : ev.action === 'leaveWaitlist' ? `Sair da lista de espera (${ev.waitPos}º na fila)`
                  : ev.action === 'waitlist' ? 'Entrar na lista de espera'
                  : 'Inscrever-se'}
              </Text>
            </TouchableOpacity>
          )}

          {myPlayerId && (
            <Text style={{ ...Type.caption, fontSize: 14, color: ev.me || gate.ok ? Colors.muted : Colors.gold, textAlign: 'center', marginTop: -Spacing.sm }}>
              {ev.me && !canLeave ? 'O prazo para cancelar já passou. Fale com o organizador.'
                : !ev.me && !gate.ok ? gate.reason
                : ev.closedFull ? 'Vagas esgotadas.'
                : ev.me === 'espera' ? 'Se abrir uma vaga, você entra sozinho.'
                : ev.full && !ev.me ? 'Sem vagas no momento — você entra na fila e é chamado se alguém cancelar.'
                : 'Quando todos estiverem prontos, o criador inicia a competição.'}
            </Text>
          )}

          {/* Botão solicitar / cancelar inscrição — visitante de grupo público */}
          {!isMember && user && !myJoinRequest && !gate.ok && (
            <Text style={{ ...Type.caption, fontSize: 14, color: Colors.gold, textAlign: 'center' }}>{gate.reason}</Text>
          )}
          {!isMember && user && (myJoinRequest || gate.ok) && (
            <TouchableOpacity
              style={[upcoming.confirmBtn,
                myJoinRequest ? upcoming.confirmBtnCancel : upcoming.confirmBtnJoin,
                joinReqBusy && { opacity: 0.5 },
              ]}
              onPress={myJoinRequest ? handleCancelJoinRequest : handleRequestJoin}
              disabled={joinReqBusy}
              activeOpacity={0.8}
            >
              <Text style={[upcoming.confirmBtnText, myJoinRequest && { color: Colors.muted }]}>
                {myJoinRequest ? '⏳ Aguardando aprovação — cancelar' : '✋ Solicitar inscrição'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Solicitações pendentes — visível só para admin */}
          {isAdmin && (comp.joinRequests?.length ?? 0) > 0 && (
            <View style={upcoming.section}>
              <Text style={upcoming.sectionTitle}>
                SOLICITAÇÕES ({comp.joinRequests!.length})
              </Text>
              {comp.joinRequests!.map(r => (
                <View key={r.uid} style={upcoming.playerRow}>
                  <Avatar name={r.name} color={Colors.gold} size={30} />
                  <Text style={upcoming.playerName}>{r.name}</Text>
                  <TouchableOpacity onPress={() => handleRejectJoin(r)} hitSlop={8} style={{ marginRight: Spacing.sm }}>
                    <Text style={{ color: Colors.coral, fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleApproveJoin(r)} hitSlop={8}>
                    <Text style={{ color: Colors.teal, fontSize: 18 }}>✓</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Lista de confirmados */}
          <View style={upcoming.section}>
            <Text style={upcoming.sectionTitle}>
              CONFIRMADOS ({ev.vagas != null ? `${ev.taken}/${ev.vagas}` : ev.taken})
            </Text>
            {(comp.confirmedIds ?? []).length === 0 ? (
              <Text style={upcoming.empty}>Nenhum jogador confirmou ainda.</Text>
            ) : (
              (comp.confirmedIds ?? []).map(pid => {
                const pl = findPlayer(pid);
                return (
                  <View key={pid} style={upcoming.playerRow}>
                    {pl && <Avatar name={pl.name} color={pl.color} size={30} />}
                    <Text style={upcoming.playerName}>{pl?.name ?? pid}</Text>
                    <Icon name="check" size={15} color={Colors.teal} />
                  </View>
                );
              })
            )}
          </View>

          {/* Fila de espera — só aparece quando há alguém nela */}
          {(comp.waitlistIds ?? []).length > 0 && (
            <View style={upcoming.section}>
              <Text style={upcoming.sectionTitle}>LISTA DE ESPERA ({(comp.waitlistIds ?? []).length})</Text>
              {(comp.waitlistIds ?? []).map((pid, i) => {
                const pl = findPlayer(pid);
                return (
                  <View key={pid} style={upcoming.playerRow}>
                    {pl && <Avatar name={pl.name} color={pl.color} size={30} />}
                    <Text style={upcoming.playerName}>{pl?.name ?? pid}</Text>
                    <Text style={upcoming.empty}>{i + 1}º</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Admin adiciona jogadores direto (vale também no modo "só o admin adiciona") */}
          {canManage && (
            <TouchableOpacity style={upcoming.addBtn} onPress={() => setShowAdminAdd(true)} activeOpacity={0.85}>
              <Text style={upcoming.addBtnText}>+ Adicionar jogador à lista</Text>
            </TouchableOpacity>
          )}

          {/* Fechar a lista (criador ou admin) */}
          {canManage && (comp.confirmedIds ?? []).length >= 2 && (
            <TouchableOpacity style={upcoming.startBtn} onPress={handleCloseRegistration} activeOpacity={0.85}>
              <Text style={upcoming.startBtnIcon}>⚡</Text>
              <Text style={upcoming.startBtnText}>
                {comp.format === 'avulso' ? `Iniciar com ${(comp.confirmedIds ?? []).length} jogadores`
                  : comp.format === 'super8' ? 'Fechar inscrições e gerar jogos'
                  : 'Fechar inscrições e montar'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Abas unificadas */}
      {comp.status === 'setup' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ ...centeredContent, padding: Spacing.md, gap: Spacing.md }}>
          <View style={upcoming.section}>
            <Text style={upcoming.sectionTitle}>MONTANDO A COMPETIÇÃO</Text>
            <Text style={{ ...Type.body, fontSize: 15, lineHeight: 22, color: Colors.text }}>
              {comp.competitors.length === 0
                ? 'Ainda não há jogadores definidos.'
                : `${comp.competitors.length} ${comp.unit === 'duplas' ? 'duplas' : 'jogadores'} na lista. Falta definir ${comp.format === 'grupos' ? 'grupos, turnos e chaveamento' : comp.format === 'liga' ? 'os turnos' : 'o chaveamento'} para gerar os jogos.`}
            </Text>
          </View>
          {canManage ? (
            <TouchableOpacity
              style={upcoming.startBtn} activeOpacity={0.85}
              onPress={() => comp.competitors.length === 0
                ? router.push({ pathname: '/competitions/new/participants', params: { compId: comp.id } })
                : router.push({ pathname: '/competitions/new/montar', params: { id: comp.id } })}
            >
              <Text style={upcoming.startBtnText}>
                {comp.competitors.length === 0 ? (comp.unit === 'duplas' ? 'Montar as duplas' : 'Escolher jogadores')
                  : comp.format === 'grupos' ? 'Montar grupos' : comp.format === 'liga' ? 'Montar liga' : 'Montar chaveamento'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={upcoming.empty}>O organizador está montando a competição. Os jogos aparecem aqui assim que forem gerados.</Text>
          )}
          {canManage && comp.competitors.length > 0 && (
            <TouchableOpacity style={upcoming.addBtn} activeOpacity={0.85} onPress={() => router.push({ pathname: '/competitions/new/participants', params: { compId: comp.id } })}>
              <Text style={upcoming.addBtnText}>Alterar jogadores</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {comp.status !== 'upcoming' && comp.status !== 'setup' && (
        <View style={{ flex: 1 }}>
          <PendingScores comp={comp} />
          <View style={main.tabBar}>
            {/* Rótulos sem emoji — o app tem set de ícones próprio, e aqui
                📋🏆⚔️🎾 conviviam com ícones SVG na mesma tela. */}
            {(comp.format === 'grupos'
              ? [
                  { key: 'regras',        label: 'Regras' },
                  { key: 'classificacao', label: 'Fase de Grupos' },
                  { key: 'partidas',      label: 'Mata-mata' },
                ] as const
              : comp.format === 'liga' || comp.format === 'avulso' || comp.format === 'super8'
                ? [
                    // Classificação + jogos numa aba só (sem duplicar o ranking)
                    { key: 'regras',   label: 'Regras' },
                    { key: 'partidas', label: 'Partidas' },
                  ] as const
                : [
                    { key: 'regras',        label: 'Regras' },
                    { key: 'classificacao', label: 'Classificação' },
                    { key: 'partidas',      label: 'Partidas' },
                  ] as const
            ).map(t => (
              <TouchableOpacity
                key={t.key}
                style={[main.tab, activeTab === t.key && main.tabActive]}
                onPress={() => setActiveTab(t.key)}
                activeOpacity={0.7}
              >
                <Text style={[main.tabLabel, activeTab === t.key && main.tabLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'regras' && <RulesView comp={comp} />}

          {activeTab === 'classificacao' && (
            comp.format === 'grupos'
              ? <GroupsPhaseView comp={comp} onScore={handleScore} onMatchActions={handleMatchActionsById} />
              /* Mata-mata não tem tabela de classificação — mas tem chave.
                 Aqui era um beco sem saída ("não possui classificação"); o
                 chaveamento existia em app/bracket.tsx sem nenhuma entrada. */
              : <ScrollView contentContainerStyle={{ ...centeredContent, padding: 16, paddingBottom: 40, gap: 12 }}>
                  <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 24 }}>
                    Mata-mata não tem tabela de classificação — a posição de cada
                    dupla é a fase até onde ela chegou.
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/bracket', params: { competitionId: comp.id } })}
                    activeOpacity={0.85}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                      height: 48, borderRadius: Radius.full,
                      backgroundColor: Colors.gold,
                    }}
                  >
                    <Icon name="ranking" size={17} color={Colors.bg} />
                    <Text style={{ fontFamily: FontFamily.title, fontSize: 14, color: Colors.bg }}>
                      Ver chaveamento
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
          )}

          {activeTab === 'partidas' && (
            comp.format === 'grupos'
              ? <KOView comp={comp} onScore={handleScore} onMatchActions={handleMatchActionsById}
                  preview={comp.status !== 'done' && !(comp.groupDefs?.every((_, gi) => groupComplete(comp.matches, gi)) ?? false)} />
              : comp.format === 'liga'
                ? <LeagueView comp={comp} onScore={handleScore} onMatchActions={handleMatchActionsById}
                    onSubstitute={isAdmin ? handleSubstitute : undefined} />
                : comp.format === 'mata'
                  ? <KOView comp={comp} onScore={handleScore} onMatchActions={handleMatchActionsById} />
                  : comp.format === 'avulso'
                    ? <AvulsoView comp={comp} onScore={handleScore} onMatchActions={handleMatchActionsById}
                        onAddMatch={() => setShowAddAvulso(true)} canEdit={isAdmin} />
                    : <RotatingView comp={comp} onScore={handleScore} onMatchActions={handleMatchActionsById}
                        onSubstitute={isAdmin ? handleSubstitute : undefined} />
          )}
        </View>
      )}

      {/* Modal: adicionar jogo avulso */}
      <Modal visible={showAddAvulso} transparent animationType="slide" onRequestClose={() => setShowAddAvulso(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md, maxHeight: '85%' }}>
            <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text }}>Registrar jogo</Text>

            {isAdmin && (
              <TouchableOpacity
                onPress={() => setShowAddGuest(true)}
                style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.teal }}>+ Novo jogador / convidado</Text>
              </TouchableOpacity>
            )}

            {(['A', 'B'] as const).map(side => {
              const team = side === 'A' ? avulsoTeamA : avulsoTeamB;
              const setTeam = side === 'A' ? setAvulsoTeamA : setAvulsoTeamB;
              const otherTeam = side === 'A' ? avulsoTeamB : avulsoTeamA;
              return (
                <View key={side} style={{ gap: Spacing.xs }}>
                  <Text style={{ fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted, letterSpacing: 1 }}>
                    DUPLA {side} {team.length > 0 ? `— ${team.map(id => findPlayer(id)?.name ?? id).join(' / ')}` : ''}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
                      {groupPlayers.filter(p => !otherTeam.includes(p.id)).map(p => {
                        const selected = team.includes(p.id);
                        return (
                          <TouchableOpacity
                            key={p.id}
                            onPress={() => {
                              if (selected) setTeam(team.filter(id => id !== p.id));
                              else if (team.length < 2) setTeam([...team, p.id]);
                            }}
                            style={{
                              paddingHorizontal: Spacing.sm, paddingVertical: 6,
                              borderRadius: Radius.full,
                              backgroundColor: selected ? Colors.gold : Colors.surf2,
                              borderWidth: 1,
                              borderColor: selected ? Colors.gold : Colors.line,
                            }}
                          >
                            <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13, color: selected ? Colors.bg : Colors.text }}>
                              {p.name.split(' ')[0]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              );
            })}

            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' }}
                onPress={() => { setShowAddAvulso(false); setAvulsoTeamA([]); setAvulsoTeamB([]); }}
              >
                <Text style={{ fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
                  (avulsoTeamA.length === 0 || avulsoTeamB.length === 0) && { opacity: 0.4 }]}
                onPress={handleConfirmAddAvulso}
                disabled={avulsoTeamA.length === 0 || avulsoTeamB.length === 0}
              >
                <Text style={{ fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg }}>Adicionar jogo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Menu de edição de um jogo — só admin (handleMatchActionsById) */}
      {matchMenu && (
        <OptionModal
          title="Editar jogo"
          message={matchDescription(matchMenu)}
          options={[
            { key: 'score',   label: matchMenu.scoreA != null ? 'Corrigir placar' : 'Marcar placar', icon: 'edit' },
            ...(isFreeFormMatch(matchMenu)
              ? [{ key: 'players', label: 'Trocar jogadores', icon: 'swap' as const }]
              : []),
            ...(matchMenu.scoreA != null
              ? [{ key: 'clear', label: 'Limpar placar', icon: 'minus' as const, color: Colors.muted }]
              : []),
            ...(isFreeFormMatch(matchMenu)
              ? [{ key: 'delete', label: 'Excluir jogo', icon: 'trash' as const, color: Colors.coral }]
              : []),
          ]}
          onSelect={handleMatchMenuSelect}
          onClose={() => setMatchMenu(null)}
        />
      )}

      {/* Modal: trocar os jogadores de um jogo já criado */}
      <Modal visible={!!editingMatch} transparent animationType="slide" onRequestClose={() => setEditingMatch(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md, maxHeight: '85%' }}>
            <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text }}>Trocar jogadores</Text>
            {editingMatch?.scoreA != null && (
              <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted }}>
                O placar registrado continua o mesmo — muda só quem jogou. O ranking é recalculado.
              </Text>
            )}

            {(['A', 'B'] as const).map(side => {
              const team = side === 'A' ? editTeamA : editTeamB;
              const setTeam = side === 'A' ? setEditTeamA : setEditTeamB;
              const otherTeam = side === 'A' ? editTeamB : editTeamA;
              return (
                <View key={side} style={{ gap: Spacing.xs }}>
                  <Text style={{ fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted, letterSpacing: 1 }}>
                    DUPLA {side} {team.length > 0 ? `— ${team.map(pid => findPlayer(pid)?.name ?? pid).join(' / ')}` : ''}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
                      {groupPlayers.filter(p => !otherTeam.includes(p.id)).map(p => {
                        const selected = team.includes(p.id);
                        return (
                          <TouchableOpacity
                            key={p.id}
                            onPress={() => {
                              if (selected) setTeam(team.filter(pid => pid !== p.id));
                              else if (team.length < 2) setTeam([...team, p.id]);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`${p.name}, dupla ${side}${selected ? ', selecionado' : ''}`}
                            style={{
                              paddingHorizontal: Spacing.sm, paddingVertical: 11,
                              borderRadius: Radius.full,
                              backgroundColor: selected ? Colors.gold : Colors.surf2,
                              borderWidth: 1,
                              borderColor: selected ? Colors.gold : Colors.line,
                            }}
                          >
                            <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13, color: selected ? Colors.bg : Colors.text }}>
                              {p.name.split(' ')[0]}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              );
            })}

            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' }}
                onPress={() => { setEditingMatch(null); setEditTeamA([]); setEditTeamB([]); }}
              >
                <Text style={{ fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
                  (editTeamA.length === 0 || editTeamB.length === 0) && { opacity: 0.4 }]}
                onPress={handleConfirmEditPlayers}
                disabled={editTeamA.length === 0 || editTeamB.length === 0}
              >
                <Text style={{ fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: admin adiciona jogador à lista de inscritos */}
      <Modal visible={showAdminAdd} transparent animationType="slide" onRequestClose={() => setShowAdminAdd(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm, maxHeight: '75%' }}>
            <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text }}>Adicionar jogador</Text>
            <ScrollView>
              {addable.length === 0 && <Text style={upcoming.empty}>Todos os jogadores do grupo já estão na lista.</Text>}
              {addable.map(p => (
                <TouchableOpacity key={p.id} style={[upcoming.playerRow, { minHeight: 48 }]} onPress={() => handleAdminAdd(p.id)} activeOpacity={0.7}>
                  <Avatar name={p.name} color={p.color} size={30} />
                  <Text style={upcoming.playerName}>{p.name}</Text>
                  <Text style={{ color: Colors.teal, fontSize: 20 }}>+</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={{ borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setShowAdminAdd(false)}
            >
              <Text style={{ fontFamily: FontFamily.title, fontSize: 15, color: Colors.muted }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: novo convidado (jogador sem cadastro) */}
      <Modal visible={showAddGuest} transparent animationType="slide" onRequestClose={() => setShowAddGuest(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md }}>
            <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text }}>Novo jogador / convidado</Text>
            <TextInput
              value={guestName}
              onChangeText={setGuestName}
              placeholder="Nome do jogador"
              placeholderTextColor={Colors.faint}
              autoFocus
              onSubmitEditing={handleAddGuest}
              style={{
                backgroundColor: Colors.surf2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line,
                paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: FontFamily.body, fontSize: 15, color: Colors.text,
              }}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' }}
                onPress={() => { setShowAddGuest(false); setGuestName(''); }}
              >
                <Text style={{ fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 2, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
                  (!guestName.trim() || guestBusy) && { opacity: 0.4 }]}
                onPress={handleAddGuest}
                disabled={!guestName.trim() || guestBusy}
              >
                <Text style={{ fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg }}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {comp.format === 'avulso' ? (
        <FreeScoreModal
          match={scoring}
          comp={comp}
          onClose={() => setScoring(null)}
          onSave={isAdmin && scoring?.scoreA != null ? handleCorrect : handleSave}
          onClear={handleClear}
          isAdmin={isAdmin}
        />
      ) : (
        <ScorerModal
          match={scoring}
          comp={comp}
          onClose={() => setScoring(null)}
          onSave={isAdmin && scoring?.scoreA != null ? handleCorrect : handleSave}
          onSaveDraft={handleSaveDraft}
          onClear={handleClear}
          isAdmin={isAdmin}
        />
      )}

      {showEditName && (
        <EditNameModal
          current={comp.name}
          onClose={() => setShowEditName(false)}
          onSave={(name) => dispatch({ type: 'RENAME', compId: id!, name })}
        />
      )}

    </SafeAreaView>
    </ErrorBoundary>
  );
}

const makeMainStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 18, color: Colors.muted },
  adminMenu: { backgroundColor: Colors.surf2, borderBottomWidth: 1, borderBottomColor: Colors.line, padding: Spacing.sm, gap: Spacing.xs },
  adminMenuItem: { alignSelf: 'flex-end' },
  adminMenuClose: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  adminMenuAction: { paddingVertical: Spacing.xs },
  adminMenuText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text },
  adminMenuDanger: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.coral },
  tabBar: { flexDirection: 'row', marginHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: Colors.gold },
  tabLabel: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.muted },
  tabLabelActive: { color: Colors.gold, fontFamily: FontFamily.title },
  // Champion banner
  champBanner: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center',
    padding: Spacing.xl,
  },
  champCard: {
    backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.xl,
    alignItems: 'center', gap: Spacing.md, width: '100%', borderWidth: 2, borderColor: Colors.gold,
  },
  champCrown: { fontSize: 48 },
  champTitle: { fontFamily: FontFamily.titleBold, fontSize: 13, color: Colors.gold, letterSpacing: 3 },
  champName: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text, textAlign: 'center' },
  champComp: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  champActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md, width: '100%' },
  champBtn: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.sm, alignItems: 'center' },
  champBtnText: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },
  champClose: { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.sm, alignItems: 'center' },
  champCloseText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted },
});

const makeUpcomingStyles = (Colors: ThemeColors) => StyleSheet.create({
  infoBanner: { flexDirection: 'row', gap: Spacing.md, backgroundColor: 'rgba(243,197,68,0.08)', borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(243,197,68,0.25)', padding: Spacing.md, alignItems: 'flex-start' },
  infoIcon:   { fontSize: 24 },
  infoTitle:  { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  infoSub:    { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, marginTop: 4, lineHeight: 20 },
  confirmBtn: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  confirmBtnJoin:   { backgroundColor: Colors.gold },
  confirmBtnCancel: { backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line },
  confirmBtnText:   { fontFamily: FontFamily.title, fontSize: 17, color: Colors.bg },
  section:     { gap: Spacing.sm },
  sectionTitle:{ fontFamily: FontFamily.titleBold, fontSize: 12, lineHeight: 16, color: Colors.muted, letterSpacing: 1.3 },
  empty:       { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, textAlign: 'center', paddingVertical: Spacing.md },
  playerRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.line },
  playerName:  { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 16, color: Colors.text },
  startBtn:    { backgroundColor: Colors.teal, borderRadius: Radius.md, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 50 },
  addBtn:      { borderWidth: 1.5, borderColor: Colors.gold, borderRadius: Radius.md, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  addBtnText:  { fontFamily: FontFamily.title, fontSize: 15, color: Colors.gold },
  startBtnIcon:{ fontSize: 18 },
  startBtnText:{ fontFamily: FontFamily.title, fontSize: 17, color: Colors.bg },
});
