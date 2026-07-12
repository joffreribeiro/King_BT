import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { buildCompetition } from '@/logic/formats';
import type { Match, Unit } from '@/logic/types';
import { WIN_RULE_PRESETS } from '@/constants/winRulePresets';

const DEFAULT_PRESET = 6; // MD3 · 4 games, com tie e super tiebreak

export default function AmistosoScreen() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { myPlayerId } = useAuth();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const { addCompetition } = useCompetitions();

  const [unit, setUnit] = useState<Unit>('individual');
  const maxPerTeam = unit === 'duplas' ? 2 : 1;
  const [teamA, setTeamA] = useState<string[]>(myPlayerId ? [myPlayerId] : []);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [busy, setBusy] = useState(false);

  function changeUnit(next: Unit) {
    setUnit(next);
    const max = next === 'duplas' ? 2 : 1;
    setTeamA(t => t.slice(0, max));
    setTeamB(t => t.slice(0, max));
  }

  const canCreate = teamA.length === maxPerTeam && teamB.length === maxPerTeam && !busy;

  async function handleCreate() {
    if (!canCreate) return;
    setBusy(true);
    try {
      const p = WIN_RULE_PRESETS[preset];
      const nameA = teamA.map(id => findPlayer(id)?.name.split(' ')[0] ?? id).join(' / ');
      const nameB = teamB.map(id => findPlayer(id)?.name.split(' ')[0] ?? id).join(' / ');

      const comp = buildCompetition({
        name: `Amistoso · ${nameA} x ${nameB}`,
        format: 'avulso',
        unit,
        gender: 'misto',
        competitors: [],
        config: {
          rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false,
          winRule: {
            sets: p.sets, games: p.games, tiebreak: p.tb,
            tiebreakAt: p.tbAt, superTiebreak: p.stb, superTiebreakPts: p.stbPts,
          },
        },
      });

      const match: Match = {
        id: 'am_' + Date.now(),
        stage: 'rotating',
        teamA, teamB,
        scoreA: null, scoreB: null,
      };

      const id = await addCompetition({
        ...comp,
        isFriendly: true,
        matches: [match],
        createdBy: myPlayerId ?? undefined,
      });

      router.replace({ pathname: '/competitions/[id]', params: { id } });
    } finally {
      setBusy(false);
    }
  }

  function TeamPicker({ side }: { side: 'A' | 'B' }) {
    const team = side === 'A' ? teamA : teamB;
    const setTeam = side === 'A' ? setTeamA : setTeamB;
    const otherTeam = side === 'A' ? teamB : teamA;
    return (
      <View style={s.field}>
        <Text style={s.fieldLabel}>
          {side === 'A' ? 'Você' : 'Adversário'}{unit === 'duplas' ? (side === 'A' ? ' / sua dupla' : ' / dupla adversária') : ''}
          {team.length > 0 ? ` — ${team.map(id => findPlayer(id)?.name.split(' ')[0] ?? id).join(' / ')}` : ''}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.chipRow}>
            {groupPlayers.filter(p => !otherTeam.includes(p.id)).map(p => {
              const selected = team.includes(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => {
                    if (selected) setTeam(team.filter(id => id !== p.id));
                    else if (team.length < maxPerTeam) setTeam([...team, p.id]);
                  }}
                  style={[s.chip, selected && s.chipActive]}
                >
                  <Text style={[s.chipTxt, selected && s.chipTxtActive]}>{p.name.split(' ')[0]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Jogo Amistoso</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.hint}>
          Registre um jogo avulso, fora de qualquer competição — conta nas suas estatísticas, histórico e H2H, mas não aparece na lista de torneios do grupo.
        </Text>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Formato</Text>
          <View style={s.segment}>
            {(['individual', 'duplas'] as Unit[]).map(u => (
              <TouchableOpacity
                key={u}
                style={[s.segmentBtn, unit === u && s.segmentBtnActive]}
                onPress={() => changeUnit(u)}
              >
                <Text style={[s.segmentTxt, unit === u && s.segmentTxtActive]}>
                  {u === 'individual' ? 'Individual' : 'Duplas'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TeamPicker side="A" />
        <TeamPicker side="B" />

        <View style={s.field}>
          <Text style={s.fieldLabel}>Formato de disputa</Text>
          <View style={s.presetGrid}>
            {WIN_RULE_PRESETS.map((p, i) => {
              const isActive = preset === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[s.presetCard, isActive && s.presetCardActive]}
                  onPress={() => setPreset(i)}
                >
                  <Text style={[s.presetLabel, isActive && s.presetLabelActive]}>{p.label}</Text>
                  <Text style={[s.presetDesc, isActive && s.presetDescActive]}>{p.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[s.createBtn, !canCreate && s.createBtnOff]}
          onPress={handleCreate}
          disabled={!canCreate}
        >
          <Text style={s.createTxt}>{busy ? 'Criando…' : 'Criar e registrar placar'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  back:  { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text, flex: 1 },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },

  hint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, lineHeight: 19 },

  field: { gap: Spacing.xs },
  fieldLabel: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.muted },

  segment: { flexDirection: 'row', gap: Spacing.xs },
  segmentBtn: {
    flex: 1, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center',
    backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line,
  },
  segmentBtnActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  segmentTxt: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  segmentTxtActive: { color: Colors.bg },

  chipRow: { flexDirection: 'row', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line,
  },
  chipActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  chipTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  chipTxtActive: { color: Colors.bg },

  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  presetCard: {
    width: '48%', padding: Spacing.sm, borderRadius: Radius.md,
    backgroundColor: Colors.surf2, borderWidth: 1, borderColor: Colors.line, gap: 2,
  },
  presetCardActive: { backgroundColor: `${Colors.gold}22`, borderColor: Colors.gold },
  presetLabel: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text },
  presetLabelActive: { color: Colors.gold },
  presetDesc: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  presetDescActive: { color: Colors.text },

  createBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2, alignItems: 'center', marginTop: Spacing.sm,
  },
  createBtnOff: { opacity: 0.4 },
  createTxt: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },
});
