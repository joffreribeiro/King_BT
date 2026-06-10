import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Match, Competition } from '@/logic/types';

function firstUnscored(matches: Match[]): Match | undefined {
  return matches.find(m => m.scoreA == null && ((m.aId && m.bId) || (m.teamA && m.teamB)));
}

function CourtLive({ comp, match, onSave, onBack }: {
  comp: Competition;
  match: Match;
  onSave: (a: number, b: number) => void;
  onBack: () => void;
}) {
  const { findPlayer } = useGroupPlayers();
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  const teamA = match.teamA ?? (match.aId ? [match.aId] : []);
  const teamB = match.teamB ?? (match.bId ? [match.bId] : []);

  const playersA = teamA.map(id => {
    if (match.aId) {
      const comp2 = comp.competitors.find(c => c.id === match.aId);
      return { name: comp2?.name ?? id, color: Colors.gold };
    }
    const p = findPlayer(id);
    return { name: p?.name ?? id, color: p?.color ?? Colors.gold };
  });

  const playersB = teamB.map(id => {
    if (match.bId) {
      const comp2 = comp.competitors.find(c => c.id === match.bId);
      return { name: comp2?.name ?? id, color: Colors.teal };
    }
    const p = findPlayer(id);
    return { name: p?.name ?? id, color: p?.color ?? Colors.teal };
  });

  const nameA = playersA.map(p => p.name.split(' ')[0]).join(' / ');
  const nameB = playersB.map(p => p.name.split(' ')[0]).join(' / ');

  const valid = scoreA !== scoreB;

  return (
    <View style={live.container}>
      <StatusBar hidden />

      <TouchableOpacity style={live.backBtn} onPress={onBack}>
        <Text style={live.backTxt}>← Sair</Text>
      </TouchableOpacity>

      <Text style={live.compName} numberOfLines={1}>{comp.name}</Text>

      <View style={live.scoreArea}>
        {/* Lado A */}
        <View style={live.side}>
          <View style={live.avatarRow}>
            {playersA.map((p, i) => (
              <Avatar key={i} name={p.name} color={p.color} size={56} />
            ))}
          </View>
          <Text style={live.teamName} numberOfLines={1}>{nameA}</Text>
          <Text style={[live.score, { color: scoreA > scoreB ? Colors.gold : Colors.muted }]}>{scoreA}</Text>
          <View style={live.btnRow}>
            <TouchableOpacity style={live.minusBtn} onPress={() => setScoreA(s => Math.max(0, s - 1))}>
              <Text style={live.minusTxt}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={live.plusBtn} onPress={() => setScoreA(s => s + 1)}>
              <Text style={live.plusTxt}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={live.vs}>
          <Text style={live.vsTxt}>VS</Text>
        </View>

        {/* Lado B */}
        <View style={live.side}>
          <View style={live.avatarRow}>
            {playersB.map((p, i) => (
              <Avatar key={i} name={p.name} color={p.color} size={56} />
            ))}
          </View>
          <Text style={live.teamName} numberOfLines={1}>{nameB}</Text>
          <Text style={[live.score, { color: scoreB > scoreA ? Colors.gold : Colors.muted }]}>{scoreB}</Text>
          <View style={live.btnRow}>
            <TouchableOpacity style={live.minusBtn} onPress={() => setScoreB(s => Math.max(0, s - 1))}>
              <Text style={live.minusTxt}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={live.plusBtn} onPress={() => setScoreB(s => s + 1)}>
              <Text style={live.plusTxt}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[live.saveBtn, !valid && live.saveBtnOff]}
        onPress={() => { if (valid) onSave(scoreA, scoreB); }}
        disabled={!valid}
      >
        <Text style={live.saveBtnTxt}>
          {!valid ? 'Sem empate' : `Salvar: ${nameA} ${scoreA}–${scoreB} ${nameB}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CourtScreen() {
  const { state, dispatch } = useCompetitions();
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [liveMatch, setLiveMatch] = useState<Match | null>(null);

  const activeComps = state.competitions.filter(c => c.status === 'active');
  const selectedComp = state.competitions.find(c => c.id === selectedCompId);

  function handleSave(a: number, b: number) {
    if (!liveMatch || !selectedCompId) return;
    dispatch({ type: 'SAVE_SCORE', compId: selectedCompId, matchId: liveMatch.id, scoreA: a, scoreB: b });
    // Advance to next match
    const comp = state.competitions.find(c => c.id === selectedCompId);
    if (!comp) { setLiveMatch(null); return; }
    const remaining = comp.matches.filter(m => m.id !== liveMatch.id);
    const next = firstUnscored(remaining);
    setLiveMatch(next ?? null);
  }

  if (liveMatch && selectedComp) {
    return (
      <CourtLive
        comp={selectedComp}
        match={liveMatch}
        onSave={handleSave}
        onBack={() => setLiveMatch(null)}
      />
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Modo Quadra ao Vivo</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {activeComps.length === 0 && (
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>🏓</Text>
            <Text style={s.emptyTitle}>Nenhuma competição ativa</Text>
            <Text style={s.emptySub}>Crie uma competição para usar o Modo Quadra.</Text>
          </View>
        )}

        {activeComps.map(comp => {
          const next = firstUnscored(comp.matches);
          const done = comp.matches.filter(m => m.scoreA != null).length;
          const total = comp.matches.length;
          return (
            <TouchableOpacity
              key={comp.id}
              activeOpacity={0.8}
              onPress={() => {
                setSelectedCompId(comp.id);
                setLiveMatch(next ?? null);
              }}
            >
              <View style={s.compCard}>
                <View style={s.compInfo}>
                  <Text style={s.compName}>{comp.name}</Text>
                  <Text style={s.compMeta}>{done}/{total} jogos · {next ? 'Próximo disponível' : 'Todos registrados'}</Text>
                </View>
                <Text style={s.arrow}>▶</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line },
  back: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.teal, width: 32 },
  title: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.text, flex: 1 },
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 18, color: Colors.text },
  emptySub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  compCard: {
    backgroundColor: Colors.surf, borderRadius: Radius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.line,
  },
  compInfo: { flex: 1 },
  compName: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  compMeta: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  arrow: { fontFamily: FontFamily.titleBold, fontSize: 18, color: Colors.gold },
});

const live = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.bg2, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xl,
  },
  backBtn: { position: 'absolute', top: 20, left: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.surf2, borderRadius: Radius.full },
  backTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  compName: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', marginBottom: Spacing.lg },
  scoreArea: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, width: '100%', marginBottom: Spacing.xl },
  side: { flex: 1, alignItems: 'center', gap: Spacing.md },
  avatarRow: { flexDirection: 'row', gap: -10 },
  teamName: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text, textAlign: 'center' },
  score: { fontFamily: FontFamily.titleBold, fontSize: 72, lineHeight: 80 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm },
  minusBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.line },
  minusTxt: { fontFamily: FontFamily.titleBold, fontSize: 28, color: Colors.muted, lineHeight: 34 },
  plusBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  plusTxt: { fontFamily: FontFamily.titleBold, fontSize: 36, color: Colors.bg, lineHeight: 42 },
  vs: { alignItems: 'center', paddingHorizontal: 4 },
  vsTxt: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.faint },
  saveBtn: { backgroundColor: Colors.teal, borderRadius: Radius.full, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, alignSelf: 'stretch', alignItems: 'center' },
  saveBtnOff: { opacity: 0.4 },
  saveBtnTxt: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },
});
