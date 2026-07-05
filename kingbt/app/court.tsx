import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Modal, Animated, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, FontFamily, Spacing, Radius } from '@/theme';
import { Avatar } from '@/components';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import { updateLiveScore } from '@/firebase/competitions';
import {
  carregarAnalise, placardInicial, avancaPonto, formatGameScore,
  winRuleFromComp, type BtAnalise, type BtPlacardState,
} from '@/logic/btTracker';
import type { Match, Competition } from '@/logic/types';

function firstUnscored(matches: Match[]): Match | undefined {
  return matches.find(m => m.scoreA == null && ((m.aId && m.bId) || (m.teamA && m.teamB)));
}

function btHint(a: number, b: number, G: number = 6): string | null {
  if (a === G - 1 && b === G - 1) return `Empate em ${G - 1}-${G - 1} — jogue até ${G + 1}!`;
  if (a === G && b === G) return `${G}-${G} — próximo ponto vence!`;
  return null;
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

function LiveBadge() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={live.liveBadge}>
      <Animated.View style={[live.liveDot, { opacity: pulseAnim }]} />
      <Text style={live.liveText}>AO VIVO</Text>
    </View>
  );
}

function CourtLive({ comp, match, onSave, onBack, onLiveScore }: {
  comp: Competition;
  match: Match;
  onSave: (a: number, b: number, sets?: { a: number; b: number }[]) => void;
  onBack: () => void;
  onLiveScore?: (gamesA: number, gamesB: number, setsA: number, setsB: number) => void;
}) {
  const { findPlayer } = useGroupPlayers();

  // Usa o BtPlacardState para seguir as regras da competição
  const rule = winRuleFromComp(comp.config.winRule);
  const [placard, setPlacard] = useState<BtPlacardState>(() => placardInicial(rule));
  const historyRef = useRef<BtPlacardState[]>([]);

  // Pontos do game atual (0-3 internamente, exibidos como 0/15/30/40)
  const GAME_LABELS = ['0', '15', '30', '40'];
  const pontosALabel = (p: number) => p >= 4 ? 'AD' : (GAME_LABELS[p] ?? '40');

  const teamA = match.teamA ?? (match.aId ? [match.aId] : []);
  const teamB = match.teamB ?? (match.bId ? [match.bId] : []);

  const playersA = teamA.map(id => {
    if (match.aId && !match.teamA) {
      const c = comp.competitors.find(x => x.id === match.aId);
      return { name: c?.name ?? id, color: Colors.gold };
    }
    const p = findPlayer(id);
    return { name: p?.name ?? id, color: p?.color ?? Colors.gold };
  });
  const playersB = teamB.map(id => {
    if (match.bId && !match.teamA) {
      const c = comp.competitors.find(x => x.id === match.bId);
      return { name: c?.name ?? id, color: Colors.teal };
    }
    const p = findPlayer(id);
    return { name: p?.name ?? id, color: p?.color ?? Colors.teal };
  });

  const nameA = playersA.map(p => p.name.split(' ')[0]).join(' / ');
  const nameB = playersB.map(p => p.name.split(' ')[0]).join(' / ');

  function addPoint(dupla: 'A' | 'B') {
    // Salva estado anterior para desfazer
    historyRef.current = [...historyRef.current, placard];
    const next = avancaPonto(placard, dupla);
    setPlacard(next);
    // Publica placar ao vivo
    onLiveScore?.(next.gamesA, next.gamesB, next.setsA, next.setsB);
    if (next.encerrada) {
      const sets = next.historicGamesA.map((gA, i) => ({ a: gA, b: next.historicGamesB[i] ?? 0 }));
      onSave(next.setsA, next.setsB, sets);
    }
  }

  function removePoint() {
    // Desfaz: volta ao estado anterior
    const prev = historyRef.current.pop();
    if (prev) setPlacard(prev);
  }

  const isTiebreak = placard.tiebreak;
  const scoreLabel = placard.superTiebreakAtivo
    ? `SUPER TIE · primeiro a ${rule.superTiebreakPts ?? 10}`
    : isTiebreak ? 'TIEBREAK' : null;

  // Histórico de sets encerrados (sets anteriores)
  const setsEncerrados = placard.historicGamesA.length;

  return (
    <View style={live.container}>
      <StatusBar hidden />

      <TouchableOpacity style={live.backBtn} onPress={onBack}>
        <Text style={live.backTxt}>← Sair</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={live.headerRow}>
        <LiveBadge />
        <Text style={live.compName} numberOfLines={1}>{comp.name}</Text>
      </View>

      {/* Tiebreak label */}
      {scoreLabel && (
        <View style={live.tiebreakBanner}>
          <Text style={live.tiebreakBannerTxt}>{scoreLabel}</Text>
        </View>
      )}

      {/* Placar estilo scoreboard — 2 linhas */}
      <View style={live.board}>

        {/* Cabeçalho de colunas */}
        <View style={live.boardHeader}>
          <View style={{ flex: 1 }} />
          {/* Colunas de sets anteriores */}
          {placard.historicGamesA.map((_, i) => (
            <Text key={i} style={live.boardColHdr}>{i + 1}º S</Text>
          ))}
          <Text style={live.boardColHdr}>G</Text>
          <Text style={[live.boardColHdr, { width: 56 }]}>PTS</Text>
        </View>

        {/* Linha A */}
        <View style={[live.boardRow, { backgroundColor: 'rgba(243,197,68,0.06)' }]}>
          {/* Indicador de serviço (futuro) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
            {playersA.map((p, i) => (
              <Avatar key={i} name={p.name} color={p.color} size={28} />
            ))}
            <Text style={live.boardName} numberOfLines={1}>{nameA}</Text>
          </View>
          {/* Sets anteriores */}
          {placard.historicGamesA.map((gA, i) => (
            <Text key={i} style={[live.boardCell, { color: gA > (placard.historicGamesB[i] ?? 0) ? Colors.gold : Colors.faint }]}>
              {gA}
            </Text>
          ))}
          {/* Games atual */}
          <Text style={[live.boardCell, { color: placard.gamesA >= placard.gamesB ? Colors.gold : Colors.text }]}>
            {placard.gamesA}
          </Text>
          {/* Pontos */}
          <Text style={[live.boardPts, { color: placard.pontosA > placard.pontosB ? Colors.gold : Colors.text, width: 56 }]}>
            {isTiebreak ? placard.pontosA : pontosALabel(placard.pontosA)}
          </Text>
        </View>

        {/* Divisor */}
        <View style={live.boardDiv} />

        {/* Linha B */}
        <View style={[live.boardRow, { backgroundColor: 'rgba(84,185,129,0.06)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
            {playersB.map((p, i) => (
              <Avatar key={i} name={p.name} color={p.color} size={28} />
            ))}
            <Text style={live.boardName} numberOfLines={1}>{nameB}</Text>
          </View>
          {placard.historicGamesA.map((_, i) => (
            <Text key={i} style={[live.boardCell, { color: (placard.historicGamesB[i] ?? 0) > placard.historicGamesA[i] ? Colors.teal : Colors.faint }]}>
              {placard.historicGamesB[i] ?? 0}
            </Text>
          ))}
          <Text style={[live.boardCell, { color: placard.gamesB >= placard.gamesA ? Colors.teal : Colors.text }]}>
            {placard.gamesB}
          </Text>
          <Text style={[live.boardPts, { color: placard.pontosB > placard.pontosA ? Colors.teal : Colors.text, width: 56 }]}>
            {isTiebreak ? placard.pontosB : pontosALabel(placard.pontosB)}
          </Text>
        </View>

        {/* Rodapé: regra */}
        <Text style={live.ruleHint}>
          MD{rule.sets} · {rule.games} games · TB {rule.tiebreak}
          {rule.superTiebreak ? ` · STB ${rule.superTiebreakPts}` : ''}
        </Text>
      </View>

      {/* Botões +/− */}
      <View style={live.btnsArea}>
        <View style={live.playerBtns}>
          <TouchableOpacity style={live.minusBtnA} onPress={() => removePoint()}>
            <Text style={live.minusTxtA}>−</Text>
          </TouchableOpacity>
          <Text style={live.playerBtnLabel} numberOfLines={1}>{nameA}</Text>
          <TouchableOpacity style={live.plusBtnA} onPress={() => addPoint('A')}>
            <Text style={live.plusTxtA}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={live.playerBtns}>
          <TouchableOpacity style={live.minusBtnB} onPress={() => removePoint()}>
            <Text style={live.minusTxtB}>−</Text>
          </TouchableOpacity>
          <Text style={live.playerBtnLabel} numberOfLines={1}>{nameB}</Text>
          <TouchableOpacity style={live.plusBtnB} onPress={() => addPoint('B')}>
            <Text style={live.plusTxtB}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function MatchMiniCard({
  comp, match, findPlayer,
}: {
  comp: Competition;
  match: Match;
  findPlayer: (id: string) => { name: string; color: string } | undefined;
}) {
  const teamA = match.teamA ?? (match.aId ? [match.aId] : []);
  const teamB = match.teamB ?? (match.bId ? [match.bId] : []);
  const useComp = !!(match.aId && match.bId && !match.teamA);
  function n(id: string) {
    if (useComp) {
      const c = comp.competitors.find(x => x.id === id);
      if (c) return c.name;
    }
    return findPlayer(id)?.name.split(' ')[0] ?? id;
  }
  return (
    <View style={md.miniCard}>
      <Text style={md.miniTeam} numberOfLines={1}>{teamA.map(n).join(' / ')}</Text>
      <Text style={md.miniVs}>×</Text>
      <Text style={md.miniTeam} numberOfLines={1}>{teamB.map(n).join(' / ')}</Text>
    </View>
  );
}

// Trava do marcador: considera abandonada após 3 min sem atualização
const SCORER_LOCK_MS = 3 * 60 * 1000;

export default function CourtScreen() {
  const { state, dispatch } = useCompetitions();
  const { findPlayer } = useGroupPlayers();
  const { group, user, isAdmin, isSuperAdmin, myPlayerId } = useAuth();
  const params = useLocalSearchParams<{ compId?: string }>();
  const [selectedCompId, setSelectedCompId] = useState<string | null>(params.compId ?? null);
  const [liveMatch, setLiveMatch] = useState<Match | null>(null);
  const [spectMatchId, setSpectMatchId] = useState<string | null>(null);
  const [modoModal, setModoModal] = useState(false);
  const [pendingMatch, setPendingMatch] = useState<Match | null>(null);
  const [analisePendente, setAnalisePendente] = useState<BtAnalise | null>(null);
  // matchId → true para partidas com análise BT salva
  const [analiseIds, setAnaliseIds] = useState<Set<string>>(new Set());

  const activeComps = state.competitions.filter(c => c.status === 'active');
  const selectedComp = state.competitions.find(c => c.id === selectedCompId);

  const myName = (myPlayerId ? findPlayer(myPlayerId)?.name : null) ?? user?.displayName ?? 'Alguém';

  // Retorna o liveScore se OUTRA pessoa está marcando este jogo agora (trava ativa)
  function lockedByOther(match: Match) {
    const ls = match.liveScore;
    if (!ls?.scorerUid || ls.scorerUid === user?.uid) return null;
    const age = Date.now() - new Date(ls.updatedAt).getTime();
    return age < SCORER_LOCK_MS ? ls : null;
  }

  // Assume a marcação: grava a trava com meu uid no Firestore
  function claimMatch(match: Match, gamesA = 0, gamesB = 0, setsA = 0, setsB = 0) {
    if (!selectedCompId && !params.compId) return;
    dispatch({
      type: 'UPDATE_LIVE_SCORE', compId: (selectedCompId ?? params.compId)!, matchId: match.id,
      gamesA, gamesB, setsA, setsB,
      scorerUid: user?.uid, scorerName: myName,
    });
  }

  // Auto-abrir próximo jogo quando compId é passado por param
  useEffect(() => {
    if (params.compId && !liveMatch && !spectMatchId) {
      const comp = state.competitions.find(c => c.id === params.compId);
      if (comp) {
        const next = firstUnscored(comp.matches);
        if (next) abrirMatch(next);
      }
    }
  }, [params.compId, state.competitions]);

  // Verifica quais partidas da comp selecionada têm análise BT salva
  useEffect(() => {
    if (!selectedComp) return;
    const scoredIds = selectedComp.matches
      .filter(m => m.scoreA != null)
      .map(m => m.id);
    if (scoredIds.length === 0) return;
    const cid = selectedComp.id;
    Promise.all(scoredIds.map(id => carregarAnalise(id, cid).then(a => ({ id, has: !!a }))))
      .then(results => {
        const s = new Set(results.filter(r => r.has).map(r => r.id));
        setAnaliseIds(s);
      })
      .catch(() => {});
  }, [selectedComp?.id]);

  async function abrirMatch(match: Match) {
    // Outra pessoa já está marcando este jogo → entra como espectador
    if (lockedByOther(match)) {
      setSpectMatchId(match.id);
      return;
    }
    setPendingMatch(match);
    const analise = selectedCompId ? await carregarAnalise(match.id, selectedCompId) : null;
    setAnalisePendente(analise);
    // Assume a trava de marcador e vai direto para o placar
    claimMatch(match);
    setLiveMatch(match);
  }

  function escolherPlacarSimples() {
    setModoModal(false);
    setLiveMatch(pendingMatch);
  }

  function escolherBtTracker() {
    setModoModal(false);
    if (!pendingMatch || !selectedCompId) return;
    const teamA = pendingMatch.teamA ?? (pendingMatch.aId ? [pendingMatch.aId] : []);
    const teamB = pendingMatch.teamB ?? (pendingMatch.bId ? [pendingMatch.bId] : []);

    const wr = selectedComp?.config?.winRule;
    router.push({
      pathname: '/analise/[matchId]/ponto',
      params: {
        matchId: pendingMatch.id,
        compId: selectedCompId,
        a1: teamA[0] ?? '',
        a2: teamA[1] ?? '',
        b1: teamB[0] ?? '',
        b2: teamB[1] ?? '',
        sets: String(wr?.sets ?? 3),
        games: String(wr?.games ?? 6),
        tiebreak: String(wr?.tiebreak ?? 7),
        scoutMode: wr?.scoutMode ?? 'avancado',
      },
    });
  }

  function verRelatorio() {
    setModoModal(false);
    if (!pendingMatch || !selectedCompId) return;
    router.push({
      pathname: '/analise/[matchId]/relatorio',
      params: { matchId: pendingMatch.id, compId: selectedCompId },
    });
  }

  function handleSave(a: number, b: number, sets?: { a: number; b: number }[]) {
    if (!liveMatch || !selectedCompId) return;
    const comp = state.competitions.find(c => c.id === selectedCompId);
    // Limpa liveScore ao finalizar
    dispatch({ type: 'CLEAR_LIVE_SCORE', compId: selectedCompId, matchId: liveMatch.id });
    dispatch({ type: 'SAVE_SCORE', compId: selectedCompId, matchId: liveMatch.id, scoreA: a, scoreB: b, sets });

    // Navegar para tela de vitória
    const winner = a > b ? 'A' : 'B';
    const teamA = liveMatch.teamA ?? (liveMatch.aId ? [liveMatch.aId] : []);
    const teamB = liveMatch.teamB ?? (liveMatch.bId ? [liveMatch.bId] : []);
    const getNome = (ids: string[]) => ids.map(id => {
      if (liveMatch.aId && !liveMatch.teamA) {
        const c = comp?.competitors.find(x => x.id === id);
        if (c) return c.name;
      }
      return findPlayer(id)?.name.split(' ')[0] ?? id;
    }).join(' / ');
    const winnerName  = winner === 'A' ? getNome(teamA) : getNome(teamB);
    const loserName   = winner === 'A' ? getNome(teamB) : getNome(teamA);
    const winnerScore = winner === 'A' ? String(a) : String(b);
    const loserScore  = winner === 'A' ? String(b) : String(a);

    router.push({
      pathname: '/victory',
      params: {
        winnerName,
        loserName,
        winnerScore,
        loserScore,
        competitionName: comp?.name ?? '',
      },
    });

    if (!comp) { setLiveMatch(null); return; }
    const remaining = comp.matches.filter(m => m.id !== liveMatch.id);
    const next = firstUnscored(remaining);
    setLiveMatch(next ?? null);
  }

  // Modal de escolha de modo
  const modoModalEl = pendingMatch && selectedComp ? (
    <Modal visible={modoModal} transparent animationType="fade">
      <View style={md.overlay}>
        <View style={md.card}>
          <Text style={md.title}>Como registrar esta partida?</Text>
          <MatchMiniCard comp={selectedComp} match={pendingMatch} findPlayer={findPlayer} />

          {/* King Scout — exclusivo do Super Admin */}
          {!isSuperAdmin ? null : analisePendente && !analisePendente.placarFinal ? (
            // Análise em andamento: botão principal é Continuar
            <>
              <TouchableOpacity style={[md.btnBt, md.btnBtContinuar]} onPress={escolherBtTracker}>
                <Text style={md.btnBtTxtContinuar}>▶ Continuar King Scout</Text>
                <Text style={md.btnBtSub}>{analisePendente.pontos.length} pontos registrados</Text>
              </TouchableOpacity>
              <TouchableOpacity style={md.btnRelatorio} onPress={verRelatorio}>
                <Text style={md.btnRelatorioTxt}>📊 Ver análise parcial</Text>
              </TouchableOpacity>
            </>
          ) : analisePendente?.placarFinal ? (
            // Análise encerrada
            <>
              <TouchableOpacity style={md.btnRelatorio} onPress={verRelatorio}>
                <Text style={md.btnRelatorioTxt}>📊 Ver Análise BT Salva</Text>
              </TouchableOpacity>
              <TouchableOpacity style={md.btnBt} onPress={escolherBtTracker}>
                <Text style={md.btnBtTxt}>🎾 Nova análise BT</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Sem análise
            <TouchableOpacity style={md.btnBt} onPress={escolherBtTracker}>
              <Text style={md.btnBtTxt}>🎾 Analisar ponto a ponto</Text>
              <Text style={md.btnBtSub}>Placar calculado automaticamente</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={md.btnSimples} onPress={escolherPlacarSimples}>
            <Text style={md.btnSimplesTxt}>Registrar placar simples</Text>
          </TouchableOpacity>

          <TouchableOpacity style={md.btnCancelar} onPress={() => setModoModal(false)}>
            <Text style={md.btnCancelarTxt}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  ) : null;

  // ── Modo espectador: outra pessoa está marcando este jogo ──
  const spectMatch = spectMatchId && selectedComp ? selectedComp.matches.find(m => m.id === spectMatchId) : null;
  if (spectMatch && selectedComp) {
    const ls = spectMatch.liveScore;
    const finished = spectMatch.scoreA != null;
    const stillLocked = !!lockedByOther(spectMatch);
    const teamA = spectMatch.teamA ?? (spectMatch.aId ? [spectMatch.aId] : []);
    const teamB = spectMatch.teamB ?? (spectMatch.bId ? [spectMatch.bId] : []);
    const nome = (ids: string[], compId?: string | null) => ids.map(id => {
      if (compId && !spectMatch.teamA) {
        const c = selectedComp.competitors.find(x => x.id === id);
        if (c) return c.name;
      }
      return findPlayer(id)?.name.split(' ')[0] ?? id;
    }).join(' / ');
    const nameA = nome(teamA, spectMatch.aId);
    const nameB = nome(teamB, spectMatch.bId);

    function assumirMarcacao() {
      const msg = `Assumir a marcação deste jogo? O placar ao vivo recomeça do 0-0 nesta tela (o placar atual de ${ls?.scorerName ?? 'quem marca'} será substituído).`;
      const doIt = () => {
        setSpectMatchId(null);
        setPendingMatch(spectMatch!);
        claimMatch(spectMatch!);
        setLiveMatch(spectMatch!);
      };
      if (Platform.OS === 'web') { if (window.confirm(msg)) doIt(); }
      else Alert.alert('Assumir marcação', msg, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Assumir', style: 'destructive', onPress: doIt },
      ]);
    }

    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => { setSpectMatchId(null); if (params.compId) router.replace('/(app)'); }}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{selectedComp.name}</Text>
            <Text style={s.meta}>Modo espectador</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Aviso de trava */}
          <View style={{ backgroundColor: Colors.gold + '15', borderWidth: 1, borderColor: Colors.gold + '44', borderRadius: Radius.md, padding: Spacing.md, gap: 4 }}>
            <Text style={{ fontFamily: FontFamily.title, fontSize: 14, color: Colors.gold }}>
              ⚠️ {ls?.scorerName ?? 'Outra pessoa'} está marcando este jogo
            </Text>
            <Text style={{ fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted }}>
              Você está acompanhando ao vivo. O placar atualiza automaticamente.
            </Text>
          </View>

          {/* Placar ao vivo */}
          <View style={{ backgroundColor: Colors.surf, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md, marginTop: Spacing.md }}>
            {finished ? (
              <Text style={{ fontFamily: FontFamily.title, fontSize: 13, color: Colors.teal, textAlign: 'center' }}>✅ Jogo encerrado</Text>
            ) : (
              <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 11, color: Colors.coral, textAlign: 'center', letterSpacing: 1 }}>● AO VIVO</Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: FontFamily.title, fontSize: 16, color: Colors.text }} numberOfLines={2}>{nameA}</Text>
              <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 34, color: Colors.gold }}>
                {finished ? spectMatch.scoreA : ls?.gamesA ?? 0}
              </Text>
              <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 20, color: Colors.faint }}>×</Text>
              <Text style={{ fontFamily: FontFamily.numberBold, fontSize: 34, color: Colors.gold }}>
                {finished ? spectMatch.scoreB : ls?.gamesB ?? 0}
              </Text>
              <Text style={{ flex: 1, fontFamily: FontFamily.title, fontSize: 16, color: Colors.text, textAlign: 'right' }} numberOfLines={2}>{nameB}</Text>
            </View>
            {!finished && (ls?.setsA ?? 0) + (ls?.setsB ?? 0) > 0 && (
              <Text style={{ fontFamily: FontFamily.body, fontSize: 12, color: Colors.muted, textAlign: 'center' }}>
                Sets: {ls?.setsA ?? 0} × {ls?.setsB ?? 0}
              </Text>
            )}
          </View>

          {/* Trava expirou ou jogo terminou → pode marcar; admin pode assumir a qualquer momento */}
          {!finished && (!stillLocked || isAdmin) && (
            <TouchableOpacity
              style={{ marginTop: Spacing.md, borderWidth: 1.5, borderColor: Colors.coral + '66', borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' }}
              onPress={assumirMarcacao}
              activeOpacity={0.8}
            >
              <Text style={{ fontFamily: FontFamily.title, fontSize: 14, color: Colors.coral }}>
                🔓 Assumir marcação{!stillLocked ? ' (marcador inativo)' : ''}
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (liveMatch && selectedComp) {
    return (
      <>
        <CourtLive
          comp={selectedComp}
          match={liveMatch}
          onSave={(a, b, sets) => handleSave(a, b, sets)}
          onBack={() => {
            dispatch({ type: 'CLEAR_LIVE_SCORE', compId: selectedCompId!, matchId: liveMatch.id });
            if (params.compId) {
              router.replace('/(app)');
            } else {
              setLiveMatch(null);
            }
          }}
          onLiveScore={(gA, gB, sA, sB) => {
            dispatch({ type: 'UPDATE_LIVE_SCORE', compId: selectedCompId!, matchId: liveMatch.id, gamesA: gA, gamesB: gB, setsA: sA, setsB: sB, scorerUid: user?.uid, scorerName: myName });
          }}
        />
        {modoModalEl}
      </>
    );
  }

  // Se tem comp selecionada mas nenhum jogo ao vivo, mostra tela de seleção de partida
  const compViewDone = selectedComp ? selectedComp.matches.filter(m => m.scoreA != null).length : 0;
  const compViewTotal = selectedComp ? selectedComp.matches.length : 0;
  const compViewNext = selectedComp ? firstUnscored(selectedComp.matches) : undefined;

  if (selectedComp) {
    return (
      <>
        <SafeAreaView style={s.container} edges={['top']}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => { if (params.compId) { router.replace('/(app)'); } else { setSelectedCompId(null); setLiveMatch(null); } }}>
              <Text style={s.back}>←</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{selectedComp.name}</Text>
              <Text style={s.meta}>{compViewDone}/{compViewTotal} jogos registrados</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {compViewNext ? (
              <TouchableOpacity activeOpacity={0.85} onPress={() => abrirMatch(compViewNext)}>
                <NextMatchPreview comp={selectedComp} match={compViewNext} />
              </TouchableOpacity>
            ) : (
              <View style={s.empty}>
                <Text style={{ fontSize: 40 }}>✅</Text>
                <Text style={s.emptyTitle}>Todos os jogos registrados!</Text>
                <Text style={s.emptySub}>Nenhuma partida pendente nesta competição.</Text>
              </View>
            )}

            {/* Partidas com análise BT salva — exclusivo do Super Admin */}
            {isSuperAdmin && analiseIds.size > 0 && (
              <View style={{ gap: Spacing.xs }}>
                <Text style={s.sectionLabel}>Análises BT salvas</Text>
                {selectedComp.matches
                  .filter(m => analiseIds.has(m.id))
                  .map(m => (
                    <TouchableOpacity
                      key={m.id}
                      style={s.analiseRow}
                      activeOpacity={0.8}
                      onPress={() => router.push({
                        pathname: '/analise/[matchId]/relatorio',
                        params: { matchId: m.id, compId: selectedComp.id },
                      })}
                    >
                      <MatchMiniCard comp={selectedComp} match={m} findPlayer={findPlayer} />
                      <Text style={s.analiseIcon}>📊</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}

            <View style={{ height: Spacing.xl }} />
          </ScrollView>
        </SafeAreaView>
        {modoModalEl}
      </>
    );
  }

  return (
    <>
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
                  if (next) abrirMatch(next);
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

          {isSuperAdmin && (
            <TouchableOpacity style={s.historico} onPress={() => router.push('/analise')} activeOpacity={0.8}>
              <Text style={s.historicoTxt}>📊 Histórico de análises BT</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
      {modoModalEl}
    </>
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
  analiseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  analiseIcon: { fontSize: 18 },
  historico: { borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
  historicoTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
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
    flex: 1, backgroundColor: '#0a0a0c',
    justifyContent: 'center', alignItems: 'stretch',
    paddingHorizontal: Spacing.md,
  },
  backBtn: { position: 'absolute', top: 20, left: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.surf2, borderRadius: Radius.full, zIndex: 10 },
  backTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.muted },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.md, marginTop: 64, justifyContent: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(229,72,61,0.12)', borderWidth: 1, borderColor: 'rgba(229,72,61,0.3)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E5483D' },
  liveText: { fontSize: 9, fontWeight: '700', color: '#E5483D', letterSpacing: 1, fontFamily: FontFamily.numberBold },
  compName: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.muted, flexShrink: 1 },
  tiebreakBanner: { backgroundColor: 'rgba(243,197,68,0.15)', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 3, alignSelf: 'center', marginBottom: Spacing.sm },
  tiebreakBannerTxt: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold, letterSpacing: 1 },

  // Board estilo TV
  board: {
    backgroundColor: 'rgba(22,20,15,0.95)',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(214,175,70,0.18)',
    overflow: 'hidden', marginBottom: Spacing.lg,
  },
  boardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(214,175,70,0.1)',
  },
  boardColHdr: { fontFamily: FontFamily.numberBold, fontSize: 9, color: Colors.faint, letterSpacing: 1, width: 36, textAlign: 'center' },
  boardRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  boardDiv: { height: 1, backgroundColor: 'rgba(214,175,70,0.1)' },
  boardName: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text, flex: 1 },
  boardCell: { fontFamily: FontFamily.numberBold, fontSize: 22, width: 36, textAlign: 'center' },
  boardPts: { fontFamily: FontFamily.titleBold, fontSize: 28, textAlign: 'center', letterSpacing: -1 },
  ruleHint: { fontFamily: FontFamily.number, fontSize: 9, color: Colors.faint, textAlign: 'center', paddingVertical: 5 },

  // Botões
  btnsArea: { gap: Spacing.sm },
  playerBtns: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  playerBtnLabel: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text, textAlign: 'center' },
  minusBtnA: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(214,175,70,0.15)', alignItems: 'center', justifyContent: 'center' },
  minusTxtA: { fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.muted, lineHeight: 30 },
  plusBtnA: { width: 56, height: 56, borderRadius: 12, backgroundColor: 'rgba(243,197,68,0.18)', borderWidth: 1.5, borderColor: 'rgba(243,197,68,0.5)', alignItems: 'center', justifyContent: 'center' },
  plusTxtA: { fontFamily: FontFamily.titleBold, fontSize: 32, color: '#F3C544', lineHeight: 38 },
  minusBtnB: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(84,185,129,0.15)', alignItems: 'center', justifyContent: 'center' },
  minusTxtB: { fontFamily: FontFamily.titleBold, fontSize: 24, color: Colors.muted, lineHeight: 30 },
  plusBtnB: { width: 56, height: 56, borderRadius: 12, backgroundColor: 'rgba(84,185,129,0.15)', borderWidth: 1.5, borderColor: 'rgba(84,185,129,0.4)', alignItems: 'center', justifyContent: 'center' },
  plusTxtB: { fontFamily: FontFamily.titleBold, fontSize: 32, color: '#54B981', lineHeight: 38 },

  // legado (não usados mas mantidos para não quebrar referências)
  scoreArea: { flexDirection: 'row' },
  side: { flex: 1 },
  avatarRow: { flexDirection: 'row' },
  teamName: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  score: { fontFamily: FontFamily.titleBold, fontSize: 72 },
  btnRow: { flexDirection: 'row', gap: Spacing.sm },
  vs: { alignItems: 'center' },
  vsTxt: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.faint },
  hintBox: { backgroundColor: Colors.gold + '22', borderRadius: Radius.md, padding: 8 },
  hintText: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.gold },
  saveBtn: { backgroundColor: Colors.teal, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center' },
  saveBtnOff: { opacity: 0.4 },
  saveBtnTxt: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.bg },
});

const md = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  card: {
    backgroundColor: Colors.surf, borderRadius: Radius.lg,
    padding: Spacing.lg, width: '100%', gap: Spacing.md,
    borderWidth: 1, borderColor: Colors.line,
  },
  title: { fontFamily: FontFamily.title, fontSize: 16, color: Colors.text, textAlign: 'center' },
  miniCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surf2, borderRadius: Radius.md, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.line,
  },
  miniTeam: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.text, textAlign: 'center' },
  miniVs: { fontFamily: FontFamily.number, fontSize: 13, color: Colors.faint },
  btnBt: {
    backgroundColor: Colors.gold + '22', borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.gold + '66',
  },
  btnBtTxt: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.gold },
  btnBtSub: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.muted },
  btnBtContinuar: { backgroundColor: Colors.teal + '22', borderColor: Colors.teal + '88' },
  btnBtTxtContinuar: { fontFamily: FontFamily.title, fontSize: 15, color: Colors.teal },
  btnSimples: {
    borderRadius: Radius.md, padding: Spacing.sm + 2, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.line,
  },
  btnSimplesTxt: { fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  btnRelatorio: {
    borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center',
    backgroundColor: Colors.teal + '22', borderWidth: 1, borderColor: Colors.teal + '55',
  },
  btnRelatorioTxt: { fontFamily: FontFamily.bodyMed, fontSize: 13, color: Colors.teal },
  btnCancelar: { alignItems: 'center', padding: 6 },
  btnCancelarTxt: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.faint },
});
