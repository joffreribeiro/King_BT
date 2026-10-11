import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, Platform, TextInput } from 'react-native';
import { Icon } from '@/components/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect, useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import type { Match, Competition, SetScore } from '@/logic/types';
import { tiebreaksDosSets } from '@/logic/btPlacarPonto';
import { erroTiebreak, setTerminouEmTiebreak } from '@/logic/tiebreakManual';
import { carregarAnalise, placardInicial, avancaPonto, winRuleFromComp, type BtAnalise } from '@/logic/btTracker';
import { loadAnaliseFs } from '@/firebase/analises';
import { deriveWinRule, isDecidingSet as isDecidingSetShared } from '@/logic/setOutcome';
import { getCompetitor } from './helpers';
import { PointLogModal } from '@/components/analise/PointLogModal';

/** Um set no formulário: games de cada lado e, quando o set foi decidido em tie-break, os pontos dele (opcionais). */
type SetRow = { a: string; b: string; tbA?: string; tbB?: string };

export function ScorerModal({ match, comp, onClose, onSave, onSaveDraft, onClear, isAdmin = false }: {
  match: Match | null; comp: Competition;
  onClose: () => void;
  onSave: (id: string, a: number, b: number, sets?: SetScore[]) => void;
  onSaveDraft: (id: string, sets: { a: number; b: number }[]) => void;
  onClear: (matchId: string) => void;
  isAdmin?: boolean;
}) {
  const { findPlayer } = useGroupPlayers();
  const { isSuperAdmin, group } = useAuth();
  const { colors: Colors } = useTheme();
  const sc = useMemo(() => makeSc(Colors), [Colors]);
  const insets = useSafeAreaInsets();
  const [analise, setAnalise] = useState<BtAnalise | null>(null);
  const [showPointLog, setShowPointLog] = useState(false);

  const { maxSets, setsToWin, gamesWin, superTb, superTbPts, tieAt, tieMode } = useMemo(
    () => deriveWinRule(comp.config.winRule),
    [comp.config.winRule]
  );

  // Estado: games por set. Começa com 1 set vazio.
  const deSet = (s: SetScore): SetRow => ({ a: String(s.a), b: String(s.b), ...(s.tb ? { tbA: String(s.tb.a), tbB: String(s.tb.b) } : {}) });
  const initSets = (): SetRow[] => {
    if (match?.sets?.length) return match.sets.map(deSet);
    return [{ a: '', b: '' }];
  };
  const [setScores, setSetScores] = useState<SetRow[]>(initSets);

  useEffect(() => {
    if (!match) return;

    (group?.id ? loadAnaliseFs(group.id, match.id, comp.id).catch(() => null) : Promise.resolve(null))
      .then(remote => remote ?? carregarAnalise(match.id, comp.id))
      .then(a => {
      setAnalise(a);

      // Prioridade 1: placar final do King Scout (partida encerrada)
      if (a?.placarFinal) {
        const { gamesA, gamesB } = a.placarFinal;
        const tbs = tiebreaksDosSets({ pontos: a.pontos, rule: a.rule, inicial: a.inicial });
        const sets: SetRow[] = gamesA.map((gA, i) => ({
          a: String(gA), b: String(gamesB[i] ?? 0),
          ...(tbs[i] && !a.placarFinal?.stb?.[i] ? { tbA: String(tbs[i]!.a), tbB: String(tbs[i]!.b) } : {}),
        }));
        setSetScores(sets.length > 0 ? sets : [{ a: '', b: '' }]);
        return;
      }

      // Prioridade 2: King Scout em andamento — reconstrói placard dos pontos
      if (a?.pontos?.length) {
        const rule = winRuleFromComp(comp.config.winRule);
        let pl = placardInicial(rule, a.inicial);
        for (const p of a.pontos) pl = avancaPonto(pl, p.vencedorDupla, p.sacador);
        // Monta sets encerrados + set atual
        const tbsAndamento = tiebreaksDosSets({ pontos: a.pontos, rule, inicial: a.inicial });
        const sets: SetRow[] = pl.historicGamesA.map((gA: number, i: number) => ({
          a: String(gA), b: String(pl.historicGamesB[i] ?? 0),
          ...(tbsAndamento[i] && !pl.historicStb[i] ? { tbA: String(tbsAndamento[i]!.a), tbB: String(tbsAndamento[i]!.b) } : {}),
        }));
        sets.push({ a: String(pl.gamesA), b: String(pl.gamesB) });
        setSetScores(sets);
        return;
      }

      // Prioridade 3: rascunho salvo
      if (match.draftSets?.length) {
        setSetScores(match.draftSets.map(s => ({ a: String(s.a), b: String(s.b) })));
        return;
      }

      // Prioridade 4: placar já registrado no Match
      if (match.sets?.length) {
        setSetScores(match.sets.map(deSet));
        return;
      }

      setSetScores([{ a: '', b: '' }]);
    });
  }, [match?.id]);

  if (!match) return null;

  const teamA = match.teamA ?? (match.aId ? [match.aId] : []);
  const teamB = match.teamB ?? (match.bId ? [match.bId] : []);
  const nameA = match.teamA
    ? match.teamA.map(id => findPlayer(id)?.name.split(' ')[0]).join(' / ')
    : (match.aId ? getCompetitor(comp, match.aId)?.name : '?') ?? '?';
  const nameB = match.teamB
    ? match.teamB.map(id => findPlayer(id)?.name.split(' ')[0]).join(' / ')
    : (match.bId ? getCompetitor(comp, match.bId)?.name : '?') ?? '?';

  // Calcula sets vencidos a partir dos games/pontos
  const computedSets = setScores.reduce(
    (acc, s, idx) => {
      const gA = parseInt(s.a) || 0;
      const gB = parseInt(s.b) || 0;
      if (gA === 0 && gB === 0) return acc;

      if (isDecidingSet(idx)) {
        // Super tie-break: primeiro a superTbPts com diff ≥ 2
        const aWins = gA >= superTbPts && gA - gB >= 2;
        const bWins = gB >= superTbPts && gB - gA >= 2;
        if (aWins) return { a: acc.a + 1, b: acc.b };
        if (bWins) return { a: acc.a, b: acc.b + 1 };
        return acc;
      }

      // Só G games no total: fecha ao completar os games; quem fez mais leva o set, empatado ninguém leva
      if (tieMode === 'fixed') {
        if (gA + gB < gamesWin) return acc;
        if (gA > gB) return { a: acc.a + 1, b: acc.b };
        if (gB > gA) return { a: acc.a, b: acc.b + 1 };
        return acc;
      }

      // Set normal: primeiro a gamesWin vence, tie-break quando ambos chegam em tieAt
      const tied = gA === tieAt && gB === tieAt;
      if (tied) {
        // Após tie: quem chegar a tieAt+1 vence
        if (gA >= tieAt + 1 && gA > gB) return { a: acc.a + 1, b: acc.b };
        if (gB >= tieAt + 1 && gB > gA) return { a: acc.a, b: acc.b + 1 };
        return acc;
      }
      if (gA >= gamesWin && gA > gB) return { a: acc.a + 1, b: acc.b };
      if (gB >= gamesWin && gB > gA) return { a: acc.a, b: acc.b + 1 };
      return acc;
    },
    { a: 0, b: 0 }
  );

  const setsA = computedSets.a;
  const setsB = computedSets.b;
  const totalSetsPlayed = setScores.filter(s => (parseInt(s.a) || 0) + (parseInt(s.b) || 0) > 0).length;
  // Games fixos: a partida acaba quando os G games foram jogados, mesmo empatada (2 x 2)
  const fixoCompleto = tieMode === 'fixed' && setScores.some(s => (parseInt(s.a) || 0) + (parseInt(s.b) || 0) >= gamesWin);
  const matchFinished = setsA >= setsToWin || setsB >= setsToWin || fixoCompleto;
  const hasWinner = matchFinished && setsA !== setsB;
  const empateFixo = fixoCompleto && setsA === setsB;
  // Pode salvar o resultado final: tem vencedor, ou é um jogo de games fixos terminado em empate
  const finalizavel = hasWinner || empateFixo;
  // Compara com os sets que já estão na tela, não só com os preenchidos: em melhor de 1 set o botão não deve aparecer.
  const canAddSet = !matchFinished && setScores.length < maxSets;
  const alreadyScored = match.scoreA != null;
  const canEdit = !alreadyScored || isAdmin;
  const analiseEncerrada = !!analise?.placarFinal;


  // Verifica se o set atual (pelo índice) é o super tie-break decisivo.
  // Lógica compartilhada com a classificação retroativa de sets nas estatísticas
  // (src/logic/setOutcome.ts), pra ScorerModal e stats.tsx nunca divergirem.
  function isDecidingSet(setIdx: number): boolean {
    const priorSets = setScores.slice(0, setIdx).map(s => ({
      a: parseInt(s.a) || 0, b: parseInt(s.b) || 0,
    }));
    return isDecidingSetShared(setIdx, priorSets, { maxSets, setsToWin, gamesWin, superTb, superTbPts, tieAt, tieMode });
  }

  // ── Tie-break do set (registro manual, opcional) ──────────────────────────
  const tbLimite = comp.config.winRule?.tiebreak ?? 7;

  /** O set terminou como termina um set decidido no tie-break (tieAt+1 × tieAt)? Aí dá para informar os pontos dele. */
  function temTiebreak(setIdx: number): boolean {
    const st = setScores[setIdx];
    if (!st || isDecidingSet(setIdx)) return false;
    return setTerminouEmTiebreak(parseInt(st.a) || 0, parseInt(st.b) || 0, tieAt);
  }

  /** Pontos do tie-break já válidos de um set, ou null (sem tie-break, em branco ou inválido). */
  function tbDoSet(setIdx: number): { a: number; b: number } | null {
    const st = setScores[setIdx];
    if (!st || !temTiebreak(setIdx) || st.tbA === undefined || st.tbB === undefined || st.tbA === '' || st.tbB === '') return null;
    return tbErro(setIdx) ? null : { a: parseInt(st.tbA) || 0, b: parseInt(st.tbB) || 0 };
  }

  /** Mensagem de erro do tie-break (null = válido). Em branco é erro: o tie-break é obrigatório. */
  function tbErro(setIdx: number): string | null {
    const st = setScores[setIdx];
    if (!st || !temTiebreak(setIdx)) return null;
    return erroTiebreak(parseInt(st.a) || 0, parseInt(st.b) || 0, st.tbA, st.tbB, tbLimite);
  }

  function updateTb(setIdx: number, side: 'a' | 'b', raw: string) {
    const v = raw.replace(/\D/g, '').slice(0, 2);
    setSetScores(prev => prev.map((st, i) => (i === setIdx ? { ...st, [side === 'a' ? 'tbA' : 'tbB']: v } : st)));
  }

  // Tie-break por +/−: o teclado numérico cobria os campos no celular. Vazio conta como 0; "−" em 0 não faz nada.
  function stepTb(setIdx: number, side: 'a' | 'b', delta: number) {
    setSetScores(prev => prev.map((st, i) => {
      if (i !== setIdx) return st;
      const key = side === 'a' ? 'tbA' : 'tbB';
      const atual = parseInt(st[key] ?? '', 10) || 0;
      const prox = Math.max(0, Math.min(99, atual + delta));
      return { ...st, [key]: String(prox) };
    }));
  }

  /** Atalhos de placar do set (derivados da regra: ex. 6–0, 6–4, 7–5, 7–6). Só preenche os games; o tie-break é pedido logo abaixo. */
  // Só placares que a regra permite: gamesWin × 0..(gamesWin−2) e o set decidido no tie-break (tieAt+1 × tieAt).
  const atalhosBase: [number, number][] =
    tieMode === 'fixed' ? Array.from({ length: Math.floor(gamesWin / 2) + 1 }, (_, i) => [gamesWin - i, i] as [number, number])   // 4–0, 3–1, 2–2
      : tieMode === 'none' ? [[gamesWin, 0], [gamesWin, gamesWin - 2], [gamesWin, gamesWin - 1]]                                 // 4–0, 4–2, 4–3
      : [[gamesWin, 0], [gamesWin, 2], [gamesWin, gamesWin - 2], [tieAt + 1, tieAt]];
  const atalhos: [number, number][] = atalhosBase
    .filter(([x, y], i, arr) => x >= y && y >= 0 && arr.findIndex(([a, b]) => a === x && b === y) === i) as [number, number][];
  function aplicarAtalho(setIdx: number, a: number, b: number) {
    setSetScores(prev => prev.map((st, i) => (i === setIdx ? { a: String(a), b: String(b) } : st)));
  }
  function inverterSet(setIdx: number) {
    setSetScores(prev => prev.map((st, i) => (i === setIdx ? { ...st, a: st.b, b: st.a, tbA: st.tbB, tbB: st.tbA } : st)));
  }

  // Limite máximo de pontos/games que um lado pode ter num set
  function maxGamesForSide(myVal: number, otherVal: number, setIdx: number): number {
    // Só G games no total: o que sobrou depois dos games do outro lado
    if (tieMode === 'fixed') return Math.max(0, gamesWin - otherVal);
    // Sem tie-break: o set fecha em G games; se o outro lado já fechou, este não passa do que tem
    if (tieMode === 'none') return otherVal >= gamesWin ? Math.min(myVal, gamesWin - 1) : gamesWin;
    if (isDecidingSet(setIdx)) {
      const minPts = superTbPts;
      const leading = Math.max(myVal, otherVal);
      if (myVal >= minPts && myVal - otherVal >= 2) return myVal;
      if (otherVal >= minPts && otherVal - myVal >= 2) return myVal;
      return Math.max(minPts, leading + 1);
    }
    // Set normal: tie quando ambos chegam em tieAt
    if (otherVal >= tieAt && myVal >= tieAt) return tieAt + 1; // permite tie-break
    if (otherVal >= tieAt + 1) return tieAt + 2;               // tie-break em andamento
    return gamesWin;
  }

  function updateGame(setIdx: number, side: 'a' | 'b', rawVal: string | number) {
    const newVal = typeof rawVal === 'number' ? rawVal : (parseInt(rawVal) || 0);
    setSetScores(prev => prev.map((s, i) => {
      if (i !== setIdx) return s;
      const other = parseInt(side === 'a' ? s.b : s.a) || 0;
      const max = maxGamesForSide(newVal, other, setIdx);
      const clamped = Math.max(0, Math.min(newVal, max));
      return { ...s, [side]: String(clamped) };
    }));
  }

  function addSet() {
    if (canAddSet) setSetScores(prev => [...prev, { a: '', b: '' }]);
  }

  function removeLastSet() {
    if (setScores.length > 1) setSetScores(prev => prev.slice(0, -1));
  }

  function abrirMarcacaoAoVivo() {
    const ir = () => {
      onClose();
      router.push({ pathname: '/court', params: { compId: comp.id, matchId: match!.id } });
    };
    if (!alreadyScored) { ir(); return; }
    const msg = 'Esta partida já tem placar registrado. Entrar na marcação ponto a ponto e marcar um novo ponto vai sobrescrever esse resultado. Continuar?';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) ir();
    } else {
      Alert.alert('Sobrescrever placar?', msg, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', style: 'destructive', onPress: ir },
      ]);
    }
  }

  function abrirBtTracker() {
    onClose();
    const wr = comp.config.winRule;
    router.push({
      pathname: '/analise/[matchId]/ponto',
      params: {
        matchId: match!.id, compId: comp.id,
        a1: teamA[0] ?? '', a2: teamA[1] ?? '',
        b1: teamB[0] ?? '', b2: teamB[1] ?? '',
        sets: String(wr?.sets ?? 3), games: String(wr?.games ?? 6),
        tiebreak: String(wr?.tiebreak ?? 7), scoutMode: wr?.scoutMode ?? 'avancado',
        // A regra atravessa como parâmetros de URL. Sem estes três campos o
        // Scout caía no padrão — e como ele lê `superTiebreak === 'true'`, a
        // ausência virava "sem super tie-break" mesmo com a competição
        // configurada com ele.
        tiebreakAt: wr?.tiebreakAt ?? 'deuce',
        superTiebreak: String(wr?.superTiebreak ?? false),
        superTiebreakPts: String(wr?.superTiebreakPts ?? 10),
      },
    });
  }

  function abrirRelatorio() {
    onClose();
    router.push({ pathname: '/analise/[matchId]/relatorio', params: { matchId: match!.id, compId: comp.id } });
  }

  function confirmClear() {
    if (Platform.OS === 'web') {
      if (window.confirm('Apagar placar? O resultado será removido.')) { onClear(match!.id); onClose(); }
    } else {
      Alert.alert('Apagar placar?', 'O resultado será removido.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: () => { onClear(match!.id); onClose(); } },
      ]);
    }
  }

  const validSets: SetScore[] = setScores.map((s, i) => ({ s, i })).filter(({ s }) => {
    const gA = parseInt(s.a) || 0, gB = parseInt(s.b) || 0;
    return gA > 0 || gB > 0;
  }).map(({ s, i }) => {
    const tb = tbDoSet(i);
    return { a: parseInt(s.a) || 0, b: parseInt(s.b) || 0, ...(tb ? { tb } : {}) };
  });
  // Set decidido em tie-break sem os pontos (ou com pontos inválidos) bloqueia o salvar
  const tbInvalido = setScores.some((_, i) => !!tbErro(i));

  // Só permite salvar se todos os sets do placar têm games preenchidos

  return (
    <Modal visible transparent animationType="slide">
      <View style={sc.overlay}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={[sc.sheet, { paddingBottom: Spacing.xl + Math.max(insets.bottom, 12) }]}>
          <Text style={sc.title}>Registrar Placar</Text>
          <Text style={sc.sub}>{comp.name}{match.round ? ` · Rodada ${match.round}` : ''}</Text>
          <Text style={sc.setsRule}>{tieMode === 'fixed' ? `${gamesWin} games no total · pode empatar` : `${maxSets === 1 ? 'Melhor de 1 set' : `Melhor de ${maxSets} sets`} · ${gamesWin} games por set${tieMode === 'none' ? ' · sem tie-break' : ''}`}</Text>

          {/* Placar calculado automaticamente */}
          <View style={sc.autoScore}>
            <View style={sc.autoSide}>
              <Text style={sc.autoName} numberOfLines={1}>{nameA}</Text>
              <Text style={[sc.autoSets, setsA > setsB ? { color: Colors.teal } : {}]}>{setsA}</Text>
            </View>
            <View style={sc.autoCenter}>
              <Text style={sc.autoLabel}>sets</Text>
              {matchFinished && !hasWinner && (empateFixo ? <Text style={sc.autoLabel}>Empate</Text> : <Text style={[sc.autoLabel, { color: Colors.coral }]}>⚠️ Empate</Text>)}
            </View>
            <View style={sc.autoSide}>
              <Text style={sc.autoName} numberOfLines={1}>{nameB}</Text>
              <Text style={[sc.autoSets, setsB > setsA ? { color: Colors.teal } : {}]}>{setsB}</Text>
            </View>
          </View>

          {/* Sets com games */}
          <View style={sc.setsSection}>
            <Text style={sc.setsTitle}>GAMES POR SET</Text>
            {setScores.map((s, i) => {
              const gA = parseInt(s.a) || 0, gB = parseInt(s.b) || 0;
              const deciding = isDecidingSet(i);
              const pts = deciding ? superTbPts : gamesWin;
              const aWon = deciding
                ? (gA >= pts && gA - gB >= 2)
                : (gA >= gamesWin && gA > gB);
              const bWon = deciding
                ? (gB >= pts && gB - gA >= 2)
                : (gB >= gamesWin && gB > gA);
              const filled = gA > 0 || gB > 0;
              const maxA = maxGamesForSide(gA, gB, i);
              const maxB = maxGamesForSide(gB, gA, i);
              const canIncA = gA < maxA;
              const canIncB = gB < maxB;
              return (
                <View key={i} style={{ gap: 6 }}>
                <View style={sc.setRow}>
                  <Text style={[sc.setLabel, deciding && { color: Colors.gold }]}>
                    {deciding ? `STB` : `Set ${i + 1}`}
                  </Text>
                  {/* Games lado A */}
                  <View style={sc.gameStepperWrap}>
                    <TouchableOpacity
                      style={[sc.gameBtn, gA === 0 && { opacity: 0.3 }]}
                      onPress={() => updateGame(i, 'a', gA - 1)}
                      disabled={gA === 0}
                      accessibilityRole="button"
                      accessibilityLabel={`Diminuir games de ${nameA} no set ${i + 1}`}
                    >
                      <Icon name="minus" size={16} color={Colors.gold} />
                    </TouchableOpacity>
                    <View
                      style={[sc.gameVal, aWon && filled && { borderColor: Colors.teal }]}
                      accessible
                      accessibilityLabel={`${nameA}, set ${i + 1}: ${gA} games`}
                    >
                      <Text style={[sc.gameValTxt, aWon && filled && { color: Colors.teal }]}>{s.a || '0'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[sc.gameBtn, !canIncA && { opacity: 0.3 }]}
                      onPress={() => updateGame(i, 'a', gA + 1)}
                      disabled={!canIncA}
                      accessibilityRole="button"
                      accessibilityLabel={`Aumentar games de ${nameA} no set ${i + 1}`}
                    >
                      <Icon name="plus" size={16} color={Colors.gold} />
                    </TouchableOpacity>
                  </View>
                  <Text style={sc.setDash}>–</Text>
                  {/* Games lado B */}
                  <View style={sc.gameStepperWrap}>
                    <TouchableOpacity
                      style={[sc.gameBtn, gB === 0 && { opacity: 0.3 }]}
                      onPress={() => updateGame(i, 'b', gB - 1)}
                      disabled={gB === 0}
                      accessibilityRole="button"
                      accessibilityLabel={`Diminuir games de ${nameB} no set ${i + 1}`}
                    >
                      <Icon name="minus" size={16} color={Colors.gold} />
                    </TouchableOpacity>
                    <View
                      style={[sc.gameVal, bWon && filled && { borderColor: Colors.teal }]}
                      accessible
                      accessibilityLabel={`${nameB}, set ${i + 1}: ${gB} games`}
                    >
                      <Text style={[sc.gameValTxt, bWon && filled && { color: Colors.teal }]}>{s.b || '0'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[sc.gameBtn, !canIncB && { opacity: 0.3 }]}
                      onPress={() => updateGame(i, 'b', gB + 1)}
                      disabled={!canIncB}
                      accessibilityRole="button"
                      accessibilityLabel={`Aumentar games de ${nameB} no set ${i + 1}`}
                    >
                      <Icon name="plus" size={16} color={Colors.gold} />
                    </TouchableOpacity>
                  </View>
                </View>
                {temTiebreak(i) && (
                  <View style={{ gap: 4 }}>
                    <Text style={sc.tbLabel}>Tie-break</Text>
                    <View style={sc.setRow}>
                      <View style={{ width: 44 }} />
                      {(['a', 'b'] as const).map((side, k) => {
                        const nome = side === 'a' ? nameA : nameB;
                        const val = side === 'a' ? s.tbA : s.tbB;
                        const n = parseInt(val ?? '', 10) || 0;
                        return (
                          <View key={side} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {k === 1 && <Text style={sc.setDash}>–</Text>}
                            <View style={sc.gameStepperWrap}>
                              <TouchableOpacity
                                style={[sc.gameBtn, n === 0 && { opacity: 0.3 }]}
                                onPress={() => stepTb(i, side, -1)} disabled={n === 0}
                                accessibilityRole="button" accessibilityLabel={`Diminuir pontos do tie-break de ${nome} no set ${i + 1}`}
                              >
                                <Icon name="minus" size={16} color={Colors.gold} />
                              </TouchableOpacity>
                              <View style={sc.gameVal} accessible accessibilityLabel={`${nome}, tie-break do set ${i + 1}: ${n} pontos`}>
                                <Text style={sc.gameValTxt}>{n}</Text>
                              </View>
                              <TouchableOpacity
                                style={sc.gameBtn}
                                onPress={() => stepTb(i, side, 1)}
                                accessibilityRole="button" accessibilityLabel={`Aumentar pontos do tie-break de ${nome} no set ${i + 1}`}
                              >
                                <Icon name="plus" size={16} color={Colors.gold} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                    {!!tbErro(i) && <Text style={sc.tbErro}>{tbErro(i)}</Text>}
                  </View>
                )}
                {canEdit && i === setScores.length - 1 && !deciding && (
                  <View style={sc.chipsRow}>
                    {atalhos.map(([x, y]) => (
                      <TouchableOpacity key={`${x}-${y}`} style={sc.chip} onPress={() => aplicarAtalho(i, x, y)}
                        accessibilityRole="button" accessibilityLabel={`Placar ${x} a ${y} no set ${i + 1}`}>
                        <Text style={sc.chipTxt}>{x}–{y}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={sc.chip} onPress={() => inverterSet(i)} accessibilityRole="button" accessibilityLabel="Inverter o placar do set">
                      <Text style={sc.chipTxt}>⇄ inverter</Text>
                    </TouchableOpacity>
                  </View>
                )}
                </View>
              );
            })}
            {/* Botões add/remove set */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {canAddSet && (
                <TouchableOpacity style={sc.addSetBtn} onPress={addSet}>
                  <Text style={sc.addSetTxt}>+ Adicionar set</Text>
                </TouchableOpacity>
              )}
              {setScores.length > 1 && (
                <TouchableOpacity style={[sc.addSetBtn, { borderColor: Colors.coral + '55' }]} onPress={removeLastSet}>
                  <Text style={[sc.addSetTxt, { color: Colors.coral }]}>− Remover</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Badge de rascunho salvo */}
          {match?.draftSets?.length && !alreadyScored && (
            <View style={sc.draftBadge}>
              <Text style={sc.draftBadgeTxt}>📝 Rascunho salvo — não conta no ranking até finalizar</Text>
            </View>
          )}

          {alreadyScored && !isAdmin && (
            <Text style={sc.lockedText}>🔒 Placar já registrado. Apenas admin pode corrigir.</Text>
          )}
          {isAdmin && alreadyScored && (
            <Text style={sc.adminNote}>⚙️ Admin — você pode corrigir ou apagar este placar.</Text>
          )}

          {/* King Scout — exclusivo do Super Admin */}
          {!isSuperAdmin ? null : analise && !analiseEncerrada ? (
            // Análise em andamento — permite continuar ou ver parcial
            <View style={{ gap: 6 }}>
              <TouchableOpacity style={[sc.btBtn, sc.btBtnContinuar]} onPress={abrirBtTracker}>
                <Text style={sc.btBtnTxtContinuar}>▶ Continuar King Scout</Text>
                <Text style={sc.btBtnSub}>{analise.pontos.length} pontos registrados</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sc.btBtnSecundario} onPress={abrirRelatorio}>
                <Text style={sc.btBtnSecundarioTxt}>📊 Ver análise parcial</Text>
              </TouchableOpacity>
            </View>
          ) : analise && analiseEncerrada ? (
            // Análise encerrada — só visualização + opção de nova análise
            <View style={{ gap: 6 }}>
              <TouchableOpacity style={sc.btBtn} onPress={abrirRelatorio}>
                <Text style={sc.btBtnTxt}>📊 Ver análise do King Scout</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sc.btBtnSecundario} onPress={abrirBtTracker}>
                <Text style={sc.btBtnSecundarioTxt}>🎾 Nova análise do King Scout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Sem análise — começa do zero
            <TouchableOpacity style={sc.btBtn} onPress={abrirBtTracker}>
              <Text style={sc.btBtnTxt}>👑 Usar King Scout</Text>
            </TouchableOpacity>
          )}

          <View style={sc.btns}>
            <TouchableOpacity onPress={onClose} style={sc.cancel}>
              <Text style={sc.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            {/* Salvar rascunho — só quando não tem vencedor e tem algum game preenchido */}
            {!finalizavel && !alreadyScored && validSets.length > 0 && (
              <TouchableOpacity
                style={sc.draft}
                onPress={() => {
                  onSaveDraft(match.id, validSets);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Text style={sc.draftText}>📝 Rascunho</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                if (finalizavel && canEdit && !tbInvalido) {
                  onSave(match.id, setsA, setsB, validSets.length > 0 ? validSets : undefined);
                }
              }}
              style={[sc.save, (!finalizavel || !canEdit || tbInvalido) && sc.saveOff]}
              disabled={!finalizavel || !canEdit || tbInvalido}
            >
              <Text style={sc.saveText}>{alreadyScored && isAdmin ? 'Corrigir' : 'Salvar placar'}</Text>
            </TouchableOpacity>
          </View>
          <View style={sc.linksRow}>
            {!!analise?.pontos?.length && (
              <TouchableOpacity onPress={() => setShowPointLog(true)} hitSlop={8} accessibilityRole="button">
                <Text style={sc.linkTxt}>Ver pontos</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={abrirMarcacaoAoVivo} hitSlop={8} accessibilityRole="button">
              <Text style={sc.linkTxt}>Marcar ponto a ponto</Text>
            </TouchableOpacity>
          </View>
          {isAdmin && alreadyScored && (
            <TouchableOpacity onPress={confirmClear} style={sc.clearBtn}>
              <Text style={sc.clearBtnText}>🗑  Apagar placar</Text>
            </TouchableOpacity>
          )}
        </View>
        </ScrollView>
      </View>
      <PointLogModal
        visible={showPointLog}
        onClose={() => setShowPointLog(false)}
        pontos={analise?.pontos ?? []}
        nameA={nameA}
        nameB={nameB}
      />
    </Modal>
  );
}

const makeSc = (Colors: ThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surf, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.md },
  title: { fontFamily: FontFamily.titleBold, fontSize: 20, color: Colors.text, textAlign: 'center' },
  sub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-around', gap: Spacing.md },
  inputBlock: { alignItems: 'center', gap: Spacing.sm, flex: 1 },
  inputLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  btn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: FontFamily.titleBold, fontSize: 22, color: Colors.gold, lineHeight: 26 },
  input: { width: 54, height: 54, borderRadius: Radius.sm, backgroundColor: Colors.surf2, borderWidth: 1.5, borderColor: Colors.gold, fontFamily: FontFamily.numberBold, fontSize: 28, color: Colors.gold, textAlign: 'center', paddingVertical: 0, paddingHorizontal: 0, textAlignVertical: 'center', includeFontPadding: false },
  warn: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.coral, textAlign: 'center' },
  btns: { flexDirection: 'row', gap: Spacing.md },
  cancel: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.line, alignItems: 'center' },
  cancelText: { fontFamily: FontFamily.body, color: Colors.muted },
  draft: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.muted + '66', alignItems: 'center' },
  draftText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  draftBadge: { backgroundColor: Colors.surf2, borderRadius: Radius.sm, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.muted + '44' },
  draftBadgeTxt: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  save: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.gold, alignItems: 'center' },
  saveOff: { opacity: 0.4 },
  saveText: { fontFamily: FontFamily.title, color: Colors.bg },
  lockedText: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, textAlign: 'center' },
  adminNote: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.gold, textAlign: 'center' },
  pointsBtn: { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  pointsBtnTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.line, marginTop: Spacing.xs },
  clearBtnText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.coral },
  btBtn: { borderWidth: 1, borderColor: Colors.gold + '55', backgroundColor: Colors.gold + '15', borderRadius: Radius.md, padding: Spacing.sm + 2, alignItems: 'center' },
  btBtnTxt: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: Colors.gold },
  btBtnContinuar: { borderColor: Colors.teal + '88', backgroundColor: Colors.teal + '22' },
  btBtnTxtContinuar: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.teal },
  btBtnSub: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.teal, opacity: 0.7, marginTop: 2 },
  btBtnSecundario: { alignItems: 'center', paddingVertical: 6 },
  btBtnSecundarioTxt: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted },
  setsRule: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, textAlign: 'center', marginTop: -4 },
  // Auto score display
  autoScore: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.md },
  autoSide: { flex: 1, alignItems: 'center', gap: 4 },
  autoName: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center' },
  autoSets: { fontFamily: FontFamily.numberBold, fontSize: 40, color: Colors.muted },
  autoCenter: { alignItems: 'center', gap: 2, paddingHorizontal: Spacing.sm },
  autoLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint },
  autoWinner: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.teal, textAlign: 'center' },
  // Sets
  setsSection: { gap: 8 },
  setsTitle: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.muted, letterSpacing: 1, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tbRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 52 },
  tbLabel: { fontFamily: FontFamily.bodyMed, fontSize: 12, color: Colors.muted, paddingLeft: 52 },
  tbInput: { width: 52, height: 36, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.bg, textAlign: 'center', fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.text, paddingVertical: 0, paddingHorizontal: 0, textAlignVertical: 'center', includeFontPadding: false },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingLeft: 52 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.line, backgroundColor: Colors.surf2 },
  chipTxt: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.teal },
  linksRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },
  linkTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted, textDecorationLine: 'underline' },
  tbErro: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.coral, paddingLeft: 52 },
  setLabel: { fontFamily: FontFamily.numberBold, fontSize: 13, color: Colors.muted, width: 44 },
  setDash: { fontFamily: FontFamily.body, fontSize: 17, color: Colors.faint },
  gameStepperWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  // 44px: é o controle mais usado do app e é usado na beira da quadra, em pé,
  // muitas vezes com a mão suada ou com areia. Era 28px e sem hitSlop.
  gameBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surf2, alignItems: 'center', justifyContent: 'center' },
  gameVal: { flex: 1, height: 44, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.line, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  gameValTxt: { fontFamily: FontFamily.numberBold, fontSize: 18, color: Colors.text },
  addSetBtn: { flex: 1, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.sm, paddingVertical: 6, alignItems: 'center' },
  addSetTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  // Legacy
  setsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  setInput: { width: 36, height: 34, borderRadius: 4, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.line, fontFamily: FontFamily.numberBold, fontSize: 17, color: Colors.gold, textAlign: 'center', paddingVertical: 0, paddingHorizontal: 0, textAlignVertical: 'center', includeFontPadding: false },
  quickRow: { gap: 6 },
  quickLabel: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.faint, textAlign: 'center' },
  quickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  quickChip: { backgroundColor: Colors.surf2, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.line },
  quickChipText: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.teal },
  stateBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  stateText: { fontFamily: FontFamily.title, fontSize: 13 },
  hint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, textAlign: 'center', marginTop: 2 },
});
