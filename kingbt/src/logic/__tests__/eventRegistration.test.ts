import { applyRegister, applyCancel, eventView, nextUpcoming, hasLimit } from '@/logic/eventRegistration';
import type { Competition } from '@/logic/types';

const st = (confirmedIds: string[], waitlistIds: string[] = [], vagas?: number) => ({ confirmedIds, waitlistIds, vagas });

describe('applyRegister', () => {
  it('sem limite, todo mundo entra na principal', () => {
    expect(applyRegister(st(['a', 'b']), 'c')).toMatchObject({ confirmedIds: ['a', 'b', 'c'], outcome: 'principal' });
  });
  it('com vaga sobrando, entra na principal', () => {
    expect(applyRegister(st(['a'], [], 2), 'b')).toMatchObject({ confirmedIds: ['a', 'b'], outcome: 'principal' });
  });
  it('lotado, vai para o fim da fila', () => {
    expect(applyRegister(st(['a', 'b'], ['x'], 2), 'c')).toMatchObject({ confirmedIds: ['a', 'b'], waitlistIds: ['x', 'c'], outcome: 'espera' });
  });
  it('quem já está inscrito (principal ou espera) não duplica', () => {
    expect(applyRegister(st(['a'], ['x'], 1), 'a').outcome).toBe('already');
    expect(applyRegister(st(['a'], ['x'], 1), 'x').outcome).toBe('already');
  });
  it('vagas 0 ou inválidas contam como sem limite', () => {
    expect(hasLimit(0)).toBe(false);
    expect(hasLimit(undefined)).toBe(false);
    expect(hasLimit(NaN)).toBe(false);
    expect(applyRegister(st(['a'], [], 0), 'b').outcome).toBe('principal');
  });
});

describe('applyCancel', () => {
  it('cancelar libera a vaga e promove o 1º da fila', () => {
    expect(applyCancel(st(['a', 'b'], ['x', 'y'], 2), 'a'))
      .toMatchObject({ confirmedIds: ['b', 'x'], waitlistIds: ['y'], promotedId: 'x' });
  });
  it('sair da fila não promove ninguém', () => {
    expect(applyCancel(st(['a', 'b'], ['x', 'y'], 2), 'x'))
      .toMatchObject({ confirmedIds: ['a', 'b'], waitlistIds: ['y'], promotedId: null });
  });
  it('sem fila, só remove', () => {
    expect(applyCancel(st(['a', 'b'], [], 2), 'a')).toMatchObject({ confirmedIds: ['b'], promotedId: null });
  });
  it('não promove se ainda estiver lotado (vagas reduzidas depois)', () => {
    expect(applyCancel(st(['a', 'b', 'c'], ['x'], 2), 'a')).toMatchObject({ confirmedIds: ['b', 'c'], waitlistIds: ['x'], promotedId: null });
  });
});

describe('eventView', () => {
  const c = (o: Partial<Competition>) => o as Pick<Competition, 'confirmedIds' | 'waitlistIds' | 'vagas'>;
  it('aberto com vagas', () => {
    expect(eventView(c({ confirmedIds: ['a'], vagas: 8 }), 'me')).toMatchObject({ me: null, taken: 1, free: 7, vagas: 8, action: 'register', lastSpot: false });
  });
  it('última vaga', () => {
    expect(eventView(c({ confirmedIds: Array(7).fill('x'), vagas: 8 }), 'me')).toMatchObject({ lastSpot: true, action: 'register' });
  });
  it('lotado leva à fila; já dentro, não é "última vaga"', () => {
    expect(eventView(c({ confirmedIds: ['a', 'b'], vagas: 2 }), 'me')).toMatchObject({ full: true, action: 'waitlist' });
    expect(eventView(c({ confirmedIds: ['a', 'me'], vagas: 2 }), 'me')).toMatchObject({ me: 'principal', action: 'cancel', lastSpot: false });
  });
  it('na fila mostra a posição', () => {
    expect(eventView(c({ confirmedIds: ['a'], waitlistIds: ['x', 'me'], vagas: 1 }), 'me'))
      .toMatchObject({ me: 'espera', waitPos: 2, waitCount: 2, action: 'leaveWaitlist' });
  });
  it('sem limite não tem vagas nem lotação', () => {
    expect(eventView(c({ confirmedIds: ['a'] }), 'me')).toMatchObject({ vagas: null, free: null, full: false, action: 'register' });
  });
});

describe('nextUpcoming', () => {
  const mk = (id: string, date: string, status: Competition['status'] = 'upcoming', isFriendly = false) => ({ id, date, status, isFriendly } as Competition);
  it('pega a agendada mais próxima a partir de hoje', () => {
    expect(nextUpcoming([mk('a', '2026-10-10'), mk('b', '2026-10-01'), mk('c', '2026-09-01')], '2026-09-29')?.id).toBe('b');
  });
  it('sem futuras, usa a mais recente; ignora ativas e amistosos', () => {
    expect(nextUpcoming([mk('a', '2026-09-01'), mk('b', '2026-09-10'), mk('c', '2026-10-01', 'active'), mk('d', '2026-10-02', 'upcoming', true)], '2026-09-29')?.id).toBe('b');
    expect(nextUpcoming([mk('c', '2026-10-01', 'active')], '2026-09-29')).toBeNull();
  });
});
