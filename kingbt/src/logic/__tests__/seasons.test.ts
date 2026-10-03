import {
  parseSeasons, currentSeasonComps, competitionsForPeriod, buildSeason, nextDay, unfinishedInSeason, currentSeasonNumber,
} from '@/logic/seasons';
import type { Competition } from '@/logic/types';

const comp = (id: string, date: string, status = 'done') => ({ id, date, status, matches: [] } as unknown as Competition);
const season = (number: number, endedAt: string) => ({ id: `s${number}`, number, startedAt: null, endedAt, ranking: [] });

describe('temporadas', () => {
  const comps = [comp('a', '2026-03-10'), comp('b', '2026-06-30'), comp('c', '2026-07-01'), comp('d', '2026-09-20')];

  it('sem temporada encerrada, tudo é da temporada atual', () => {
    expect(currentSeasonComps(comps, []).map(c => c.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(currentSeasonNumber([])).toBe(1);
  });

  it('depois do encerramento só contam os jogos posteriores; o dia do encerramento é da antiga', () => {
    const ss = [season(1, '2026-06-30')];
    expect(currentSeasonComps(comps, ss).map(c => c.id)).toEqual(['c', 'd']);
    expect(currentSeasonNumber(ss)).toBe(2);
  });

  it('usa o encerramento mais recente mesmo se a lista vier fora de ordem', () => {
    const ss = [season(2, '2026-08-01'), season(1, '2026-06-30')];
    expect(currentSeasonComps(comps, ss).map(c => c.id)).toEqual(['d']);
  });

  it('período: acumulado ignora as temporadas; mês filtra dentro da temporada', () => {
    const ss = [season(1, '2026-06-30')];
    const now = new Date('2026-09-25T12:00:00');
    expect(competitionsForPeriod(comps, 'acumulado', ss, now)).toHaveLength(4);
    expect(competitionsForPeriod(comps, 'temporada', ss, now).map(c => c.id)).toEqual(['c', 'd']);
    expect(competitionsForPeriod(comps, 'mes', ss, now).map(c => c.id)).toEqual(['d']);
  });

  it('buildSeason numera e começa no dia seguinte ao fim da anterior', () => {
    const first = buildSeason([], [], '2026-06-30');
    expect(first).toMatchObject({ id: 's1', number: 1, startedAt: null, endedAt: '2026-06-30' });
    const second = buildSeason([first], [], '2026-12-15');
    expect(second).toMatchObject({ id: 's2', number: 2, startedAt: '2026-07-01', endedAt: '2026-12-15' });
  });

  it('nextDay vira mês e ano', () => {
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(nextDay('2026-02-28')).toBe('2026-03-01');
  });

  it('avisa das competições não concluídas até hoje', () => {
    const cs = [comp('a', '2026-09-01', 'active'), comp('b', '2026-09-02', 'done'), comp('c', '2026-10-05', 'upcoming')];
    expect(unfinishedInSeason(cs, [], '2026-09-30').map(c => c.id)).toEqual(['a']);
  });

  it('parseSeasons tolera lixo e ordena', () => {
    expect(parseSeasons(undefined)).toEqual([]);
    expect(parseSeasons([null, { endedAt: 'x' }, { number: 2, endedAt: '2026-08-01' }, { number: 1, endedAt: '2026-06-30', ranking: [{ id: 'p', name: 'Ana', points: 12.5 }] }])
      .map(s => s.number)).toEqual([1, 2]);
    expect(parseSeasons([{ number: 1, endedAt: '2026-06-30', ranking: [{ id: 'p', name: 'Ana', points: 12.5 }] }])[0].ranking[0])
      .toMatchObject({ id: 'p', name: 'Ana', points: 12.5, wins: 0 });
  });
});

import { seasonPlacements } from '@/logic/seasons';
import { ACHIEVEMENTS } from '@/constants/achievements';

describe('campeão e vice de temporada', () => {
  const row = (id: string) => ({ id, name: id, points: 10, played: 1, wins: 1, losses: 0, gamesPro: 6, gamesCon: 0 });
  const ss = [
    { ...season(1, '2026-06-30'), ranking: [row('ana'), row('bia'), row('cris')] },
    { ...season(2, '2026-12-30'), ranking: [row('bia'), row('ana')] },
  ];
  it('conta títulos e vices', () => {
    expect(seasonPlacements(ss, 'ana')).toMatchObject({ titles: 1, runnerUps: 1 });
    expect(seasonPlacements(ss, 'bia')).toMatchObject({ titles: 1, runnerUps: 1 });
    expect(seasonPlacements(ss, 'cris')).toMatchObject({ titles: 0, runnerUps: 0, entries: [] });
  });
  it('a conquista Rei da Colmeia desbloqueia com 1 título', () => {
    const a = ACHIEVEMENTS.find(x => x.id === 'season_champion')!;
    const base = { totalWins: 0, totalMatches: 0, currentStreak: 0, maxStreak: 0, currentRating: 0, champCount: 0, super8Wins: 0, ligaWins: 0, avulsoWins: 0, hatTrick: false, unbeatable: false, perfectPartner: false, sharesCount: 0 };
    expect(a.progress({ ...base })).toBe(0);
    expect(a.progress({ ...base, seasonTitles: 1 })).toBe(1);
  });
  it('a conquista Vice da Colmeia desbloqueia com 1 segundo lugar', () => {
    const a = ACHIEVEMENTS.find(x => x.id === 'season_runnerup')!;
    const base = { totalWins: 0, totalMatches: 0, currentStreak: 0, maxStreak: 0, currentRating: 0, champCount: 0, super8Wins: 0, ligaWins: 0, avulsoWins: 0, hatTrick: false, unbeatable: false, perfectPartner: false, sharesCount: 0 };
    expect(a.progress({ ...base })).toBe(0);
    expect(a.progress({ ...base, seasonRunnerUps: 1 })).toBe(1);
  });
});
