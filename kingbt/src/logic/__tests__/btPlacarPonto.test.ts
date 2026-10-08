jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { placaresAposPontos, tiebreaksDosSets } from '../btPlacarPonto';
import type { BtWinRule } from '../btTracker';

type V = 'A' | 'B';
const pts = (...v: V[]) => v.map(vencedorDupla => ({ vencedorDupla, sacador: 'x' }));
const rep = (n: number, v: V) => Array.from({ length: n }, () => v);
const regra: BtWinRule = { sets: 2, games: 4, tiebreak: 7, tiebreakAt: 'deuce' };

describe('placar depois de cada ponto', () => {
  it('o primeiro ponto já mostra o placar com o ponto contado', () => {
    expect(placaresAposPontos({ pontos: pts('A', 'A', 'B'), rule: regra })).toEqual(['0x0 15x0', '0x0 30x0', '0x0 30x15']);
  });

  it('ao fechar um game mostra só os games, e o game seguinte recomeça de 0x0', () => {
    const r = placaresAposPontos({ pontos: pts('A', 'A', 'A', 'A', 'B'), rule: regra });
    expect(r[3]).toBe('1x0');
    expect(r[4]).toBe('1x0 0x15');
  });

  it('ao fechar um set mostra o placar do set, e o set seguinte indica o número', () => {
    const r = placaresAposPontos({ pontos: pts(...rep(16, 'A'), 'B'), rule: { ...regra, sets: 3 } });
    expect(r[15]).toBe('Set 1 encerrado · 4x0');
    expect(r[16]).toBe('Set 2 · 0x0 0x15');
  });

  it('no último ponto da partida mostra o resultado em sets', () => {
    const r = placaresAposPontos({ pontos: pts(...rep(32, 'A')), rule: { ...regra, sets: 3 } });
    expect(r[31]).toBe('Fim · 2x0 em sets (último set 4x0)');
  });
});

describe('tiebreaksDosSets', () => {
  it('guarda os pontos do tie-break do set e deixa os outros sets vazios', () => {
    const r: BtWinRule = { sets: 1, games: 2, tiebreak: 3, tiebreakAt: 'full' };
    const g = (v: V) => rep(4, v);
    // com 2 games e tie-break "full", o tie-break é em 2x2
    const pontos = pts(...g('A'), ...g('B'), ...g('A'), ...g('B'), 'A', 'B', 'A', 'A');
    expect(tiebreaksDosSets({ pontos, rule: r })).toEqual([{ a: 3, b: 1 }]);
  });

  it('set sem tie-break não gera entrada', () => {
    expect(tiebreaksDosSets({ pontos: pts(...rep(16, 'A')), rule: regra })[0]).toBeUndefined();
  });
});
