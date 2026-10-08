jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import type { BtPonto } from '../btTracker';
import {
  agregarMapaCalor, chaveCelula, destinoAceitaFora, duplaDoAutor, ehCelulaFora, jogoTemMapaCalor, temMapaCalor,
} from '../btMapaCalor';

let n = 0;
function ponto(o: Partial<BtPonto> & Pick<BtPonto, 'vencedorDupla' | 'finalizacao'>): BtPonto {
  return { id: String(++n), timestamp: n, gameScore: '', setScore: '', sacador: 'A1', posicaoSaque: 'Direita-3', ...o };
}

describe('mapa de calor — regras básicas', () => {
  it('só Winner, Forçou Erro e Erro Não Forçado têm mapa', () => {
    expect(['Winner', 'ForçouErro', 'ErroNaoForcado'].every(f => temMapaCalor(f as never))).toBe(true);
    expect(['Ace', 'ErroSaque', 'ErroDevolucao', 'SemDetalhe'].some(f => temMapaCalor(f as never))).toBe(false);
    expect(temMapaCalor(null)).toBe(false);
  });

  it('só o erro não forçado aceita a bola fora', () => {
    expect(destinoAceitaFora('ErroNaoForcado')).toBe(true);
    expect(destinoAceitaFora('Winner')).toBe(false);
    expect(destinoAceitaFora('ForçouErro')).toBe(false);
  });

  it('casas da faixa externa são "fora", os cantos e o miolo não', () => {
    expect(ehCelulaFora({ linha: 3, coluna: 1 })).toBe(true);
    expect(ehCelulaFora({ linha: 1, coluna: -1 })).toBe(true);
    expect(ehCelulaFora({ linha: 3, coluna: 3 })).toBe(false); // canto
    expect(ehCelulaFora({ linha: 1, coluna: 1 })).toBe(false);
    expect(chaveCelula({ linha: 2, coluna: -1 })).toBe('2,-1');
  });

  it('no erro não forçado o autor é a dupla que perdeu o ponto', () => {
    expect(duplaDoAutor({ finalizacao: 'ErroNaoForcado', vencedorDupla: 'A' })).toBe('B');
    expect(duplaDoAutor({ finalizacao: 'Winner', vencedorDupla: 'A' })).toBe('A');
  });
});

describe('agregarMapaCalor', () => {
  const pontos = [
    ponto({ vencedorDupla: 'A', finalizacao: 'Winner', vencedorJogador: 'A1', tipoFinalizacao: 'Smash', calorJogador: { linha: 2, coluna: 1 }, calorBola: { linha: 2, coluna: 0 } }),
    ponto({ vencedorDupla: 'A', finalizacao: 'Winner', vencedorJogador: 'A2', tipoFinalizacao: 'Lob Alto', calorJogador: { linha: 2, coluna: 1 }, calorBola: { linha: 1, coluna: 2 } }),
    ponto({ vencedorDupla: 'A', finalizacao: 'Winner', vencedorJogador: 'A1' }), // sem marcação: ignora
    ponto({ vencedorDupla: 'B', finalizacao: 'Winner', vencedorJogador: 'B1', calorBola: { linha: 0, coluna: 0 } }),
    // erro de A (ponto de B): conta para a dupla A
    ponto({ vencedorDupla: 'B', finalizacao: 'ErroNaoForcado', vencedorJogador: 'A1', calorBola: { linha: 3, coluna: 1 } }),
  ];

  it('soma as marcações da dupla no tipo de finalização', () => {
    const r = agregarMapaCalor(pontos, 'A', 'Winner');
    expect(r.total).toBe(2);
    expect(r.jogador).toEqual({ '2,1': 2 });
    expect(r.bola).toEqual({ '2,0': 1, '1,2': 1 });
  });

  it('filtra por jogador e por golpe', () => {
    expect(agregarMapaCalor(pontos, 'A', 'Winner', { jogador: 'A2' }).total).toBe(1);
    expect(agregarMapaCalor(pontos, 'A', 'Winner', { golpe: 'Smash' }).bola).toEqual({ '2,0': 1 });
  });

  it('atribui o erro não forçado à dupla que errou', () => {
    expect(agregarMapaCalor(pontos, 'A', 'ErroNaoForcado').bola).toEqual({ '3,1': 1 });
    expect(agregarMapaCalor(pontos, 'B', 'ErroNaoForcado').total).toBe(0);
  });

  it('jogoTemMapaCalor ignora pontos sem marcação', () => {
    expect(jogoTemMapaCalor(pontos)).toBe(true);
    expect(jogoTemMapaCalor([ponto({ vencedorDupla: 'A', finalizacao: 'Winner' })])).toBe(false);
    expect(jogoTemMapaCalor([ponto({ vencedorDupla: 'A', finalizacao: 'Ace', calorBola: { linha: 0, coluna: 0 } })])).toBe(false);
  });
});
