import { havePlayedTogether } from '@/logic/playedWith';
import type { Competition } from '@/logic/types';

const comp = (matches: any[], competitors: any[] = []) => ({ id: 'c', matches, competitors } as unknown as Competition);

describe('havePlayedTogether', () => {
  it('duplas: juntos ou contra contam', () => {
    const c = [comp([{ id: '1', teamA: ['me', 'p1'], teamB: ['x', 'y'], scoreA: 6, scoreB: 3 }])];
    expect(havePlayedTogether(c, 'me', 'p1')).toBe(true);
    expect(havePlayedTogether(c, 'me', 'x')).toBe(true);
    expect(havePlayedTogether(c, 'me', 'zzz')).toBe(false);
  });
  it('individual', () => {
    const c = [comp([{ id: '1', aId: 'me', bId: 'q', scoreA: 6, scoreB: 4 }])];
    expect(havePlayedTogether(c, 'me', 'q')).toBe(true);
  });
  it('duplas fixas resolvem os membros do time', () => {
    const c = [comp([{ id: '1', aId: 't1', bId: 't2', scoreA: 6, scoreB: 4 }], [
      { id: 't1', members: ['me', 'p1'] }, { id: 't2', members: ['x', 'y'] },
    ])];
    expect(havePlayedTogether(c, 'me', 'y')).toBe(true);
    expect(havePlayedTogether(c, 'p1', 'x')).toBe(true);
  });
  it('sem placar não vale; si mesmo não vale', () => {
    const c = [comp([{ id: '1', aId: 'me', bId: 'q', scoreA: null, scoreB: null }])];
    expect(havePlayedTogether(c, 'me', 'q')).toBe(false);
    expect(havePlayedTogether([comp([{ id: '1', aId: 'me', bId: 'q', scoreA: 1, scoreB: 0 }])], 'me', 'me')).toBe(false);
  });
});
