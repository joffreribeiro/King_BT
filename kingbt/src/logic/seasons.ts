import type { Competition } from './types';

/** Uma linha do ranking final gravado ao encerrar a temporada. */
export interface SeasonRow {
  id: string;
  name: string;
  points: number;
  played: number;
  wins: number;
  losses: number;
  gamesPro: number;
  gamesCon: number;
}

/**
 * Temporada encerrada. O ranking final é gravado (foto do momento) para não
 * mudar se alguém corrigir um placar antigo depois — vale o que o grupo viu.
 */
export interface Season {
  id: string;
  /** 1, 2, 3… na ordem em que foram encerradas. */
  number: number;
  /** "YYYY-MM-DD" do primeiro dia (dia seguinte ao fim da anterior); null na primeira. */
  startedAt: string | null;
  /** "YYYY-MM-DD" do dia do encerramento. Jogos desse dia ainda são desta temporada. */
  endedAt: string;
  ranking: SeasonRow[];
}

/** Período do ranking: só este mês, a temporada atual, ou tudo somado (todas as temporadas). */
export type RankingPeriod = 'mes' | 'temporada' | 'acumulado';

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

/** Lê o campo `seasons` do doc do grupo, tolerando ausência e lixo. Ordem: mais antiga primeiro. */
export function parseSeasons(raw: unknown): Season[] {
  if (!Array.isArray(raw)) return [];
  const out: Season[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const endedAt = str(o.endedAt);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endedAt)) continue;
    out.push({
      id: str(o.id, endedAt),
      number: num(o.number, out.length + 1),
      startedAt: typeof o.startedAt === 'string' ? o.startedAt : null,
      endedAt,
      ranking: Array.isArray(o.ranking)
        ? (o.ranking as Record<string, unknown>[]).map(x => ({
            id: str(x?.id), name: str(x?.name, '?'),
            points: num(x?.points), played: num(x?.played), wins: num(x?.wins), losses: num(x?.losses),
            gamesPro: num(x?.gamesPro), gamesCon: num(x?.gamesCon),
          }))
        : [],
    });
  }
  return out.sort((a, b) => a.number - b.number);
}

/** Número da temporada em andamento (a próxima a ser encerrada). */
export const currentSeasonNumber = (seasons: Season[]) => seasons.length + 1;

/** Último dia da temporada anterior, ou null se ainda não houve encerramento. */
export function lastSeasonEnd(seasons: Season[]): string | null {
  return seasons.reduce<string | null>((m, s) => (m == null || s.endedAt > m ? s.endedAt : m), null);
}

/** Competições da temporada em andamento: as posteriores ao dia do último encerramento. */
export function currentSeasonComps(competitions: Competition[], seasons: Season[]): Competition[] {
  const end = lastSeasonEnd(seasons);
  return end ? competitions.filter(c => (c.date ?? '') > end) : competitions;
}

/** Competições do período escolhido no ranking. */
export function competitionsForPeriod(
  competitions: Competition[], period: RankingPeriod, seasons: Season[], now = new Date(),
): Competition[] {
  if (period === 'acumulado') return competitions;
  const inSeason = currentSeasonComps(competitions, seasons);
  if (period === 'temporada') return inSeason;
  return inSeason.filter(c => {
    const d = new Date(c.date + 'T12:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

/** "YYYY-MM-DD" de hoje no fuso local. */
export function todayIso(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Dia seguinte a "YYYY-MM-DD". */
export function nextDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return todayIso(d);
}

/**
 * Competições não concluídas que cairiam na temporada que está sendo encerrada
 * (data até hoje). Elas ficam nela — o admin deve ser avisado antes de confirmar.
 */
export function unfinishedInSeason(competitions: Competition[], seasons: Season[], today = todayIso()): Competition[] {
  return currentSeasonComps(competitions, seasons).filter(c => c.countsForRanking !== false).filter(c => c.status !== 'done' && (c.date ?? '') <= today);
}

/** Monta a temporada a gravar. `ranking` já vem ordenado do 1º ao último. */
export function buildSeason(seasons: Season[], ranking: SeasonRow[], today = todayIso()): Season {
  const end = lastSeasonEnd(seasons);
  const number = currentSeasonNumber(seasons);
  return {
    id: `s${number}`,
    number,
    startedAt: end ? nextDay(end) : null,
    endedAt: today,
    ranking,
  };
}

/** Uma colocação de pódio (1º ou 2º) que o jogador teve numa temporada encerrada. */
export interface SeasonPlacement {
  number: number;
  pos: 1 | 2;
  points: number;
}

/** Títulos e vices de temporada de um jogador, do mais antigo ao mais recente. */
export function seasonPlacements(seasons: Season[], playerId: string): { titles: number; runnerUps: number; entries: SeasonPlacement[] } {
  const entries: SeasonPlacement[] = [];
  for (const s of seasons) {
    const i = s.ranking.findIndex(r => r.id === playerId);
    if (i === 0 || i === 1) entries.push({ number: s.number, pos: (i + 1) as 1 | 2, points: s.ranking[i].points });
  }
  return {
    titles: entries.filter(e => e.pos === 1).length,
    runnerUps: entries.filter(e => e.pos === 2).length,
    entries,
  };
}
