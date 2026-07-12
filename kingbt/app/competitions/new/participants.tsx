import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Avatar } from '@/components';
import type { Format } from '@/logic/types';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import { addGuestPlayer, removeGuestPlayer } from '@/firebase/groupPlayers';
import { buildRanking } from '@/logic/scoring';
import { extractPlayerGames } from '@/logic/formats';
import { balancedPairs } from '@/logic/roundRobin';

const STEPS = ['Formato', 'Ajustes', 'Quem joga', 'Revisar'];

type Params = {
  format: Format; name: string; unit: string; rounds: string;
  winMode: string; target: string; groups: string; qualifiers: string; thirdPlace: string;
};

type GuestPlayer = { id: string; name: string; color: string; guest: true };

const GUEST_COLORS = ['#94A3B8', '#FB923C', '#A78BFA', '#34D399', '#F472B6', '#2DD4BF', '#FCD34D'];

export default function ParticipantsStep() {
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const params = useLocalSearchParams<Params>();
  // No Super 8, sempre seleção individual — o sistema gera as duplas automaticamente
  const isSuper8 = params.format === 'super8';
  const isDuplas = params.unit === 'duplas' && !isSuper8;
  const { state } = useCompetitions();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const { group } = useAuth();

  const [selected, setSelected] = useState<string[]>([]);
  const [pairs, setPairs] = useState<[string, string][]>([]);
  const [pairBuf, setPairBuf] = useState<string | null>(null);
  const [balanced, setBalanced] = useState(false);

  // ── Distribuição de grupos ───────────────────────────────────────────────
  type DistMode = 'auto' | 'ranking' | 'manual';
  const [distMode, setDistMode] = useState<DistMode>('auto');
  const [manualGroups, setManualGroups] = useState<Record<string, number>>({});

  const isGrupos = params.format === 'grupos';
  const numGroups = parseInt(params.groups ?? '2');

  const rankingForGroups = useMemo(() => {
    if (!isGrupos || distMode !== 'ranking') return [];
    const allGames = state.competitions.flatMap(extractPlayerGames);
    return buildRanking(
      groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color })),
      allGames,
    );
  }, [isGrupos, distMode, state.competitions, groupPlayers]);

  function changeDistMode(mode: DistMode) {
    setDistMode(mode);
    if (mode === 'manual') {
      // Inicializa com distribuição serpentina automática
      const init: Record<string, number> = {};
      selected.forEach((id, i) => {
        const row = Math.floor(i / numGroups), col = i % numGroups;
        init[id] = row % 2 ? numGroups - 1 - col : col;
      });
      setManualGroups(init);
    }
  }

  // Convidados
  const [guests, setGuests] = useState<GuestPlayer[]>([]);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');

  // Convidados já persistidos no grupo (via addGuestPlayer) somem daqui assim
  // que a assinatura em tempo real do Firestore os traz por groupPlayers —
  // evita duplicar a mesma pessoa na grade.
  const allPlayers = [
    ...groupPlayers.map(p => ({ id: p.id, name: p.name, color: p.color, guest: false as const })),
    ...guests.filter(g => !groupPlayers.some(p => p.id === g.id)),
  ];

  // Sugestão de duplas equilibradas pelo ranking histórico
  const suggestedPairs = useMemo(() => {
    if (!balanced || !isDuplas || selected.length < 4) return null;
    const allGames = state.competitions.flatMap(extractPlayerGames);
    const ranking = buildRanking(
      groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color })),
      allGames
    );
    return balancedPairs(selected.map(id => ({ id })), ranking);
  }, [balanced, selected, isDuplas, state.competitions, groupPlayers]);

  // Persiste o convidado direto no grupo (groups/{id}/players) em vez de
  // guardar só no estado local da tela — antes disso, o convidado "sumia" ao
  // criar as partidas de fato, porque aquela tela só lê da lista real do
  // grupo (groupPlayers), nunca do rascunho local do assistente.
  async function addGuest() {
    const name = guestName.trim();
    if (!name || !group) return;
    const color = GUEST_COLORS[guests.length % GUEST_COLORS.length];
    setGuestName('');
    setShowGuestModal(false);
    const id = await addGuestPlayer(group.id, name, color);
    setGuests(prev => [...prev, { id, name, color, guest: true }]);
  }

  async function removeGuest(id: string) {
    setGuests(prev => prev.filter(g => g.id !== id));
    setSelected(prev => prev.filter(x => x !== id));
    setPairs(prev => prev.filter(([a, b]) => a !== id && b !== id));
    if (group) await removeGuestPlayer(group.id, id);
  }

  function togglePlayer(id: string) {
    if (!isDuplas) {
      setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      return;
    }
    if (pairBuf === null) {
      setPairBuf(id);
    } else if (pairBuf === id) {
      setPairBuf(null);
    } else {
      setPairs(prev => [...prev, [pairBuf, id]]);
      setPairBuf(null);
    }
  }

  function removePair(i: number) {
    setPairs(prev => prev.filter((_, idx) => idx !== i));
  }

  const minIndividual = isSuper8 && params.unit === 'duplas' ? 4 : 2;
  const minDuplas = 2;
  const canContinue = isDuplas ? pairs.length >= minDuplas : selected.length >= minIndividual;
  const usedInPair = pairs.flat();

  function next() {
    if (!canContinue) return;

    let orderedSelected = selected;
    let groupMap = '';

    if (isGrupos && !isDuplas) {
      if (distMode === 'ranking' && rankingForGroups.length > 0) {
        orderedSelected = [...selected].sort((a, b) => {
          const ra = rankingForGroups.findIndex(r => r.id === a);
          const rb = rankingForGroups.findIndex(r => r.id === b);
          return (ra < 0 ? 9999 : ra) - (rb < 0 ? 9999 : rb);
        });
      } else if (distMode === 'manual') {
        const groups: string[][] = Array.from({ length: numGroups }, () => []);
        selected.forEach(id => {
          const g = Math.min(manualGroups[id] ?? 0, numGroups - 1);
          groups[g].push(id);
        });
        groupMap = JSON.stringify(groups);
      }
    }

    const ids = isDuplas
      ? pairs.map(([a, b]) => `${a}+${b}`).join(',')
      : orderedSelected.join(',');
    const guestData = guests.length > 0 ? JSON.stringify(guests.map(g => ({ id: g.id, name: g.name, color: g.color }))) : '';
    router.push({
      pathname: '/competitions/new/review',
      params: { ...params, playerIds: ids, guestData, ...(groupMap ? { groupMap } : {}) },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/competitions/new/config')} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova competição</Text>
      </View>

      {/* Steps */}
      <View style={styles.stepBar}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepLine, i <= 2 && styles.stepLineActive]} />
            <Text style={[styles.stepLabel, i === 2 && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Título */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {isDuplas ? 'Monte as duplas' : 'Quem vai jogar'}
          </Text>
          {isSuper8 && params.unit === 'duplas' && (
            <View style={styles.countBadge}>
              <Text style={{ fontFamily: FontFamily.body, fontSize: 10, color: Colors.teal }}>auto</Text>
            </View>
          )}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {isDuplas ? pairs.length : selected.length}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {isDuplas
            ? 'Toque em dois jogadores para formar uma dupla.'
            : isSuper8 && params.unit === 'duplas'
              ? `Selecione os jogadores. Mínimo 4. O sistema gera as duplas automaticamente.`
              : 'Selecione os participantes. Mínimo 2.'}
        </Text>

        {/* Duplas formadas */}
        {isDuplas && pairs.length > 0 && (
          <View style={styles.pairsGrid}>
            {pairs.map(([a, b], i) => {
              const pA = allPlayers.find(p => p.id === a)!;
              const pB = allPlayers.find(p => p.id === b)!;
              return (
                <TouchableOpacity key={i} style={styles.pairChip} onPress={() => removePair(i)}>
                  <Avatar name={pA.name} color={pA.color} size={24} />
                  <Text style={styles.pairText}>{pA.name.split(' ')[0]}/{pB.name.split(' ')[0]}</Text>
                  <Text style={styles.pairRemove}>✕</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Grid de jogadores */}
        <View style={styles.grid}>
          {allPlayers.map(pl => {
            const isSelected = isDuplas
              ? usedInPair.includes(pl.id) || pairBuf === pl.id
              : selected.includes(pl.id);
            const isPairBuf = pairBuf === pl.id;
            const isUsed = usedInPair.includes(pl.id);

            return (
              <TouchableOpacity
                key={pl.id}
                style={[
                  styles.playerCard,
                  isSelected && !isPairBuf && styles.playerCardSelected,
                  isPairBuf && styles.playerCardBuf,
                  isUsed && styles.playerCardUsed,
                ]}
                onPress={() => togglePlayer(pl.id)}
                disabled={isDuplas && isUsed}
                activeOpacity={0.75}
              >
                <Avatar name={pl.name} color={pl.color} size={36} />
                <View style={styles.playerInfo}>
                  <Text style={[styles.playerName, isSelected && { color: Colors.gold }]} numberOfLines={1}>
                    {pl.name.split(' ')[0]}
                  </Text>
                  {pl.guest && (
                    <Text style={styles.guestBadge}>convidado</Text>
                  )}
                </View>
                {pl.guest && (
                  <TouchableOpacity
                    style={styles.removeGuest}
                    onPress={() => removeGuest(pl.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeGuestText}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Botão adicionar convidado */}
          <TouchableOpacity
            style={styles.addGuestCard}
            onPress={() => setShowGuestModal(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.addGuestIcon}>+</Text>
            <Text style={styles.addGuestText}>Convidado</Text>
          </TouchableOpacity>
        </View>

        {/* Instrução modo duplas */}
        {isDuplas && pairBuf && (
          <View style={styles.bufHint}>
            <Text style={styles.bufHintText}>
              {allPlayers.find(p => p.id === pairBuf)?.name} selecionado — toque no parceiro
            </Text>
          </View>
        )}

        {/* Toggle duplas equilibradas — só para avulso/super8 duplas com ≥4 selecionados */}
        {isDuplas && (params.format === 'avulso' || params.format === 'super8') && selected.length >= 4 && pairs.length === 0 && (
          <View style={{ gap: Spacing.sm }}>
            <TouchableOpacity
              style={[styles.balanceToggle, balanced && styles.balanceToggleActive]}
              onPress={() => setBalanced(v => !v)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 20 }}>⚖️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.balanceToggleTitle, balanced && { color: Colors.gold }]}>
                  Duplas equilibradas
                </Text>
                <Text style={styles.balanceToggleSub}>
                  1° com o último, 2° com o penúltimo…
                </Text>
              </View>
              <View style={[styles.balanceCheck, balanced && styles.balanceCheckActive]}>
                {balanced && <Text style={{ fontSize: 12, color: Colors.bg }}>✓</Text>}
              </View>
            </TouchableOpacity>

            {balanced && suggestedPairs && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: FontFamily.number, fontSize: 10, color: Colors.muted, letterSpacing: 1.5 }}>
                  SUGESTÃO DE DUPLAS
                </Text>
                {suggestedPairs.map(([idA, idB], i) => {
                  const pA = allPlayers.find(p => p.id === idA) ?? findPlayer(idA);
                  const pB = allPlayers.find(p => p.id === idB) ?? findPlayer(idB);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={styles.suggestionRow}
                      onPress={() => {
                        setPairs(prev => [...prev, [idA, idB]]);
                        setSelected(prev => prev.filter(x => x !== idA && x !== idB));
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.faint, width: 20 }}>
                        {i + 1}
                      </Text>
                      {pA && <Avatar name={pA.name} color={pA.color} size={24} />}
                      <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text }}>
                        {pA?.name.split(' ')[0]}
                      </Text>
                      <Text style={{ color: Colors.faint }}>+</Text>
                      {pB && <Avatar name={pB.name} color={pB.color} size={24} />}
                      <Text style={{ fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text }}>
                        {pB?.name.split(' ')[0]}
                      </Text>
                      <Text style={{ fontFamily: FontFamily.body, fontSize: 11, color: Colors.teal, marginLeft: 'auto' }}>
                        + adicionar
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── Distribuição de grupos ── */}
        {isGrupos && !isDuplas && selected.length >= numGroups * 2 && (
          <View style={styles.distSection}>
            <Text style={styles.distTitle}>Distribuição nos grupos</Text>

            {/* Seletor de modo */}
            <View style={styles.distModeRow}>
              {([
                { key: 'auto',    label: 'Automático' },
                { key: 'ranking', label: '🏅 Por ranking' },
                { key: 'manual',  label: '✏️ Manual' },
              ] as { key: DistMode; label: string }[]).map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.distModeBtn, distMode === key && styles.distModeBtnActive]}
                  onPress={() => changeDistMode(key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.distModeTxt, distMode === key && styles.distModeTxtActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {distMode === 'auto' && (
              <Text style={styles.distInfo}>
                Jogadores distribuídos em serpentina pela ordem de seleção.
              </Text>
            )}

            {distMode === 'ranking' && (
              <Text style={styles.distInfo}>
                Jogadores ordenados pelo ranking histórico e distribuídos em serpentina — grupos mais equilibrados.
              </Text>
            )}

            {distMode === 'manual' && (
              <View style={{ gap: Spacing.sm }}>
                <Text style={styles.distInfo}>Toque nos botões de grupo para cada jogador.</Text>

                {/* Atribuição por jogador */}
                {selected.map(id => {
                  const pl = allPlayers.find(p => p.id === id);
                  if (!pl) return null;
                  const g = manualGroups[id] ?? 0;
                  return (
                    <View key={id} style={styles.assignRow}>
                      <Avatar name={pl.name} color={pl.color} size={30} />
                      <Text style={styles.assignName} numberOfLines={1}>{pl.name.split(' ')[0]}</Text>
                      <View style={styles.assignBtns}>
                        {Array.from({ length: numGroups }, (_, gi) => (
                          <TouchableOpacity
                            key={gi}
                            style={[styles.groupBadge, g === gi && styles.groupBadgeActive]}
                            onPress={() => setManualGroups(prev => ({ ...prev, [id]: gi }))}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.groupBadgeTxt, g === gi && styles.groupBadgeTxtActive]}>
                              {String.fromCharCode(65 + gi)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })}

                {/* Preview dos grupos */}
                <View style={{ gap: 6, marginTop: 4 }}>
                  {Array.from({ length: numGroups }, (_, gi) => {
                    const inGroup = selected.filter(id => (manualGroups[id] ?? 0) === gi);
                    return (
                      <View key={gi} style={styles.groupPreview}>
                        <Text style={styles.groupPreviewLabel}>
                          Grupo {String.fromCharCode(65 + gi)} — {inGroup.length} jogadores
                        </Text>
                        <Text style={styles.groupPreviewNames} numberOfLines={1}>
                          {inGroup.length > 0
                            ? inGroup.map(id => allPlayers.find(p => p.id === id)?.name.split(' ')[0] ?? id).join(', ')
                            : 'Nenhum'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btnContinue, !canContinue && styles.btnDisabled]}
          onPress={next}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, !canContinue && styles.btnTextDisabled]}>
            {canContinue
              ? 'Continuar'
              : isDuplas
                ? `Mínimo ${minDuplas} duplas`
                : `Mínimo ${minIndividual} jogadores`}
          </Text>
          {!canContinue && isSuper8 && params.unit === 'duplas' && (
            <Text style={{ fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted, marginTop: 2 }}>
              (4 para gerar duplas automáticas)
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal convidado */}
      <Modal visible={showGuestModal} transparent animationType="fade" onRequestClose={() => setShowGuestModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowGuestModal(false)}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1}>
            <Text style={styles.modalTitle}>Adicionar convidado</Text>
            <Text style={styles.modalSubtitle}>Jogador sem cadastro no grupo</Text>
            <TextInput
              style={styles.modalInput}
              value={guestName}
              onChangeText={setGuestName}
              placeholder="Nome do convidado"
              placeholderTextColor={Colors.faint}
              autoFocus
              autoCapitalize="words"
              onSubmitEditing={addGuest}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setShowGuestModal(false); setGuestName(''); }}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnAdd, !guestName.trim() && styles.btnDisabled]}
                onPress={addGuest}
                disabled={!guestName.trim()}
              >
                <Text style={styles.modalBtnAddText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.line },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, lineHeight: 24 },
  headerTitle: { fontFamily: FontFamily.title, fontSize: 17, color: Colors.text },
  stepBar: { flexDirection: 'row', paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.xs, gap: Spacing.xs },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepLine: { height: 3, width: '100%', borderRadius: 2, backgroundColor: Colors.surf2 },
  stepLineActive: { backgroundColor: Colors.gold },
  stepLabel: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.faint },
  stepLabelActive: { color: Colors.gold, fontFamily: FontFamily.bodyMed },
  scroll: { padding: Spacing.md, gap: Spacing.md },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text },
  countBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.gold },
  subtitle: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, marginTop: -Spacing.xs },

  pairsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pairChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surf2, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: Colors.gold + '44' },
  pairText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  pairRemove: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.coral, marginLeft: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  playerCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surf,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.line,
    padding: Spacing.sm + 2,
  },
  playerCardSelected: { borderColor: Colors.gold, backgroundColor: Colors.surf2 },
  playerCardBuf: { borderColor: Colors.teal, backgroundColor: Colors.teal + '11' },
  playerCardUsed: { opacity: 0.4 },
  playerInfo: { flex: 1, gap: 2 },
  playerName: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  guestBadge: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.muted },
  removeGuest: { padding: 2 },
  removeGuestText: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.coral },

  addGuestCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: 'transparent',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.line,
    borderStyle: 'dashed',
    padding: Spacing.sm + 2,
    minHeight: 56,
  },
  addGuestIcon: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.muted },
  addGuestText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.muted },

  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalBox: { backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', gap: Spacing.md },
  modalTitle: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text },
  modalSubtitle: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, marginTop: -Spacing.sm },
  modalInput: {
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontFamily: FontFamily.body, fontSize: 16, color: Colors.text,
  },
  modalButtons: { flexDirection: 'row', gap: Spacing.sm },
  modalBtnCancel: { flex: 1, borderWidth: 1.5, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  modalBtnCancelText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted },
  modalBtnAdd: { flex: 1, backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.sm + 2, alignItems: 'center' },
  modalBtnAddText: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },

  bufHint: { backgroundColor: Colors.teal + '22', borderRadius: Radius.sm, padding: Spacing.sm, alignItems: 'center' },
  bufHintText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.teal },

  balanceToggle: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.line,
  },
  balanceToggleActive: { backgroundColor: Colors.gold + '15', borderColor: Colors.gold + '44' },
  balanceToggleTitle: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text },
  balanceToggleSub: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  balanceCheck: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  balanceCheckActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.sm,
  },

  // Distribuição de grupos
  distSection: { gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line },
  distTitle: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  distInfo: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.faint, lineHeight: 18 },
  distModeRow: { flexDirection: 'row', gap: Spacing.xs },
  distModeBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.surf2 },
  distModeBtnActive: { borderColor: Colors.gold + '88', backgroundColor: Colors.gold + '20' },
  distModeTxt: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted },
  distModeTxtActive: { color: Colors.gold },
  // Atribuição manual
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  assignName: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  assignBtns: { flexDirection: 'row', gap: 6 },
  groupBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line },
  groupBadgeActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  groupBadgeTxt: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.muted },
  groupBadgeTxtActive: { color: Colors.bg },
  // Preview dos grupos
  groupPreview: { backgroundColor: Colors.surf2, borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.line },
  groupPreviewLabel: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.gold },
  groupPreviewNames: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: 2 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, paddingBottom: Spacing.lg, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.line },
  btnContinue: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  btnDisabled: { backgroundColor: Colors.surf2 },
  btnText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
  btnTextDisabled: { color: Colors.faint },
});
