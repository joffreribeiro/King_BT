import type { Player, PlayerStat, RankedPlayer } from './types';
import { DEFAULT_SCORING, type ScoringConfig } from './scoringConfig';

export type { PlayerStat, RankedPlayer };

/** Épsilon para comparar pontos/GA em ponto flutuante. */
const EPS = 1e-9;

/**
 * Um jogo já resolvido, pronto para virar estatística.
 *
 * `winner` e `gamesA`/`gamesB` são grandezas diferentes, e estarem separados é
 * o ponto deste tipo: quem venceu sai do placar da PARTIDA (sets vencidos,
 * `Match.scoreA`/`scoreB`), enquanto GP/GC e o GA saem dos GAMES de cada set.
 * Deduzir o vencedor dos games dá resultado errado toda vez que o vencedor em
 * sets soma menos games que o perdedor — 7-6, 0-6, 7-6 é vitória por 2x1 com
 * 14 games contra 18 — e apaga o jogo inteiro quando os games empatam
 * (6-4, 3-6, 7-6 → 16 a 16). Era exatamente o que acontecia quando os dois
 * viajavam no mesmo par de campos.
 */
export interface PlayerGame {
  teamA: string[];
  teamB: string[];
  /** Games de cada lado (soma dos sets). Sem detalhe set a set, é o próprio placar da partida. */
  gamesA: number;
  gamesB: number;
  /**
   * Lado vencedor da partida. Nunca derivado de `gamesA`/`gamesB`.
   * `'draw'` — placar empatado na partida (comum no formato avulso/rodízio,
   * um set só até N games sem desempate) — conta como jogo disputado (J e
   * GA sobem para os dois lados), mas ninguém ganha V nem leva D.
   */
  winner: 'A' | 'B' | 'draw';
  /** Competição de origem — usada para contar eventos distintos. */
  compId?: string;
}

/** Forma canônica de estatísticas agregadas de um competidor. */
export interface ScoreStats {
  played: number;
  wins: number;
  gamesPro: number;
  gamesCon: number;
}

/** Linha mínima para ordenação de ranking/classificação. */
export interface RankRow {
  id: string;
  points: number;
  sg: number;
  ga: number;
  wins: number;
}

export function blankStat(): PlayerStat {
  return { id: '', played: 0, wins: 0, losses: 0, gamesPro: 0, gamesCon: 0, events: 0 };
}

/**
 * GA = GamesPró ÷ GamesContra (nunca divide por 0, máximo 9.99)
 *
 * DECISÃO PENDENTE (registrada 21/09/2026, não resolvida — mantida assim de
 * propósito): quem jogou uma única partida 6×0 satura o GA em 9,99 e sobe
 * ao topo do ranking, à frente de quem jogou a temporada inteira com GA
 * mais baixo mas consistente. O usuário confirmou "deixar como está por
 * agora" ao ser perguntado — não mexer na fórmula de ranking em produção
 * sem decidir antes um critério mínimo (quantos jogos pro GA valer? o que
 * acontece com o GA antes disso?). Revisitar se o assunto voltar à tona.
 */
export function gameAverage(s: Pick<ScoreStats, 'gamesPro' | 'gamesCon'>): number {
  if (s.gamesCon === 0) return s.gamesPro > 0 ? 9.99 : 0;
  return Math.min(9.99, s.gamesPro / s.gamesCon);
}

/**
 * Pts = (V×winCoef) + (J×playedCoef) + (GA×gaCoef) + (Eventos×eventCoef).
 * Coeficientes vêm do cfg (padrão: V×3 + J×0,5 + GA×2, sem bônus de eventos).
 * `events` é opcional pra não quebrar chamadas que só têm ScoreStats (sem
 * contagem de competições distintas) — nesse caso o termo de eventos é 0.
 */
export function statPoints(s: ScoreStats & { events?: number }, cfg: ScoringConfig = DEFAULT_SCORING): number {
  return s.wins * cfg.winCoef + s.played * cfg.playedCoef + gameAverage(s) * cfg.gaCoef
    + (s.events ?? 0) * (cfg.eventCoef ?? 0);
}

/**
 * Base transitiva do desempate: pontos → saldo de games → GA → vitórias →
 * alfabético. Nunca usa confronto direto — ver `compareRank` para o porquê.
 */
function compareRankBase(a: RankRow, b: RankRow, nameOf: (id: string) => string): number {
  const byPts = b.points - a.points;  if (Math.abs(byPts) > EPS) return byPts;
  const bySg  = b.sg   - a.sg;         if (bySg  !== 0) return bySg;
  const byGa  = b.ga   - a.ga;         if (Math.abs(byGa) > EPS) return byGa;
  const byW   = b.wins - a.wins;       if (byW   !== 0) return byW;
  return nameOf(a.id).localeCompare(nameOf(b.id), 'pt-BR', { sensitivity: 'base' });
}

/**
 * Comparador único de ranking/classificação. Ordem de desempate:
 * pontos → confronto direto → saldo de games → GA → vitórias → alfabético.
 * @param h2h  -1 se A vem antes, 1 se B vem antes, 0 empate.
 * @param nameOf nome usado no desempate alfabético final.
 *
 * @deprecated usar `sortRanking`, que aplica o confronto direto só DENTRO de
 * grupos empatados em pontos, em vez de dentro do comparator geral do sort.
 * Confronto direto não é transitivo (A pode vencer B, B vencer C, C vencer
 * A) — um comparator não-transitivo passado pro Array.sort quebra a
 * invariante que o algoritmo de ordenação pressupõe, e diferentes motores
 * JS podem devolver ordens diferentes para a MESMA entrada. Mantido só para
 * não quebrar quem ainda importa `compareRank` diretamente.
 */
export function compareRank(
  a: RankRow,
  b: RankRow,
  h2h: (idA: string, idB: string) => number,
  nameOf: (id: string) => string,
): number {
  const byBase = compareRankBase(a, b, nameOf);
  if (Math.abs(a.points - b.points) > EPS) return byBase; // pontos decidem antes de olhar h2h
  const byH2H = h2h(a.id, b.id); if (byH2H !== 0) return byH2H;
  return byBase;
}

/**
 * Ordena por `compareRankBase` (transitivo) e só then aplica confronto
 * direto como micro-desempate DENTRO de cada grupo de jogadores empatados
 * em pontos — nunca como critério do comparator geral do sort. Dentro do
 * grupo, cada jogador soma quantos confrontos diretos venceu contra os
 * OUTROS do mesmo grupo; empates nesse placar (inclusive ciclos do tipo
 * A>B>C>A, onde não existe "o melhor" por H2H) caem de volta nos critérios
 * transitivos, que sempre desempatam até o nome.
 */
export function sortRanking<T extends RankRow>(
  rows: T[],
  h2h: (idA: string, idB: string) => number,
  nameOf: (id: string) => string,
): T[] {
  const sorted = [...rows].sort((a, b) => compareRankBase(a, b, nameOf));

  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && Math.abs(sorted[j].points - sorted[i].points) <= EPS) j++;
    if (j - i > 1) {
      const group = sorted.slice(i, j);
      const ids = group.map(r => r.id);
      const h2hScore = new Map<string, number>();
      for (const id of ids) {
        let score = 0;
        for (const other of ids) {
          if (other === id) continue;
          const cmp = h2h(id, other); // -1 = id melhor, 1 = other melhor, 0 = empate/não jogaram
          score -= cmp;
        }
        h2hScore.set(id, score);
      }
      group.sort((a, b) => {
        const byH2H = (h2hScore.get(b.id) ?? 0) - (h2hScore.get(a.id) ?? 0);
        if (byH2H !== 0) return byH2H;
        return compareRankBase(a, b, nameOf);
      });
      for (let k = i; k < j; k++) sorted[k] = group[k - i];
    }
    i = j;
  }
  return sorted;
}

export function applyGame(
  statsMap: Record<string, PlayerStat>,
  game: PlayerGame
): void {
  const isDraw = game.winner === 'draw';
  const aWin = game.winner === 'A';
  for (const id of game.teamA) {
    if (!statsMap[id]) statsMap[id] = { ...blankStat(), id };
    const s = statsMap[id];
    s.played++; s.gamesPro += game.gamesA; s.gamesCon += game.gamesB;
    if (!isDraw) { if (aWin) s.wins++; else s.losses++; }
  }
  for (const id of game.teamB) {
    if (!statsMap[id]) statsMap[id] = { ...blankStat(), id };
    const s = statsMap[id];
    s.played++; s.gamesPro += game.gamesB; s.gamesCon += game.gamesA;
    if (!isDraw) { if (aWin) s.losses++; else s.wins++; }
  }
}

export function buildRanking(
  players: Player[],
  games: PlayerGame[],
  cfg: ScoringConfig = DEFAULT_SCORING,
): RankedPlayer[] {
  const map: Record<string, PlayerStat> = {};
  players.forEach(p => { map[p.id] = { ...blankStat(), id: p.id }; });
  games.forEach(g => applyGame(map, g));

  // Eventos = nº de competições distintas em que o jogador teve pelo menos
  // 1 jogo válido (mesma base de dados de V/J/GA — sem campo novo). Jogos
  // sem compId (chamadores antigos) simplesmente não contam pra isso.
  const eventsByPlayer = new Map<string, Set<string>>();
  games.forEach(g => {
    if (!g.compId) return;
    [...g.teamA, ...g.teamB].forEach(id => {
      if (!eventsByPlayer.has(id)) eventsByPlayer.set(id, new Set());
      eventsByPlayer.get(id)!.add(g.compId!);
    });
  });
  eventsByPlayer.forEach((comps, id) => {
    if (map[id]) map[id].events = comps.size;
  });

  function h2h(idA: string, idB: string): number {
    let wA = 0, wB = 0;
    games.forEach(g => {
      const aInA = g.teamA.includes(idA), bInA = g.teamA.includes(idB);
      const aInB = g.teamB.includes(idA), bInB = g.teamB.includes(idB);
      if ((aInA && bInA) || (aInB && bInB)) return; // mesmo time
      if (g.winner === 'draw') return; // empate não decide confronto direto
      const aWon = g.winner === 'A';
      if (aInA && bInB) { if (aWon) wA++; else wB++; }
      else if (aInB && bInA) { if (!aWon) wA++; else wB++; }
    });
    if (wA !== wB) return wA > wB ? -1 : 1;
    return 0;
  }

  const ranked = players.map(p => {
    const s = map[p.id];
    const sg = s.gamesPro - s.gamesCon;
    const ga = gameAverage(s);
    return {
      ...p, ...s, sg, ga,
      winRate: s.played ? Math.round((s.wins / s.played) * 100) : 0,
      points: Math.round(statPoints(s, cfg) * 100) / 100,
    } as RankedPlayer;
  });

  // Map em vez de find linear dentro do comparador: um comparator roda
  // O(n log n) vezes, e cada find linear era mais um O(n) — O(n² log n) no
  // total pra montar só os nomes do desempate alfabético.
  const nameById = new Map(ranked.map(r => [r.id, r.name]));
  const nameOf = (id: string) => nameById.get(id) ?? id;
  return sortRanking(ranked, h2h, nameOf);
}
