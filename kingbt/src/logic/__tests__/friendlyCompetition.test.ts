import { countsForRanking, rankedCompetitions } from '../rankingScope';
import { extractPlayerGames, extractCompetitionGames } from '../formats';
import { buildRanking } from '../scoring';
import { computeAchievementStats } from '../achievementStats';
import { computeStreakHistory } from '../streak';
import { computeHallStats } from '../hallStats';
import { computeFormatStats } from '../formatStats';
import { computeBattles } from '../battles';
import { computeRivalries, computeGroupRivalries } from '../rivalries';
import { computeRankingDeltas } from '../rankingDelta';
import { havePlayedTogether } from '../playedWith';
import { unfinishedInSeason } from '../seasons';
import { playerXp } from '../playerLevel';
import type { Competition, Match } from '../types';

const match = (id: string, a: string, b: string, scoreA: number, scoreB: number): Match => ({
  id, stage: 'league', aId: a, bId: b, aSrc: null, bSrc: null, scoreA, scoreB,
});

const comp = (id: string, date: string, matches: Match[], over: Partial<Competition> = {}): Competition => ({
  id, name: id, format: 'liga', unit: 'individual', gender: 'misto', status: 'done', date,
  config: { rounds: 'single', groups: 2, qualifiers: 2, thirdPlace: false, winRule: { sets: 1, games: 6 } },
  competitors: [
    { id: 'me', name: 'Eu', short: 'EU', color: '#fff', members: ['me'] },
    { id: 'x', name: 'X', short: 'X', color: '#fff', members: ['x'] },
  ],
  matches, ...over,
});

const ranked = comp('oficial', '2026-09-01', [match('1', 'me', 'x', 6, 4)]);
const friendly = comp('amistosa', '2026-09-02',
  [match('2', 'me', 'x', 6, 0), match('3', 'me', 'x', 6, 1), match('4', 'me', 'x', 6, 2)],
  { countsForRanking: false });
const players = [
  { id: 'me', name: 'Eu', short: 'EU', color: '#fff' },
  { id: 'x', name: 'X', short: 'X', color: '#fff' },
];

describe('competição amistosa (countsForRanking: false)', () => {
  it('ausente ou true conta; só false deixa de contar', () => {
    expect(countsForRanking({})).toBe(true);
    expect(countsForRanking({ countsForRanking: true })).toBe(true);
    expect(countsForRanking({ countsForRanking: false })).toBe(false);
    expect(rankedCompetitions([ranked, friendly])).toEqual([ranked]);
  });

  it('não gera jogos para o ranking, mas a classificação interna da competição continua existindo', () => {
    expect(extractPlayerGames(friendly)).toEqual([]);
    expect(extractCompetitionGames(friendly)).toHaveLength(3);
    expect(extractPlayerGames(ranked)).toHaveLength(1);
  });

  it('ranking: vitórias, jogos e pontos ignoram a amistosa', () => {
    const all = [ranked, friendly].flatMap(extractPlayerGames);
    const r = buildRanking(players, all);
    const me = r.find(p => p.id === 'me')!;
    expect(me.played).toBe(1);
    expect(me.wins).toBe(1);
    expect(me.gamesPro).toBe(6);
    const onlyRanked = buildRanking(players, extractPlayerGames(ranked));
    expect(me.points).toBe(onlyRanked.find(p => p.id === 'me')!.points);
  });

  it('XP: o jogo da amistosa não entra na contagem de partidas e vitórias', () => {
    const stats = computeAchievementStats([ranked, friendly], 'me');
    expect(stats.totalMatches).toBe(1);
    expect(stats.totalWins).toBe(1);
    const withFriendly = playerXp(stats.totalMatches, undefined, null, { wins: stats.totalWins, events: stats.events ?? 0, rated: 0, achievementXp: 0 });
    const onlyRanked = computeAchievementStats([ranked], 'me');
    expect(withFriendly.xp).toBe(playerXp(onlyRanked.totalMatches, undefined, null, { wins: onlyRanked.totalWins, events: onlyRanked.events ?? 0, rated: 0, achievementXp: 0 }).xp);
  });

  it('conquistas: hat-trick, título, sequência e eventos não contam a amistosa', () => {
    const stats = computeAchievementStats([ranked, friendly], 'me');
    expect(stats.hatTrick).toBe(false);
    expect(stats.champCount).toBe(1);
    expect(stats.maxStreak).toBe(1);
    expect(stats.events).toBe(1);
    expect(stats.ligaWins).toBe(1);
    const onlyFriendly = computeAchievementStats([friendly], 'me');
    expect(onlyFriendly.totalWins).toBe(0);
    expect(onlyFriendly.champCount).toBe(0);
    expect(onlyFriendly.events).toBe(0);
    expect(onlyFriendly.unbeatable).toBe(false);
  });

  it('sequência, hall, formatos, confrontos e rivalidades ignoram a amistosa', () => {
    expect(computeStreakHistory([friendly], 'me').results).toEqual([]);
    expect(computeHallStats([friendly], 'me').events).toBe(0);
    expect(computeFormatStats([friendly], 'me')).toEqual([]);
    expect(computeBattles('me', [friendly])).toEqual([]);
    expect(computeRivalries('me', [friendly]).carrasco).toBeNull();
    expect(computeGroupRivalries([friendly])).toEqual([]);
    expect(computeBattles('me', [ranked, friendly])[0].played).toBe(1);
  });

  it('variação de posição não considera a amistosa como competição nova', () => {
    expect(computeRankingDeltas([ranked, friendly], players)).toEqual({});
  });

  it('avaliação dos colegas: "jogaram juntos" só vale em competição oficial', () => {
    expect(havePlayedTogether([friendly], 'me', 'x')).toBe(false);
    expect(havePlayedTogether([ranked], 'me', 'x')).toBe(true);
    expect(havePlayedTogether([ranked, friendly], 'me', 'x')).toBe(true);
  });

  it('encerrar a temporada não avisa sobre amistosa inacabada', () => {
    const open = comp('amistosa2', '2026-09-03', [match('5', 'me', 'x', 1, 0)], { countsForRanking: false, status: 'active' });
    expect(unfinishedInSeason([open], [], '2026-10-01')).toEqual([]);
    expect(unfinishedInSeason([{ ...open, countsForRanking: undefined }], [], '2026-10-01')).toHaveLength(1);
  });

  it('competições antigas (sem o campo) seguem contando normalmente', () => {
    const legacy = comp('legado', '2026-08-01', [match('9', 'me', 'x', 6, 3)]);
    expect('countsForRanking' in legacy).toBe(false);
    expect(extractPlayerGames(legacy)).toHaveLength(1);
    expect(computeAchievementStats([legacy], 'me').totalWins).toBe(1);
  });
});
