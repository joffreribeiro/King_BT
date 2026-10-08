// btTracker.ts importa AsyncStorage; usa o mock oficial (igual a btTracker.test.ts).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { proximoSacadorAutomatico, deriveSeqSacadores, sacadorNoTiebreak, sacadorSugerido } from '../btRotacao';
import type { BtPonto, BtWinRule } from '../btTracker';

const rule: BtWinRule = { sets: 3, games: 4, tiebreak: 7, tiebreakAt: 'deuce' };
const A = ['A1', 'A2'];
const B = ['B1', 'B2'];

let n = 0;
function ponto(sacador: string, vencedorDupla: 'A' | 'B'): BtPonto {
  return { id: String(++n), timestamp: n, gameScore: '', setScore: '', sacador, posicaoSaque: 'Direita-3', vencedorDupla, finalizacao: 'Winner' };
}
const game = (s: string, v: 'A' | 'B') => Array.from({ length: 4 }, () => ponto(s, v));

describe('proximoSacadorAutomatico', () => {
  it('duplas: games 1 e 2 manuais; depois o parceiro de 2 games atrás', () => {
    expect(proximoSacadorAutomatico([], A, B, true)).toBeNull();
    expect(proximoSacadorAutomatico(['A1'], A, B, true)).toBeNull();
    expect(proximoSacadorAutomatico(['A1', 'B1'], A, B, true)).toBe('A2');
    expect(proximoSacadorAutomatico(['A1', 'B1', 'A2'], A, B, true)).toBe('B2');
    expect(proximoSacadorAutomatico(['A1', 'B1', 'A2', 'B2'], A, B, true)).toBe('A1');
  });

  it('individual: game 1 manual; depois alterna', () => {
    expect(proximoSacadorAutomatico([], ['A1'], ['B1'], false)).toBeNull();
    expect(proximoSacadorAutomatico(['A1'], ['A1'], ['B1'], false)).toBe('B1');
    expect(proximoSacadorAutomatico(['A1', 'B1'], ['A1'], ['B1'], false)).toBe('A1');
  });
});

describe('deriveSeqSacadores', () => {
  it('não inclui o game em andamento', () => {
    const pontos = [...game('A1', 'A'), ponto('B1', 'B')];
    expect(deriveSeqSacadores(pontos, rule)).toEqual(['A1']);
  });

  it('conta o game recém-fechado e a rotação volta ao 1º sacador (4º → 1º)', () => {
    const pontos: BtPonto[] = [];
    const esperado = [null, 'A2', 'B2', 'A1'];
    ['A1', 'B1', 'A2', 'B2'].forEach((s, i) => {
      pontos.push(...game(s, i % 2 === 0 ? 'A' : 'B'));
      expect(proximoSacadorAutomatico(deriveSeqSacadores(pontos, rule), A, B, true)).toBe(esperado[i]);
    });
  });

  it('zera a sequência ao fechar o set, sem levar o último game do set anterior', () => {
    const set1 = [...game('A1', 'A'), ...game('B1', 'A'), ...game('A2', 'A'), ...game('B2', 'A')]; // 4-0
    expect(deriveSeqSacadores([...set1, ponto('A1', 'B')], rule)).toEqual([]);
    // mesmo sem nenhum ponto do set seguinte (reabrir a partida logo após fechar o set)
    expect(deriveSeqSacadores(set1, rule)).toEqual([]);
  });

  it('o set seguinte recomeça a rotação do zero', () => {
    const set1 = [...game('A1', 'A'), ...game('B1', 'A'), ...game('A2', 'A'), ...game('B2', 'A')];
    const pontos = [...set1, ...game('B1', 'B'), ...game('A1', 'A')];
    expect(deriveSeqSacadores(pontos, rule)).toEqual(['B1', 'A1']);
  });
});

describe('sacadorNoTiebreak', () => {
  const regra: BtWinRule = { sets: 1, games: 2, tiebreak: 7, tiebreakAt: 'full' };

  it('fora do tie-break devolve null', () => {
    expect(sacadorNoTiebreak([], regra, [], A, B, true)).toBeNull();
  });

  it('duplas: 1 ponto do 1º, depois 2 para cada um, e volta ao 1º', () => {
    // 2x2 em games => tie-break; games sacados por A1, B1, A2 e B2
    const base = [...game('A1', 'A'), ...game('B1', 'B'), ...game('A2', 'A'), ...game('B2', 'B')];
    const tb: BtPonto[] = [];
    ['A1', 'B1', 'B1', 'A2', 'A2', 'B2', 'B2', 'A1'].forEach((esperado, i) => {
      const pontos = [...base, ...tb];
      expect(sacadorNoTiebreak(pontos, regra, deriveSeqSacadores(pontos, regra), A, B, true)).toBe(esperado);
      tb.push(ponto(esperado, i % 2 === 0 ? 'A' : 'B'));
    });
  });

  it('individual: alterna de 2 em 2 pontos depois do primeiro', () => {
    const base = [...game('A1', 'A'), ...game('B1', 'B'), ...game('A1', 'A'), ...game('B1', 'B')];
    const tb: BtPonto[] = [];
    ['A1', 'B1', 'B1', 'A1', 'A1', 'B1'].forEach((esperado, i) => {
      const pontos = [...base, ...tb];
      expect(sacadorNoTiebreak(pontos, regra, deriveSeqSacadores(pontos, regra), ['A1'], ['B1'], false)).toBe(esperado);
      tb.push(ponto(esperado, i % 2 === 0 ? 'A' : 'B'));
    });
  });
});

describe('sacadorSugerido', () => {
  it('usa a rotação por games fora do tie-break', () => {
    const pontos = [...game('A1', 'A'), ...game('B1', 'B')];
    expect(sacadorSugerido(pontos, rule, A, B, true)).toBe('A2');
  });
});
