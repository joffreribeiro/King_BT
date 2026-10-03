import type { Competition } from './types';
import { competitionChampion } from './formats';
import { parseStoredDate } from './format';
import type { ScoringConfig } from './scoringConfig';

export interface DoneItem {
  /** Id fixo por competição — é o id do documento no feed quando alguém reage/comenta. */
  id: string;
  kind: 'champion' | 'comp_done';
  compId: string;
  compName: string;
  format: string;
  championIds: string[];
  championName: string;
  date: Date;
}

export const championItemId = (compId: string) => `champ_${compId}`;
export const doneItemId = (compId: string) => `done_${compId}`;

/** Quando a competição terminou: o último jogo com placar; sem data de jogo, a data da competição. */
function finishedAt(comp: Competition): Date {
  let best = 0;
  for (const m of comp.matches) {
    if (m.scoreA == null || !m.playedAt) continue;
    const t = new Date(m.playedAt).getTime();
    if (Number.isFinite(t) && t > best) best = t;
  }
  return best > 0 ? new Date(best) : parseStoredDate(comp.date);
}

/**
 * Cards que aparecem quando uma competição TERMINA (qualquer formato): o de
 * campeão e o de "foi finalizado". O feed não mostra mais jogo a jogo. Vêm das próprias competições encerradas — funcionam para as
 * antigas também, sem gravar nada. O documento só passa a existir no feed
 * quando alguém reage ou comenta (ver ensureFeedItem).
 */
export function buildDoneItems(
  comps: Competition[],
  nameOf: (id: string) => string,
  cfg?: ScoringConfig,
): DoneItem[] {
  const out: DoneItem[] = [];
  for (const comp of comps) {
    if (comp.status !== 'done' || comp.isFriendly) continue;
    const champ = competitionChampion(comp, nameOf, cfg);
    if (!champ) continue;
    const members = champ.members ?? [];
    const championName = members.length ? members.map(nameOf).join(' / ') : (champ.name ?? '');
    if (!championName) continue;
    const date = finishedAt(comp);
    const base = { compId: comp.id, compName: comp.name, format: comp.format, championIds: members, championName };
    // O card de campeão fica 1s à frente do de "finalizado" (mesma ordem do Atlas).
    out.push({ ...base, id: championItemId(comp.id), kind: 'champion', date: new Date(date.getTime() + 1000) });
    out.push({ ...base, id: doneItemId(comp.id), kind: 'comp_done', date });
  }
  return out;
}
