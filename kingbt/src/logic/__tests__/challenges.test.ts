import {
  newChallenge, parseChallenge, isExpired, effectiveStatus, incomingChallenges, sentChallenges, awaitingGame,
  attentionCount, alreadyChallenged, isDoubles, challengeSides, involves, CHALLENGE_MESSAGE_MAX, CHALLENGE_WHEN_MAX, type Challenge,
} from '@/logic/challenges';

const NOW = new Date('2026-10-10T12:00:00Z');
const ch = (over: Partial<Challenge> = {}): Challenge => ({
  id: 'c1', fromId: 'a', toId: 'b', fromUid: 'ua', toUid: 'ub', status: 'pending', createdAt: '2026-10-09T12:00:00.000Z', ...over,
});

describe('newChallenge', () => {
  it('monta o desafio limpo, pendente, sem campos undefined', () => {
    const c = newChallenge({ fromId: 'a', toId: 'b', fromUid: 'ua', toUid: 'ub', message: '  Bora? ', when: ' sábado ' }, NOW)!;
    expect(c).toEqual({ fromId: 'a', toId: 'b', fromUid: 'ua', toUid: 'ub', message: 'Bora?', when: 'sábado', status: 'pending', createdAt: NOW.toISOString() });
    const bare = newChallenge({ fromId: 'a', toId: 'b', fromUid: 'ua', toUid: 'ub' }, NOW)!;
    expect('message' in bare).toBe(false);
    expect('when' in bare).toBe(false);
  });
  it('recusa desafiar a si mesmo, jogador sem conta e textos grandes', () => {
    expect(newChallenge({ fromId: 'a', toId: 'a', fromUid: 'ua', toUid: 'ub' })).toBeNull();
    expect(newChallenge({ fromId: 'a', toId: 'b', fromUid: 'ua', toUid: 'ua' })).toBeNull();
    expect(newChallenge({ fromId: 'a', toId: 'b', fromUid: 'ua', toUid: null })).toBeNull();
    expect(newChallenge({ fromId: 'a', toId: 'b', fromUid: 'ua', toUid: 'ub', message: 'x'.repeat(CHALLENGE_MESSAGE_MAX + 1) })).toBeNull();
    expect(newChallenge({ fromId: 'a', toId: 'b', fromUid: 'ua', toUid: 'ub', when: 'x'.repeat(CHALLENGE_WHEN_MAX + 1) })).toBeNull();
  });
});

describe('parseChallenge', () => {
  it('lê um desafio válido e ignora lixo', () => {
    expect(parseChallenge('x', { fromId: 'a', toId: 'b', fromUid: 'ua', toUid: 'ub', status: 'accepted', createdAt: 't', compId: 'c9' }))
      .toMatchObject({ id: 'x', status: 'accepted', compId: 'c9' });
    expect(parseChallenge('x', { fromId: 'a' })).toBeNull();
    expect(parseChallenge('x', { fromId: 'a', toId: 'b', fromUid: 'ua', toUid: 'ub', status: 'zzz' })).toBeNull();
    expect(parseChallenge('x', undefined)).toBeNull();
  });
});

describe('estados e filas', () => {
  it('expira depois de 14 dias sem resposta; aceito não expira', () => {
    expect(isExpired(ch({ createdAt: '2026-09-20T12:00:00.000Z' }), NOW)).toBe(true);
    expect(isExpired(ch({ createdAt: '2026-09-30T12:00:00.000Z' }), NOW)).toBe(false);
    expect(isExpired(ch({ status: 'accepted', createdAt: '2026-01-01T00:00:00.000Z' }), NOW)).toBe(false);
    expect(effectiveStatus(ch({ createdAt: '2026-09-01T00:00:00.000Z' }), NOW)).toBe('expired');
  });
  it('incoming/sent separam recebidos e enviados e escondem os expirados', () => {
    const list = [ch({ id: '1' }), ch({ id: '2', fromId: 'b', toId: 'a' }), ch({ id: '3', createdAt: '2026-08-01T00:00:00.000Z' }), ch({ id: '4', status: 'declined' })];
    expect(incomingChallenges(list, 'b', NOW).map(c => c.id)).toEqual(['1']);
    expect(incomingChallenges(list, 'a', NOW).map(c => c.id)).toEqual(['2']);
    expect(sentChallenges(list, 'a', NOW).map(c => c.id)).toEqual(['1']);
    expect(incomingChallenges(list, null, NOW)).toEqual([]);
  });
  it('awaitingGame: aceitos sem jogo, para quem participa', () => {
    const list = [ch({ id: '1', status: 'accepted' }), ch({ id: '2', status: 'accepted', compId: 'k' }), ch({ id: '3' })];
    expect(awaitingGame(list, 'a').map(c => c.id)).toEqual(['1']);
    expect(awaitingGame(list, 'b').map(c => c.id)).toEqual(['1']);
    expect(awaitingGame(list, 'z')).toEqual([]);
  });
  it('attentionCount soma o que pede ação sua', () => {
    const list = [ch({ id: '1' }), ch({ id: '2', toId: 'a', fromId: 'c', fromUid: 'uc', toUid: 'ua', status: 'accepted' })];
    expect(attentionCount(list, 'b', NOW)).toBe(1);   // um para responder
    expect(attentionCount(list, 'a', NOW)).toBe(1);   // um aceito sem jogo marcado
  });
  it('alreadyChallenged evita duplicar enquanto espera resposta', () => {
    expect(alreadyChallenged([ch()], 'a', 'b', NOW)).toBe(true);
    expect(alreadyChallenged([ch({ status: 'declined' })], 'a', 'b', NOW)).toBe(false);
    expect(alreadyChallenged([ch({ createdAt: '2026-08-01T00:00:00.000Z' })], 'a', 'b', NOW)).toBe(false);
  });
});

describe('desafio de duplas', () => {
  const base = { fromId: 'a', toId: 'b', fromUid: 'ua', toUid: 'ub' };
  it('monta com os dois parceiros e lê de volta', () => {
    const c = newChallenge({ ...base, fromPartnerId: 'c', toPartnerId: 'd' }, NOW)!;
    expect(c).toMatchObject({ fromPartnerId: 'c', toPartnerId: 'd' });
    const back = parseChallenge('x', c as Record<string, unknown>)!;
    expect(isDoubles(back)).toBe(true);
    expect(challengeSides(back)).toEqual([['a', 'c'], ['b', 'd']]);
    expect(involves(back, 'd')).toBe(true);
    expect(involves(back, 'z')).toBe(false);
  });
  it('1 contra 1 continua sem parceiros', () => {
    const c = newChallenge(base, NOW)!;
    expect('fromPartnerId' in c).toBe(false);
    expect(challengeSides({ id: 'x', ...c } as Challenge)).toEqual([['a'], ['b']]);
  });
  it('recusa só um parceiro ou jogador repetido', () => {
    expect(newChallenge({ ...base, fromPartnerId: 'c' })).toBeNull();
    expect(newChallenge({ ...base, fromPartnerId: 'c', toPartnerId: 'c' })).toBeNull();
    expect(newChallenge({ ...base, fromPartnerId: 'b', toPartnerId: 'd' })).toBeNull();
    expect(newChallenge({ ...base, fromPartnerId: 'a', toPartnerId: 'd' })).toBeNull();
  });
});
