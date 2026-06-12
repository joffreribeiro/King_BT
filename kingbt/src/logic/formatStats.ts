import type { Competition, Format } from './types';

export interface FormatStat {
  format:  Format;
  label:   string;
  color:   string;
  played:  number;
  wins:    number;
  pct:     number;
}

const FORMAT_META: Record<Format, { label: string; color: string }> = {
  avulso: { label: 'Avulso',    color: '#38BDF8' },
  liga:   { label: 'Liga',      color: '#54B981' },
  grupos: { label: 'Grupos',    color: '#6B7FD7' },
  mata:   { label: 'Mata-Mata', color: '#E5483D' },
  super8: { label: 'Super 8',   color: '#F472B6' },
};

export function computeFormatStats(
  competitions: Competition[],
  playerId: string
): FormatStat[] {
  if (!playerId) return [];

  const map: Record<Format, { played: number; wins: number }> = {
    avulso: { played: 0, wins: 0 },
    liga:   { played: 0, wins: 0 },
    grupos: { played: 0, wins: 0 },
    mata:   { played: 0, wins: 0 },
    super8: { played: 0, wins: 0 },
  };

  competitions.forEach(comp => {
    const f = comp.format as Format;
    if (!map[f]) return;

    comp.matches.forEach(m => {
      if (m.scoreA == null || m.scoreB == null) return;

      const inA = m.aId === playerId || m.teamA?.includes(playerId);
      const inB = m.bId === playerId || m.teamB?.includes(playerId);
      if (!inA && !inB) return;

      map[f].played++;
      const won = inA ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
      if (won) map[f].wins++;
    });
  });

  return (Object.keys(map) as Format[])
    .filter(f => map[f].played > 0)
    .map(f => ({
      format:  f,
      label:   FORMAT_META[f].label,
      color:   FORMAT_META[f].color,
      played:  map[f].played,
      wins:    map[f].wins,
      pct:     Math.round((map[f].wins / map[f].played) * 100),
    }))
    .sort((a, b) => b.pct - a.pct);
}
