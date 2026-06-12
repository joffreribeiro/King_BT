import type { Competition } from './types';
import { competitionChampion } from './formats';

export type Badge = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  unlocked: boolean;
};

export function computeBadges(playerId: string, competitions: Competition[], nameOf?: (id: string) => string): Badge[] {
  const doneComps = competitions.filter(c => c.status === 'done');

  // Matches played by this player
  const myMatches = competitions.flatMap(c =>
    c.matches.filter(m => m.scoreA != null && (
      (m.teamA?.includes(playerId) || m.teamB?.includes(playerId)) ||
      (m.aId === playerId || m.bId === playerId)
    ))
  );

  const wins = myMatches.filter(m => {
    const inA = m.teamA ? m.teamA.includes(playerId) : m.aId === playerId;
    return inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
  });

  // Champions
  const champCount = doneComps.filter(c => {
    const champ = competitionChampion(c, nameOf);
    return champ && champ.members.includes(playerId);
  }).length;

  // Consecutive wins (sequence)
  const resultSeq = myMatches.map(m => {
    const inA = m.teamA ? m.teamA.includes(playerId) : m.aId === playerId;
    return inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
  });
  let maxStreak = 0, streak = 0;
  for (const w of resultSeq) { if (w) { streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0; }

  // Hat-trick: 3 wins in single competition
  const hasHatTrick = competitions.some(c => {
    const compWins = c.matches.filter(m => {
      if (m.scoreA == null) return false;
      const inA = m.teamA ? m.teamA.includes(playerId) : m.aId === playerId;
      const inB = m.teamB ? m.teamB.includes(playerId) : m.bId === playerId;
      if (!inA && !inB) return false;
      return inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
    }).length;
    return compWins >= 3;
  });

  // Unbeatable in a month: all wins in any month
  const monthlyResults: Record<string, { w: number; total: number }> = {};
  competitions.forEach(c => {
    const month = c.date?.slice(0, 7) ?? 'unknown';
    c.matches.forEach(m => {
      if (m.scoreA == null) return;
      const inA = m.teamA ? m.teamA.includes(playerId) : m.aId === playerId;
      const inB = m.teamB ? m.teamB.includes(playerId) : m.bId === playerId;
      if (!inA && !inB) return;
      if (!monthlyResults[month]) monthlyResults[month] = { w: 0, total: 0 };
      monthlyResults[month].total++;
      const won = inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
      if (won) monthlyResults[month].w++;
    });
  });
  const unbeatable = Object.values(monthlyResults).some(r => r.total >= 3 && r.w === r.total);

  // Perfect partner: dupla partnership win rate ≥ 80%
  const partnerWins: Record<string, { wins: number; played: number }> = {};
  competitions.forEach(c => {
    c.matches.filter(m => m.scoreA != null && m.teamA && m.teamB).forEach(m => {
      const inA = m.teamA!.includes(playerId);
      const inB = m.teamB!.includes(playerId);
      if (!inA && !inB) return;
      const myTeam = inA ? m.teamA! : m.teamB!;
      const partner = myTeam.find(id => id !== playerId);
      if (!partner) return;
      const won = inA ? m.scoreA! > m.scoreB! : m.scoreB! > m.scoreA!;
      if (!partnerWins[partner]) partnerWins[partner] = { wins: 0, played: 0 };
      partnerWins[partner].played++;
      if (won) partnerWins[partner].wins++;
    });
  });
  const perfectPartner = Object.values(partnerWins).some(p => p.played >= 5 && p.wins / p.played >= 0.8);

  return [
    {
      id: 'first_win',
      emoji: '🏆',
      name: 'Primeira Vitória',
      description: 'Vença sua primeira partida',
      unlocked: wins.length >= 1,
    },
    {
      id: 'champion',
      emoji: '👑',
      name: 'Campeão',
      description: 'Conquiste um título',
      unlocked: champCount >= 1,
    },
    {
      id: 'tri_champion',
      emoji: '🔱',
      name: 'Tricampeão',
      description: 'Conquiste 3 títulos',
      unlocked: champCount >= 3,
    },
    {
      id: 'streak_5',
      emoji: '🔥',
      name: '5 Seguidas',
      description: 'Vença 5 partidas consecutivas',
      unlocked: maxStreak >= 5,
    },
    {
      id: 'hat_trick',
      emoji: '🎩',
      name: 'Hat-trick',
      description: 'Vença 3 partidas em uma competição',
      unlocked: hasHatTrick,
    },
    {
      id: 'unbeatable',
      emoji: '🛡️',
      name: 'Imbatível do Mês',
      description: 'Vença todas as partidas em um mês (mín. 3)',
      unlocked: unbeatable,
    },
    {
      id: 'perfect_partner',
      emoji: '🤝',
      name: 'Parceiro Perfeito',
      description: '80%+ de vitórias com um parceiro (mín. 5 jogos)',
      unlocked: perfectPartner,
    },
    {
      id: 'veteran',
      emoji: '⭐',
      name: 'Veterano',
      description: 'Dispute 20 partidas',
      unlocked: myMatches.length >= 20,
    },
  ];
}
