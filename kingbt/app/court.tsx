import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import type { Match, Competition } from '@/logic/types';

function firstUnscored(matches: Match[]): Match | undefined {
  return matches.find(m => m.scoreA == null && ((m.aId && m.bId) || (m.teamA && m.teamB)));
}

function isBtScore(a: number, b: number): { isBt: boolean; hint: string | null } {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === 5 && lo === 5) return { isBt: false, hint: 'BT: quem chegar a 7 primeiro vence!' };
  if (hi === 6 && lo === 6) return { isBt: false, hint: 'BT duplo: próximo ponto vence!' };
  return { isBt: false, hint: null };
}

function NextMatchPreview({ comp, match }: { comp: Competition; match: Match }) {
  const { findPlayer } = useGroupPlayers();
  const teamA = match.teamA ?? (match.aId ? [match.aId] : []);
  const teamB = match.teamB ?? (match.bId ? [match.bId] : []);

  function resolveName(id: string, useCompetitor: boolean): { name: string; color: string } {
    if (useCompetitor) {
      const c = comp.competitors.find(x => x.id === id);
      if (c) return { name: c.name, color: Colors.gold };
    }
    const p = findPlayer(id);
    return { name: p?.name.split(' ')[0] ?? id, color: p?.color ?? Colors.gold };
  }

  const useComp = !!(match.aId && match.bId && !match.teamA);
  const pA = teamA.map(id => resolveName(id, useComp));
  const pB = teamB.map(id => resolveName(id, useComp));

  return (
    <View style={nxt.card}>
      <Text style={nxt.title}>Próximo jogo</Text>
      <View style={nxt.teams}>
        <View style={nxt.team}>
          <View style={nxt.avatars}>
            {pA.map((p, i) => <Avatar key={i} name={p.name} color={p.color} size={36} />)}
          </View>
          <Text style={nxt.teamName} numberOfLines={1}>{pA.map(p => p.name).join(' / ')}</Text>
        </View>
        <Text style={nxt.vs}>VS</Text>
        <View style={nxt.team}>
          <View style={nxt.avatars}>
            {pB.map((p, i) => <Avatar key={i} name={p.name} color={p.color} size={36} />)}
          </View>
          <Text style={nxt.teamName} numberOfLines={1}>{pB.map(p => p.name).join(' / ')}</Text>
        </View>
      </View>
    </View>
  );
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
    if (match.aId && !match.teamA) {
      const comp2 = comp.competitors.find(c => c.id === match.aId);
      return { name: comp2?.name ?? id, color: Colors.gold };
    }
    const p = findPlayer(id);
    return { name: p?.name ?? id, color: p?.color ?? Colors.gold };
  });

  const playersB = teamB.map(id => {
    if (match.bId && !match.teamA) {
      const comp2 = comp.competitors.find(c => c.id === match.bId);
      return { name: comp2?.name ?? id, color: Colors.teal };
    }
    const p = findPlayer(id);
    return { name: p?.name ?? id, color: p?.color ?? Colors.teal };
  });

  const nameA = playersA.map(p => p.name.split(' ')[0]).join(' / ');
  const nameB = playersB.map(p => p.name.split(' ')[0]).join(' / ');

  const valid = scoreA !== scoreB;
  const { hint } = isBtScore(scoreA, scoreB);

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

      {/* Hint BT */}
      {hint && (
        <View style={live.hintBox}>
          <Text style={live.hintText}>🏓 {hint}</Text>
        </View>
      )}

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
  const params = useLocalSearchParams<{ compId?: string }>();
  const [selectedCompId, setSelectedCompId] = useState<string | null>(params.compId ?? null);
  const [liveMatch, setLiveMatch] = useState<Match | null>(null);

  const activeComps = state.competitions.filter(c => c.status === 'active');
  const selectedComp = state.competitions.find(c => c.id === selectedCompId);

  // Auto-abrir próximo jogo quando compId é passado por param
  useEffect(() => {
    if (params.compId && !liveMatch) {
      const comp = state.competitions.find(c => c.id === params.compId);
      if (comp) {
        const next = firstUnscored(comp.matches);
        if (next) setLiveMatch(next);
      }
    }
  }, [params.compId]);

  function handleSave(a: number, b: number) {
    if (!liveMatch || !selectedCompId) return;
    dispatch({ type: 'SAVE_SCORE', compId: selectedCompId, matchId: liveMatch.id, scoreA: a, scoreB: b });
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

  // Se tem comp selecionada mas nenhum jogo ao vivo, mostra tela de seleção de partida
  const compViewDone = selectedComp ? selectedComp.matches.filter(m => m.scoreA != null).length : 0;
  const compViewTotal = selectedComp ? selectedComp.matches.length : 0;
  const compViewNext = selectedComp ? firstUnscored(selectedComp.matches) : undefined;

  if (selectedComp) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { setSelectedCompId(null); setLiveMatch(null); }}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{selectedComp.name}</Text>
            <Text style={s.meta}>{compViewDone}/{compViewTotal} jogos registrados</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {compViewNext ? (
            <TouchableOpacity activeOpacity={0.85} onPress={() => setLiveMatch(compViewNext)}>
              <NextMatchPreview comp={selectedComp} match={compViewNext} />
            </TouchableOpacity>
          ) : (
            <View style={s.empty}>
              <Text style={{ fontSize: 40 }}>✅</Text>
              <Text style={s.emptyTitle}>Todos os jogos registrados!</Text>
              <Text style={s.emptySub}>Nenhuma partida pendente nesta competição.</Text>
            </View>
          )}

          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
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
  meta: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted },
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.title, fontSize: 18, color: Colors.text },
  emptySub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  sectionLabel: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted, marginTop: Spacing.sm, marginBottom: 4 },
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

const nxt = StyleSheet.create({
  card: {
    backgroundColor: Colors.surf,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gold + '44',
    gap: Spacing.sm,
  },
  title: { fontFamily: FontFamily.title, fontSize: 13, color: Colors.gold, letterSpacing: 1 },
  teams: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  team: { flex: 1, alignItems: 'center', gap: 6 },
  avatars: { flexDirection: 'row', gap: -8 },
  teamName: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text, textAlign: 'center' },
  vs: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.faint, paddingHorizontal: 4 },
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
  hintBox: {
    backgroundColor: Colors.gold + '22',
    borderRadius: Radius.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.gold + '55',
  },
  hintText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.gold, textAlign: 'center' },
  saveBtn: { backgroundColor: Colors.teal, borderRadius: Radius.full, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, alignSelf: 'stretch', alignItems: 'center' },
  saveBtnOff: { opacity: 0.4 },
  saveBtnTxt: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },
});
