import { buildDoneItems, championItemId, doneItemId } from '@/logic/feedDone';
import type { Competition } from '@/logic/types';

const name = (id: string) => ({ a: 'Ana', b: 'Beto', c: 'Caio', d: 'Duda' } as Record<string, string>)[id] ?? id;

const super8 = (over: Partial<Competition> = {}): Competition => ({
  id: 'c1', name: 'Super 8', format: 'super8', unit: 'individual', gender: 'misto', status: 'done', date: '2026-09-14',
  config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: { sets: 1, games: 6 } },
  competitors: [],
  matches: [
    { id: 'm1', stage: 'group', teamA: ['a', 'b'], teamB: ['c', 'd'], scoreA: 1, scoreB: 0, playedAt: '2026-09-14T21:10:00.000Z' },
    { id: 'm2', stage: 'group', teamA: ['a', 'c'], teamB: ['b', 'd'], scoreA: 1, scoreB: 0, playedAt: '2026-09-14T21:20:00.000Z' },
  ] as any,
  ...over,
} as Competition);

describe('buildDoneItems', () => {
  it('gera campeão + finalizado para competição encerrada, campeão 1s à frente', () => {
    const items = buildDoneItems([super8()], name);
    expect(items.map(i => i.id)).toEqual([championItemId('c1'), doneItemId('c1')]);
    expect(items[0].kind).toBe('champion');
    expect(items[0].championName).toBe('Ana');
    expect(items[0].date.getTime() - items[1].date.getTime()).toBe(1000);
    expect(items[1].date.toISOString()).toBe('2026-09-14T21:20:00.000Z');
  });
  it('vale para qualquer formato, inclusive avulso', () => {
    expect(buildDoneItems([super8({ format: 'avulso' })], name)).toHaveLength(2);
  });
  it('ignora em andamento, amistosos e sem campeão', () => {
    expect(buildDoneItems([super8({ status: 'active' })], name)).toEqual([]);
    expect(buildDoneItems([super8({ isFriendly: true })], name)).toEqual([]);
    expect(buildDoneItems([super8({ matches: [] })], name)).toEqual([]);
  });
});
