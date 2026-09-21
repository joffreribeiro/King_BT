import { applyScore, clearScore, withMatches } from '../competitionOps';
import type { Competition, Match } from '../types';

// ─── playedAt carimbado ao registrar placar ────────────────────────────────
// Antes desta correção, `playedAt` nunca era atribuído em lugar nenhum do
// código — só lido. useNotifications.ts filtra por `m.playedAt`, então a aba
// de notificações "Novo resultado" ficava permanentemente vazia.

function mkComp(matches: Match[]): Competition {
  return {
    id: 'c1', name: 'Sessão', format: 'avulso', unit: 'duplas', gender: 'misto',
    status: 'active', date: '2026-09-20',
    config: { rounds: 'single', groups: 0, qualifiers: 0, thirdPlace: false, winRule: {} },
    competitors: [],
    matches,
  } as unknown as Competition;
}

const jogoSemPlacar: Match = {
  id: 'm1', stage: 'rotating', teamA: ['p1'], teamB: ['p2'], scoreA: null, scoreB: null,
};

describe('applyScore grava playedAt', () => {
  it('carimba playedAt na PRIMEIRA vez que o jogo recebe placar', () => {
    const comp = mkComp([jogoSemPlacar]);
    const antes = Date.now();
    const updated = applyScore(comp, 'm1', 6, 4);
    const depois = Date.now();

    const m = updated.matches.find(x => x.id === 'm1')!;
    expect(m.playedAt).toBeTruthy();
    const carimbo = new Date(m.playedAt!).getTime();
    expect(carimbo).toBeGreaterThanOrEqual(antes);
    expect(carimbo).toBeLessThanOrEqual(depois);
  });

  it('NÃO sobrescreve playedAt numa correção posterior (CORRECT_SCORE)', () => {
    const jogoJaJogado: Match = { ...jogoSemPlacar, scoreA: 6, scoreB: 4, playedAt: '2026-01-01T10:00:00.000Z' };
    const comp = mkComp([jogoJaJogado]);

    const corrigido = applyScore(comp, 'm1', 6, 3, undefined);
    const m = corrigido.matches.find(x => x.id === 'm1')!;

    // O placar muda, mas a data em que o jogo foi jogado, não.
    expect(m.scoreA).toBe(6);
    expect(m.scoreB).toBe(3);
    expect(m.playedAt).toBe('2026-01-01T10:00:00.000Z');
  });

  it('jogos diferentes da mesma competição recebem carimbos independentes', () => {
    const comp = mkComp([
      { id: 'm1', stage: 'rotating', teamA: ['p1'], teamB: ['p2'], scoreA: null, scoreB: null },
      { id: 'm2', stage: 'rotating', teamA: ['p3'], teamB: ['p4'], scoreA: null, scoreB: null },
    ]);

    const depoisDoM1 = applyScore(comp, 'm1', 6, 2);
    const m2AntesDeJogar = depoisDoM1.matches.find(x => x.id === 'm2')!;
    // m2 ainda não tem placar — não deve ganhar playedAt por tabela.
    expect(m2AntesDeJogar.playedAt).toBeFalsy();

    const depoisDoM2 = applyScore(depoisDoM1, 'm2', 6, 1);
    const m1Final = depoisDoM2.matches.find(x => x.id === 'm1')!;
    const m2Final = depoisDoM2.matches.find(x => x.id === 'm2')!;
    expect(m1Final.playedAt).toBeTruthy();
    expect(m2Final.playedAt).toBeTruthy();
  });

  it('withMatches não mexe em playedAt de jogos que não foram tocados', () => {
    const jogoJaJogado: Match = { ...jogoSemPlacar, scoreA: 6, scoreB: 4, playedAt: '2026-01-01T10:00:00.000Z' };
    const outroJogo: Match = { id: 'm2', stage: 'rotating', teamA: ['p3'], teamB: ['p4'], scoreA: null, scoreB: null };
    const comp = mkComp([jogoJaJogado, outroJogo]);

    const semM2 = withMatches(comp, comp.matches.filter(m => m.id !== 'm2'));
    expect(semM2.matches.find(m => m.id === 'm1')!.playedAt).toBe('2026-01-01T10:00:00.000Z');
  });

  it('clearScore apaga playedAt junto com o placar', () => {
    const jogoJaJogado: Match = { ...jogoSemPlacar, scoreA: 6, scoreB: 4, playedAt: '2026-01-01T10:00:00.000Z' };
    const comp = mkComp([jogoJaJogado]);

    const apagado = clearScore(comp, 'm1');
    const m1 = apagado.matches.find(m => m.id === 'm1')!;
    expect(m1.scoreA).toBeNull();
    // Se some com o placar, um novo registro (mesmo que dias depois) carimba
    // a data REAL do novo jogo, em vez de herdar a da tentativa apagada.
    expect(m1.playedAt).toBeNull();

    const reregistrado = applyScore(apagado, 'm1', 6, 2);
    expect(reregistrado.matches.find(m => m.id === 'm1')!.playedAt).toBeTruthy();
  });
});
