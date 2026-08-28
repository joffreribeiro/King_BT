import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { goToPlayer } from '@/logic/nav';
import { FontFamily, Spacing, type ThemeColors, PODIUM_COLORS } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Avatar, Card, Icon, ScreenHeader } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { competitionChampion } from '@/logic/formats';

const FORMAT_LABEL: Record<string, string> = {
  liga: 'Liga', grupos: 'Grupos + KO', mata: 'Mata-mata', avulso: 'Avulso', super8: 'Super 8',
};

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HallScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { state } = useCompetitions();
  const { findPlayer } = useGroupPlayers();

  const champions = useMemo(() => state.competitions
    .filter(c => c.status === 'done' && !c.isFriendly)
    .map(c => {
      const champ = competitionChampion(c, id => findPlayer(id)?.name ?? id);
      if (!champ) return null;
      // O campeão pode ser uma dupla. Antes só `members[0]` era considerado, o
      // que apagava o parceiro do card e da contagem de títulos. `members` fica
      // vazio quando o competidor não tem jogadores vinculados — nesse caso o
      // próprio id do competidor é a melhor referência que existe.
      const memberIds = champ.members.length ? champ.members : [champ.id];
      const players = memberIds.map(id => findPlayer(id));
      const champName = players.every(Boolean)
        ? players.map(p => p!.name.split(' ')[0]).join(' / ')
        : ((champ as { name?: string }).name ?? memberIds.join(' / '));
      return {
        compId: c.id,
        compName: c.name,
        compDate: c.date,
        format: c.format,
        champName,
        memberIds,
      };
    })
    .filter(Boolean)
    .reverse() as Array<{
      compId: string;
      compName: string;
      compDate: string;
      format: string;
      champName: string;
      memberIds: string[];
    }>, [state.competitions, findPlayer]);

  // Títulos por jogador. A contagem era feita pelo nome exibido, então dois
  // homônimos viravam uma linha só e renomear um jogador criava duas — agora a
  // chave é o id, e cada membro da dupla campeã soma o próprio título.
  const topWinners = useMemo(() => {
    const trophies: Record<string, number> = {};
    champions.forEach(c => c.memberIds.forEach(id => {
      trophies[id] = (trophies[id] ?? 0) + 1;
    }));
    return Object.entries(trophies)
      .map(([id, count]) => ({ id, count, player: findPlayer(id) }))
      .sort((a, b) => b.count - a.count || (a.player?.name ?? '').localeCompare(b.player?.name ?? ''))
      .slice(0, 3);
  }, [champions, findPlayer]);

  const podium = PODIUM_COLORS;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScreenHeader title="Hall dos Campeões" />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {champions.length === 0 && (
          <Card style={{ alignItems: 'center', padding: Spacing.xl }}>
            <Icon name="crown" size={40} color={Colors.gold} />
            <Text style={s.emptyTitle}>Sem campeões ainda</Text>
            <Text style={s.emptySub}>Conclua uma competição para ver o campeão aqui.</Text>
          </Card>
        )}

        {topWinners.length > 0 && (
          <Card style={s.rankCard}>
            <Text style={s.sectionLabel}>MAIS TÍTULOS</Text>
            {topWinners.map((w, i) => (
              <TouchableOpacity
                key={w.id}
                style={s.topRow}
                onPress={() => { if (w.player) goToPlayer(w.id); }}
                activeOpacity={w.player ? 0.75 : 1}
              >
                <View style={[s.medal, { borderColor: podium[i] ?? Colors.line }]}>
                  <Text style={[s.medalNum, { color: podium[i] ?? Colors.muted }]}>{i + 1}</Text>
                </View>
                <Avatar name={w.player?.name ?? w.id} color={w.player?.color ?? Colors.gold} size={28} />
                <Text style={s.topName} numberOfLines={1}>{w.player?.name ?? w.id}</Text>
                <Text style={s.topCount}>{w.count} {w.count === 1 ? 'título' : 'títulos'}</Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        <Text style={s.sectionLabel}>HISTÓRICO DE CAMPEÕES</Text>

        {champions.map(c => (
          <TouchableOpacity
            key={c.compId}
            onPress={() => router.push(`/competitions/${c.compId}`)}
            activeOpacity={0.8}
          >
            <Card style={s.champCard}>
              <View style={s.champLeft}>
                <Icon name="crown" size={20} color={Colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={s.champCompName} numberOfLines={1}>{c.compName}</Text>
                  <Text style={s.champMeta}>
                    {FORMAT_LABEL[c.format] ?? c.format} · {formatDate(c.compDate)}
                  </Text>
                </View>
              </View>
              <View style={s.champRight}>
                <View style={s.champAvatars}>
                  {c.memberIds.map(id => {
                    const pl = findPlayer(id);
                    return (
                      <Avatar key={id} name={pl?.name ?? id} color={pl?.color ?? Colors.gold} size={30} />
                    );
                  })}
                </View>
                <Text style={s.champWinner} numberOfLines={1}>{c.champName}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  title: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.gold, flex: 1 },
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  sectionLabel: { fontFamily: FontFamily.number, fontSize: 11, color: Colors.muted, letterSpacing: 2, marginTop: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 18, color: Colors.text, marginTop: Spacing.sm },
  emptySub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 4 },
  rankCard: { gap: Spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  medal: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  medalNum: { fontFamily: FontFamily.numberBold, fontSize: 11 },
  topName: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.text },
  topCount: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.gold },
  champCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  champLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  champCompName: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  champMeta: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  champRight: { alignItems: 'center', gap: 4, maxWidth: 96 },
  champAvatars: { flexDirection: 'row', gap: 3 },
  champWinner: { fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.gold, textAlign: 'center' },
});
