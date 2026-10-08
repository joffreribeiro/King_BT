jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import type { BtEstatJogador, BtWinRule } from '../btTracker';
import { melhoresPorColuna, sequenciasDePontos, viradasDoJogo } from '../btMomentos';

const rule: BtWinRule = { sets: 3, games: 4, tiebreak: 7, tiebreakAt: 'deuce' };
const seq = (s: string) => s.split('').map(c => ({ vencedorDupla: c as 'A' | 'B', sacador: 'x' }));

function jog(id: string, o: Partial<BtEstatJogador> = {}): BtEstatJogador {
  return {
    id, winners: 0, aces: 0, errosDevolucao: 0, errosNaoForcados: 0, forcouErro: 0, errosSaque: 0, pontosGanhos: 0, saquesTotal: 0,
    saquesPorPosicao: {},
    qualidadeSaque: { ace: 0, bom: 0, regular: 0, ruim: 0, erroSaque: 0 },
    qualidadeDevolucao: { winner: 0, boa: 0, regular: 0, ruim: 0, erroDevolucao: 0 },
    qualidadePrimeiraBola: { Boa: 0, Regular: 0, Ruim: 0 },
    nota: 5, ...o,
  };
}

describe('sequenciasDePontos', () => {
  it('acha trechos com 3+ pontos seguidos da mesma dupla (numeração de 1 em diante)', () => {
    expect(sequenciasDePontos(seq('AAABBAAAA'))).toEqual([
      { dupla: 'A', inicio: 1, fim: 3, tamanho: 3 },
      { dupla: 'A', inicio: 6, fim: 9, tamanho: 4 },
    ]);
  });

  it('respeita o mínimo e o caso vazio', () => {
    expect(sequenciasDePontos(seq('AABB'))).toEqual([]);
    expect(sequenciasDePontos(seq('AABB'), 2)).toHaveLength(2);
    expect(sequenciasDePontos([])).toEqual([]);
  });
});

describe('viradasDoJogo', () => {
  it('registra quando a liderança no saldo troca de lado', () => {
    // A lidera, B empata e passa à frente no 5º ponto, A volta à frente no 9º
    const v = viradasDoJogo({ pontos: seq('AABBBBAAA'), rule });
    expect(v.map(x => [x.numero, x.dupla])).toEqual([[5, 'B'], [9, 'A']]);
    expect(v[0].placar).toBe('0x0 30x40'); // placar logo depois do ponto da virada
  });

  it('empate no saldo não é virada, e quem lidera desde o início não vira', () => {
    expect(viradasDoJogo({ pontos: seq('AAAA'), rule })).toEqual([]);
    expect(viradasDoJogo({ pontos: seq('ABAB'), rule })).toEqual([]);
  });
});

describe('melhoresPorColuna', () => {
  it('dá ★ ao maior (winners) e ao menor (erros), com empate levando todos', () => {
    const r = melhoresPorColuna([
      jog('A1', { winners: 5, errosNaoForcados: 1 }),
      jog('A2', { winners: 2, errosNaoForcados: 1 }),
      jog('B1', { winners: 5, errosNaoForcados: 4 }),
    ]);
    expect(r['Winner']).toEqual(['A1', 'B1']);
    expect(r['Erro N.F.']).toEqual(['A1', 'A2']);
  });

  it('sem ★ quando todos iguais, quando o melhor seria zero ou com um só dado', () => {
    const r = melhoresPorColuna([jog('A1'), jog('A2'), jog('B1')]);
    expect(r['Ace']).toEqual([]);      // melhor seria 0
    expect(r['Winner']).toEqual([]);   // todos iguais
    expect(r['Erro saque']).toEqual([]); // ninguém sacou
    expect(melhoresPorColuna([jog('A1', { winners: 3 })])['Winner']).toEqual([]);
  });

  it('erro de saque compara por percentual dos saques', () => {
    const r = melhoresPorColuna([
      jog('A1', { saquesTotal: 10, errosSaque: 1 }),
      jog('A2', { saquesTotal: 4, errosSaque: 2 }),
    ]);
    expect(r['Erro saque']).toEqual(['A1']);
  });
});
