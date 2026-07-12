// btTracker.ts importa AsyncStorage para persistência local; usa o mock
// oficial do pacote para rodar em Jest (não há setup global de mocks no projeto).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { calcularEstatisticas, type BtAnalise, type BtPonto } from '../btTracker';

function ponto(overrides: Partial<BtPonto> & Pick<BtPonto, 'sacador' | 'vencedorDupla'>): BtPonto {
  return {
    id: Math.random().toString(),
    timestamp: Date.now(),
    gameScore: '',
    setScore: '',
    posicaoSaque: 'Direita-3',
    finalizacao: 'Winner',
    ...overrides,
  };
}

describe('calcularEstatisticas — confirmação de saque (hold) e break points', () => {
  const rule = { sets: 1, games: 4, tiebreak: 7 };
  const jogadores = { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2' };

  it('credita hold para quem sacou e venceu o game sem quebra', () => {
    // Game 1: A1 saca e a dupla A vence os 4 pontos (game fechado sem quebra)
    const pontos: BtPonto[] = [
      ponto({ sacador: 'A1', vencedorDupla: 'A' }),
      ponto({ sacador: 'A1', vencedorDupla: 'A' }),
      ponto({ sacador: 'A1', vencedorDupla: 'A' }),
      ponto({ sacador: 'A1', vencedorDupla: 'A' }),
    ];
    const analise: BtAnalise = {
      id: 'm1', competitionId: 'c1', matchId: 'm1', criadaEm: Date.now(),
      rule, jogadores, nomes: {}, pontos,
    };
    const stats = calcularEstatisticas(analise);
    expect(stats.dupla.A.gamesSacando).toBe(1);
    expect(stats.dupla.A.gamesSacandoVencidos).toBe(1);
    expect(stats.dupla.B.gamesSacando).toBe(0);
  });

  it('detecta chance de quebra e conversão quando o recebedor está em 40 e vence o game', () => {
    const pontos: BtPonto[] = [
      // Game 1: A1 saca e vence (hold, sem quebra) — abre espaço para o game 2
      ponto({ sacador: 'A1', vencedorDupla: 'A' }),
      ponto({ sacador: 'A1', vencedorDupla: 'A' }),
      ponto({ sacador: 'A1', vencedorDupla: 'A' }),
      ponto({ sacador: 'A1', vencedorDupla: 'A' }),
      // Game 2: B1 saca; dupla A (recebedora) chega a 40 e fecha o game
      ponto({ sacador: 'B1', vencedorDupla: 'A' }), // A: 15x0
      ponto({ sacador: 'B1', vencedorDupla: 'A' }), // A: 30x0
      ponto({ sacador: 'B1', vencedorDupla: 'A' }), // A: 40x0 — ainda não é break point (é o 4º ponto que fecha)
      ponto({ sacador: 'B1', vencedorDupla: 'A' }), // break point: A já estava em 40, B em 0
    ];
    const analise: BtAnalise = {
      id: 'm2', competitionId: 'c1', matchId: 'm2', criadaEm: Date.now(),
      rule, jogadores, nomes: {}, pontos,
    };
    const stats = calcularEstatisticas(analise);

    // Game 2: B sacou e perdeu — sem hold para B
    expect(stats.dupla.B.gamesSacando).toBe(1);
    expect(stats.dupla.B.gamesSacandoVencidos).toBe(0);

    // A (recebedora) teve 1 chance de quebra e converteu
    expect(stats.dupla.A.breakPointsChances).toBe(1);
    expect(stats.dupla.A.breakPointsConvertidos).toBe(1);
  });

  it('ignora "SemDetalhe" (ponto rápido) nos contadores de finalização, mas soma no placar', () => {
    const pontos: BtPonto[] = [
      ponto({ sacador: 'A1', vencedorDupla: 'A', finalizacao: 'SemDetalhe' }),
    ];
    const analise: BtAnalise = {
      id: 'm3', competitionId: 'c1', matchId: 'm3', criadaEm: Date.now(),
      rule, jogadores, nomes: {}, pontos,
    };
    const stats = calcularEstatisticas(analise);
    expect(stats.dupla.A.pontosGanhos).toBe(1);
    expect(stats.dupla.A.winners).toBe(0);
  });

  it('agrega qualidade do saque por jogador', () => {
    const pontos: BtPonto[] = [
      ponto({ sacador: 'A1', vencedorDupla: 'A', finalizacao: 'Ace', qualidadeSaque: 'ace' }),
      ponto({ sacador: 'A1', vencedorDupla: 'B', finalizacao: 'ErroSaque', qualidadeSaque: 'erroSaque' }),
    ];
    const analise: BtAnalise = {
      id: 'm4', competitionId: 'c1', matchId: 'm4', criadaEm: Date.now(),
      rule, jogadores, nomes: {}, pontos,
    };
    const stats = calcularEstatisticas(analise);
    expect(stats.jogadores['A1'].qualidadeSaque.ace).toBe(1);
    expect(stats.jogadores['A1'].qualidadeSaque.erroSaque).toBe(1);
  });
});
