import { computeHallStats } from '@/logic/hallStats';
import type { Competition } from '@/logic/types';

const m = (a: string[], b: string[], sa: number, sb: number) => ({ id: Math.random().toString(36), stage: 'rotating', teamA: a, teamB: b, scoreA: sa, scoreB: sb, sets: [{ a: sa, b: sb }] });
const comp = (over: Partial<Competition>): Competition => ({
  id: 'c' + Math.random().toString(36).slice(2), name: 'c', format: 'super8', unit: 'individual', gender: 'misto', status: 'done', date: '2026-01-01',
  competitors: [], config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: { sets: 1, games: 6 } }, matches: [], ...over,
} as unknown as Competition);

// 4 jogadores em rodízio: "a" ganha sempre → 1º; "b" 2º; "c" 3º; "d" 4º
const ranked = (date: string, status: any = 'done') => comp({
  date, status,
  matches: [
    m(['a', 'b'], ['c', 'd'], 6, 2),
    m(['a', 'c'], ['b', 'd'], 6, 3),
    m(['a', 'd'], ['b', 'c'], 6, 4),
  ] as any,
});

describe('computeHallStats', () => {
  it('conta eventos, colocação no Super 8 e pódios', () => {
    const c = ranked('2026-01-01');
    expect(computeHallStats([c], 'a')).toMatchObject({ events: 1, super8Gold: 1, podiums: 1 });
    expect(computeHallStats([c], 'd').super8Gold).toBe(0);
  });
  it('só competições encerradas contam colocação; em andamento conta só como evento', () => {
    const c = ranked('2026-01-01', 'active');
    expect(computeHallStats([c], 'a')).toMatchObject({ events: 1, super8Gold: 0, podiums: 0 });
  });
  it('invicto pede o mínimo de jogos e nenhuma derrota', () => {
    const c = ranked('2026-01-01');
    expect(computeHallStats([c], 'a').invictos).toBe(1);   // 3 vitórias
    expect(computeHallStats([c], 'b').invictos).toBe(0);
    const curto = comp({ matches: [m(['a', 'b'], ['c', 'd'], 6, 2)] as any });
    expect(computeHallStats([curto], 'a').invictos).toBe(0); // 1 jogo só
  });
  it('rei do saldo: melhor saldo de games entre quem jogou o mínimo', () => {
    const c = ranked('2026-01-01');
    expect(computeHallStats([c], 'a').saldoKing).toBe(1);
    expect(computeHallStats([c], 'd').saldoKing).toBe(0);
  });
  it('sequência de títulos: 3 seguidas; uma derrota no meio zera', () => {
    const w = (d: string) => ranked(d);
    expect(computeHallStats([w('2026-01-01'), w('2026-02-01'), w('2026-03-01')], 'a').titleStreakMax).toBe(3);
    const perdeu = comp({ date: '2026-02-01', matches: [m(['b', 'c'], ['a', 'd'], 6, 1), m(['b', 'd'], ['a', 'c'], 6, 1), m(['b', 'a'], ['c', 'd'], 6, 1)] as any });
    expect(computeHallStats([w('2026-01-01'), perdeu, w('2026-03-01')], 'a').titleStreakMax).toBe(1);
  });
  it('amistosos não contam como evento; sem id devolve zeros', () => {
    expect(computeHallStats([{ ...ranked('2026-01-01'), isFriendly: true } as Competition], 'a').events).toBe(0);
    expect(computeHallStats([ranked('2026-01-01')], '').events).toBe(0);
  });
});
