import { rankedCompetitions } from './rankingScope';
import { playersOfMatch } from './playedWith';
import type { Competition } from './types';

export interface RatePromptItem {
  playerId: string;
  compId: string;
  compName: string;
  /** Data da competição (AAAA-MM-DD). */
  compDate: string;
}

/** Soma dias a "AAAA-MM-DD" sem depender de fuso. */
function minusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - days));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/**
 * Quem o jogador ainda não avaliou entre quem jogou com ou contra ele nas competições
 * ENCERRADAS (ou, com `includeActive`, também as em andamento) dos últimos `days` dias. Só valem competições que contam para o ranking
 * (as amistosas ficam de fora, como no Radar) e jogos com placar. Um colega aparece uma vez,
 * ligado à competição mais recente em que se encontraram.
 */
export function playersToRate(
  competitions: Competition[],
  myId: string | null | undefined,
  ratedIds: string[],
  today: string,
  days = 14,
  dismissedCompIds: string[] = [],
  /** Inclui competições ainda em andamento (jogos que já têm placar). */
  includeActive = false,
): RatePromptItem[] {
  if (!myId) return [];
  const since = minusDays(today, days);
  const rated = new Set(ratedIds);
  const dismissed = new Set(dismissedCompIds);
  const found = new Map<string, RatePromptItem>();

  const recent = rankedCompetitions(competitions)
    .filter(c => (c.status === 'done' || (includeActive && c.status === 'active')) && !!c.date && c.date >= since && c.date <= today && !dismissed.has(c.id))
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const comp of recent) {
    for (const m of comp.matches) {
      if (m.scoreA == null || m.scoreB == null) continue;
      const all = playersOfMatch(comp, m);
      if (!all.includes(myId)) continue;
      for (const pid of all) {
        if (pid === myId || rated.has(pid) || found.has(pid)) continue;
        found.set(pid, { playerId: pid, compId: comp.id, compName: comp.name, compDate: comp.date });
      }
    }
  }
  return [...found.values()];
}
