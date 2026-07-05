import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { useMemo } from 'react';
import { FontFamily, Spacing, Radius, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { Avatar, Card } from '@/components';
import type { Match } from '@/logic/types';

export interface ScoreSide {
  label: string;
  players?: { name: string; color: string }[];
  placeholder?: boolean; // slot ainda não definido ("1º Grupo A") — itálico
  bye?: boolean;
}

type Col = { v: string | number; win?: boolean; live?: boolean; draft?: boolean; trophy?: boolean };

/**
 * Card de jogo estilo placar de TV: cada lado numa linha,
 * games de cada set em colunas à direita.
 */
export function ScoreboardCard({ sideA, sideB, match: m, isNext = false, pending = false, hint, onPress, onLongPress }: {
  sideA: ScoreSide; sideB: ScoreSide; match: Match;
  isNext?: boolean; pending?: boolean; hint?: string | null;
  onPress: () => void; onLongPress?: () => void;
}) {
  const { colors: Colors } = useTheme();
  const sb = useMemo(() => makeSb(Colors), [Colors]);
  const has = m.scoreA != null && m.scoreB != null;
  const aWon = has && m.scoreA! > m.scoreB!;
  const sets = has && m.sets?.length ? m.sets : null;
  const live = !has && m.liveScore ? m.liveScore : null;
  const draft = !has && !live && m.draftSets?.length ? m.draftSets : null;

  function cols(side: 'a' | 'b'): Col[] {
    if (sets) return sets.map(s => {
      const v = side === 'a' ? s.a : s.b;
      return { v, win: side === 'a' ? s.a > s.b : s.b > s.a };
    });
    // Jogo antigo/migrado sem games gravados: não mostra placar em sets —
    // só um troféu no lado vencedor, para a zona de placar não ficar vazia
    if (has) return (side === 'a' ? aWon : !aWon) ? [{ v: '🏆', trophy: true }] : [];
    if (live) return [{ v: side === 'a' ? live.gamesA : live.gamesB, live: true }];
    if (draft) return draft.map(s => ({ v: side === 'a' ? s.a : s.b, draft: true }));
    return [{ v: '–' }];
  }

  function TeamRow({ side, info }: { side: 'a' | 'b'; info: ScoreSide }) {
    const won = has && (side === 'a' ? aWon : !aWon);
    return (
      <View style={sb.teamRow}>
        {info.players?.map((p, i) => <Avatar key={i} name={p.name} color={p.color} size={24} />)}
        <Text
          style={[sb.name, won && sb.nameWin, info.placeholder && sb.placeholder, info.bye && sb.bye]}
          numberOfLines={1}
        >
          {info.label}
        </Text>
        {/* Zona de placar fixa: colunas alinhadas da esquerda p/ direita,
            mesma posição do set 1 em todos os cards */}
        <View style={sb.scoreZone}>
          {cols(side).map((c, i) => (
            <Text key={i} style={[sb.col, c.win && sb.colWin, c.live && sb.colLive, c.draft && sb.colDraft]}>
              {c.v}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  const showBadges = isNext || !!live || !!draft;

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} disabled={pending} activeOpacity={0.8}>
      <Card padding={0} style={{
        overflow: 'hidden', marginBottom: 8,
        ...(isNext ? sb.nextCard : {}),
        ...(pending ? { opacity: 0.9 } : {}),
      } as ViewStyle}>
        {showBadges && (
          <View style={sb.badgeRow}>
            {isNext && (
              <View style={sb.nextBadge}><Text style={sb.nextBadgeTxt}>PRÓXIMO</Text></View>
            )}
            {live && (
              <View style={sb.liveBadge}>
                <View style={sb.liveDot} />
                <Text style={sb.liveBadgeTxt}>EM ANDAMENTO</Text>
              </View>
            )}
            {draft && (
              <View style={sb.draftBadge}><Text style={sb.draftBadgeTxt}>📝 RASCUNHO</Text></View>
            )}
          </View>
        )}
        <TeamRow side="a" info={sideA} />
        <View style={sb.div} />
        <TeamRow side="b" info={sideB} />
        {hint ? <Text style={sb.hint}>{hint}</Text> : null}
      </Card>
    </TouchableOpacity>
  );
}

const makeSb = (Colors: ThemeColors) => StyleSheet.create({
  nextCard: { borderColor: Colors.gold, borderWidth: 1.5 },
  badgeRow: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.sm + 2, paddingTop: 8 },
  nextBadge: { backgroundColor: Colors.gold + '22', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  nextBadgeTxt: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.gold, letterSpacing: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.coral + '22', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.coral },
  liveBadgeTxt: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.coral, letterSpacing: 1 },
  draftBadge: { backgroundColor: Colors.muted + '18', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  draftBadgeTxt: { fontFamily: FontFamily.numberBold, fontSize: 10, color: Colors.muted, letterSpacing: 1 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: Spacing.sm + 2, height: 44 },
  name: { flex: 1, fontFamily: FontFamily.bodyMed, fontSize: 14, color: Colors.text },
  nameWin: { color: Colors.gold, fontFamily: FontFamily.title },
  placeholder: { fontStyle: 'italic' },
  bye: { fontFamily: FontFamily.numberBold, fontSize: 12, letterSpacing: 1 },
  scoreZone: {
    width: 100, alignSelf: 'stretch',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start',
    borderLeftWidth: 1, borderLeftColor: Colors.line,
    paddingLeft: 6, backgroundColor: Colors.surf2,
  },
  col: { width: 30, textAlign: 'center', fontFamily: FontFamily.numberBold, fontSize: 17, color: Colors.muted },
  colWin: { color: Colors.teal },
  colLive: { color: Colors.coral },
  colDraft: { color: Colors.faint },
  div: { height: 1, backgroundColor: Colors.line, marginHorizontal: Spacing.sm },
  hint: { fontFamily: FontFamily.body, fontSize: 11, color: Colors.faint, textAlign: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.line },
});
