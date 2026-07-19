import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Platform,
  Animated, Dimensions, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useRef, useEffect, useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Avatar, Badge, Card } from '@/components';
import { competitionChampion, groupComplete } from '@/logic/formats';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Match, Competition } from '@/logic/types';
import ConfettiCannon from 'react-native-confetti-cannon';
import {
  confirmParticipation, cancelParticipation,
  requestRegistration, cancelRegistrationRequest, approveJoinRequest, rejectJoinRequest,
} from '@/firebase/competitions';
import { addGuestPlayer } from '@/firebase/groupPlayers';
import { shareText, notifyCopied } from '@/services/share';
import { buildShareText } from '@/components/competition/helpers';
import { EditNameModal } from '@/components/competition/EditNameModal';
import { RulesView } from '@/components/competition/RulesView';
import { ScorerModal } from '@/components/competition/ScorerModal';
import { FreeScoreModal } from '@/components/competition/FreeScoreModal';
import { AvulsoView } from '@/components/competition/AvulsoView';
import {
  RotatingView, ClassificacaoView, LeagueView, GroupsPhaseView, KOView,
} from '@/components/competition/FormatViews';

// Cor aleatória para o perfil criado ao aprovar uma solicitação de inscrição
const GUEST_COLORS = ['#FFD166', '#2DD4BF', '#A78BFA', '#34D399', '#F472B6', '#94A3B8', '#FB923C', '#60A5FA'];

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CompetitionDetail() {
  const { colors: Colors } = useTheme();
  const main = useMemo(() => makeMainStyles(Colors), [Colors]);
  const upcoming = useMemo(() => makeUpcomingStyles(Colors), [Colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useCompetitions();
  const { user, isAdmin, myPlayerId, group, isMember } = useAuth();
  const [joinReqBusy, setJoinReqBusy] = useState(false);
  const { findPlayer, groupPlayers } = useGroupPlayers();
  const comp = state.competitions.find(c => c.id === id);
  const [scoring, setScoring]             = useState<Match | null>(null);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showEditName, setShowEditName]   = useState(false);
  const [showConfetti, setShowConfetti]   = useState(false);
  const [showChampion, setShowChampion]   = useState(false);
  const [confirmBusy, setConfirmBusy]     = useState(false);
  const [showAddAvulso, setShowAddAvulso] = useState(false);
  const [avulsoTeamA, setAvulsoTeamA]     = useState<string[]>([]);
  const [avulsoTeamB, setAvulsoTeamB]     = useState<string[]>([]);
  const [showAddGuest, setShowAddGuest]   = useState(false);
  const [guestName, setGuestName]         = useState('');
  const [guestBusy, setGuestBusy]         = useState(false);
  const champAnim  = useRef(new Animated.Value(0)).current;
  const screenW = Dimensions.get('window').width;
  const confettiFired = useRef(false);

  // Para competição tipo "Grupo", inicia na aba correta baseado na fase ativa
  const [activeTab, setActiveTab] = useState<'regras' | 'classificacao' | 'partidas'>(() => {
    if (comp?.format !== 'grupos') return 'partidas';
    // Se há grupos incompletos, abre em "classificacao", senão em "partidas" (mata-mata)
    const allGroupsComplete = comp.groupDefs?.every((_, gi) => groupComplete(comp.matches, gi)) ?? false;
    return allGroupsComplete ? 'partidas' : 'classificacao';
  });

  function triggerChampion() {
    if (confettiFired.current) return;
    confettiFired.current = true;
    setShowConfetti(true);
    setShowChampion(true);
    champAnim.setValue(0);
    Animated.spring(champAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }).start();
    setTimeout(() => setShowConfetti(false), 4000);
  }

  // Dispara quando o status muda para 'done' em tempo real
  useEffect(() => {
    if (comp?.status === 'done' && competitionChampion(comp, id => findPlayer(id)?.name ?? id)) triggerChampion();
  }, [comp?.status]);

  // Dispara ao entrar numa competição já concluída (comp carrega após montagem)
  useEffect(() => {
    if (comp?.status === 'done' && competitionChampion(comp, id => findPlayer(id)?.name ?? id)) triggerChampion();
  }, [!!comp]);

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md }}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')}>
            <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal }}>←</Text>
          </TouchableOpacity>
          <Text style={{ color: Colors.coral, fontFamily: FontFamily.body, fontSize: 14 }}>
            Competição não encontrada.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const champion = competitionChampion(comp, id => findPlayer(id)?.name ?? id);
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
    if (!isMember) return; // visitante: somente leitura
    dispatch({ type: 'CLEAR_SCORE', compId: id!, matchId });
  }

  // Visitante de grupo público não pode abrir o registro de placar
  function handleScore(m: Match) {
    if (!isMember) return;
    setScoring(m);
  }

  function handleReopenAvulso() {
    dispatch({ type: 'UPDATE', comp: { ...comp!, status: 'active' } });
  }

  function handleEndAvulso() {
    const doEnd = () => {
      dispatch({ type: 'UPDATE', comp: { ...comp!, status: 'done' } });
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
    const text = buildShareText(comp!, findPlayer);
    const result = await shareText(text, comp!.name);
    if (result === 'copied') notifyCopied('Resultados');
  }

  async function handleToggleConfirm() {
    if (!group || !myPlayerId || !comp) return;
    setConfirmBusy(true);
    const already = comp.confirmedIds?.includes(myPlayerId);
    if (already) {
      await cancelParticipation(group.id, comp.id, myPlayerId);
    } else {
      await confirmParticipation(group.id, comp.id, myPlayerId);
    }
    setConfirmBusy(false);
  }

  // Visitante (não-membro de grupo público) solicita/cancela inscrição
  const myJoinRequest = user ? comp?.joinRequests?.find(r => r.uid === user.uid) : undefined;

  async function handleRequestJoin() {
    if (!group || !user || !comp) return;
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
    await approveJoinRequest(group.id, comp.id, request, GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)]);
  }

  async function handleRejectJoin(request: NonNullable<typeof myJoinRequest>) {
    if (!group || !comp || !isAdmin) return;
    await rejectJoinRequest(group.id, comp.id, request);
  }

  async function handleAddGuest() {
    const name = guestName.trim();
    if (!name || !group) return;
    setGuestBusy(true);
    const color = GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)];
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
    dispatch({
      type: 'UPDATE',
      comp: { ...comp!, matches: [...comp!.matches, newMatch], status: 'active' },
    });
    setAvulsoTeamA([]);
    setAvulsoTeamB([]);
    setShowAddAvulso(false);
  }

  async function handleStartUpcoming() {
    if (!comp || !group) return;
    // Monta competidores a partir dos jogadores confirmados
    const confirmedPlayers = (comp.confirmedIds ?? [])
      .map(pid => findPlayer(pid))
      .filter(Boolean) as typeof groupPlayers;
    const competitors = confirmedPlayers.map(p => ({
      id: p.id, name: p.name, short: p.name.slice(0, 3).toUpperCase(),
      color: p.color, members: [p.id],
    }));
    dispatch({
      type: 'UPDATE',
      comp: {
        ...comp,
        status: 'active',
        competitors,
        confirmedIds: comp.confirmedIds,
      },
    });
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

  return (
    <SafeAreaView style={main.container} edges={['top']}>
      {/* Confetti */}
      {showConfetti && (
        <ConfettiCannon
          count={120}
          origin={{ x: screenW / 2, y: -20 }}
          autoStart
          fadeOut
          colors={[Colors.gold, Colors.teal, '#FF6B6B', '#FFFFFF', '#A8DADC']}
        />
      )}

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
      <View style={main.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')}>
          <Text style={main.back}>←</Text>
        </TouchableOpacity>
        <View style={main.headerInfo}>
          <TouchableOpacity onLongPress={isAdmin ? () => setShowEditName(true) : undefined} activeOpacity={isAdmin ? 0.7 : 1}>
            <Text style={main.compName} numberOfLines={1}>{comp.name}</Text>
          </TouchableOpacity>
          <Badge
            label={comp.status === 'upcoming' ? 'Agendada' : comp.status === 'done' ? 'Concluída' : 'Ativa'}
            variant={comp.status === 'upcoming' ? 'gold' : comp.status === 'done' ? 'teal' : 'gold'}
            small
          />
        </View>
        <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
          {comp.status === 'done' && champPlayer && (
            <TouchableOpacity onPress={() => setShowChampion(true)} style={main.iconBtn}>
              <Text style={main.iconBtnText}>👑</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleShare} style={main.iconBtn}>
            <Text style={main.iconBtnText}>↑</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity onPress={() => setShowAdminMenu(true)} style={main.iconBtn}>
              <Text style={main.iconBtnText}>⚙️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isAdmin && <Text style={main.editHint}>Segure o nome para renomear</Text>}

      {/* Menu admin */}
      {showAdminMenu && (
        <View style={main.adminMenu}>
          <TouchableOpacity style={main.adminMenuItem} onPress={() => setShowAdminMenu(false)}>
            <Text style={main.adminMenuClose}>✕ Fechar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={main.adminMenuAction} onPress={() => { setShowAdminMenu(false); setShowEditName(true); }}>
            <Text style={main.adminMenuText}>✏️ Renomear competição</Text>
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
          <TouchableOpacity style={main.adminMenuAction} onPress={() => { setShowAdminMenu(false); handleDelete(); }}>
            <Text style={main.adminMenuDanger}>🗑️ Excluir competição</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Painel de confirmação (upcoming) */}
      {comp.status === 'upcoming' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}>

          {/* Banner info */}
          <View style={upcoming.infoBanner}>
            <Text style={upcoming.infoIcon}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={upcoming.infoTitle}>Competição agendada</Text>
              <Text style={upcoming.infoSub}>
                Confirme sua participação. Quando todos estiverem prontos, o criador inicia a competição.
              </Text>
            </View>
          </View>

          {/* Botão confirmar / cancelar — membros do grupo */}
          {myPlayerId && (
            <TouchableOpacity
              style={[upcoming.confirmBtn,
                comp.confirmedIds?.includes(myPlayerId) ? upcoming.confirmBtnCancel : upcoming.confirmBtnJoin,
                confirmBusy && { opacity: 0.5 },
              ]}
              onPress={handleToggleConfirm}
              disabled={confirmBusy}
              activeOpacity={0.8}
            >
              <Text style={[upcoming.confirmBtnText, comp.confirmedIds?.includes(myPlayerId) && { color: Colors.muted }]}>
                {comp.confirmedIds?.includes(myPlayerId) ? '✓ Confirmado — cancelar' : '+ Confirmar participação'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Botão solicitar / cancelar inscrição — visitante de grupo público */}
          {!isMember && user && (
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
              CONFIRMADOS ({(comp.confirmedIds ?? []).length})
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
                    <Text style={{ color: Colors.teal, fontSize: 16 }}>✓</Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Botão iniciar (criador ou admin) */}
          {(isAdmin || comp.createdBy === myPlayerId) && (comp.confirmedIds ?? []).length >= 2 && (
            <TouchableOpacity style={upcoming.startBtn} onPress={handleStartUpcoming} activeOpacity={0.85}>
              <Text style={upcoming.startBtnIcon}>⚡</Text>
              <Text style={upcoming.startBtnText}>
                Iniciar com {(comp.confirmedIds ?? []).length} jogadores
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Abas unificadas */}
      {comp.status !== 'upcoming' && (
        <View style={{ flex: 1 }}>
          <View style={main.tabBar}>
            {(comp.format === 'grupos'
              ? [
                  { key: 'regras',        label: '📋 Regras' },
                  { key: 'classificacao', label: '🏆 Fase de Grupos' },
                  { key: 'partidas',      label: '⚔️ Mata-mata' },
                ] as const
              : [
                  { key: 'regras',        label: '📋 Regras' },
                  { key: 'classificacao', label: '🏆 Classificação' },
                  { key: 'partidas',      label: '🎾 Partidas' },
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
              ? <GroupsPhaseView comp={comp} onScore={handleScore} onClear={handleClear} />
              : comp.format === 'liga' || comp.format === 'avulso' || comp.format === 'super8'
                ? <ClassificacaoView comp={comp} />
                : <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                    <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 32 }}>
                      Formato mata-mata não possui classificação.
                    </Text>
                  </ScrollView>
          )}

          {activeTab === 'partidas' && (
            comp.format === 'grupos'
              ? <KOView comp={comp} onScore={handleScore} onClear={handleClear}
                  preview={comp.status !== 'done' && !(comp.groupDefs?.every((_, gi) => groupComplete(comp.matches, gi)) ?? false)} />
              : comp.format === 'liga'
                ? <LeagueView comp={comp} onScore={handleScore} onClear={handleClear}
                    onSubstitute={isAdmin ? handleSubstitute : undefined} />
                : comp.format === 'mata'
                  ? <KOView comp={comp} onScore={handleScore} onClear={handleClear} />
                  : comp.format === 'avulso'
                    ? <AvulsoView comp={comp} onScore={handleScore} onClear={handleClear}
                        onAddMatch={() => setShowAddAvulso(true)} />
                    : <RotatingView comp={comp} onScore={handleScore} onClear={handleClear}
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
  );
}

const makeMainStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line },
  back: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  compName: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  editHint: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint, textAlign: 'center', paddingVertical: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 18, color: Colors.muted },
  adminMenu: { backgroundColor: Colors.surf2, borderBottomWidth: 1, borderBottomColor: Colors.line, padding: Spacing.sm, gap: Spacing.xs },
  adminMenuItem: { alignSelf: 'flex-end' },
  adminMenuClose: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  adminMenuAction: { paddingVertical: Spacing.xs },
  adminMenuText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  adminMenuDanger: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.coral },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surf2, borderBottomWidth: 1, borderBottomColor: Colors.line },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.gold },
  tabLabel: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.faint },
  tabLabelActive: { color: Colors.gold },
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
  champBtnText: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.bg },
  champClose: { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.sm, alignItems: 'center' },
  champCloseText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
});

const makeUpcomingStyles = (Colors: ThemeColors) => StyleSheet.create({
  infoBanner: { flexDirection: 'row', gap: Spacing.md, backgroundColor: 'rgba(243,197,68,0.08)', borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(243,197,68,0.25)', padding: Spacing.md, alignItems: 'flex-start' },
  infoIcon:   { fontSize: 24 },
  infoTitle:  { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  infoSub:    { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, marginTop: 4, lineHeight: 18 },
  confirmBtn: { borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  confirmBtnJoin:   { backgroundColor: Colors.gold },
  confirmBtnCancel: { backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line },
  confirmBtnText:   { fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
  section:     { gap: Spacing.sm },
  sectionTitle:{ fontFamily: FontFamily.title, fontSize: 12, color: Colors.muted, letterSpacing: 1 },
  empty:       { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, textAlign: 'center', paddingVertical: Spacing.md },
  playerRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.line },
  playerName:  { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text },
  startBtn:    { backgroundColor: Colors.teal, borderRadius: Radius.md, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, minHeight: 50 },
  startBtnIcon:{ fontSize: 18 },
  startBtnText:{ fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
});
