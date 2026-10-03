import { playersToRate } from '@/logic/ratePrompt';
import type { Competition, Match } from '@/logic/types';

const match = (a: string[], b: string[], sa: number | null = 6, sb: number | null = 4): Match => ({
  id: Math.random().toString(36).slice(2), stage: 'rotating', scoreA: sa, scoreB: sb, teamA: a, teamB: b,
});
const comp = (over: Partial<Competition> & { matches: Match[] }): Competition => ({
  id: 'c1', name: '12ª Rodada', format: 'super8', unit: 'individual', gender: 'misto', status: 'done', date: '2026-10-01',
  config: { rounds: 'single', groups: 2, qualifiers: 2, thirdPlace: false, winRule: { sets: 1, games: 6 } },
  competitors: [], ...over,
});

const TODAY = '2026-10-03';

describe('playersToRate', () => {
  const c = comp({ matches: [match(['eu', 'ana'], ['bia', 'cris']), match(['eu', 'bia'], ['dan', 'ana'])] });
  it('lista quem jogou com ou contra você, sem repetir', () => {
    expect(playersToRate([c], 'eu', [], TODAY).map(i => i.playerId).sort()).toEqual(['ana', 'bia', 'cris', 'dan']);
  });
  it('tira quem você já avaliou', () => {
    expect(playersToRate([c], 'eu', ['ana', 'bia'], TODAY).map(i => i.playerId).sort()).toEqual(['cris', 'dan']);
  });
  it('só competições encerradas e recentes', () => {
    expect(playersToRate([comp({ ...c, status: 'active' })], 'eu', [], TODAY)).toEqual([]);
    expect(playersToRate([comp({ ...c, date: '2026-09-01' })], 'eu', [], TODAY)).toEqual([]);
    expect(playersToRate([comp({ ...c, date: '2026-09-20' })], 'eu', [], TODAY)).toHaveLength(4); // 13 dias
  });
  it('competição amistosa e jogo sem placar não entram', () => {
    expect(playersToRate([comp({ ...c, countsForRanking: false })], 'eu', [], TODAY)).toEqual([]);
    expect(playersToRate([comp({ matches: [match(['eu'], ['ana'], null, null)] })], 'eu', [], TODAY)).toEqual([]);
  });
  it('quem não jogou não vê ninguém; competição dispensada some', () => {
    expect(playersToRate([c], 'fora', [], TODAY)).toEqual([]);
    expect(playersToRate([c], 'eu', [], TODAY, 14, ['c1'])).toEqual([]);
    expect(playersToRate([c], null, [], TODAY)).toEqual([]);
  });
  it('liga o colega à competição mais recente em que se encontraram', () => {
    const velha = comp({ id: 'old', name: 'Antiga', date: '2026-09-25', matches: [match(['eu'], ['ana'])] });
    const nova = comp({ id: 'new', name: 'Nova', date: '2026-10-02', matches: [match(['eu'], ['ana'])] });
    expect(playersToRate([velha, nova], 'eu', [], TODAY)).toEqual([{ playerId: 'ana', compId: 'new', compName: 'Nova', compDate: '2026-10-02' }]);
  });
});

describe('playersToRate — competição em andamento', () => {
  const active = comp({ status: 'active', matches: [match(['eu'], ['ana']), match(['eu'], ['bia'], null, null)] });
  it('só entra com includeActive, e só jogos que já têm placar', () => {
    expect(playersToRate([active], 'eu', [], TODAY)).toEqual([]);
    expect(playersToRate([active], 'eu', [], TODAY, 30, [], true).map(i => i.playerId)).toEqual(['ana']);
  });
});
