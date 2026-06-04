import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { PLAYERS, SESSIONS, SESSION4_GAMES } from '@/mocks/data';
import type { Game } from '@/logic/scoring';

function getPlayer(id: string) {
  return PLAYERS.find(p => p.id === id)!;
}

type GameWithScore = Game & { sessionId: string };

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = SESSIONS.find(s => s.id === id);

  const [games, setGames] = useState<GameWithScore[]>(
    id === 's4' ? SESSION4_GAMES.map(g => ({ ...g })) : []
  );
  const [editingGame, setEditingGame] = useState<GameWithScore | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>Sessão não encontrada.</Text>
      </SafeAreaView>
    );
  }

  const done = games.filter(g => g.scoreA != null).length;
  const total = games.length;
  const progress = total > 0 ? done / total : 0;

  function openScoreModal(game: GameWithScore) {
    setEditingGame(game);
    setScoreA(game.scoreA != null ? String(game.scoreA) : '');
    setScoreB(game.scoreB != null ? String(game.scoreB) : '');
  }

  function saveScore() {
    if (!editingGame) return;
    const a = parseInt(scoreA);
    const b = parseInt(scoreB);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a === b) return;
    setGames(prev => prev.map(g =>
      g.id === editingGame.id ? { ...g, scoreA: a, scoreB: b } : g
    ));
    setEditingGame(null);
  }

  const allDone = total > 0 && done === total;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{session.label}</Text>
          <Text style={styles.date}>
            {new Date(session.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </Text>
        </View>

        {/* Jogadores presentes */}
        <Card>
          <Text style={styles.sectionTitle}>Jogadores ({session.playerIds.length})</Text>
          <View style={styles.playerRow}>
            {session.playerIds.map(pid => {
              const pl = getPlayer(pid);
              return (
                <View key={pid} style={styles.playerChip}>
                  <Avatar name={pl.name} color={pl.color} size={36} />
                  <Text style={styles.playerChipName}>{pl.name.split(' ')[0]}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Progresso */}
        {total > 0 && (
          <Card>
            <View style={styles.progressHeader}>
              <Text style={styles.sectionTitle}>Progresso</Text>
              <Text style={styles.progressCount}>{done}/{total} jogos</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            {allDone && (
              <View style={styles.reiDoDia}>
                <Text style={styles.reiText}>👑 Rei do Dia: Joffre — 3 vitórias</Text>
              </View>
            )}
          </Card>
        )}

        {/* Lista de jogos */}
        <Text style={styles.sectionTitle}>Jogos</Text>
        {games.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>Nenhum jogo gerado para esta sessão no mock.</Text>
          </Card>
        ) : (
          games.map((game, i) => {
            const pA1 = getPlayer(game.teamA[0]);
            const pA2 = getPlayer(game.teamA[1]);
            const pB1 = getPlayer(game.teamB[0]);
            const pB2 = getPlayer(game.teamB[1]);
            const hasScore = game.scoreA != null;
            const aWon = hasScore && game.scoreA! > game.scoreB!;

            return (
              <TouchableOpacity key={game.id} onPress={() => openScoreModal(game)}>
                <Card style={styles.gameCard}>
                  <View style={styles.gameRow}>
                    {/* Time A */}
                    <View style={[styles.team, styles.teamLeft, aWon && styles.teamWon]}>
                      <View style={styles.avatarPair}>
                        <Avatar name={pA1.name} color={pA1.color} size={30} />
                        <Avatar name={pA2.name} color={pA2.color} size={30} />
                      </View>
                      <Text style={styles.teamNames} numberOfLines={1}>
                        {pA1.name.split(' ')[0]} / {pA2.name.split(' ')[0]}
                      </Text>
                    </View>

                    {/* Placar */}
                    <View style={styles.scoreBlock}>
                      {hasScore ? (
                        <Text style={styles.scoreText}>
                          <Text style={aWon ? styles.scoreWin : styles.scoreLose}>{game.scoreA}</Text>
                          {' – '}
                          <Text style={!aWon ? styles.scoreWin : styles.scoreLose}>{game.scoreB}</Text>
                        </Text>
                      ) : (
                        <Text style={styles.scorePending}>Jogo {i + 1}</Text>
                      )}
                    </View>

                    {/* Time B */}
                    <View style={[styles.team, styles.teamRight, !aWon && hasScore && styles.teamWon]}>
                      <View style={styles.avatarPair}>
                        <Avatar name={pB1.name} color={pB1.color} size={30} />
                        <Avatar name={pB2.name} color={pB2.color} size={30} />
                      </View>
                      <Text style={styles.teamNames} numberOfLines={1}>
                        {pB1.name.split(' ')[0]} / {pB2.name.split(' ')[0]}
                      </Text>
                    </View>
                  </View>

                  {!hasScore && (
                    <View style={styles.tapHint}>
                      <Text style={styles.tapHintText}>Toque para registrar placar</Text>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>

      {/* Modal de placar */}
      <Modal visible={!!editingGame} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {editingGame && (
              <>
                <Text style={styles.modalTitle}>Registrar Placar</Text>
                <Text style={styles.modalSub}>
                  {getPlayer(editingGame.teamA[0]).name} / {getPlayer(editingGame.teamA[1]).name}
                  {'\nvs\n'}
                  {getPlayer(editingGame.teamB[0]).name} / {getPlayer(editingGame.teamB[1]).name}
                </Text>

                <View style={styles.scoreInputRow}>
                  <View style={styles.scoreInputBlock}>
                    <Text style={styles.scoreInputLabel}>Time A</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity onPress={() => setScoreA(s => String(Math.max(0, parseInt(s||'0') - 1)))} style={styles.stepBtn}>
                        <Text style={styles.stepBtnText}>−</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.scoreInput}
                        value={scoreA}
                        onChangeText={setScoreA}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                      <TouchableOpacity onPress={() => setScoreA(s => String(parseInt(s||'0') + 1))} style={styles.stepBtn}>
                        <Text style={styles.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.vs}>×</Text>

                  <View style={styles.scoreInputBlock}>
                    <Text style={styles.scoreInputLabel}>Time B</Text>
                    <View style={styles.stepper}>
                      <TouchableOpacity onPress={() => setScoreB(s => String(Math.max(0, parseInt(s||'0') - 1)))} style={styles.stepBtn}>
                        <Text style={styles.stepBtnText}>−</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.scoreInput}
                        value={scoreB}
                        onChangeText={setScoreB}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                      <TouchableOpacity onPress={() => setScoreB(s => String(parseInt(s||'0') + 1))} style={styles.stepBtn}>
                        <Text style={styles.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {scoreA !== '' && scoreB !== '' && scoreA === scoreB && (
                  <Text style={styles.drawWarning}>⚠️ Sem empate no beach tennis!</Text>
                )}

                <View style={styles.modalBtns}>
                  <TouchableOpacity onPress={() => setEditingGame(null)} style={styles.modalCancel}>
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={saveScore} style={styles.modalSave}>
                    <Text style={styles.modalSaveText}>Salvar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  error: { fontFamily: FontFamily.body, color: Colors.coral, padding: Spacing.md },

  header: { gap: 4 },
  back: { marginBottom: Spacing.xs },
  backText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.teal },
  title: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text },
  date: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.textSoft, textTransform: 'capitalize' },

  sectionTitle: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text, marginBottom: Spacing.sm },
  playerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  playerChip: { alignItems: 'center', gap: 4 },
  playerChipName: { fontFamily: FontFamily.body, fontSize: 10, color: Colors.textSoft },

  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressCount: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.textSoft },
  progressTrack: { height: 6, backgroundColor: Colors.line, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: Colors.teal, borderRadius: 3 },
  reiDoDia: { backgroundColor: Colors.gold + '22', borderRadius: Radius.sm, padding: Spacing.sm, marginTop: Spacing.sm },
  reiText: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.gold, textAlign: 'center' },

  emptyText: { fontFamily: FontFamily.body, color: Colors.textSoft, textAlign: 'center', padding: Spacing.md },

  gameCard: { marginBottom: 0 },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  team: { flex: 1, gap: 4 },
  teamLeft: { alignItems: 'flex-start' },
  teamRight: { alignItems: 'flex-end' },
  teamWon: {},
  avatarPair: { flexDirection: 'row', gap: -8 },
  teamNames: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSoft },

  scoreBlock: { alignItems: 'center', minWidth: 60 },
  scoreText: { fontFamily: FontFamily.numberBold, fontSize: 22 },
  scoreWin: { color: Colors.teal },
  scoreLose: { color: Colors.textSoft },
  scorePending: { fontFamily: FontFamily.number, fontSize: 12, color: Colors.textSoft },

  tapHint: { borderTopWidth: 1, borderTopColor: Colors.line, marginTop: Spacing.sm, paddingTop: Spacing.xs },
  tapHintText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.textSoft, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface1,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalTitle: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center' },
  modalSub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.textSoft, textAlign: 'center' },

  scoreInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  scoreInputBlock: { alignItems: 'center', gap: Spacing.sm },
  scoreInputLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.textSoft },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface2, alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.gold },
  scoreInput: {
    width: 56, height: 56, borderRadius: Radius.sm,
    backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.gold,
    fontFamily: FontFamily.numberBold, fontSize: 28, color: Colors.gold,
    textAlign: 'center',
  },
  vs: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.textSoft },

  drawWarning: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral, textAlign: 'center' },

  modalBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  modalCancel: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line, alignItems: 'center',
  },
  modalCancelText: { fontFamily: FontFamily.title, color: Colors.textSoft },
  modalSave: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.teal, alignItems: 'center',
  },
  modalSaveText: { fontFamily: FontFamily.title, color: Colors.bg },
});
