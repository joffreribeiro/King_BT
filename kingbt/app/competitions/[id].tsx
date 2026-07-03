import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Platform, Share,
  Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { competitionChampion } from '@/logic/formats';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Match, Competition } from '@/logic/types';
import ConfettiCannon from 'react-native-confetti-cannon';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { confirmParticipation, cancelParticipation } from '@/firebase/competitions';
import { buildShareText } from '@/components/competition/helpers';
import { EditNameModal } from '@/components/competition/EditNameModal';
import { RulesView } from '@/components/competition/RulesView';
import { ScorerModal } from '@/components/competition/ScorerModal';
import { AvulsoView } from '@/components/competition/AvulsoView';
import {
  RotatingView, ClassificacaoView, LeagueView, GroupsView, KOView,
} from '@/components/competition/FormatViews';

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CompetitionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useCompetitions();
  const { isAdmin, myPlayerId, group } = useAuth();
  const { findPlayer, groupPlayers } = useGroupPlayers();
  const comp = state.competitions.find(c => c.id === id);
  const [scoring, setScoring]             = useState<Match | null>(null);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showEditName, setShowEditName]   = useState(false);
  const [showConfetti, setShowConfetti]   = useState(false);
  const [showChampion, setShowChampion]   = useState(false);
  const [confirmBusy, setConfirmBusy]     = useState(false);
  const [showAddAvulso, setShowAddAvulso] = useState(false);
  const [activeTab, setActiveTab] = useState<'regras' | 'classificacao' | 'partidas'>('partidas');
  const [avulsoTeamA, setAvulsoTeamA]     = useState<string[]>([]);
  const [avulsoTeamB, setAvulsoTeamB]     = useState<string[]>([]);
  const champAnim  = useRef(new Animated.Value(0)).current;
  const viewShotRef = useRef<View>(null);
  const screenW = Dimensions.get('window').width;
  const confettiFired = useRef(false);

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

  async function shareChampionImage() {
    try {
      if (!viewShotRef.current) return;
      const uri = await captureRef(viewShotRef, { format: 'png', quality: 0.95 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartilhar resultado' });
      }
    } catch { /* ignore */ }
  }

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
    dispatch({ type: 'CLEAR_SCORE', compId: id!, matchId });
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

  function handleShare() {
    const text = buildShareText(comp!, findPlayer);
    Share.share({ message: text, title: comp!.name }).catch(() => {});
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

  function handleSubstitute(match: Match, originalId: string) {
    if (!isAdmin) return;
    const options = groupPlayers
      .filter(p => p.id !== originalId)
      .slice(0, 6)
      .map(p => ({
        text: p.name,
        onPress: () => {
          dispatch({
            type: 'SUBSTITUTE_PLAYER',
            compId: comp!.id,
            sub: {
              originalId,
              substituteId: p.id,
              fromMatchId: match.id,
              timestamp: new Date().toISOString(),
            },
          });
        },
      }));
    Alert.alert('Substituir jogador', 'Escolha quem vai entrar:', [
      { text: 'Cancelar', style: 'cancel' },
      ...options,
    ]);
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
          <View ref={viewShotRef} style={main.champCard}>
            <Text style={main.champCrown}>👑</Text>
            <Avatar name={champPlayer.name} color={champPlayer.color} size={60} />
            <Text style={main.champTitle}>CAMPEÃO</Text>
            <Text style={main.champName}>{champDisplayName}</Text>
            <Text style={main.champComp}>{comp.name}</Text>
          </View>
          <View style={main.champActions}>
            <TouchableOpacity style={main.champBtn} onPress={shareChampionImage}>
              <Text style={main.champBtnText}>📤 Compartilhar</Text>
            </TouchableOpacity>
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

          {/* Botão confirmar / cancelar */}
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
            {([
              { key: 'regras',        label: '📋 Regras' },
              { key: 'classificacao', label: '🏆 Classificação' },
              { key: 'partidas',      label: '🎾 Partidas' },
            ] as const).map(t => (
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
            comp.format === 'liga' || comp.format === 'grupos' || comp.format === 'avulso' || comp.format === 'super8'
              ? <ClassificacaoView comp={comp} />
              : <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                  <Text style={{ fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 32 }}>
                    Formato mata-mata não possui classificação.
                  </Text>
                </ScrollView>
          )}

          {activeTab === 'partidas' && (
            comp.format === 'grupos'
              ? <GroupsView comp={comp} onScore={setScoring} onClear={handleClear} />
              : comp.format === 'liga'
                ? <LeagueView comp={comp} onScore={setScoring} onClear={handleClear}
                    onSubstitute={isAdmin ? handleSubstitute : undefined} />
                : comp.format === 'mata'
                  ? <KOView comp={comp} onScore={setScoring} onClear={handleClear} />
                  : comp.format === 'avulso'
                    ? <AvulsoView comp={comp} onScore={setScoring} onClear={handleClear}
                        onAddMatch={() => setShowAddAvulso(true)} />
                    : <RotatingView comp={comp} onScore={setScoring} onClear={handleClear}
                        onSubstitute={isAdmin ? handleSubstitute : undefined} />
          )}
        </View>
      )}

      {/* Modal: adicionar jogo avulso */}
      <Modal visible={showAddAvulso} transparent animationType="slide" onRequestClose={() => setShowAddAvulso(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md, maxHeight: '85%' }}>
            <Text style={{ fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text }}>Registrar jogo</Text>

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

      <ScorerModal
        match={scoring}
        comp={comp}
        onClose={() => setScoring(null)}
        onSave={isAdmin && scoring?.scoreA != null ? handleCorrect : handleSave}
        onSaveDraft={handleSaveDraft}
        onClear={handleClear}
        isAdmin={isAdmin}
      />

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

const main = StyleSheet.create({
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

const upcoming = StyleSheet.create({
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
