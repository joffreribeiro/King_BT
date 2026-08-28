import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useMemo, useState, useRef, useEffect } from 'react';
import { Type, Spacing, Radius, formatAccent, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useAuth } from '@/store/AuthContext';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ScorerModal } from './competition/ScorerModal';
import Avatar from './Avatar';
import type { Competition, Match } from '@/logic/types';

/**
 * Atalho para a ação mais frequente do app: marcar o placar do próximo jogo.
 * Antes eram 4 navegações (home → card → tela da competição → achar o jogo →
 * abrir o scorer); aqui o ScorerModal abre direto da home.
 *
 * Escolhe a competição ativa mais recente e, dentro dela, o primeiro jogo sem
 * placar na ordem de `matches`. Sem jogo pendente, não renderiza nada.
 */
export function NextMatchCard() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStyles(Colors), [Colors]);
  const { state, dispatch } = useCompetitions();
  const { findPlayer } = useGroupPlayers();
  const { isAdmin, isMember } = useAuth();
  const reduced = useReducedMotion();
  const [scoring, setScoring] = useState<Match | null>(null);

  const next = useMemo(() => {
    // Percorre as competições ativas da mais recente para a mais antiga e para
    // na primeira que tiver jogo pendente. Olhar só a mais recente deixaria o
    // card sumir quando ela já está completa mas outra ativa ainda tem jogos —
    // justamente o caso em que o atalho é útil.
    const active = state.competitions
      .filter(c => c.status === 'active' && !c.isFriendly)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    for (const comp of active) {
      const match = comp.matches.find(m => m.scoreA == null);
      if (match) return { comp, match };
    }
    return null;
  }, [state.competitions]);

  // Ponto pulsante — é o único loop da tela, e o elemento que deve chamar
  // atenção. Os cards da lista abaixo já não pulsam mais (ver CompCard).
  const dot = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    if (!next || reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dot, { toValue: 1,    duration: 900, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [next, reduced]);

  if (!next || !isMember) return null;
  const { comp, match } = next;

  const accent = formatAccent(Colors, comp.format);
  const done  = comp.matches.filter(m => m.scoreA != null).length;
  const total = comp.matches.length;

  return (
    <>
      <View style={[s.card, { borderColor: accent + '55' }]}>
        <View style={s.labelRow}>
          <Animated.View style={[s.dot, { backgroundColor: accent, opacity: reduced ? 1 : dot }]} />
          <Text style={[s.label, { color: accent }]}>
            PRÓXIMA PARTIDA{match.round ? ` · RODADA ${match.round}` : ''}
          </Text>
        </View>

        <Text style={s.compName} numberOfLines={1}>{comp.name}</Text>
        <Text style={s.meta}>{done} de {total} jogos</Text>

        <View style={s.matchRow}>
          <Side comp={comp} match={match} side="a" findPlayer={findPlayer} Colors={Colors} s={s} />
          <Text style={s.vs}>vs</Text>
          <Side comp={comp} match={match} side="b" findPlayer={findPlayer} Colors={Colors} s={s} />
        </View>

        <TouchableOpacity style={s.cta} onPress={() => setScoring(match)} activeOpacity={0.85}>
          <Text style={s.ctaText}>Marcar placar</Text>
        </TouchableOpacity>
      </View>

      {scoring && (
        <ScorerModal
          match={scoring}
          comp={comp}
          onClose={() => setScoring(null)}
          onSave={(matchId, a, b, sets) => {
            dispatch({ type: 'CLEAR_DRAFT', compId: comp.id, matchId });
            dispatch({ type: 'SAVE_SCORE', compId: comp.id, matchId, scoreA: a, scoreB: b, sets });
            setScoring(null);
          }}
          onSaveDraft={(matchId, draftSets) => dispatch({ type: 'SAVE_DRAFT', compId: comp.id, matchId, draftSets })}
          onClear={(matchId) => dispatch({ type: 'CLEAR_SCORE', compId: comp.id, matchId })}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}

/**
 * Um lado do confronto. Cuidado com a pegadinha do modelo: quando a
 * competição usa competidores nomeados (`comp.competitors.length > 0`), os
 * `aId`/`bId` do match apontam para o COMPETIDOR (ex.: "d0"), não para um
 * jogador — nesse caso o nome/membros vêm de `competitors`.
 */
function Side({ comp, match, side, findPlayer, Colors, s }: {
  comp: Competition; match: Match; side: 'a' | 'b';
  findPlayer: (id: string) => { name: string; color: string } | undefined;
  Colors: ThemeColors; s: any;
}) {
  const team = side === 'a' ? match.teamA : match.teamB;
  const id   = side === 'a' ? match.aId   : match.bId;

  let memberIds: string[] = [];
  let fallbackName = '?';

  if (team?.length) {
    memberIds = team;
  } else if (id) {
    const competitor = comp.competitors.find(c => c.id === id);
    if (competitor) {
      memberIds = competitor.members.length ? competitor.members : [];
      fallbackName = competitor.name;
    } else {
      memberIds = [id];
    }
  }

  const players = memberIds.map(pid => findPlayer(pid)).filter(Boolean) as { name: string; color: string }[];
  const name = players.length
    ? players.map(p => p.name.split(' ')[0]).join(' / ')
    : fallbackName;

  return (
    <View style={s.side}>
      <View style={s.avatars}>
        {players.slice(0, 2).map((p, i) => (
          <Avatar key={i} name={p.name} color={p.color} size={22} />
        ))}
      </View>
      <Text style={s.sideName} numberOfLines={1}>{name}</Text>
    </View>
  );
}

const makeStyles = (Colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: Colors.surf, borderRadius: Radius.lg,
    borderWidth: 1.5, padding: Spacing.md,
    marginBottom: Spacing.md, gap: 4,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { ...Type.label },
  compName: { ...Type.h2, color: Colors.text, marginTop: 2 },
  meta: { ...Type.caption, color: Colors.muted },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: Spacing.sm, marginBottom: Spacing.sm,
  },
  side: { flex: 1, gap: 4 },
  avatars: { flexDirection: 'row', gap: 3 },
  sideName: { ...Type.bodyMed, color: Colors.text },
  vs: { ...Type.caption, color: Colors.faint },
  cta: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 4, alignItems: 'center',
  },
  ctaText: { ...Type.h2, color: Colors.bg },
});
