import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar, Badge, Card } from '@/components';
import { PLAYERS, SESSIONS } from '@/mocks/data';

function getPlayer(id: string) {
  return PLAYERS.find(p => p.id === id)!;
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SessionsScreen() {
  const sessions = [...SESSIONS].reverse();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Sessões</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/session/new')}>
          <Text style={styles.newBtnText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: sess }) => (
          <TouchableOpacity onPress={() => router.push({ pathname: '/session/[id]', params: { id: sess.id } })}>
            <Card style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.sessLabel}>{sess.label}</Text>
                  <Text style={styles.sessDate}>{formatDate(sess.date)}</Text>
                </View>
                <Badge label={sess.done ? 'Finalizada' : 'Em andamento'} variant={sess.done ? 'teal' : 'gold'} />
              </View>

              <View style={styles.avatarRow}>
                {sess.playerIds.map(id => {
                  const pl = getPlayer(id);
                  return <Avatar key={id} name={pl.name} color={pl.color} size={32} />;
                })}
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  title: { fontFamily: FontFamily.titleBold, fontSize: 26, color: Colors.text },
  newBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  newBtnText: { fontFamily: FontFamily.title, fontSize: 14, color: Colors.bg },
  list: { padding: Spacing.md, gap: Spacing.sm },
  card: { gap: Spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sessLabel: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  sessDate: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.textSoft, marginTop: 2 },
  avatarRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
});
