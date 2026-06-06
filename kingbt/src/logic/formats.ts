import type { Match, MatchSource, GroupDef, Competition, Standing, Competitor } from './types';

// ─── Liga (round-robin Circle method) ────────────────────────────────────────

function circleRounds(ids: string[]): [string, string][][] {
  let arr = ids.slice();
  if (arr.length % 2) arr.push('BYE');
  const n = arr.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a !== 'BYE' && b !== 'BYE') pairs.push([a, b]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  return rounds;
}

export function genLeague(ids: string[], dbl: boolean): Match[] {
  const rounds = circleRounds(ids);
  const matches: Match[] = [];
  let n = 0;
  const addRound = (pairs: [string, string][], ri: number) =>
    pairs.forEach(([a, b]) =>
      matches.push({ id: 'L' + n++, stage: 'league', round: ri + 1, aId: a, bId: b, aSrc: null, bSrc: null, scoreA: null, scoreB: null })
    );
  rounds.forEach((pairs, ri) => addRound(pairs, ri));
  if (dbl) rounds.forEach((pairs, ri) =>
    pairs.forEach(([a, b]) =>
      matches.push({ id: 'L' + n++, stage: 'league', round: rounds.length + ri + 1, aId: b, bId: a, aSrc: null, bSrc: null, scoreA: null, scoreB: null })
    )
  );
  return matches;
}

// ─── Bracket (eliminatória simples) ──────────────────────────────────────────

function bracketSeedOrder(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const n = seeds.length * 2;
    const next: number[] = [];
    seeds.forEach(s => { next.push(s); next.push(n + 1 - s); });
    seeds = next;
  }
  return seeds;
}

export const koRoundName = (cnt: number): string =>
  cnt === 1 ? 'Final' : cnt === 2 ? 'Semifinal' : cnt === 4 ? 'Quartas' :
  cnt === 8 ? 'Oitavas' : cnt === 16 ? '16-avos' : `${cnt * 2}-avos`;

export function genBracket(
  seedList: (string | MatchSource)[],
  thirdPlace: boolean,
  idPrefix = 'K'
): Match[] {
  const m = seedList.length;
  let size = 1;
  while (size < m) size *= 2;
  if (size < 2) size = 2;

  const order = bracketSeedOrder(size);
  const slots = order.map(sn => sn <= m ? seedList[sn - 1] : null);
  const numRounds = Math.round(Math.log2(size));
  const matches: Match[] = [];
  let prev: string[] = [];

  for (let r = 0; r < numRounds; r++) {
    const cnt = size / Math.pow(2, r + 1);
    const cur: string[] = [];
    for (let i = 0; i < cnt; i++) {
      const id = idPrefix + r + '_' + i;
      let aId: string | null = null, bId: string | null = null;
      let aSrc: MatchSource | null = null, bSrc: MatchSource | null = null;
      if (r === 0) {
        const sa = slots[i * 2], sb = slots[i * 2 + 1];
        if (typeof sa === 'string') aId = sa; else if (sa) aSrc = sa as MatchSource;
        if (typeof sb === 'string') bId = sb; else if (sb) bSrc = sb as MatchSource;
      } else {
        aSrc = { type: 'winner', match: prev[i * 2] };
        bSrc = { type: 'winner', match: prev[i * 2 + 1] };
      }
      cur.push(id);
      matches.push({ id, stage: 'ko', koRound: r, koTotal: numRounds, cnt, slot: i, aId, bId, aSrc, bSrc, scoreA: null, scoreB: null });
    }
    prev = cur;
  }

  if (thirdPlace && numRounds >= 2) {
    const sfs = matches.filter(x => x.koRound === numRounds - 2);
    matches.push({
      id: idPrefix + 'third', stage: 'ko', koRound: numRounds - 1, third: true,
      cnt: 1, slot: 1, aId: null, bId: null,
      aSrc: { type: 'loser', match: sfs[0].id },
      bSrc: { type: 'loser', match: sfs[1].id },
      scoreA: null, scoreB: null,
    });
  }
  return matches;
}

// ─── Grupos + Eliminatórias ───────────────────────────────────────────────────

export function genGroups(
  ids: string[],
  numGroups: number,
  dbl: boolean,
  qualifiers: number,
  thirdPlace: boolean
): { groupDefs: GroupDef[]; matches: Match[] } {
  const groups: string[][] = Array.from({ length: numGroups }, () => []);
  ids.forEach((id, i) => {
    const row = Math.floor(i / numGroups), col = i % numGroups;
    const g = row % 2 ? numGroups - 1 - col : col;
    groups[g].push(id);
  });
  const groupDefs: GroupDef[] = groups.map((gids, i) => ({
    name: 'Grupo ' + String.fromCharCode(65 + i), ids: gids,
  }));
  const matches: Match[] = [];
  groupDefs.forEach((gd, gi) =>
    genLeague(gd.ids, dbl).forEach(mm =>
      matches.push({ ...mm, id: 'G' + gi + mm.id, stage: 'group', groupIdx: gi })
    )
  );
  const tickets: MatchSource[] = [];
  for (let pos = 1; pos <= qualifiers; pos++)
    for (let g = 0; g < numGroups; g++)
      tickets.push({ type: 'group', g, pos });
  const bracket = genBracket(tickets, thirdPlace, 'K');
  return { groupDefs, matches: matches.concat(bracket) };
}

// ─── Standings ────────────────────────────────────────────────────────────────

export function standings(ids: string[], matches: Match[]): Standing[] {
  const t: Record<string, Standing> = {};
  ids.forEach(id => { t[id] = { id, played: 0, wins: 0, losses: 0, gf: 0, ga: 0, gd: 0, pts: 0 }; });
  matches.forEach(m => {
    if (m.scoreA == null || m.scoreB == null) return;
    if (!m.aId || !m.bId || !t[m.aId] || !t[m.bId]) return;
    t[m.aId].played++; t[m.bId].played++;
    t[m.aId].gf += m.scoreA; t[m.aId].ga += m.scoreB;
    t[m.bId].gf += m.scoreB; t[m.bId].ga += m.scoreA;
    if (m.scoreA > m.scoreB) { t[m.aId].wins++; t[m.bId].losses++; }
    else { t[m.bId].wins++; t[m.aId].losses++; }
  });
  return ids
    .map(id => { const s = t[id]; return { ...s, gd: s.gf - s.ga, pts: s.wins * 3 }; })
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

export function groupComplete(matches: Match[], gi: number): boolean {
  const gm = matches.filter(m => m.stage === 'group' && m.groupIdx === gi);
  return gm.length > 0 && gm.every(m => m.scoreA != null && m.scoreB != null);
}

// ─── Winner / Loser helpers ───────────────────────────────────────────────────

export function matchWinner(m: Match): string | null {
  if (m.scoreA != null && m.scoreB != null && m.scoreA !== m.scoreB)
    return m.scoreA > m.scoreB ? (m.aId ?? null) : (m.bId ?? null);
  if (m.aId != null && m.bId == null && !m.bSrc) return m.aId;
  if (m.bId != null && m.aId == null && !m.aSrc) return m.bId;
  return null;
}

export function matchLoser(m: Match): string | null {
  if (m.scoreA != null && m.scoreB != null && m.scoreA !== m.scoreB)
    return m.scoreA > m.scoreB ? (m.bId ?? null) : (m.aId ?? null);
  return null;
}

// ─── resolveCompetition (fixpoint) ────────────────────────────────────────────

export function resolveCompetition(comp: Competition): Competition {
  const { matches, groupDefs } = comp;
  const byId: Record<string, Match> = Object.fromEntries(matches.map(m => [m.id, m]));

  const groupRank: Record<number, Standing[]> = {};
  if (groupDefs) {
    groupDefs.forEach((gd, gi) => {
      if (groupComplete(matches, gi))
        groupRank[gi] = standings(gd.ids, matches.filter(m => m.stage === 'group' && m.groupIdx === gi));
    });
  }

  let changed = true, guard = 0;
  while (changed && guard++ < 30) {
    changed = false;
    for (const m of matches) {
      for (const side of ['a', 'b'] as const) {
        const src = m[`${side}Src`] as MatchSource | null;
        if (!src || m[`${side}Id`] != null) continue;
        let val: string | null = null;
        if (src.type === 'winner') {
          const sm = byId[src.match!]; if (sm) val = matchWinner(sm);
        } else if (src.type === 'loser') {
          const sm = byId[src.match!]; if (sm) val = matchLoser(sm);
        } else if (src.type === 'group') {
          const gr = groupRank[src.g!];
          if (gr && gr[src.pos! - 1]) val = gr[src.pos! - 1].id;
        }
        if (val != null) { (m as unknown as Record<string, unknown>)[`${side}Id`] = val; changed = true; }
      }
    }
  }
  return comp;
}

// ─── Campeão ──────────────────────────────────────────────────────────────────

export function competitionChampion(comp: Competition): Competitor | null {
  if (comp.format === 'liga') {
    const st = standings(comp.competitors.map(c => c.id), comp.matches);
    const allDone = comp.matches.every(m => m.scoreA != null);
    return allDone && st[0] ? comp.competitors.find(c => c.id === st[0].id) ?? null : null;
  }
  const finals = comp.matches.filter(m => m.stage === 'ko' && !m.third);
  if (!finals.length) return null;
  const last = finals.reduce((a, b) => (b.koRound ?? 0) > (a.koRound ?? 0) ? b : a, finals[0]);
  const w = matchWinner(last);
  return w ? comp.competitors.find(c => c.id === w) ?? null : null;
}

// ─── Extração de jogos para ranking global ────────────────────────────────────

function membersOf(comp: Competition, id: string): string[] {
  const c = comp.competitors.find(x => x.id === id);
  return c ? (c.members.length > 0 ? c.members : [c.id]) : [id];
}

export function extractPlayerGames(
  comp: Competition
): Array<{ teamA: string[]; teamB: string[]; scoreA: number; scoreB: number }> {
  const out: Array<{ teamA: string[]; teamB: string[]; scoreA: number; scoreB: number }> = [];
  comp.matches.forEach(m => {
    if (m.scoreA == null || m.scoreB == null || m.scoreA === m.scoreB) return;
    if (m.teamA && m.teamB) {
      out.push({ teamA: m.teamA, teamB: m.teamB, scoreA: m.scoreA, scoreB: m.scoreB });
      return;
    }
    if (!m.aId || !m.bId) return;
    out.push({ teamA: membersOf(comp, m.aId), teamB: membersOf(comp, m.bId), scoreA: m.scoreA, scoreB: m.scoreB });
  });
  return out;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

import type { Format, Unit, CompetitionConfig } from './types';
import { generateSchedule } from './roundRobin';

export function buildCompetition(spec: {
  name: string;
  format: Format;
  unit: Unit;
  competitors: Competitor[];
  config: CompetitionConfig;
  location?: string;
  notes?: string;
}): Competition {
  const id = 'comp_' + Date.now();
  const comp: Competition = {
    id, name: spec.name, format: spec.format, unit: spec.unit,
    status: 'active', date: new Date().toISOString().slice(0, 10),
    ...(spec.location ? { location: spec.location } : {}),
    ...(spec.notes ? { notes: spec.notes } : {}),
    config: spec.config, competitors: spec.competitors, matches: [],
  };
  const ids = spec.competitors.map(c => c.id);
  const { config } = spec;
  if (spec.format === 'liga') {
    comp.matches = genLeague(ids, config.rounds === 'double');
  } else if (spec.format === 'mata') {
    comp.matches = genBracket(ids, config.thirdPlace, 'K');
  } else if (spec.format === 'grupos') {
    const { groupDefs, matches } = genGroups(ids, config.groups, config.rounds === 'double', config.qualifiers, config.thirdPlace);
    comp.groupDefs = groupDefs; comp.matches = matches;
  } else {
    const players = spec.competitors.map(c => ({ id: c.members[0] ?? c.id, name: c.name, short: c.short, color: c.color }));
    comp.matches = generateSchedule(players);
  }
  resolveCompetition(comp);
  return comp;
}
