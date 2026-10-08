jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import type { BtAnalise, BtPonto, BtWinRule } from '../btTracker';
import { resumoDoAtleta, type ResumoAtleta } from '../btAtleta';
import {
  adversariosDe, analisesContra, campanhasDoAtleta, dicasContra, distribuicao, evolucaoDoAtleta,
  sugestoesDoAtleta, MINIMO_PARTIDAS_EVOLUCAO,
} from '../btAtletaAnalise';

const rule: BtWinRule = { sets: 1, games: 4, tiebreak: 7, tiebreakAt: 'deuce' };
const jogadores = { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2' };
const nomes = { A1: 'Ana', A2: 'Ari', B1: 'Bia', B2: 'Beto' };

let n = 0;
function ponto(o: Partial<BtPonto> & Pick<BtPonto, 'sacador' | 'vencedorDupla'>): BtPonto {
  return { id: String(++n), timestamp: n, gameScore: '', setScore: '', posicaoSaque: 'Direita-3', finalizacao: 'Winner', ...o };
}
const rep = (k: number, f: () => BtPonto) => Array.from({ length: k }, f);

/** Análise encerrada em que A1 vence (ou perde) com pontos de lance variados. */
function analise(pontos: BtPonto[], venceA: boolean, criadaEm: number, competitionId = 'c1', j = jogadores): BtAnalise {
  return {
    id: 'm' + ++n, competitionId, matchId: 'm' + n, criadaEm, rule, jogadores: j, nomes, pontos,
    placarFinal: venceA ? { setsA: 1, setsB: 0, gamesA: [4], gamesB: [0] } : { setsA: 0, setsB: 1, gamesA: [0], gamesB: [4] },
  };
}

describe('distribuicao', () => {
  it('ordena do mais frequente e calcula a fatia', () => {
    expect(distribuicao({ Lob: 1, Smash: 3 })).toEqual([{ label: 'Smash', n: 3, pct: 75 }, { label: 'Lob', n: 1, pct: 25 }]);
    expect(distribuicao({})).toEqual([]);
  });
});

describe('sugestões do atleta', () => {
  // A1 erra muito de Smash, faz poucos winners, erra saques
  const erros = rep(6, () => ponto({ sacador: 'B1', vencedorDupla: 'B', finalizacao: 'ErroNaoForcado', vencedorJogador: 'A1', tipoFinalizacao: 'Smash' as never }));
  const saques = rep(6, () => ponto({ sacador: 'A1', vencedorDupla: 'B', finalizacao: 'ErroSaque' }));
  const r = resumoDoAtleta([analise([...erros, ...saques], false, 1)], 'A1')!;

  it('aponta saque, golpe de erro e pressão quando há amostra', () => {
    const ids = sugestoesDoAtleta(r).map(s => s.id);
    expect(ids).toEqual(expect.arrayContaining(['saque', 'enf-golpe', 'pressao']));
  });

  it('sem amostra mínima não sugere nada', () => {
    const pouco = resumoDoAtleta([analise([ponto({ sacador: 'A1', vencedorDupla: 'A', vencedorJogador: 'A1' })], true, 1)], 'A1')!;
    expect(sugestoesDoAtleta(pouco)).toEqual([]);
  });

  it('destaca o golpe que mais dá winners', () => {
    const w = rep(4, () => ponto({ sacador: 'B1', vencedorDupla: 'A', vencedorJogador: 'A1', tipoFinalizacao: 'Smash' as never }));
    const r2 = resumoDoAtleta([analise(w, true, 1)], 'A1')!;
    expect(sugestoesDoAtleta(r2).find(s => s.id === 'arma')?.tipo).toBe('forte');
  });
});

describe('evolução recentes × anteriores', () => {
  const winnersEm = (k: number) => rep(k, () => ponto({ sacador: 'B1', vencedorDupla: 'A', vencedorJogador: 'A1' }));

  it('null com poucas partidas', () => {
    const r = resumoDoAtleta([analise(winnersEm(2), true, 1)], 'A1') as ResumoAtleta;
    expect(MINIMO_PARTIDAS_EVOLUCAO).toBe(4);
    expect(evolucaoDoAtleta(r)).toBeNull();
  });

  it('detecta melhora de winners por partida', () => {
    const lista = [1, 2, 3, 4, 5, 6].map((d, i) => analise(winnersEm(i < 3 ? 2 : 6), true, d));
    const ev = evolucaoDoAtleta(resumoDoAtleta(lista, 'A1')!)!;
    expect(ev.recentes).toBe(3);
    expect(ev.anteriores).toBe(3);
    const w = ev.linhas.find(l => l.id === 'winners')!;
    expect(w.tendencia).toBe('melhorou');
    expect(w.antes).toBe('2 por jogo');
    expect(w.depois).toBe('6 por jogo');
  });
});

describe('adversários', () => {
  const venceA = analise(rep(2, () => ponto({ sacador: 'A1', vencedorDupla: 'A' })), true, 100);
  const perdeA = analise(rep(2, () => ponto({ sacador: 'B1', vencedorDupla: 'B' })), false, 200);

  it('lista quem esteve do outro lado, com o saldo do foco', () => {
    const l = adversariosDe([venceA, perdeA], 'A1');
    const bia = l.find(x => x.id === 'B1')!;
    expect(bia).toMatchObject({ partidas: 2, vitorias: 1, derrotas: 1, ultimaData: 200 });
    expect(l.find(x => x.id === 'A2')).toBeUndefined(); // parceiro não é adversário
  });

  it('filtra as análises contra o adversário e respeita o foco', () => {
    expect(analisesContra([venceA, perdeA], 'B1', 'A1')).toHaveLength(2);
    expect(analisesContra([venceA, perdeA], 'B1', 'B2')).toHaveLength(0); // jogaram do mesmo lado
    expect(analisesContra([venceA, perdeA], 'B1')).toHaveLength(2);
  });

  it('dicas de "como jogar contra" usam os dados, e avisam quando faltam', () => {
    const erros = rep(4, () => ponto({ sacador: 'A1', vencedorDupla: 'A', finalizacao: 'ErroNaoForcado', vencedorJogador: 'B1', tipoFinalizacao: 'Lob' as never }));
    const r = resumoDoAtleta([analise(erros, true, 1)], 'B1')!;
    expect(dicasContra(r)[0]).toMatch(/Lob/);
    const vazio = resumoDoAtleta([analise([ponto({ sacador: 'A1', vencedorDupla: 'A' })], true, 1)], 'B1')!;
    expect(dicasContra(vazio)[0]).toMatch(/poucos dados/);
  });
});

describe('campanha por competição', () => {
  it('agrupa por competição com o saldo e ordena pela mais recente', () => {
    const p = () => rep(2, () => ponto({ sacador: 'A1', vencedorDupla: 'A' }));
    const r = resumoDoAtleta([analise(p(), true, 10, 'c1'), analise(p(), false, 20, 'c1'), analise(p(), true, 30, 'c2')], 'A1')!;
    const c = campanhasDoAtleta(r);
    expect(c.map(x => x.competitionId)).toEqual(['c2', 'c1']);
    expect(c[1]).toMatchObject({ vitorias: 1, derrotas: 1 });
    expect(c[1].partidas).toHaveLength(2);
  });
});
