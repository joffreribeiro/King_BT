import { rankedCompetitions } from './rankingScope';
import type { Competition } from './types';
import { matchGames } from './setOutcome';

export type BattlePeriod = 'mes' | 'ano' | 'geral';

/** Último jogo contra o adversário, do seu ponto de vista. */
export interface LastMeeting {
  /** "YYYY-MM-DD". */
  date: string;
  won: boolean;
  /** Games seus e dele nesse jogo. */
  gf: number;
  gc: number;
}

/** Seu confronto direto contra um adversário: quantas vezes jogaram um contra o outro e quem levou. */
export interface Battle {
  id: string;
  played: number;
  wins: number;
  losses: number;
  /** Sua taxa de vitória contra ele, 0–100. */
  pct: number;
  /** Games que você fez / tomou nesses confrontos. */
  gamesPro: number;
  gamesCon: number;
  last: LastMeeting | null;
  /** Sequência atual contra ele (resultados iguais seguidos, do mais recente para trás). */
  streak: { won: boolean; count: number };
}

/** Uma parceria em dupla: com quem você joga junto e como se dá. */
export interface Partnership {
  partnerId: string;
  wins: number;
  losses: number;
  played: number;
  /** Sua taxa de vitória jogando com ele, 0–100. */
  pct: number;
}

/** Um jogo com placar em que `myId` participou, já do ponto de vista dele. */
interface MyGame {
  date: string;
  won: boolean;
  gf: number;
  gc: number;
  opponents: string[];
  partner: string | null;
}

const dateOf = (comp: Competition, playedAt?: string | null) => (playedAt ? playedAt.slice(0, 10) : comp.date ?? '');

/** Os jogos de `myId` com placar decidido, em ordem cronológica (mais antigo primeiro). */
function collectGames(myId: string, competitions: Competition[]): MyGame[] {
  competitions = rankedCompetitions(competitions);
  const out: (MyGame & { seq: number })[] = [];
  let seq = 0;
  for (const comp of competitions) {
    for (const m of comp.matches) {
      seq++;
      if (m.scoreA == null || m.scoreB == null || m.scoreA === m.scoreB) continue;
      const inA = m.teamA ? m.teamA.includes(myId) : m.aId === myId;
      const inB = m.teamB ? m.teamB.includes(myId) : m.bId === myId;
      if (!inA && !inB) continue;
      const won = (inA ? m.scoreA : m.scoreB) > (inA ? m.scoreB : m.scoreA);
      const g = matchGames(m, comp.config?.winRule);

      let opponents: string[];
      let partner: string | null = null;
      if (m.teamA && m.teamB) {
        opponents = (inA ? m.teamB : m.teamA).filter(id => id !== myId);
        partner = (inA ? m.teamA : m.teamB).find(id => id !== myId) ?? null;
      } else {
        const opp = inA ? m.bId : m.aId;
        opponents = opp && opp !== myId ? [opp] : [];
      }
      out.push({
        date: dateOf(comp, m.playedAt), won,
        gf: inA ? g.a : g.b, gc: inA ? g.b : g.a,
        opponents, partner, seq,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq);
}

/** Só as competições do período — mesma regra do filtro do Ranking (pela data da competição). */
export function filterByPeriod(competitions: Competition[], period: BattlePeriod, now = new Date()): Competition[] {
  if (period === 'geral') return competitions;
  return competitions.filter(c => {
    const d = new Date(c.date + 'T12:00:00');
    if (period === 'mes') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return d.getFullYear() === now.getFullYear();
  });
}

/**
 * Todos os adversários que você já enfrentou, com o placar de confrontos.
 * Em dupla, cada um dos dois adversários conta como enfrentado. Ordem: mais
 * jogos primeiro; empate por mais vitórias.
 */
export function computeBattles(myId: string, competitions: Competition[]): Battle[] {
  const map = new Map<string, MyGame[]>();
  for (const g of collectGames(myId, competitions)) {
    for (const opp of g.opponents) {
      const list = map.get(opp) ?? [];
      list.push(g);
      map.set(opp, list);
    }
  }

  return [...map.entries()]
    .map(([id, games]) => {
      const wins = games.filter(g => g.won).length;
      const losses = games.length - wins;
      const played = games.length;
      const lastGame = games[games.length - 1];
      let count = 0;
      for (let i = games.length - 1; i >= 0 && games[i].won === lastGame.won; i--) count++;
      return {
        id, played, wins, losses,
        pct: played ? Math.round((wins / played) * 100) : 0,
        gamesPro: games.reduce((n, g) => n + g.gf, 0),
        gamesCon: games.reduce((n, g) => n + g.gc, 0),
        last: { date: lastGame.date, won: lastGame.won, gf: lastGame.gf, gc: lastGame.gc },
        streak: { won: lastGame.won, count },
      };
    })
    .sort((a, b) => b.played - a.played || b.wins - a.wins);
}

/** Jogos em dupla de `myId`, agrupados por parceiro. Ordem: mais vitórias primeiro. */
export function computePartnerships(myId: string, competitions: Competition[]): Partnership[] {
  const map = new Map<string, { wins: number; losses: number }>();
  for (const g of collectGames(myId, competitions)) {
    if (!g.partner) continue;
    const r = map.get(g.partner) ?? { wins: 0, losses: 0 };
    if (g.won) r.wins++; else r.losses++;
    map.set(g.partner, r);
  }
  return [...map.entries()]
    .map(([partnerId, r]) => {
      const played = r.wins + r.losses;
      return { partnerId, wins: r.wins, losses: r.losses, played, pct: Math.round((r.wins / played) * 100) };
    })
    .sort((a, b) => b.wins - a.wins || b.pct - a.pct);
}

/** Jogos mínimos contra/com alguém para valer como destaque (1 jogo é sorte). */
const MIN_GAMES = 2;

export interface BattleHighlights {
  /** Quem te vence com mais folga: você perdeu mais do que ganhou, menor taxa de vitória sua. */
  carrasco: Battle | null;
  /** Quem você vence com mais folga: você ganhou mais do que perdeu, maior taxa de vitória sua. */
  fregues: Battle | null;
  /** Quem você mais enfrentou. */
  rival: Battle | null;
}

/**
 * Carrasco e freguês são pela TAXA de vitória, não pela contagem — pela
 * contagem, quem você mais enfrenta ganhava os dois títulos ao mesmo tempo.
 * Só entra quem tem saldo a favor de um lado (não há empate) e ao menos
 * MIN_GAMES jogos. A mesma pessoa nunca é carrasco e freguês.
 */
export function battleHighlights(battles: Battle[]): BattleHighlights {
  let carrasco: Battle | null = null, fregues: Battle | null = null, rival: Battle | null = null;
  for (const b of battles) {
    if (b.played >= MIN_GAMES && b.losses > b.wins && (!carrasco || b.pct < carrasco.pct || (b.pct === carrasco.pct && b.played > carrasco.played))) carrasco = b;
    if (b.played >= MIN_GAMES && b.wins > b.losses && (!fregues || b.pct > fregues.pct || (b.pct === fregues.pct && b.played > fregues.played))) fregues = b;
    if (!rival || b.played > rival.played) rival = b;
  }
  return { carrasco, fregues, rival };
}

export interface PartnerHighlights {
  /** Com quem você mais ganha: mais vitórias que derrotas, maior taxa. */
  best: Partnership | null;
  /** Com quem você mais perde: mais derrotas que vitórias, menor taxa. */
  worst: Partnership | null;
}

export function partnerHighlights(partnerships: Partnership[]): PartnerHighlights {
  let best: Partnership | null = null, worst: Partnership | null = null;
  for (const p of partnerships) {
    if (p.played < MIN_GAMES) continue;
    if (p.wins > p.losses && (!best || p.pct > best.pct || (p.pct === best.pct && p.played > best.played))) best = p;
    if (p.losses > p.wins && (!worst || p.pct < worst.pct || (p.pct === worst.pct && p.played > worst.played))) worst = p;
  }
  return { best, worst };
}
