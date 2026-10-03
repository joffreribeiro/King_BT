import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { HexBackground } from '@/components/HexBackground';
import { Avatar, ScreenHeader } from '@/components';
import { FontFamily, Spacing, Radius, centeredContent, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { useAuth } from '@/store/AuthContext';
import { useCompetitions } from '@/store/CompetitionsContext';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useChallenges } from '@/hooks/useChallenges';
import { cancelChallenge, linkChallengeGame, respondChallenge } from '@/firebase/challenges';
import {
  STATUS_LABEL, awaitingGame, challengeSides, effectiveStatus, incomingChallenges, involves, isDoubles, sentChallenges, type Challenge,
} from '@/logic/challenges';
import { quickGameCompetition } from '@/logic/quickGame';

const brDate = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

/** Desafios: responder aos que chegaram, marcar o jogo dos aceitos e acompanhar os enviados. */
export default function DesafiosScreen() {
  useRequireAuth();
  const { colors: C } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  const { group, myPlayerId } = useAuth();
  const { state, addCompetition } = useCompetitions();
  const { findPlayer } = useGroupPlayers();
  const { challenges, loaded, denied } = useChallenges();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const incoming = incomingChallenges(challenges, myPlayerId, now);
  const toSchedule = awaitingGame(challenges, myPlayerId);
  const sent = sentChallenges(challenges, myPlayerId, now);
  const mine = challenges.filter(c => involves(c, myPlayerId));
  const played = mine.filter(c => c.status === 'accepted' && !!c.compId);
  const closed = mine.filter(c => ['declined', 'cancelled'].includes(c.status) || effectiveStatus(c, now) === 'expired').slice(0, 10);

  const nameOf = (id: string) => findPlayer(id)?.name ?? 'Jogador';
  const other = (c: Challenge) => (c.fromId === myPlayerId ? c.toId : c.fromId);

  async function run(id: string, task: () => Promise<void>) {
    setBusyId(id); setError(null);
    try { await task(); }
    catch { setError('Não foi possível concluir. Verifique a conexão e tente de novo.'); }
    finally { setBusyId(null); }
  }

  function markGame(c: Challenge) {
    if (!group) return;
    return run(c.id, async () => {
      const [sideA, sideB] = challengeSides(c);
      const label = (ids: string[]) => ids.map(i => nameOf(i).split(' ')[0]).join('/');
      const comp = quickGameCompetition({
        name: `Desafio · ${label(sideA)} x ${label(sideB)}`,
        teamA: sideA, teamB: sideB, unit: isDoubles(c) ? 'duplas' : 'individual', creatorId: myPlayerId,
      });
      const id = await addCompetition(comp);
      try { await linkChallengeGame(group.id, c.id, id); } catch { /* o jogo existe; o vínculo pode ser refeito */ }
      router.push({ pathname: '/competitions/[id]', params: { id } });
    });
  }

  /** "Joffre 2 × 1 Marcelão" quando o jogo já tem placar; senão, "jogo marcado". */
  function resultOf(c: Challenge): string {
    const comp = state.competitions.find(x => x.id === c.compId);
    const m = comp?.matches[0];
    if (!m || m.scoreA == null || m.scoreB == null) return 'Jogo marcado, sem placar ainda';
    const [sa, sb] = challengeSides(c);
    const lab = (ids: string[]) => ids.map(i => nameOf(i).split(' ')[0]).join('/');
    return `${lab(m.teamA?.length ? m.teamA : sa)} ${m.scoreA} × ${m.scoreB} ${lab(m.teamB?.length ? m.teamB : sb)}`;
  }

  const first = (id: string) => nameOf(id).split(' ')[0];
  /** Frase do desafio, de 1x1 ou de duplas, do ponto de vista de quem está olhando. */
  function headline(c: Challenge): string {
    if (!isDoubles(c)) return c.fromId === myPlayerId ? `Você desafiou ${first(c.toId)}` : `${first(c.fromId)} desafiou você`;
    const [a, b] = challengeSides(c);
    const names = (ids: string[]) => ids.map(i => (i === myPlayerId ? 'você' : first(i))).join(' e ');
    const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
    return `${cap(names(a))} × ${names(b)} · duplas`;
  }

  const Row = ({ c, children, sub }: { c: Challenge; children?: React.ReactNode; sub?: string }) => {
    const o = findPlayer(c.fromId !== myPlayerId && c.toId !== myPlayerId ? c.fromId : other(c));
    return (
      <View style={s.row}>
        <View style={s.rowTop}>
          {o && <Avatar name={o.name} color={o.color} size={44} />}
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>
              {headline(c)}
            </Text>
            <Text style={s.sub} numberOfLines={2}>{sub ?? [c.message, c.when].filter(Boolean).join(' · ') ?? ''}</Text>
            <Text style={s.date}>{brDate(c.createdAt)} · {STATUS_LABEL[effectiveStatus(c, now)]}</Text>
          </View>
        </View>
        {children ? <View style={s.actions}>{children}</View> : null}
      </View>
    );
  };

  const btn = (label: string, onPress: () => void, kind: 'primary' | 'ghost', id: string) => (
    <TouchableOpacity
      key={label} style={[kind === 'primary' ? s.primary : s.ghost, busyId === id && { opacity: 0.5 }]} disabled={busyId === id}
      onPress={onPress} activeOpacity={0.85} accessibilityRole="button"
    >
      <Text style={kind === 'primary' ? s.primaryText : s.ghostText}>{label}</Text>
    </TouchableOpacity>
  );

  const nothing = loaded && !denied && incoming.length + toSchedule.length + sent.length + played.length + closed.length === 0;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <HexBackground />
      <ScreenHeader title="Desafios" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(app)/home'))} />
      <ScrollView contentContainerStyle={[s.scroll, centeredContent]} showsVerticalScrollIndicator={false}>
        <Text style={s.lead}>Convide alguém do grupo para um jogo 1 contra 1. Para desafiar, abra o perfil da pessoa e toque em "Desafiar".</Text>
        {denied && <Text style={s.error}>Os desafios ainda não estão liberados neste grupo. Tente de novo mais tarde.</Text>}
        {!!error && <Text style={s.error}>{error}</Text>}
        {nothing && <Text style={s.empty}>Nenhum desafio por aqui ainda.</Text>}

        {incoming.length > 0 && <Text style={s.section}>Para você responder</Text>}
        {incoming.map(c => (
          <Row key={c.id} c={c}>
            {btn('Recusar', () => run(c.id, () => respondChallenge(group!.id, c.id, false)), 'ghost', c.id)}
            {btn('Aceitar', () => run(c.id, () => respondChallenge(group!.id, c.id, true)), 'primary', c.id)}
          </Row>
        ))}

        {toSchedule.length > 0 && <Text style={s.section}>Aceitos, falta marcar o jogo</Text>}
        {toSchedule.map(c => (
          <Row key={c.id} c={c} sub={[c.message, c.when].filter(Boolean).join(' · ') || 'Desafio aceito'}>
            {btn('Marcar o jogo', () => markGame(c), 'primary', c.id)}
          </Row>
        ))}

        {sent.length > 0 && <Text style={s.section}>Aguardando resposta</Text>}
        {sent.map(c => (
          <Row key={c.id} c={c}>
            {btn('Cancelar desafio', () => run(c.id, () => cancelChallenge(group!.id, c.id)), 'ghost', c.id)}
          </Row>
        ))}

        {played.length > 0 && <Text style={s.section}>Jogos dos desafios</Text>}
        {played.map(c => (
          <Row key={c.id} c={c} sub={resultOf(c)}>
            {btn('Ver jogo', () => router.push({ pathname: '/competitions/[id]', params: { id: c.compId as string } }), 'ghost', c.id)}
          </Row>
        ))}

        {closed.length > 0 && <Text style={s.section}>Encerrados</Text>}
        {closed.map(c => <Row key={c.id} c={c} />)}
        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  lead: { fontFamily: FontFamily.body, fontSize: 15, lineHeight: 22, color: C.muted },
  empty: { fontFamily: FontFamily.body, fontSize: 15, color: C.muted, textAlign: 'center', paddingVertical: Spacing.lg },
  error: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: C.coral },
  section: { fontFamily: FontFamily.titleBold, fontSize: 13, letterSpacing: 1.3, color: C.gold, textTransform: 'uppercase', marginTop: Spacing.md },
  row: { backgroundColor: C.surf, borderRadius: Radius.lg, borderWidth: 1, borderColor: C.line, padding: Spacing.md, gap: Spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  name: { fontFamily: FontFamily.titleBold, fontSize: 16, color: C.text },
  sub: { fontFamily: FontFamily.body, fontSize: 14, lineHeight: 20, color: C.text, marginTop: 1 },
  date: { fontFamily: FontFamily.body, fontSize: 13, color: C.muted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  primary: { flex: 1, minHeight: 46, borderRadius: Radius.full, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FontFamily.titleBold, fontSize: 15, color: C.bg },
  ghost: { flex: 1, minHeight: 46, borderRadius: Radius.full, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: FontFamily.bodyMed, fontSize: 15, color: C.muted },
});
