import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Badge, Card, KingBTLogo } from '@/components';
import { MOCK_COMPETITIONS } from '@/mocks/competitions';
import type { Competition } from '@/logic/types';

const FORMAT_LABEL: Record<string, string> = {
  avulso: 'Americano', liga: 'Liga', grupos: 'Grupos', mata: 'Mata-Mata', super8: 'Super 8',
};
const FORMAT_ICON: Record<string, string> = {
  avulso: '🔄', liga: '📋', grupos: '🗂️', mata: '⚔️', super8: '8️⃣',
};

function CompCard({ comp }: { comp: Competition }) {
  const done = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;
  const pct = total > 0 ? done / total : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push({ pathname: '/competitions/[id]', params: { id: comp.id } })}
    >
      <Card style={styles.compCard} elevated={comp.status === 'active'}>
        <View style={styles.compTop}>
          <Text style={styles.compIcon}>{FORMAT_ICON[comp.format]}</Text>
          <View style={styles.compInfo}>
            <Text style={styles.compName}>{comp.name}</Text>
            <Text style={styles.compMeta}>
              {FORMAT_LABEL[comp.format]} · {comp.competitors.length} participantes · {comp.date}
            </Text>
          </View>
          <Badge
            label={comp.status === 'done' ? 'Concluída' : 'Ativa'}
            variant={comp.status === 'done' ? 'teal' : 'gold'}
            small
          />
        </View>

        {total > 0 && (
          <View style={styles.progress}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{done}/{total} jogos</Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

export default function HubScreen() {
  const active = MOCK_COMPETITIONS.filter(c => c.status === 'active');
  const done   = MOCK_COMPETITIONS.filter(c => c.status === 'done');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={[...active, ...done]}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <KingBTLogo size="md" showTagline />
            <Text style={styles.subtitle}>Competições do grupo</Text>
          </View>
        }
        ListEmptyComponent={
          <Card style={styles.empty}>
            <Text style={styles.emptyText}>Nenhuma competição ainda.</Text>
            <Text style={styles.emptyHint}>Toque em + para criar uma.</Text>
          </Card>
        }
        renderItem={({ item }) => <CompCard comp={item} />}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  list: { padding: Spacing.md, gap: Spacing.sm },
  header: { alignItems: 'center', paddingVertical: Spacing.lg, gap: Spacing.xs },
  subtitle: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },

  compCard: { gap: Spacing.sm },
  compTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  compIcon: { fontSize: 28, width: 36 },
  compInfo: { flex: 1 },
  compName: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.text },
  compMeta: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, marginTop: 2 },

  progress: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.line, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: Colors.teal, borderRadius: 2 },
  progressLabel: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.muted, width: 52, textAlign: 'right' },

  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.muted },
  emptyHint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint },
});
