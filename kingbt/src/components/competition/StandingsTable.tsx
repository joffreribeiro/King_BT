import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { FontFamily, Spacing, PODIUM_COLORS, type ThemeColors } from '@/theme';
import { useTheme } from '@/store/ThemeContext';
import { goToPlayer } from '@/logic/nav';
import { Card } from '@/components';
import { standings } from '@/logic/formats';
import { useGroupPlayers } from '@/store/GroupPlayersContext';
import { useSettings } from '@/store/SettingsContext';
import { withCompetitionScoring } from '@/logic/scoringConfig';
import type { Match, Competition } from '@/logic/types';
import { getCompetitor, sgColor } from './helpers';

// Em duplas fixas, o id da linha é o time (sem perfil próprio) — só navega
// quando dá pra resolver um único jogador real por trás do id.
function resolvePlayerLink(comp: Competition, id: string): string | null {
  const competitor = getCompetitor(comp, id);
  if (competitor) return competitor.members.length === 1 ? competitor.members[0] : null;
  return id; // sem competitor cadastrado: o próprio id já é o jogador (avulso/individual)
}

export function StandingsTable({ comp, ids, matches, highlightTop = 0 }: {
  comp: Competition; ids: string[]; matches: Match[]; highlightTop?: number;
}) {
  const { findPlayer } = useGroupPlayers();
  const { scoringConfig } = useSettings();
  const { colors: Colors } = useTheme();

  function resolveEntry(id: string): { name: string; color: string } {
    const competitor = getCompetitor(comp, id);
    if (competitor) return { name: competitor.name, color: competitor.color };
    const gp = findPlayer(id);
    if (gp) return { name: gp.name, color: gp.color };
    return { name: id, color: Colors.muted };
  }

  const st = standings(ids, matches, id => resolveEntry(id).name, withCompetitionScoring(scoringConfig, comp.config), comp.config?.winRule);
  return (
    <Card padding={0} style={{ overflow: 'hidden', marginBottom: Spacing.sm }}>
      <StandingsHeader />
      {st.map((s, i) => {
        const pl = resolveEntry(s.id);
        const linkId = resolvePlayerLink(comp, s.id);
        return (
          <StandingRow
            key={s.id}
            pos={i + 1}
            name={pl.name}
            color={pl.color}
            played={s.played}
            wins={s.wins}
            losses={s.losses}
            gp={s.gf}
            gc={Math.round(s.gf - s.gd)}
            sg={s.gd}
            ga={Number(s.ga)}
            pts={Number(s.pts)}
            classified={highlightTop > 0 && i < highlightTop}
            last={i === st.length - 1}
            onPress={linkId ? () => goToPlayer(linkId) : undefined}
          />
        );
      })}
      <StandingsLegend />
    </Card>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Uma linha da classificação, no estilo do Atlas: medalha nos três primeiros
 * (com a linha tingida na cor do pódio), número nos demais, e só o que decide a
 * colocação — V, D, GP, SALDO e PTS — em fonte legível.
 */
export function StandingRow(p: {
  pos: number; name: string; color: string;
  played: number; wins: number; losses: number; gp: number; gc: number; sg: number; ga: number; pts: number;
  classified?: boolean; last?: boolean; onPress?: () => void;
}) {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStRow(Colors), [Colors]);
  const podium = p.pos >= 1 && p.pos <= 3 ? PODIUM_COLORS[p.pos - 1] : null;
  return (
    <TouchableOpacity
      style={[s.row, !p.last && s.border, podium && { backgroundColor: podium + '1F' }, p.classified && s.classified]}
      onPress={p.onPress}
      disabled={!p.onPress}
      activeOpacity={0.75}
    >
      <View style={s.posBox}>
        {podium ? <Text style={s.medal}>{MEDALS[p.pos - 1]}</Text> : <Text style={s.pos}>{p.pos}</Text>}
      </View>
      <Text style={s.name} numberOfLines={1}>{p.name}</Text>
      <Text style={s.cN}>{p.wins}</Text>
      <Text style={s.cN}>{p.losses}</Text>
      <Text style={s.cGp}>{p.gp}</Text>
      <Text style={[s.cSg, { color: sgColor(p.sg, Colors) }]}>{p.sg > 0 ? '+' : ''}{p.sg}</Text>
      <Text style={s.cPts}>{p.pts.toFixed(2).replace('.', ',')}</Text>
    </TouchableOpacity>
  );
}

/** Cabeçalho das colunas da classificação. */
export function StandingsHeader() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStRow(Colors), [Colors]);
  return (
    <View style={[s.row, s.header]}>
      <View style={s.posBox} />
      <Text style={[s.name, s.th]}>NOME</Text>
      <Text style={[s.cN, s.th]}>V</Text>
      <Text style={[s.cN, s.th]}>D</Text>
      <Text style={[s.cGp, s.th]}>GP</Text>
      <Text style={[s.cSg, s.th]}>SALDO</Text>
      <Text style={[s.cPts, s.th]}>PTS</Text>
    </View>
  );
}

export function StandingsLegend() {
  const { colors: Colors } = useTheme();
  const s = useMemo(() => makeStRow(Colors), [Colors]);
  return (
    <View style={s.legend}>
      <Text style={s.legendText}>V vitórias · D derrotas · GP games pró · SALDO saldo de games · PTS pontuação</Text>
    </View>
  );
}

// Exportado: outras views (Classificação/Rotating) reutilizam estes estilos
export const makeStRow = (Colors: ThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm + 4, paddingVertical: 13 },
  header: { backgroundColor: 'transparent', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.line },
  border: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  classified: { borderLeftWidth: 3, borderLeftColor: Colors.teal },
  th: { fontFamily: FontFamily.titleBold, fontSize: 12, lineHeight: 16, color: Colors.muted, letterSpacing: 0.3 },
  posBox: { width: 30, alignItems: 'center', justifyContent: 'center' },
  medal: { fontSize: 20 },
  pos: { fontFamily: FontFamily.numberBold, fontSize: 17, color: Colors.text },
  name: { flex: 1, minWidth: 0, fontFamily: FontFamily.title, fontSize: 16, color: Colors.text },
  cN: { width: 26, textAlign: 'center', fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.text },
  cGp: { width: 32, textAlign: 'center', fontFamily: FontFamily.numberBold, fontSize: 16, color: Colors.text },
  cSg: { width: 54, textAlign: 'center', fontFamily: FontFamily.numberBold, fontSize: 16 },
  cPts: { width: 54, textAlign: 'right', fontFamily: FontFamily.numberBold, fontSize: 18, color: Colors.gold },
  legend: { paddingHorizontal: Spacing.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.line },
  legendText: { fontFamily: FontFamily.body, fontSize: 12, lineHeight: 16, color: Colors.muted, textAlign: 'center' },
});
