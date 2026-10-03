import { personalNotifs } from '@/logic/personalNotifs';
import { applyValidationOp } from '@/logic/scoreValidation';
import type { Challenge } from '@/logic/challenges';
import type { Competition } from '@/logic/types';

const NOW = new Date('2026-10-10T12:00:00Z');
const nameOf = (id: string) => ({ a: 'Ana Souza', b: 'Bia Lima', c: 'Caio', d: 'Duda' }[id] ?? id);
const ch = (over: Partial<Challenge> = {}): Challenge => ({
  id: 'c1', fromId: 'a', toId: 'b', fromUid: 'ua', toUid: 'ub', status: 'pending', createdAt: '2026-10-09T12:00:00.000Z', ...over,
});
const base = { challenges: [] as Challenge[], honors: [], announcements: [], competitions: [] as Competition[], nameOf, now: NOW };

describe('personalNotifs', () => {
  it('desafio recebido avisa o desafiado, não o desafiante', () => {
    const forB = personalNotifs({ ...base, myId: 'b', challenges: [ch({ message: 'Revanche?' })] });
    expect(forB).toHaveLength(1);
    expect(forB[0]).toMatchObject({ type: 'challenge_in', title: 'Ana desafiou você', actionRoute: '/desafios' });
    expect(forB[0].description).toContain('Revanche?');
    expect(personalNotifs({ ...base, myId: 'a', challenges: [ch()] })).toHaveLength(0);
  });

  it('resposta chega ao desafiante; aceito sem jogo marcado pede para marcar', () => {
    const accepted = ch({ status: 'accepted', respondedAt: '2026-10-10T09:00:00.000Z' });
    const forA = personalNotifs({ ...base, myId: 'a', challenges: [accepted] });
    expect(forA.map(n => n.type).sort()).toEqual(['challenge_game', 'challenge_reply']);
    expect(forA.find(n => n.type === 'challenge_reply')!.title).toBe('Bia aceitou seu desafio');
    const declined = personalNotifs({ ...base, myId: 'a', challenges: [ch({ status: 'declined', respondedAt: '2026-10-10T09:00:00.000Z' })] });
    expect(declined[0].title).toBe('Bia recusou seu desafio');
    // jogo já marcado: some o pedido para marcar
    const withGame = personalNotifs({ ...base, myId: 'a', challenges: [ch({ status: 'accepted', compId: 'x' })] });
    expect(withGame.map(n => n.type)).toEqual(['challenge_reply']);
  });

  it('desafio de duplas: o parceiro não recebe aviso de resposta, e o tipo aparece no texto', () => {
    const d = ch({ fromPartnerId: 'c', toPartnerId: 'd', status: 'accepted', respondedAt: '2026-10-10T09:00:00.000Z' });
    expect(personalNotifs({ ...base, myId: 'a', challenges: [d] }).find(n => n.type === 'challenge_reply')!.title).toBe('Bia aceitou seu desafio de duplas');
    expect(personalNotifs({ ...base, myId: 'c', challenges: [d] })).toHaveLength(0);
  });

  it('desafio expirado não vira aviso', () => {
    expect(personalNotifs({ ...base, myId: 'b', challenges: [ch({ createdAt: '2026-09-01T12:00:00.000Z' })] })).toHaveLength(0);
  });

  it('honraria só avisa quem recebeu', () => {
    const honors = [{ id: 'h1', playerId: 'a', title: 'Fair Play', icon: '🤝', date: '2026-10-10T10:00:00.000Z' }];
    expect(personalNotifs({ ...base, myId: 'a', honors })[0]).toMatchObject({ type: 'honor', title: 'Você recebeu a honraria Fair Play' });
    expect(personalNotifs({ ...base, myId: 'b', honors })).toHaveLength(0);
  });

  it('comunicado vale para todos, até para conta sem perfil; vencido some', () => {
    const announcements = [
      { id: 'n1', title: 'Chuva', text: 'Jogo cancelado', date: '2026-10-10T08:00:00.000Z' },
      { id: 'n2', text: 'Antigo', date: '2026-09-01T08:00:00.000Z', expiresAt: '2026-09-05T08:00:00.000Z' },
    ];
    const r = personalNotifs({ ...base, myId: null, announcements });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ type: 'announcement', title: 'Comunicado: Chuva' });
  });

  it('placar para confirmar avisa o adversário de quem lançou', () => {
    const comp: Competition = {
      id: 'k1', name: 'Torneio', format: 'avulso', unit: 'individual', gender: 'misto', status: 'active', date: '2026-10-10',
      config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, requireConfirmation: true, winRule: { sets: 1, games: 6 } },
      competitors: [], matches: [{ id: 'm1', stage: 'rotating', teamA: ['a'], teamB: ['b'], scoreA: null, scoreB: null }],
    } as Competition;
    const pending = applyValidationOp(comp, { kind: 'submit', matchId: 'm1', scoreA: 2, scoreB: 1, by: 'a', at: '2026-10-10T11:00:00Z' });
    const forB = personalNotifs({ ...base, myId: 'b', competitions: [pending] });
    expect(forB).toHaveLength(1);
    expect(forB[0]).toMatchObject({ type: 'score_confirm', actionCompId: 'k1' });
    expect(forB[0].description).toBe('Ana lançou 2 × 1');
    expect(personalNotifs({ ...base, myId: 'a', competitions: [pending] })).toHaveLength(0);
  });
});
