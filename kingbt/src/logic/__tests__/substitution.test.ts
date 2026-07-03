import { applySubstitution } from '../substitution';
import type { Match } from '../types';

const sub = { originalId: 'pedro', substituteId: 'maria', fromMatchId: 'g1', timestamp: '2026-07-03T12:00:00Z' };

describe('applySubstitution', () => {
  it('troca o jogador do jogo selecionado em diante, apenas em jogos sem placar', () => {
    const matches: Match[] = [
      { id: 'g0', stage: 'rotating', teamA: ['pedro'], teamB: ['bruno'], scoreA: 2, scoreB: 0 },
      { id: 'g1', stage: 'rotating', teamA: ['pedro'], teamB: ['joao'],  scoreA: null, scoreB: null },
      { id: 'g2', stage: 'rotating', teamA: ['paulo'], teamB: ['pedro'], scoreA: null, scoreB: null },
    ];
    const result = applySubstitution(matches, sub);

    // Jogo já disputado permanece com o original (estatísticas preservadas)
    expect(result[0].teamA).toEqual(['pedro']);
    // Jogos seguintes sem placar recebem o substituto
    expect(result[1].teamA).toEqual(['maria']);
    expect(result[2].teamB).toEqual(['maria']);
  });

  it('não altera jogos anteriores ao jogo selecionado', () => {
    const matches: Match[] = [
      { id: 'g0', stage: 'rotating', teamA: ['pedro'], teamB: ['bruno'], scoreA: null, scoreB: null },
      { id: 'g1', stage: 'rotating', teamA: ['pedro'], teamB: ['joao'],  scoreA: null, scoreB: null },
    ];
    const result = applySubstitution(matches, sub);
    expect(result[0].teamA).toEqual(['pedro']); // antes do fromMatchId
    expect(result[1].teamA).toEqual(['maria']);
  });

  it('troca em duplas mantendo o parceiro', () => {
    const matches: Match[] = [
      { id: 'g1', stage: 'rotating', teamA: ['pedro', 'bruno'], teamB: ['joao', 'paulo'], scoreA: null, scoreB: null },
    ];
    const result = applySubstitution(matches, sub);
    expect(result[0].teamA).toEqual(['maria', 'bruno']);
    expect(result[0].teamB).toEqual(['joao', 'paulo']);
  });

  it('troca aId/bId em jogos de liga/mata-mata', () => {
    const matches: Match[] = [
      { id: 'g1', stage: 'ko', aId: 'pedro', bId: 'joao', scoreA: null, scoreB: null },
    ];
    const result = applySubstitution(matches, sub);
    expect(result[0].aId).toBe('maria');
    expect(result[0].bId).toBe('joao');
  });

  it('não introduz chaves undefined (Firestore rejeita undefined)', () => {
    // Jogo de Super 8: não tem aId/bId
    const matches: Match[] = [
      { id: 'g1', stage: 'rotating', teamA: ['pedro'], teamB: ['joao'], scoreA: null, scoreB: null },
    ];
    const result = applySubstitution(matches, sub);
    expect('aId' in result[0]).toBe(false);
    expect('bId' in result[0]).toBe(false);

    // Jogo de mata-mata: não tem teamA/teamB
    const koMatches: Match[] = [
      { id: 'g1', stage: 'ko', aId: 'pedro', bId: 'joao', scoreA: null, scoreB: null },
    ];
    const koResult = applySubstitution(koMatches, sub);
    expect('teamA' in koResult[0]).toBe(false);
    expect('teamB' in koResult[0]).toBe(false);
  });
});
