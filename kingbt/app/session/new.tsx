import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Card } from '@/components';
import { PLAYERS } from '@/mocks/data';
import { generateSchedule } from '@/logic/roundRobin';

export default function NewSessionScreen() {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleGenerate() {
    if (selected.length < 4) return;
    const games = generateSchedule(selected.map(id => ({ id })));
    // Em produção: salva no Firestore e navega para a sessão criada
    // No mock: navega para s4 como demonstração
    router.replace({ pathname: '/session/[id]', params: { id: 's4' } });
  }

  const canGenerate = selected.length >= 4;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Nova Sessão</Text>
          <Text style={styles.subtitle}>Selecione os jogadores presentes (mín. 4)</Text>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>
            Jogadores selecionados: <Text style={{ color: Colors.gold }}>{selected.length}</Text>
          </Text>
          {selected.length >= 4 && (
            <Text style={styles.gamesPreview}>
              → {Math.ceil(selected.length * (selected.length - 1) / 4)} jogos serão gerados
            </Text>
          )}
        </Card>

        <View style={styles.playerGrid}>
          {PLAYERS.map(pl => {
            const isSelected = selected.includes(pl.id);
            return (
              <TouchableOpacity
                key={pl.id}
                onPress={() => toggle(pl.id)}
                style={[styles.playerCard, isSelected && styles.playerCardSelected]}
                activeOpacity={0.7}
              >
                <Avatar name={pl.name} color={pl.color} size={48} />
                <Text style={[styles.playerName, isSelected && { color: Colors.gold }]}>
                  {pl.name}
                </Text>
                <Text style={styles.playerTitle}>{pl.titleEmoji}</Text>
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Card para adicionar convidado */}
          <TouchableOpacity style={styles.guestCard}>
            <Text style={styles.guestIcon}>+</Text>
            <Text style={styles.guestLabel}>Convidado</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={!canGenerate}
        >
          <Text style={[styles.generateBtnText, !canGenerate && { color: Colors.textSoft }]}>
            {canGenerate
              ? `🎾 Gerar ${Math.ceil(selected.length * (selected.length - 1) / 4)} Jogos`
              : `Selecione pelo menos 4 jogadores`
            }
          </Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, gap: Spacing.md },

  header: { gap: 4 },
  back: { marginBottom: Spacing.xs },
  backText: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.teal },
  title: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.textSoft },

  sectionTitle: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  gamesPreview: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.teal, marginTop: 4 },

  playerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  playerCard: {
    width: '47%',
    backgroundColor: Colors.surface1,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.line,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  playerCardSelected: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold + '11',
  },
  playerName: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.text, textAlign: 'center' },
  playerTitle: { fontSize: 20 },
  checkBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center',
  },
  checkText: { fontFamily: FontFamily.numberBold, fontSize: 12, color: Colors.bg },

  guestCard: {
    width: '47%',
    backgroundColor: Colors.surface1,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.line,
    borderStyle: 'dashed',
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    minHeight: 110,
  },
  guestIcon: { fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.textSoft },
  guestLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.textSoft },

  generateBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  generateBtnDisabled: { backgroundColor: Colors.surface2 },
  generateBtnText: { fontFamily: FontFamily.titleBold, fontSize: 16, color: Colors.bg },
});
