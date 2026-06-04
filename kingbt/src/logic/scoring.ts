export type Game = {
  id: string;
  teamA: [string, string];
  teamB: [string, string];
  scoreA: number | null;
  scoreB: number | null;
};

export type PlayerStats = {
  id: string;
  name: string;
  wins: number;
  losses: number;
  played: number;
  gp: number;
  gc: number;
  sg: number;   // saldo de games = gp - gc (desempate)
  ga: number;   // game average = gp / gc (entra na fórmula)
  points: number;
};

export function buildRanking(
  players: { id: string; name: string }[],
  allGames: Game[]
): PlayerStats[] {
  const m: Record<string, { wins: number; losses: number; played: number; gp: number; gc: number }> = {};
  players.forEach(p => {
    m[p.id] = { wins: 0, losses: 0, played: 0, gp: 0, gc: 0 };
  });

  for (const g of allGames) {
    if (g.scoreA == null || g.scoreB == null) continue;
    const aWin = g.scoreA > g.scoreB;
    for (const id of g.teamA) {
      const s = m[id];
      if (!s) continue;
      s.played++;
      s.gp += g.scoreA;
      s.gc += g.scoreB;
      if (aWin) s.wins++; else s.losses++;
    }
    for (const id of g.teamB) {
      const s = m[id];
      if (!s) continue;
      s.played++;
      s.gp += g.scoreB;
      s.gc += g.scoreA;
      if (!aWin) s.wins++; else s.losses++;
    }
  }

  return players
    .map(p => {
      const s = m[p.id];
      const sg = s.gp - s.gc;
      const ga = s.gc === 0 ? s.gp : s.gp / s.gc;
      const points = Math.round((s.wins * 3 + s.played * 0.5 + ga * 2) * 100) / 100;
      return { id: p.id, name: p.name, ...s, sg, ga, points };
    })
    .sort((a, b) => b.points - a.points || b.ga - a.ga || b.sg - a.sg || b.wins - a.wins);
}
