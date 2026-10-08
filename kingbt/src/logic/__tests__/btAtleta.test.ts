jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { calcularEstatisticas, type BtAnalise, type BtPonto, type BtWinRule } from '../btTracker';
import { analisesDoPeriodo, atletasConhecidos, confirmacaoDeSaque, resumoDoAtleta } from '../btAtleta';

const rule: BtWinRule = { sets: 1, games: 4, tiebreak: 7, tiebreakAt: 'deuce' };
const jogadores = { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2' };
const nomes = { A1: 'Ana Souza', A2: 'Ari', B1: 'Bia', B2: 'Beto' };

let n = 0;
function ponto(o: Partial<BtPonto> & Pick<BtPonto, 'sacador' | 'vencedorDupla'>): BtPonto {
  return { id: String(++n), timestamp: n, gameScore: '', setScore: '', posicaoSaque: 'Direita-3', finalizacao: 'Winner', ...o };
}
function analise(pontos: BtPonto[], extra: Partial<BtAnalise> = {}): BtAnalise {
  return { id: 'm' + n, competitionId: 'c1', matchId: 'm' + ++n, criadaEm: 1000 + n, rule, jogadores, nomes, pontos, ...extra };
}

describe('atribuição de lances por jogador', () => {
  it('Winner vai para quem fez (vencedorJogador), não para o 1º da dupla', () => {
    const st = calcularEstatisticas(analise([ponto({ sacador: 'B1', vencedorDupla: 'A', vencedorJogador: 'A2' })]));
    expect(st.jogadores.A2.winners).toBe(1);
    expect(st.jogadores.A1.winners).toBe(0);
  });

  it('erro não forçado vai para quem errou (vencedorJogador no ponto é o errante)', () => {
    const st = calcularEstatisticas(analise([ponto({ sacador: 'A1', vencedorDupla: 'A', finalizacao: 'ErroNaoForcado', vencedorJogador: 'B2' })]));
    expect(st.jogadores.B2.errosNaoForcados).toBe(1);
    expect(st.jogadores.B1.errosNaoForcados).toBe(0);
  });

  it('erro de devolução sem marcação usa o devolvedor; sem nada, cai no 1º da dupla', () => {
    const comDevolvedor = calcularEstatisticas(analise([ponto({ sacador: 'A1', vencedorDupla: 'A', finalizacao: 'ErroDevolucao', devolvedor: 'B2' })]));
    expect(comDevolvedor.jogadores.B2.errosDevolucao).toBe(1);
    const semNada = calcularEstatisticas(analise([ponto({ sacador: 'A1', vencedorDupla: 'A', finalizacao: 'ErroNaoForcado' })]));
    expect(semNada.jogadores.B1.errosNaoForcados).toBe(1);
  });

  it('ignora vencedorJogador de outra dupla (dado inconsistente)', () => {
    const st = calcularEstatisticas(analise([ponto({ sacador: 'B1', vencedorDupla: 'A', vencedorJogador: 'B2' })]));
    expect(st.jogadores.A1.winners).toBe(1);
    expect(st.jogadores.B2.winners).toBe(0);
  });
});

describe('confirmacaoDeSaque', () => {
  const game = (s: string, v: 'A' | 'B') => Array.from({ length: 4 }, () => ponto({ sacador: s, vencedorDupla: v }));

  it('conta games sacados e vencidos por jogador', () => {
    const a = analise([...game('A1', 'A'), ...game('B1', 'A'), ...game('A2', 'B')]);
    expect(confirmacaoDeSaque(a, 'A1')).toEqual({ n: 1, total: 1, pct: 100 });
    expect(confirmacaoDeSaque(a, 'B1')).toEqual({ n: 0, total: 1, pct: 0 });
    expect(confirmacaoDeSaque(a, 'A2')).toEqual({ n: 0, total: 1, pct: 0 });
  });

  it('game em andamento não conta', () => {
    const a = analise([...game('A1', 'A'), ponto({ sacador: 'B1', vencedorDupla: 'B' })]);
    expect(confirmacaoDeSaque(a, 'B1').total).toBe(0);
  });
});

describe('resumo do atleta entre partidas', () => {
  const venceA = () => analise(
    [...Array.from({ length: 16 }, () => ponto({ sacador: 'A1', vencedorDupla: 'A', vencedorJogador: 'A1' }))],
    { placarFinal: { setsA: 1, setsB: 0, gamesA: [4], gamesB: [0], stb: [false] }, criadaEm: 1000 },
  );
  const perdeA = () => analise(
    [...Array.from({ length: 16 }, () => ponto({ sacador: 'B1', vencedorDupla: 'B', vencedorJogador: 'B1' }))],
    { placarFinal: { setsA: 0, setsB: 1, gamesA: [0], gamesB: [4], stb: [false] }, criadaEm: 2000 },
  );

  it('soma vitórias, derrotas e lances do atleta pelo id', () => {
    const r = resumoDoAtleta([perdeA(), venceA()], 'A1')!;
    expect(r.partidas).toBe(2);
    expect(r.vitorias).toBe(1);
    expect(r.derrotas).toBe(1);
    expect(r.winners).toBe(16);
    expect(r.nome).toBe('Ana Souza');
    expect(r.lista.map(x => x.venceu)).toEqual([true, false]); // ordenado por data
    expect(r.lista[0].parceiro).toBe('Ari');
    expect(r.lista[0].placar).toBe('4-0');
  });

  it('o placar de quem jogou do lado B é invertido', () => {
    const r = resumoDoAtleta([venceA()], 'B1')!;
    expect(r.lista[0].placar).toBe('0-4');
    expect(r.vitorias).toBe(0);
  });

  it('null quando o atleta não jogou, e análise sem placarFinal é ignorada', () => {
    expect(resumoDoAtleta([venceA()], 'X')).toBeNull();
    expect(resumoDoAtleta([analise([ponto({ sacador: 'A1', vencedorDupla: 'A' })])], 'A1')).toBeNull();
  });
});

describe('período e atletas conhecidos', () => {
  const enc = (criadaEm: number) => analise([], { placarFinal: { setsA: 1, setsB: 0, gamesA: [4], gamesB: [0] }, criadaEm });
  const dia = 24 * 60 * 60 * 1000;

  it('filtra pelo período e ordena do mais antigo ao mais recente', () => {
    const agora = 100 * dia;
    const r = analisesDoPeriodo([enc(agora - 2 * dia), enc(agora - 40 * dia), enc(agora - 5 * dia)], '30d', agora);
    expect(r.map(a => a.criadaEm)).toEqual([agora - 5 * dia, agora - 2 * dia]);
    expect(analisesDoPeriodo([enc(agora - 40 * dia)], 'tudo', agora)).toHaveLength(1);
  });

  it('lista os atletas por número de partidas', () => {
    const extra = analise([], { jogadores: { a1: 'A1', a2: '', b1: 'B1', b2: '' }, placarFinal: { setsA: 1, setsB: 0, gamesA: [4], gamesB: [0] } });
    const l = atletasConhecidos([enc(1), extra]);
    expect(l[0].partidas).toBe(2);
    expect(['A1', 'B1']).toContain(l[0].id);
    expect(l.find(x => x.id === 'A2')?.partidas).toBe(1);
  });
});
