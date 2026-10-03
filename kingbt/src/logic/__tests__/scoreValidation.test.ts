import {
  requiresConfirmation, mustConfirm, applyValidationOp, canConfirmScore, canDisputeScore, sideOfPlayer, awaitingMyConfirmation, pendingOf,
} from '@/logic/scoreValidation';
import { applyScore } from '@/logic/competitionOps';
import type { Competition, Match } from '@/logic/types';

const mk = (over: Partial<Competition> = {}, matches?: Match[]): Competition => ({
  id: 'c1', name: 'Torneio', format: 'avulso', unit: 'individual', gender: 'misto', status: 'active', date: '2026-10-10',
  config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, requireConfirmation: true, winRule: { sets: 1, games: 6 } },
  competitors: [],
  matches: matches ?? [{ id: 'm1', stage: 'rotating', teamA: ['ana'], teamB: ['bia'], scoreA: null, scoreB: null }],
  ...over,
});
const submit = (c: Competition, by = 'ana') => applyValidationOp(c, { kind: 'submit', matchId: 'm1', scoreA: 2, scoreB: 1, by, at: '2026-10-10T20:00:00Z' });

describe('quando exige confirmação', () => {
  it('só exige se a competição ligar; admin e criador lançam direto', () => {
    expect(requiresConfirmation(mk())).toBe(true);
    expect(requiresConfirmation(mk({ config: { ...mk().config, requireConfirmation: undefined } }))).toBe(false);
    expect(mustConfirm(mk(), false)).toBe(true);
    expect(mustConfirm(mk(), true)).toBe(false);
  });
});

describe('submit / dispute / discard', () => {
  it('submit guarda o placar como pendente SEM mexer no placar oficial', () => {
    const m = submit(mk()).matches[0];
    expect(m.scoreA).toBeNull();
    expect(m.scoreB).toBeNull();
    expect(m.pendingScore).toMatchObject({ scoreA: 2, scoreB: 1, by: 'ana', at: '2026-10-10T20:00:00Z' });
  });
  it('dispute marca a contestação e guarda o motivo (limitado)', () => {
    const c = applyValidationOp(submit(mk()), { kind: 'dispute', matchId: 'm1', by: 'bia', reason: '  Foi 2×2  ', at: 'T2' });
    expect(c.matches[0].pendingScore).toMatchObject({ disputed: true, disputedBy: 'bia', reason: 'Foi 2×2', scoreA: 2 });
    const long = applyValidationOp(submit(mk()), { kind: 'dispute', matchId: 'm1', by: 'bia', reason: 'x'.repeat(300), at: 'T2' });
    expect(long.matches[0].pendingScore?.reason).toHaveLength(140);
  });
  it('dispute sem pendência não faz nada; discard tira a pendência', () => {
    const none = applyValidationOp(mk(), { kind: 'dispute', matchId: 'm1', by: 'bia', at: 'T' });
    expect(none.matches[0].pendingScore).toBeUndefined();
    const d = applyValidationOp(submit(mk()), { kind: 'discard', matchId: 'm1' });
    expect('pendingScore' in d.matches[0]).toBe(false);
  });
  it('um novo submit refaz a pendência e limpa a contestação', () => {
    const disputed = applyValidationOp(submit(mk()), { kind: 'dispute', matchId: 'm1', by: 'bia', at: 'T' });
    const again = applyValidationOp(disputed, { kind: 'submit', matchId: 'm1', scoreA: 2, scoreB: 2, by: 'ana', at: 'T3' });
    expect(again.matches[0].pendingScore?.disputed).toBeUndefined();
    expect(again.matches[0].pendingScore).toMatchObject({ scoreA: 2, scoreB: 2 });
  });
});

describe('quem pode confirmar', () => {
  const c = submit(mk());
  const m = c.matches[0];
  it('só o lado oposto ao de quem lançou', () => {
    expect(canConfirmScore(c, m, 'bia', false)).toBe(true);   // adversário
    expect(canConfirmScore(c, m, 'ana', false)).toBe(false);  // quem lançou não confirma o próprio
    expect(canConfirmScore(c, m, 'fora', false)).toBe(false); // não joga
    expect(canConfirmScore(c, m, null, false)).toBe(false);
  });
  it('admin/criador confirma sempre, inclusive o contestado', () => {
    expect(canConfirmScore(c, m, 'qualquer', true)).toBe(true);
    const dc = applyValidationOp(c, { kind: 'dispute', matchId: 'm1', by: 'bia', at: 'T' });
    expect(canConfirmScore(dc, dc.matches[0], 'bia', false)).toBe(false);
    expect(canConfirmScore(dc, dc.matches[0], 'x', true)).toBe(true);
  });
  it('duplas: qualquer jogador da dupla adversária confirma', () => {
    const d = mk({}, [{ id: 'm1', stage: 'rotating', teamA: ['a1', 'a2'], teamB: ['b1', 'b2'], scoreA: null, scoreB: null }]);
    const s = submit(d, 'a2');
    expect(canConfirmScore(s, s.matches[0], 'b2', false)).toBe(true);
    expect(canConfirmScore(s, s.matches[0], 'a1', false)).toBe(false);
  });
  it('se quem lançou não joga a partida, qualquer um dos jogadores confirma', () => {
    const s = submit(mk(), 'terceiro');
    expect(canConfirmScore(s, s.matches[0], 'ana', false)).toBe(true);
    expect(canConfirmScore(s, s.matches[0], 'bia', false)).toBe(true);
  });
  it('canDisputeScore: quem pode confirmar (menos admin), enquanto não contestado', () => {
    expect(canDisputeScore(c, m, 'bia')).toBe(true);
    expect(canDisputeScore(c, m, 'ana')).toBe(false);
    const dc = applyValidationOp(c, { kind: 'dispute', matchId: 'm1', by: 'bia', at: 'T' });
    expect(canDisputeScore(dc, dc.matches[0], 'bia')).toBe(false);
  });
  it('sideOfPlayer resolve os lados', () => {
    expect([sideOfPlayer(c, m, 'ana'), sideOfPlayer(c, m, 'bia'), sideOfPlayer(c, m, 'z'), sideOfPlayer(c, m, null)]).toEqual(['A', 'B', null, null]);
  });
});

describe('fila do jogador e confirmação', () => {
  it('awaitingMyConfirmation lista o que espera a confirmação de quem joga', () => {
    const c = submit(mk());
    expect(awaitingMyConfirmation([c], 'bia')).toHaveLength(1);
    expect(awaitingMyConfirmation([c], 'ana')).toHaveLength(0);
    expect(awaitingMyConfirmation([c], null)).toEqual([]);
    expect(pendingOf(c)).toHaveLength(1);
  });
  it('competição que não exige confirmação nunca entra na fila', () => {
    const c = submit(mk({ config: { ...mk().config, requireConfirmation: false } }));
    expect(awaitingMyConfirmation([c], 'bia')).toEqual([]);
  });
  it('confirmar = lançar o placar oficial, que também apaga a pendência', () => {
    const c = submit(mk());
    const done = applyScore(c, 'm1', 2, 1);
    expect(done.matches[0]).toMatchObject({ scoreA: 2, scoreB: 1 });
    expect('pendingScore' in done.matches[0]).toBe(false);
  });
});
