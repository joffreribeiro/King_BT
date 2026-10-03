import { rankGap, myPendingMatches, pendingJoinRequests, feedLine } from '@/logic/homeSummary';
import type { Competition } from '@/logic/types';

const line = (id: string, points: number, played = 3) => ({ id, points, played });
const RANK = [line('a', 10), line('b', 9), line('c', 8), line('d', 7), line('e', 6), line('f', 4.5), line('g', 0, 0)];

describe('rankGap', () => {
  it('sem jogos ou fora do ranking não gera frase', () => {
    expect(rankGap(RANK, 'g')).toBeNull();
    expect(rankGap(RANK, 'zzz')).toBeNull();
    expect(rankGap(RANK, null)).toBeNull();
  });

  it('líder mostra a vantagem sobre o 2º', () => {
    expect(rankGap(RANK, 'a')).toEqual({ kind: 'leader', position: 1, points: 10, lead: 1 });
  });

  it('dentro do Top 5 aponta o líder como alvo', () => {
    expect(rankGap(RANK, 'e')).toEqual({ kind: 'inside', position: 5, points: 6, target: 10 });
  });

  it('fora do Top 5 calcula o que falta para o 5º', () => {
    expect(rankGap(RANK, 'f')).toMatchObject({ kind: 'outside', position: 6, gap: 1.5, tied: false });
  });

  it('empate em pontos com o 5º é sinalizado', () => {
    const r = [...RANK.slice(0, 5), line('x', 6)];
    expect(rankGap(r, 'x')).toMatchObject({ kind: 'outside', gap: 0, tied: true });
  });

  it('grupo pequeno: Top 5 vira o último da lista', () => {
    expect(rankGap([line('a', 5), line('b', 3)], 'b')).toMatchObject({ kind: 'inside', position: 2 });
  });
});

const comp = (over: Partial<Competition>): Competition => ({
  id: 'c1', name: 'Super 8', status: 'active', competitors: [], matches: [], ...over,
} as unknown as Competition);

describe('myPendingMatches', () => {
  it('conta jogos sem placar em que o jogador está (time, competidor e jogador direto)', () => {
    const c = comp({
      competitors: [{ id: 'd0', name: 'D0', short: 'D0', color: '#000', members: ['me', 'p2'] }] as any,
      matches: [
        { id: '1', scoreA: null, scoreB: null, aId: 'd0', bId: 'd1' },
        { id: '2', scoreA: null, scoreB: null, teamA: ['x', 'y'], teamB: ['me', 'z'] },
        { id: '3', scoreA: 6, scoreB: 3, aId: 'me', bId: 'p9' },
        { id: '4', scoreA: null, scoreB: null, aId: 'p8', bId: 'p9' },
      ] as any,
    });
    expect(myPendingMatches([c], 'me')).toEqual({ count: 2, compId: 'c1', compName: 'Super 8' });
  });

  it('ignora competições encerradas e usuário sem jogador', () => {
    const c = comp({ status: 'done', matches: [{ id: '1', scoreA: null, scoreB: null, aId: 'me', bId: 'p' }] as any });
    expect(myPendingMatches([c], 'me').count).toBe(0);
    expect(myPendingMatches([c], null).count).toBe(0);
  });
});

describe('pendingJoinRequests', () => {
  it('soma solicitações de todas as competições', () => {
    const r = { uid: 'u', name: 'N', requestedAt: '' };
    const cs = [comp({ id: 'a' }), comp({ id: 'b', joinRequests: [r, r] }), comp({ id: 'c', joinRequests: [r] })];
    expect(pendingJoinRequests(cs)).toEqual({ count: 3, compId: 'b' });
  });
});

describe('feedLine', () => {
  it('resume cada tipo de item do feed', () => {
    expect(feedLine({ type: 'match_result', compName: 'Liga', sideA: { name: 'A / B', score: 1 }, sideB: { name: 'C / D', score: 0 } }))
      .toEqual({ emoji: '🎾', title: 'A / B 1–0 C / D', sub: 'Liga' });
    expect(feedLine({ type: 'rank_change', compName: '', playerName: 'Ana', oldPos: 5, newPos: 2, newPoints: 87.4 }))
      .toMatchObject({ title: 'Ana subiu no ranking', sub: 'Agora em #2 · 87,4 pts' });
    expect(feedLine({ type: 'rank_change', compName: '', playerName: 'Ana', oldPos: 2, newPos: 4 }).title).toBe('Ana caiu no ranking');
    expect(feedLine({ type: 'comp_done', compName: 'Super 8', playerName: 'Ana' })).toMatchObject({ title: 'Super 8 foi finalizado', sub: 'Campeão: Ana' });
    expect(feedLine({ type: 'champion', compName: 'Super 8', playerName: 'Ana' })).toMatchObject({ title: 'Ana é campeão', sub: 'Super 8' });
    expect(feedLine({ type: 'rivalry_milestone', compName: '', milestoneEmoji: '💥', milestoneTitle: 'Sequência quebrada!', milestoneDesc: 'X parou Y' }))
      .toEqual({ emoji: '💥', title: 'Sequência quebrada!', sub: 'X parou Y' });
  });
});

describe('rankGap — mínimo de jogos', () => {
  it('ignora quem está em classificação: posição e topo contam só os classificados', () => {
    const ranking = [
      { id: 'a', points: 30, played: 10 },
      { id: 'b', points: 20, played: 8 },
      { id: 'novo', points: 40, played: 1, provisional: true },
    ];
    expect(rankGap(ranking, 'b')).toMatchObject({ kind: 'inside', position: 2, target: 30 });
    expect(rankGap(ranking, 'novo')).toBeNull();
  });
});
