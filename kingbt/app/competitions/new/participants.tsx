import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useMemo } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar } from '@/components';
import { PLAYERS } from '@/mocks/data';
import type { Format } from '@/logic/types';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
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
  const params = useLocalSearchParams<Params>();
  const isDuplas = params.unit === 'duplas';
  const { state } = useCompetitions();
  const { groupPlayers, findPlayer } = useGroupPlayers();

  const [selected, setSelected] = useState<string[]>([]);
  const [pairs, setPairs] = useState<[string, string][]>([]);
  const [pairBuf, setPairBuf] = useState<string | null>(null);
  const [balanced, setBalanced] = useState(false);

  // Convidados
  const [guests, setGuests] = useState<GuestPlayer[]>([]);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');

  const allPlayers = [
    ...PLAYERS.map(p => ({ ...p, guest: false as const })),
    ...guests,
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

  function addGuest() {
    const name = guestName.trim();
    if (!name) return;
    const id = `guest_${Date.now()}`;
    const color = GUEST_COLORS[guests.length % GUEST_COLORS.length];
    setGuests(prev => [...prev, { id, name, color, guest: true }]);
    setGuestName('');
    setShowGuestModal(false);
  }

  function removeGuest(id: string) {
    setGuests(prev => prev.filter(g => g.id !== id));
    setSelected(prev => prev.filter(x => x !== id));
    setPairs(prev => prev.filter(([a, b]) => a !== id && b !== id));
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

  const canContinue = isDuplas ? pairs.length >= 2 : selected.length >= 2;
  const usedInPair = pairs.flat();

  function next() {
    if (!canContinue) return;
    const ids = isDuplas
      ? pairs.map(([a, b]) => `${a}+${b}`).join(',')
      : selected.join(',');
    const guestData = guests.length > 0 ? JSON.stringify(guests.map(g => ({ id: g.id, name: g.name, color: g.color }))) : '';
    router.push({
      pathname: '/competitions/new/review',
      params: { ...params, playerIds: ids, guestData },
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
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {isDuplas ? pairs.length : selected.length}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {isDuplas
            ? 'Toque em dois jogadores para formar uma dupla.'
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
              : isDuplas ? 'Mínimo 2 duplas' : 'Mínimo 2 jogadores'}
          </Text>
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

const styles = StyleSheet.create({
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

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, paddingBottom: Spacing.lg, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.line },
  btnContinue: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  btnDisabled: { backgroundColor: Colors.surf2 },
  btnText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.bg },
  btnTextDisabled: { color: Colors.faint },
});
