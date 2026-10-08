jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { avancaPonto, calcularEstatisticas, placardInicial, type BtAnalise, type BtPonto, type BtWinRule } from '../btTracker';
import { deriveSeqSacadores, proximoSacadorAutomatico, sacadorNoTiebreak, sacadorSugerido } from '../btRotacao';
import { atletasConhecidos, confirmacaoDeSaque, resumoDoAtleta } from '../btAtleta';
import { adversariosDe, sugestoesDoAtleta } from '../btAtletaAnalise';
import { agregarMapaCalor } from '../btMapaCalor';
import { melhoresPorColuna } from '../btMomentos';
import { gerarRelatorioPartidaHtml } from '../exportRelatorio';

// Jogo individual (1x1): a2 e b2 vazios, exatamente como a competição passa ao scout
const rule: BtWinRule = { sets: 1, games: 4, tiebreak: 7, tiebreakAt: 'deuce' };
const jogadores = { a1: 'Ana', a2: '', b1: 'Bia', b2: '' };
const nomes = { Ana: 'Ana Souza', Bia: 'Bia Lima' };
const A = ['Ana'];
const B = ['Bia'];

let n = 0;
function ponto(sacador: string, vencedorDupla: 'A' | 'B', o: Partial<BtPonto> = {}): BtPonto {
  return { id: String(++n), timestamp: n, gameScore: '', setScore: '', posicaoSaque: 'Direita-3', finalizacao: 'Winner', sacador, vencedorDupla, ...o };
}
const game = (s: string, v: 'A' | 'B', extra: Partial<BtPonto> = {}) => Array.from({ length: 4 }, () => ponto(s, v, extra));

describe('scout individual (1x1)', () => {
  // Ana vence 4-0 em games; sacadores alternam (Ana, Bia, Ana, Bia)
  const pontos = [
    ...game('Ana', 'A', { vencedorJogador: 'Ana' }), ...game('Bia', 'A', { vencedorJogador: 'Ana' }),
    ...game('Ana', 'A', { vencedorJogador: 'Ana' }), ...game('Bia', 'A', { vencedorJogador: 'Ana' }),
  ];
  const analise: BtAnalise = {
    id: 'm1', competitionId: 'c1', matchId: 'm1', criadaEm: 1000, rule, jogadores, nomes, pontos,
    placarFinal: { setsA: 1, setsB: 0, gamesA: [4], gamesB: [0], stb: [false] },
  };

  it('o placar fecha normalmente sem parceiros', () => {
    let pl = placardInicial(rule);
    for (const p of pontos) pl = avancaPonto(pl, p.vencedorDupla, p.sacador);
    expect(pl.encerrada).toBe(true);
    expect(pl.winnerDupla).toBe('A');
  });

  it('rotação do saque alterna a partir do 2º game', () => {
    expect(proximoSacadorAutomatico([], A, B, false)).toBeNull();
    expect(proximoSacadorAutomatico(['Ana'], A, B, false)).toBe('Bia');
    expect(proximoSacadorAutomatico(['Ana', 'Bia'], A, B, false)).toBe('Ana');
    expect(deriveSeqSacadores(pontos.slice(0, 8), rule)).toEqual(['Ana', 'Bia']);
    expect(sacadorSugerido(pontos.slice(0, 8), rule, A, B, false)).toBe('Ana');
  });

  it('tie-break individual alterna de 2 em 2 pontos', () => {
    const r: BtWinRule = { sets: 1, games: 2, tiebreak: 3, tiebreakAt: 'full' };
    const base = [...game('Ana', 'A'), ...game('Bia', 'B'), ...game('Ana', 'A'), ...game('Bia', 'B')]; // 2x2
    const tb: BtPonto[] = [];
    ['Ana', 'Bia', 'Bia', 'Ana', 'Ana'].forEach((esperado, i) => {
      const ps = [...base, ...tb];
      expect(sacadorNoTiebreak(ps, r, deriveSeqSacadores(ps, r), A, B, false)).toBe(esperado);
      tb.push(ponto(esperado, i % 2 === 0 ? 'A' : 'B'));
    });
  });

  it('estatísticas por jogador ignoram o parceiro inexistente', () => {
    const st = calcularEstatisticas(analise);
    expect(st.jogadores.Ana.winners).toBe(16);
    expect(st.jogadores.Bia.winners).toBe(0);
    expect(Object.keys(st.jogadores).filter(Boolean).sort()).toEqual(['Ana', 'Bia']);
    expect(st.dupla.A.gamesSacando).toBe(2);
    expect(st.dupla.A.gamesSacandoVencidos).toBe(2);
    expect(st.dupla.B.gamesSacando).toBe(2);
    expect(st.dupla.B.gamesSacandoVencidos).toBe(0);
  });

  it('análise do atleta funciona no individual', () => {
    expect(atletasConhecidos([analise]).map(x => x.id).sort()).toEqual(['Ana', 'Bia']);
    const r = resumoDoAtleta([analise], 'Ana')!;
    expect(r).toMatchObject({ partidas: 1, vitorias: 1, derrotas: 0, winners: 16 });
    expect(r.lista[0].parceiro).toBeNull();
    expect(r.lista[0].adversarios).toBe('Bia');
    expect(r.lista[0].placar).toBe('4-0');
    expect(confirmacaoDeSaque(analise, 'Ana')).toEqual({ n: 2, total: 2, pct: 100 });
    expect(confirmacaoDeSaque(analise, 'Bia')).toEqual({ n: 0, total: 2, pct: 0 });
    expect(adversariosDe([analise], 'Ana')).toEqual([expect.objectContaining({ id: 'Bia', vitorias: 1 })]);
    expect(Array.isArray(sugestoesDoAtleta(r))).toBe(true);
  });

  it('mapa de calor e ★ do melhor funcionam com 1 jogador por lado', () => {
    const comMapa = [ponto('Ana', 'A', { vencedorJogador: 'Ana', calorBola: { linha: 1, coluna: 1 } })];
    expect(agregarMapaCalor(comMapa, 'A', 'Winner', { jogador: 'Ana' }).total).toBe(1);
    const st = calcularEstatisticas(analise);
    const melhores = melhoresPorColuna([st.jogadores.Ana, st.jogadores.Bia]);
    expect(melhores['Winner']).toEqual(['Ana']);
  });

  it('o PDF não mostra nome de parceiro fantasma', () => {
    const html = gerarRelatorioPartidaHtml(analise, calcularEstatisticas(analise));
    expect(html).toContain('Ana Souza × Bia Lima');
    expect(html).not.toMatch(/Ana Souza \//);
    expect(html).not.toContain('undefined');
  });
});
