import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import { HexBackground } from '@/components/HexBackground';
import { Avatar, ScreenHeader } from '@/components';
import { FontFamily, Spacing, Radius, centeredContent, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useSettings } from '@/store/SettingsContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { extractPlayerGames } from '@/logic/formats';
import { buildRanking } from '@/logic/scoring';
import {
  suggestGroups, groupSizes, groupPhaseGames, knockoutGames, pairsOf, setupBlockers, setupWarnings, applySetup,
  minutesForWinRule, durationMinutes, fmtMin, FORMAT_NAME, type Distribution, type SetupOptions,
} from '@/logic/competitionPlan';
import {
  SectionTitle, FieldLabel, Hint, Notice, Segment, StepperRow, Box, SummaryRow, PrimaryButton,
} from '@/components/competition/FormKit';

type Rounds = 'single' | 'double';

/** Fase "Montar": com a lista fechada, o admin define grupos, turnos e chave (com sugestão) e gera os jogos. */
export default function MontarStep() {
  useRequireAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useCompetitions();
  const { groupPlayers, findPlayer } = useGroupPlayers();
  const { scoringConfig } = useSettings();
  const comp = state.competitions.find(c => c.id === id);

  const n = comp?.competitors.length ?? 0;
  const [groups, setGroups] = useState(2);
  const [qualifiers, setQualifiers] = useState(2);
  const [bestThirds, setBestThirds] = useState(0);
  const [rounds, setRounds] = useState<Rounds>('single');
  const [dist, setDist] = useState<Distribution>('auto');
  const [manual, setManual] = useState<Record<string, number>>({});
  const [courts, setCourts] = useState(2);
  const [busy, setBusy] = useState(false);
  const [seededFor, setSeededFor] = useState<number | null>(null);

  // A sugestão acompanha o nº de competidores até o admin mexer nos controles.
  useEffect(() => {
    if (!comp || seededFor === n) return;
    const sug = suggestGroups(n);
    setGroups(sug.groups); setQualifiers(sug.qualifiers); setBestThirds(sug.bestThirds);
    setSeededFor(n);
  }, [comp, n, seededFor]);

  const ranking = useMemo(() => {
    if (dist !== 'ranking') return [];
    const games = state.competitions.flatMap(extractPlayerGames);
    return buildRanking(groupPlayers.map(p => ({ id: p.id, name: p.name, short: '', color: p.color })), games, scoringConfig);
  }, [dist, state.competitions, groupPlayers, scoringConfig]);

  if (!comp) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'bottom']}>
        <HexBackground />
        <ScreenHeader title="Montar" onBack={() => router.replace('/(app)')} />
        <Text style={s.loading}>Carregando competição…</Text>
      </SafeAreaView>
    );
  }

  const format = comp.format;
  const isGrupos = format === 'grupos';
  const isLiga = format === 'liga';
  const isMata = format === 'mata';
  const sug = suggestGroups(n);
  const double = rounds === 'double';
  const title = isGrupos ? 'Montar grupos' : isLiga ? 'Montar liga' : 'Montar chaveamento';

  const manualGroups: string[][] = Array.from({ length: groups }, () => []);
  comp.competitors.forEach((c, i) => {
    const row = Math.floor(i / groups), col = i % groups;
    const dflt = row % 2 ? groups - 1 - col : col;
    manualGroups[Math.min(manual[c.id] ?? dflt, groups - 1)].push(c.id);
  });
  const opts: SetupOptions = {
    rounds, groups, qualifiers, bestThirds, distribution: dist,
    ...(dist === 'manual' ? { manualGroups } : {}),
  };
  const sizes = dist === 'manual' ? manualGroups.map(g => g.length) : groupSizes(n, groups);
  const blockers = setupBlockers(format, n, opts);
  const warnings = setupWarnings(format, n, opts);

  const qualified = groups * qualifiers + bestThirds;
  const minutes = minutesForWinRule(comp.config?.winRule);
  const totalGames = isLiga ? pairsOf(n) * (double ? 2 : 1)
    : isMata ? knockoutGames(n) + (comp.config.thirdPlace && n >= 4 ? 1 : 0)
    : (dist === 'manual' ? sizes.reduce((a, z) => a + pairsOf(z), 0) * (double ? 2 : 1) : groupPhaseGames(n, groups, double)) + knockoutGames(qualified) + (comp.config.thirdPlace && qualified >= 4 ? 1 : 0);

  function pick(k: 'g' | 'q' | 't', v: number) {
    if (k === 'g') { setGroups(v); setBestThirds(b => Math.min(b, v)); }
    else if (k === 'q') setQualifiers(v);
    else setBestThirds(v);
  }

  function useSuggestion() {
    setGroups(sug.groups); setQualifiers(sug.qualifiers); setBestThirds(sug.bestThirds);
  }

  function changeDist(d: Distribution) {
    setDist(d);
    if (d === 'manual') {
      const init: Record<string, number> = {};
      comp!.competitors.forEach((c, i) => {
        const row = Math.floor(i / groups), col = i % groups;
        init[c.id] = row % 2 ? groups - 1 - col : col;
      });
      setManual(init);
    }
  }

  function generate() {
    if (!comp || busy || blockers.length) return;
    setBusy(true);
    const rankingOrder = dist === 'ranking'
      ? [...comp.competitors]
          .sort((a, b) => {
            const best = (c: typeof a) => Math.min(...c.members.map(m => { const i = ranking.findIndex(r => r.id === m); return i < 0 ? 9999 : i; }));
            return best(a) - best(b);
          })
          .map(c => c.id)
      : undefined;
    const done = applySetup(comp, { ...opts, rankingOrder }, scoringConfig);
    dispatch({
      type: 'PATCH_COMP', compId: comp.id, onlyIfStatus: ['setup'],
      patch: {
        status: 'active', matches: done.matches, config: done.config,
        ...(done.groupDefs ? { groupDefs: done.groupDefs } : {}),
      },
    });
    router.replace({ pathname: '/competitions/[id]', params: { id: comp.id } });
  }

  const fromRegistration = !!comp.registration;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <HexBackground />
      <ScreenHeader
        title={title}
        subtitle={`${comp.name} · ${FORMAT_NAME[format]}`}
        onBack={() => (router.canGoBack() ? router.back() : router.replace({ pathname: '/competitions/[id]', params: { id: comp.id } }))}
      />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Box>
          <View style={s.countRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.countLabel}>{comp.unit === 'duplas' ? 'Duplas' : 'Inscritos'}</Text>
              <Text style={s.countSub}>{fromRegistration ? 'inscrições fechadas' : 'lista definida'}</Text>
            </View>
            <Text style={s.countVal}>{n}</Text>
          </View>
        </Box>

        {isGrupos && (
          <>
            <Notice>
              <Text style={s.bold}>Sugestão para {n} {comp.unit === 'duplas' ? 'duplas' : 'inscritos'}:</Text>{' '}
              {sug.groups} grupos ({groupSizes(n, sug.groups).join(', ')}), {sug.qualifiers} {sug.qualifiers === 1 ? 'classificado' : 'classificados'} por grupo
              {sug.bestThirds ? ` e os ${sug.bestThirds} melhores 3ºs` : ''} → <Text style={s.bold}>{sug.groups * sug.qualifiers + sug.bestThirds}</Text> no mata-mata.
            </Notice>
            <View style={{ marginTop: Spacing.sm }}>
              <PrimaryButton label="Usar sugestão" outline onPress={useSuggestion} />
            </View>

            <SectionTitle>Fase de grupos</SectionTitle>
            <Box>
              <StepperRow label="Nº de grupos" value={groups} min={2} max={8} onChange={v => pick('g', v)} />
              <StepperRow label="Classificados por grupo" value={qualifiers} min={1} max={4} onChange={v => pick('q', v)} />
              <StepperRow label="Melhores 3ºs que avançam" value={bestThirds} min={0} max={groups} onChange={v => pick('t', v)} />
              <FieldLabel>Turnos</FieldLabel>
              <Segment options={[{ value: 'single', label: 'Turno único' }, { value: 'double', label: 'Ida e volta' }]} value={rounds} onChange={setRounds} />
              <FieldLabel>Distribuição dos jogadores</FieldLabel>
              <Segment
                options={[{ value: 'auto', label: 'Automática' }, { value: 'ranking', label: 'Por ranking' }, { value: 'manual', label: 'Manual' }]}
                value={dist} onChange={changeDist}
              />
              <Hint>
                {dist === 'auto' ? 'Os competidores são sorteados e distribuídos em serpentina pelos grupos.'
                  : dist === 'ranking' ? 'Ordenados pelo ranking e distribuídos em serpentina: grupos mais equilibrados.'
                  : 'Toque na letra do grupo de cada competidor.'}
              </Hint>
            </Box>
            <View style={s.chips}>
              {sizes.map((z, i) => (
                <View key={i} style={s.chip}><Text style={s.chipText}>Grupo {String.fromCharCode(65 + i)} · {z}</Text></View>
              ))}
            </View>

            {dist === 'manual' && (
              <View style={{ marginTop: Spacing.sm }}>
                {comp.competitors.map(c => {
                  const cur = manualGroups.findIndex(g => g.includes(c.id));
                  const pl = c.members.length === 1 ? findPlayer(c.members[0]) : undefined;
                  return (
                    <View key={c.id} style={s.assignRow}>
                      <Avatar name={c.name} color={pl?.color ?? c.color} size={30} />
                      <Text style={s.assignName} numberOfLines={1}>{c.name.split(' ')[0]}</Text>
                      <View style={s.assignBtns}>
                        {Array.from({ length: groups }, (_, gi) => (
                          <TouchableOpacity
                            key={gi} style={[s.groupBadge, cur === gi && s.groupBadgeOn]}
                            onPress={() => setManual(prev => ({ ...prev, [c.id]: gi }))}
                            accessibilityLabel={`${c.name} no grupo ${String.fromCharCode(65 + gi)}`}
                          >
                            <Text style={[s.groupBadgeText, cur === gi && { color: C.bg }]}>{String.fromCharCode(65 + gi)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {isLiga && (
          <>
            <SectionTitle>Turnos</SectionTitle>
            <Segment options={[{ value: 'single', label: 'Turno único' }, { value: 'double', label: 'Ida e volta' }]} value={rounds} onChange={setRounds} />
            <Hint>{double ? 'Ida e volta: cada confronto acontece duas vezes.' : 'Turno único: cada confronto acontece uma vez.'}</Hint>
          </>
        )}

        {isMata && (
          <>
            <SectionTitle>Sorteio do chaveamento</SectionTitle>
            <Segment options={[{ value: 'auto', label: 'Sorteio' }, { value: 'ranking', label: 'Por ranking' }]} value={dist === 'ranking' ? 'ranking' : 'auto'} onChange={v => setDist(v as Distribution)} />
            <Hint>{dist === 'ranking'
              ? 'Os melhores do ranking viram cabeças de chave: se enfrentam só nas fases finais.'
              : 'A chave é sorteada ao gerar os jogos.'}</Hint>
          </>
        )}

        <View style={s.summary}>
          <Text style={s.sumTitle}>O que vai ser gerado</Text>
          {isGrupos ? (
            <>
              <SummaryRow label="Jogos na fase de grupos" value={String(dist === 'manual' ? sizes.reduce((a, z) => a + pairsOf(z), 0) * (double ? 2 : 1) : groupPhaseGames(n, groups, double))} />
              <SummaryRow label="Classificados para o mata-mata" value={`${qualified}${bestThirds ? ` (${groups * qualifiers} + ${bestThirds} melhores 3ºs)` : ''}`} />
              <SummaryRow label="Jogos do mata-mata" value={String(knockoutGames(qualified) + (comp.config.thirdPlace && qualified >= 4 ? 1 : 0))} />
            </>
          ) : (
            <SummaryRow label="Jogos" value={String(totalGames)} />
          )}
          <SummaryRow
            label="Duração estimada" last
            value={minutes ? `≈ ${fmtMin(durationMinutes(totalGames, minutes, courts))} com ${courts} ${courts === 1 ? 'quadra' : 'quadras'}` : '—'}
          />
          <StepperRow label="Quadras disponíveis" sub="só para estimar a duração" value={courts} min={1} max={20} onChange={setCourts} />
          {[...blockers, ...warnings].length ? (
            <Text style={[s.warn, blockers.length > 0 && { color: C.coral }]}>{[...blockers, ...warnings].join(' ')}</Text>
          ) : null}
        </View>

        <View style={{ marginTop: Spacing.md }}>
          <PrimaryButton
            label={fromRegistration ? 'Fechar inscrições e gerar jogos' : 'Gerar jogos'}
            onPress={generate} disabled={blockers.length > 0} busy={busy}
          />
        </View>
        <Text style={s.after}>
          {isGrupos ? 'Depois disso a competição entra em andamento e os grupos não mudam.' : 'Depois disso a competição entra em andamento e os jogos não mudam.'}
        </Text>
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { ...centeredContent, paddingHorizontal: Spacing.md, paddingBottom: Spacing.xl },
  loading: { fontFamily: FontFamily.body, fontSize: 15, color: C.muted, padding: Spacing.md },
  bold: { fontFamily: FontFamily.title },
  countRow: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.md, gap: Spacing.md },
  countLabel: { fontFamily: FontFamily.bodyMed, fontSize: 16, color: C.text },
  countSub: { fontFamily: FontFamily.body, fontSize: 14, color: C.muted },
  countVal: { fontFamily: FontFamily.numberBold, fontSize: 32, color: C.gold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.sm },
  chip: { minHeight: 32, paddingHorizontal: 12, justifyContent: 'center', borderRadius: Radius.full, borderWidth: 1, borderColor: C.line, backgroundColor: C.surf },
  chipText: { fontFamily: FontFamily.body, fontSize: 14, color: C.muted },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4, minHeight: 52 },
  assignName: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.text },
  assignBtns: { flexDirection: 'row', gap: 6 },
  groupBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.surf2, borderWidth: 1, borderColor: C.line },
  groupBadgeOn: { backgroundColor: C.gold, borderColor: C.gold },
  groupBadgeText: { fontFamily: FontFamily.numberBold, fontSize: 15, color: C.muted },
  summary: { backgroundColor: C.surf, borderWidth: 1, borderColor: C.gold + '99', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginTop: Spacing.lg },
  sumTitle: { fontFamily: FontFamily.titleBold, fontSize: 14, letterSpacing: 1.3, color: C.gold, textTransform: 'uppercase', paddingVertical: Spacing.sm },
  warn: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: C.gold, paddingVertical: Spacing.sm },
  after: { fontFamily: FontFamily.body, fontSize: 14, color: C.muted, textAlign: 'center', marginTop: Spacing.sm },
});
