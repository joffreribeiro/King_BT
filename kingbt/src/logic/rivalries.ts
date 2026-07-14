import type { Competition } from './types';
import { extractPlayerGames } from './formats';

export interface RivalryStats {
  /** Com quem jogou mais vezes (independente de resultado) */
  biggestPartner:    { id: string; played: number; wins: number } | null;
  /** Com quem tem melhor aproveitamento em dupla (mín. 2 jogos) */
  bestPartner:       { id: string; wins: number; played: number; pct: number } | null;
  /** Oponente que enfrentou mais vezes */
  biggestRival:      { id: string; played: number; wins: number } | null;
  /** Oponente que mais venceu contra você */
  carrasco:          { id: string; wins: number; played: number } | null;
  /** Oponente que você mais venceu */
  fregues:           { id: string; wins: number; played: number } | null;
}

export function computeRivalries(
  myId: string,
  competitions: Competition[],
): RivalryStats {
  // parceiro: quem jogou ao meu lado em dupla
  const partnerMap = new Map<string, { played: number; wins: number }>();
  // oponente: quem enfrentei
  const rivalMap   = new Map<string, { played: number; theyWon: number; iWon: number }>();

  for (const comp of competitions) {
    for (const m of comp.matches) {
      if (m.scoreA == null || m.scoreB == null) continue;

      const inA = m.teamA ? m.teamA.includes(myId) : m.aId === myId;
      const inB = m.teamB ? m.teamB.includes(myId) : m.bId === myId;
      if (!inA && !inB) continue;

      const myScore  = inA ? m.scoreA : m.scoreB;
      const oppScore = inA ? m.scoreB : m.scoreA;
      const iWon = myScore > oppScore;

      // ── parceiros (dupla) ──────────────────────────────────────────────
      if (m.teamA && m.teamB) {
        const myTeam  = inA ? m.teamA : m.teamB;
        const oppTeam = inA ? m.teamB : m.teamA;

        for (const pid of myTeam) {
          if (pid === myId) continue;
          const p = partnerMap.get(pid) ?? { played: 0, wins: 0 };
          p.played++;
          if (iWon) p.wins++;
          partnerMap.set(pid, p);
        }

        // oponentes via teamA/teamB
        for (const pid of oppTeam) {
          const r = rivalMap.get(pid) ?? { played: 0, theyWon: 0, iWon: 0 };
          r.played++;
          if (iWon) r.iWon++; else r.theyWon++;
          rivalMap.set(pid, r);
        }
      } else {
        // individual: aId / bId
        const oppId = inA ? m.bId : m.aId;
        if (oppId) {
          const r = rivalMap.get(oppId) ?? { played: 0, theyWon: 0, iWon: 0 };
          r.played++;
          if (iWon) r.iWon++; else r.theyWon++;
          rivalMap.set(oppId, r);
        }
      }
    }
  }

  // ── biggest partner (mais jogos juntos) ───────────────────────────────
  let biggestPartner: RivalryStats['biggestPartner'] = null;
  for (const [id, s] of partnerMap) {
    if (!biggestPartner || s.played > biggestPartner.played) {
      biggestPartner = { id, played: s.played, wins: s.wins };
    }
  }

  // ── best partner (melhor aproveitamento, mín 2 jogos) ─────────────────
  let bestPartner: RivalryStats['bestPartner'] = null;
  for (const [id, s] of partnerMap) {
    if (s.played < 2) continue;
    const pct = s.wins / s.played;
    if (!bestPartner || pct > bestPartner.pct || (pct === bestPartner.pct && s.wins > bestPartner.wins)) {
      bestPartner = { id, wins: s.wins, played: s.played, pct };
    }
  }

  // ── biggest rival (mais confrontos) ──────────────────────────────────
  let biggestRival: RivalryStats['biggestRival'] = null;
  for (const [id, r] of rivalMap) {
    if (!biggestRival || r.played > biggestRival.played) {
      biggestRival = { id, played: r.played, wins: r.iWon };
    }
  }

  // ── carrasco (quem mais venceu contra mim) ────────────────────────────
  let carrasco: RivalryStats['carrasco'] = null;
  for (const [id, r] of rivalMap) {
    if (r.theyWon === 0) continue;
    if (!carrasco || r.theyWon > carrasco.wins || (r.theyWon === carrasco.wins && r.played < (rivalMap.get(carrasco.id)?.played ?? 0))) {
      carrasco = { id, wins: r.theyWon, played: r.played };
    }
  }

  // ── freguês (quem eu mais venci) ──────────────────────────────────────
  let fregues: RivalryStats['fregues'] = null;
  for (const [id, r] of rivalMap) {
    if (r.iWon === 0) continue;
    if (!fregues || r.iWon > fregues.wins || (r.iWon === fregues.wins && r.played < (rivalMap.get(fregues.id)?.played ?? 0))) {
      fregues = { id, wins: r.iWon, played: r.played };
    }
  }

  return { biggestPartner, bestPartner, biggestRival, carrasco, fregues };
}

// ── Rivalidades agregadas por NOME (para o Desempenho Geral / multi-grupo) ──────
// Como os IDs de jogador são por grupo, ao somar vários grupos usamos o nome
// como chave. Cada grupo produz mapas por nome; depois somamos e reduzimos.
export interface NamedRivalryMaps {
  partners: Record<string, { played: number; wins: number }>;
  rivals:   Record<string, { played: number; iWon: number; theyWon: number }>;
}

export interface NamedRivalryStats {
  biggestPartner: { name: string; played: number; wins: number } | null;
  bestPartner:    { name: string; wins: number; played: number; pct: number } | null;
  biggestRival:   { name: string; played: number; wins: number } | null;
  carrasco:       { name: string; wins: number; played: number } | null;
  fregues:        { name: string; wins: number; played: number } | null;
}

/** Igual ao computeRivalries, mas com os mapas crus chaveados por nome (via resolveName). */
export function computeNamedRivalries(
  myId: string,
  competitions: Competition[],
  resolveName: (id: string) => string,
): NamedRivalryMaps {
  const partners: NamedRivalryMaps['partners'] = {};
  const rivals:   NamedRivalryMaps['rivals']   = {};

  for (const comp of competitions) {
    for (const m of comp.matches) {
      if (m.scoreA == null || m.scoreB == null) continue;
      const inA = m.teamA ? m.teamA.includes(myId) : m.aId === myId;
      const inB = m.teamB ? m.teamB.includes(myId) : m.bId === myId;
      if (!inA && !inB) continue;

      const iWon = (inA ? m.scoreA : m.scoreB) > (inA ? m.scoreB : m.scoreA);

      if (m.teamA && m.teamB) {
        const myTeam  = inA ? m.teamA : m.teamB;
        const oppTeam = inA ? m.teamB : m.teamA;
        for (const pid of myTeam) {
          if (pid === myId) continue;
          const name = resolveName(pid);
          const p = partners[name] ?? { played: 0, wins: 0 };
          p.played++; if (iWon) p.wins++;
          partners[name] = p;
        }
        for (const pid of oppTeam) {
          const name = resolveName(pid);
          const r = rivals[name] ?? { played: 0, iWon: 0, theyWon: 0 };
          r.played++; if (iWon) r.iWon++; else r.theyWon++;
          rivals[name] = r;
        }
      } else {
        const oppId = inA ? m.bId : m.aId;
        if (oppId) {
          const name = resolveName(oppId);
          const r = rivals[name] ?? { played: 0, iWon: 0, theyWon: 0 };
          r.played++; if (iWon) r.iWon++; else r.theyWon++;
          rivals[name] = r;
        }
      }
    }
  }

  return { partners, rivals };
}

/** Soma os mapas por nome de vários grupos. */
export function mergeNamedRivalries(list: NamedRivalryMaps[]): NamedRivalryMaps {
  const partners: NamedRivalryMaps['partners'] = {};
  const rivals:   NamedRivalryMaps['rivals']   = {};
  for (const maps of list) {
    for (const [name, s] of Object.entries(maps.partners)) {
      const p = partners[name] ?? { played: 0, wins: 0 };
      p.played += s.played; p.wins += s.wins;
      partners[name] = p;
    }
    for (const [name, s] of Object.entries(maps.rivals)) {
      const r = rivals[name] ?? { played: 0, iWon: 0, theyWon: 0 };
      r.played += s.played; r.iWon += s.iWon; r.theyWon += s.theyWon;
      rivals[name] = r;
    }
  }
  return { partners, rivals };
}

/** Reduz os mapas por nome nos 5 destaques de rivalidade. */
export function reduceNamedRivalries(maps: NamedRivalryMaps): NamedRivalryStats {
  const P = Object.entries(maps.partners);
  const R = Object.entries(maps.rivals);

  let biggestPartner: NamedRivalryStats['biggestPartner'] = null;
  for (const [name, s] of P) {
    if (!biggestPartner || s.played > biggestPartner.played) biggestPartner = { name, played: s.played, wins: s.wins };
  }
  let bestPartner: NamedRivalryStats['bestPartner'] = null;
  for (const [name, s] of P) {
    if (s.played < 2) continue;
    const pct = s.wins / s.played;
    if (!bestPartner || pct > bestPartner.pct || (pct === bestPartner.pct && s.wins > bestPartner.wins)) {
      bestPartner = { name, wins: s.wins, played: s.played, pct };
    }
  }
  let biggestRival: NamedRivalryStats['biggestRival'] = null;
  for (const [name, r] of R) {
    if (!biggestRival || r.played > biggestRival.played) biggestRival = { name, played: r.played, wins: r.iWon };
  }
  let carrasco: NamedRivalryStats['carrasco'] = null;
  for (const [name, r] of R) {
    if (r.theyWon === 0) continue;
    if (!carrasco || r.theyWon > carrasco.wins) carrasco = { name, wins: r.theyWon, played: r.played };
  }
  let fregues: NamedRivalryStats['fregues'] = null;
  for (const [name, r] of R) {
    if (r.iWon === 0) continue;
    if (!fregues || r.iWon > fregues.wins) fregues = { name, wins: r.iWon, played: r.played };
  }
  return { biggestPartner, bestPartner, biggestRival, carrasco, fregues };
}

/** Versão para o dashboard: retorna os pares de maior rivalidade entre qualquer dupla de jogadores */
export interface GroupRivalry {
  idA: string;
  idB: string;
  played: number;
  winsA: number;
  winsB: number;
}

export function computeGroupRivalries(competitions: Competition[]): GroupRivalry[] {
  const map = new Map<string, GroupRivalry>();

  for (const comp of competitions) {
    for (const m of comp.matches) {
      if (m.scoreA == null || m.scoreB == null) continue;

      const teamA = m.teamA ?? (m.aId ? [m.aId] : []);
      const teamB = m.teamB ?? (m.bId ? [m.bId] : []);
      if (!teamA.length || !teamB.length) continue;

      const aWon = m.scoreA > m.scoreB;

      // Para individual (1v1) ou considerar apenas o primeiro player de cada lado
      const idA = teamA[0];
      const idB = teamB[0];
      if (!idA || !idB || idA === idB) continue;

      const key = [idA, idB].sort().join('|');
      const r = map.get(key) ?? { idA, idB, played: 0, winsA: 0, winsB: 0 };
      // normalizar ordem
      const isNormal = idA < idB;
      r.played++;
      if (aWon) { if (isNormal) r.winsA++; else r.winsB++; }
      else      { if (isNormal) r.winsB++; else r.winsA++; }
      map.set(key, r);
    }
  }

  return [...map.values()].sort((a, b) => b.played - a.played);
}
