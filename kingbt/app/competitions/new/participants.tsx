import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal } from 'react-native';
import { HexBackground } from '@/components/HexBackground';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import { FontFamily, Spacing, centeredContent, Radius, type ThemeColors, PLAYER_COLORS } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Avatar, ScreenHeader } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import { addGuestPlayer, removeGuestPlayer } from '@/firebase/groupPlayers';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { closeRegistration, competitorsFromPairs, competitorsFromPlayers } from '@/logic/competitionPlan';
import { PrimaryButton, Hint } from '@/components/competition/FormKit';
import { PotsDrawModal } from '@/components/competition/PotsDrawModal';
import { useSettings } from '@/store/SettingsContext';
import { extractPlayerGames } from '@/logic/formats';
import { buildRanking } from '@/logic/scoring';

type GuestPlayer = { id: string; name: string; color: string; guest: true };

/** "Quem joga": o admin escolhe os jogadores (ou monta as duplas) de uma competição criada sem inscrições. */
export default function ParticipantsStep() {
  useRequireAuth();
  const { colors: Colors } = useTheme();
  const styles = useMemo(() => makeStyles(Colors), [Colors]);
  const { compId } = useLocalSearchParams<{ compId: string }>();
  const { state, dispatch } = useCompetitions();
  const { groupPlayers } = useGroupPlayers();
  const { group } = useAuth();
  const comp = state.competitions.find(c => c.id === compId);

  const [selected, setSelected] = useState<string[]>([]);
  const [pairs, setPairs] = useState<[string, string][]>([]);
  const [pairBuf, setPairBuf] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPots, setShowPots] = useState(false);
  const { scoringConfig } = useSettings();

  const [guests, setGuests] = useState<GuestPlayer[]>([]);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');

  // Já inscritos (se a lista veio de inscrições) começam marcados.
  useEffect(() => {
    if (!comp || seeded) return;
    setSeeded(true);
    if (comp.unit !== 'duplas' || comp.format === 'super8') setSelected(comp.confirmedIds ?? []);
  }, [comp, seeded]);

  const isSuper8 = comp?.format === 'super8';
  const isDuplas = comp?.unit === 'duplas' && !isSuper8;

  const allPlayers = [
    ...groupPlayers.map(p => ({ id: p.id, name: p.name, color: p.color, handicap: p.handicap, guest: false as const })),
    ...guests.filter(g => !groupPlayers.some(p => p.id === g.id)).map(g => ({ ...g, handicap: undefined })),
  ];

  async function addGuest() {
    const name = guestName.trim();
    if (!name || !group) return;
    const color = PLAYER_COLORS[guests.length % PLAYER_COLORS.length];
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

  // Posição de cada jogador no ranking do grupo — só calculada quando o sorteio por potes abre.
  const rankIndex = useMemo(() => {
    if (!showPots) return new Map<string, number>();
    const ranking = buildRanking(
      groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color, handicap: p.handicap })),
      state.competitions.flatMap(extractPlayerGames),
      scoringConfig,
    );
    return new Map(ranking.map((r, i) => [r.id, i]));
  }, [showPots, groupPlayers, state.competitions, scoringConfig]);

  function togglePlayer(id: string) {
    if (!isDuplas) {
      setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
      return;
    }
    if (pairBuf === null) setPairBuf(id);
    else if (pairBuf === id) setPairBuf(null);
    else { setPairs(prev => [...prev, [pairBuf, id]]); setPairBuf(null); }
  }

  if (!comp) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <HexBackground />
        <ScreenHeader title="Quem joga" onBack={() => router.replace('/(app)')} />
        <Text style={styles.loading}>Carregando competição…</Text>
      </SafeAreaView>
    );
  }

  const minIndividual = isSuper8 && comp.unit === 'duplas' ? 4 : 2;
  const minDuplas = 2;
  const usedInPair = pairs.flat();
  const count = isDuplas ? pairs.length : selected.length;
  const canContinue = isDuplas ? pairs.length >= minDuplas : selected.length >= minIndividual;

  function save() {
    if (!comp || !canContinue || busy) return;
    setBusy(true);
    const lite = allPlayers.map(p => ({ id: p.id, name: p.name, color: p.color, handicap: p.handicap }));
    if (isDuplas) {
      dispatch({
        type: 'PATCH_COMP', compId: comp.id, onlyIfStatus: ['setup'],
        patch: { competitors: competitorsFromPairs(pairs, lite), confirmedIds: pairs.flat() },
      });
      router.replace({ pathname: '/competitions/new/montar', params: { id: comp.id } });
      return;
    }
    if (isSuper8) {
      const started = closeRegistration({ ...comp, confirmedIds: selected }, lite);
      dispatch({
        type: 'PATCH_COMP', compId: comp.id, onlyIfStatus: ['setup', 'upcoming'],
        patch: { status: 'active', competitors: started.competitors, matches: started.matches, confirmedIds: selected },
      });
      router.replace({ pathname: '/competitions/[id]', params: { id: comp.id } });
      return;
    }
    dispatch({
      type: 'PATCH_COMP', compId: comp.id, onlyIfStatus: ['setup'],
      patch: { competitors: competitorsFromPlayers(selected, lite), confirmedIds: selected },
    });
    router.replace({ pathname: '/competitions/new/montar', params: { id: comp.id } });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HexBackground />
      <ScreenHeader
        title={isDuplas ? 'Monte as duplas' : 'Quem vai jogar'}
        subtitle={comp.name}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/(app)'))}
        right={<View style={styles.countBadge}><Text style={styles.countText}>{count}</Text></View>}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Hint>
          {isDuplas
            ? 'Toque em dois jogadores para formar uma dupla, ou sorteie as duplas por potes.'
            : isSuper8 && comp.unit === 'duplas'
              ? 'Selecione os jogadores. Mínimo 4. O sistema sorteia as duplas rotativas.'
              : isSuper8
                ? 'Selecione os jogadores. Mínimo 2: todos jogam contra todos, 1 contra 1.'
                : 'Selecione os participantes. Mínimo 2.'}
        </Hint>

        {isDuplas && (
          <TouchableOpacity style={styles.potsBtn} onPress={() => setShowPots(true)} activeOpacity={0.8} accessibilityRole="button">
            <Text style={styles.potsBtnText}>🎲 Sortear duplas por potes</Text>
          </TouchableOpacity>
        )}

        {isDuplas && pairs.length > 0 && (
          <View style={styles.pairsGrid}>
            {pairs.map(([a, b], i) => {
              const pA = allPlayers.find(p => p.id === a);
              const pB = allPlayers.find(p => p.id === b);
              if (!pA || !pB) return null;
              return (
                <TouchableOpacity key={i} style={styles.pairChip} onPress={() => setPairs(prev => prev.filter((_, idx) => idx !== i))} accessibilityLabel={`Desfazer dupla ${pA.name} e ${pB.name}`}>
                  <Avatar name={pA.name} color={pA.color} size={24} />
                  <Text style={styles.pairText}>{pA.name.split(' ')[0]}/{pB.name.split(' ')[0]}</Text>
                  <Text style={styles.pairRemove}>✕</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.grid}>
          {allPlayers.map(pl => {
            const isSelected = isDuplas ? usedInPair.includes(pl.id) || pairBuf === pl.id : selected.includes(pl.id);
            const isPairBuf = pairBuf === pl.id;
            const isUsed = usedInPair.includes(pl.id);
            return (
              <TouchableOpacity
                key={pl.id}
                style={[styles.playerCard, isSelected && !isPairBuf && styles.playerCardSelected, isPairBuf && styles.playerCardBuf, isUsed && styles.playerCardUsed]}
                onPress={() => togglePlayer(pl.id)}
                disabled={isDuplas && isUsed}
                activeOpacity={0.75}
              >
                <Avatar name={pl.name} color={pl.color} size={36} />
                <View style={styles.playerInfo}>
                  <Text style={[styles.playerName, isSelected && { color: Colors.gold }]} numberOfLines={1}>{pl.name.split(' ')[0]}</Text>
                  {pl.guest && <Text style={styles.guestBadge}>convidado</Text>}
                </View>
                {pl.guest && (
                  <TouchableOpacity style={styles.removeGuest} onPress={() => removeGuest(pl.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={`Remover convidado ${pl.name}`}>
                    <Text style={styles.removeGuestText}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.addGuestCard} onPress={() => setShowGuestModal(true)} activeOpacity={0.75}>
            <Text style={styles.addGuestIcon}>+</Text>
            <Text style={styles.addGuestText}>Convidado</Text>
          </TouchableOpacity>
        </View>

        {isDuplas && pairBuf && (
          <View style={styles.bufHint}>
            <Text style={styles.bufHintText}>{allPlayers.find(p => p.id === pairBuf)?.name} selecionado — toque no parceiro</Text>
          </View>
        )}
        <View style={{ height: Spacing.md }} />
        <PrimaryButton
          label={canContinue
            ? (isSuper8 ? 'Gerar duplas e jogos' : 'Continuar para montar')
            : isDuplas ? `Mínimo ${minDuplas} duplas` : `Mínimo ${minIndividual} jogadores`}
          onPress={save} disabled={!canContinue} busy={busy}
        />
        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      <PotsDrawModal
        visible={showPots}
        preselect={comp.confirmedIds}
        candidates={allPlayers.filter(p => !usedInPair.includes(p.id)).map(p => ({
          id: p.id, name: p.name, color: p.color,
          category: groupPlayers.find(g => g.id === p.id)?.about?.category ?? null,
          rank: rankIndex.get(p.id) ?? null,
        }))}
        onClose={() => setShowPots(false)}
        onUse={drawn => { setPairs(prev => [...prev, ...drawn]); setShowPots(false); }}
      />

      <Modal visible={showGuestModal} transparent animationType="fade" onRequestClose={() => setShowGuestModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowGuestModal(false)}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1}>
            <Text style={styles.modalTitle}>Adicionar convidado</Text>
            <Text style={styles.modalSubtitle}>Jogador sem cadastro no grupo</Text>
            <TextInput
              style={styles.modalInput} value={guestName} onChangeText={setGuestName}
              placeholder="Nome do convidado" placeholderTextColor={Colors.faint}
              autoFocus autoCapitalize="words" onSubmitEditing={addGuest}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setShowGuestModal(false); setGuestName(''); }}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnAdd, !guestName.trim() && { opacity: 0.5 }]} onPress={addGuest} disabled={!guestName.trim()}>
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
  scroll: { ...centeredContent, padding: Spacing.md, gap: Spacing.md },
  loading: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted, padding: Spacing.md },
  countBadge: { minWidth: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.gold },
  potsBtn: { minHeight: 48, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.gold, backgroundColor: Colors.gold + '14', alignItems: 'center', justifyContent: 'center' },
  potsBtnText: { fontFamily: FontFamily.titleBold, fontSize: 15, color: Colors.gold },
  pairsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pairChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surf2, borderRadius: Radius.full, paddingVertical: 6, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: Colors.gold + '44' },
  pairText: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  pairRemove: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.coral, marginLeft: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  playerCard: { width: '47%', flexGrow: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surf, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, padding: Spacing.sm + 2 },
  playerCardSelected: { borderColor: Colors.gold, backgroundColor: Colors.surf2 },
  playerCardBuf: { borderColor: Colors.teal, backgroundColor: Colors.teal + '11' },
  playerCardUsed: { opacity: 0.4 },
  playerInfo: { flex: 1, gap: 2 },
  playerName: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text },
  guestBadge: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted },
  removeGuest: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  removeGuestText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.coral },
  addGuestCard: { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, borderStyle: 'dashed', padding: Spacing.sm + 2, minHeight: 56 },
  addGuestIcon: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.muted },
  addGuestText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.muted },
  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalBox: { backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.lg, width: '100%', gap: Spacing.md },
  modalTitle: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text },
  modalSubtitle: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.muted, marginTop: -Spacing.sm },
  modalInput: { backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.line, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontFamily: FontFamily.body, fontSize: 17, color: Colors.text },
  modalButtons: { flexDirection: 'row', gap: Spacing.sm },
  modalBtnCancel: { flex: 1, minHeight: 48, borderWidth: 1.5, borderColor: Colors.line, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancelText: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.muted },
  modalBtnAdd: { flex: 1, minHeight: 48, backgroundColor: Colors.gold, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  modalBtnAddText: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },
  bufHint: { backgroundColor: Colors.teal + '22', borderRadius: Radius.sm, padding: Spacing.sm, alignItems: 'center' },
  bufHintText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.teal },
});
