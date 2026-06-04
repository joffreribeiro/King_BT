import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { PLAYERS } from '@/mocks/data';
import type { Competition } from '@/logic/types';

const FORMAT_LABEL: Record<string, string> = {
  avulso: 'Avulso', liga: 'Liga', grupos: 'Grupos + Eliminatórias',
  mata: 'Mata-Mata', super8: 'Super 8',
};
const FORMAT_ICON: Record<string, string> = {
  avulso: '🔀', liga: '≡', grupos: '⊞', mata: '⚔', super8: '8',
};
const FORMAT_ICON_BG: Record<string, string> = {
  avulso: '#1a3a2a', liga: '#1a2a3a', grupos: '#2a1a3a', mata: '#3a1a1a', super8: '#2a2a1a',
};

function formatDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const today = new Date();
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}

function CompCard({ comp }: { comp: Competition }) {
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;
  const pct   = total > 0 ? done / total : 0;
  const isActive = comp.status === 'active';

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => router.push({ pathname: '/competitions/[id]', params: { id: comp.id } })}
    >
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          {/* Ícone do formato */}
          <View style={[styles.fmtIcon, { backgroundColor: FORMAT_ICON_BG[comp.format] ?? '#1a1a1a' }]}>
            <Text style={styles.fmtIconText}>{FORMAT_ICON[comp.format]}</Text>
          </View>

          {/* Info */}
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{comp.name}</Text>
            <View style={styles.cardMeta}>
              <Badge
                label={isActive ? 'EM ANDAMENTO' : 'ENCERRADA'}
                variant={isActive ? 'gold' : 'teal'}
                small
              />
              <Text style={styles.cardMetaText}>
                {FORMAT_LABEL[comp.format]} · {comp.competitors.length} jogadores
              </Text>
            </View>
            {/* Progresso */}
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View style={[
                  styles.progressFill,
                  { width: `${pct * 100}%`, backgroundColor: pct === 1 ? Colors.teal : Colors.gold }
                ]} />
              </View>
              <Text style={styles.progressText}>{done}/{total} jogos</Text>
              <Text style={styles.dateText}>{formatDate(comp.date)}</Text>
            </View>
          </View>

          <Text style={styles.chevron}>›</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function HubScreen() {
  const { state } = useCompetitions();
  const all    = state.competitions;
  const active = all.filter(c => c.status === 'active');
  const done   = all.filter(c => c.status === 'done');

  // Usuário logado (mock = Joffre)
  const me = PLAYERS[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={[...active, ...done]}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Image
                  source={require('../../assets/kingbt-logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <View>
                  <Text style={styles.headerGroup}>Grupo</Text>
                  <Text style={styles.headerTitle}>
                    KING <Text style={styles.headerTitleBT}>BT</Text>
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => router.push('/(app)/profile')}>
                <Avatar name={me.name} color={me.color} size={40} />
              </TouchableOpacity>
            </View>

            {/* Botão criar */}
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => router.push('/competitions/new/format')}
              activeOpacity={0.85}
            >
              <Text style={styles.createBtnText}>+ Criar competição</Text>
            </TouchableOpacity>

            {/* Seção Em andamento */}
            {active.length > 0 && (
              <Text style={styles.sectionTitle}>Em andamento</Text>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const isFirstDone = item.status === 'done' && (index === 0 || all[index - 1]?.status === 'active');
          return (
            <View>
              {isFirstDone && (
                <Text style={styles.sectionTitle}>Encerradas</Text>
              )}
              <CompCard comp={item} />
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.xs }} />}
        ListEmptyComponent={
          <Card style={styles.empty}>
            <Text style={styles.emptyText}>Nenhuma competição ainda.</Text>
            <Text style={styles.emptyHint}>Toque em "+ Criar competição" para começar.</Text>
          </Card>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.md, paddingTop: Spacing.sm },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logo: {
    width: 52,
    height: 52,
  },
  headerGroup: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  headerTitle: {
    fontFamily: FontFamily.titleBold,
    fontSize: 26,
    color: Colors.text,
    letterSpacing: 1,
  },
  headerTitleBT: { color: Colors.gold },

  // Botão criar
  createBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  createBtnText: {
    fontFamily: FontFamily.title,
    fontSize: 16,
    color: Colors.bg,
  },

  // Seções
  sectionTitle: {
    fontFamily: FontFamily.title,
    fontSize: 16,
    color: Colors.text,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },

  // Card de competição
  card: { padding: Spacing.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fmtIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fmtIconText: { fontSize: 20 },
  cardInfo: { flex: 1, gap: 4 },
  cardName: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  cardMetaText: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  progressTrack: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: Colors.line, overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: 2 },
  progressText: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.muted },
  dateText: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.faint },
  chevron: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.faint },

  // Empty
  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm, marginTop: Spacing.lg },
  emptyText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.muted },
  emptyHint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, textAlign: 'center' },
});
