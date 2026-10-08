jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { avancaPonto, calcularEstatisticas, placardInicial, setsDoPlacard, type BtAnalise, type BtPonto, type BtWinRule } from '../btTracker';
import { validarSeed } from '../btSeed';
import { deriveSeqSacadores, sacadorNoTiebreak } from '../btRotacao';
import { placaresAposPontos, tiebreaksDosSets } from '../btPlacarPonto';
import { confirmacaoDeSaque } from '../btAtleta';

// MD3, 4 games, tie-break em 3-3 (o preset mais comum), sem super tie-break
const md3: BtWinRule = { sets: 3, games: 4, tiebreak: 7, tiebreakAt: 'deuce' };
const md3Stb: BtWinRule = { ...md3, superTiebreak: true, superTiebreakPts: 10 };

let n = 0;
function ponto(sacador: string, vencedorDupla: 'A' | 'B', o: Partial<BtPonto> = {}): BtPonto {
  return { id: String(++n), timestamp: n, gameScore: '', setScore: '', posicaoSaque: 'Direita-3', finalizacao: 'Winner', sacador, vencedorDupla, ...o };
}
const game = (s: string, v: 'A' | 'B') => Array.from({ length: 4 }, () => ponto(s, v));

describe('placardInicial com placar semeado', () => {
  it('sem semente é o 0x0 de sempre', () => {
    const pl = placardInicial(md3);
    expect([pl.setsA, pl.setsB, pl.gamesA, pl.gamesB, pl.historicGamesA]).toEqual([0, 0, 0, 0, []]);
  });

  it('sets fechados entram na contagem e no histórico', () => {
    const pl = placardInicial(md3, { setsFechados: [{ a: 4, b: 2 }], gamesA: 1, gamesB: 2 });
    expect([pl.setsA, pl.setsB, pl.gamesA, pl.gamesB]).toEqual([1, 0, 1, 2]);
    expect(pl.historicGamesA).toEqual([4]);
    expect(pl.historicGamesB).toEqual([2]);
    expect(setsDoPlacard(pl)).toEqual([{ a: 4, b: 2 }]);
  });

  it('semeado em 3x3 já entra em tie-break', () => {
    const pl = placardInicial(md3, { gamesA: 3, gamesB: 3 });
    expect(pl.tiebreak).toBe(true);
  });

  it('o jogo continua dali: a partida fecha com o set semeado + o set jogado', () => {
    let pl = placardInicial(md3, { setsFechados: [{ a: 4, b: 1 }], gamesA: 0, gamesB: 0 });
    for (let i = 0; i < 16; i++) pl = avancaPonto(pl, 'A'); // A vence o 2º set por 4-0
    expect(pl.encerrada).toBe(true);
    expect([pl.setsA, pl.setsB]).toEqual([2, 0]);
    expect(setsDoPlacard(pl).map(x => [x.a, x.b])).toEqual([[4, 1], [4, 0]]);
  });

  it('sets empatados com super tie-break semeado entram direto nele', () => {
    const pl = placardInicial(md3Stb, { setsFechados: [{ a: 4, b: 2 }, { a: 1, b: 4 }], gamesA: 0, gamesB: 0 });
    expect(pl.superTiebreakAtivo).toBe(true);
    expect(pl.tiebreak).toBe(true);
    let p2 = pl;
    for (let i = 0; i < 10; i++) p2 = avancaPonto(p2, 'B');
    expect(p2.encerrada).toBe(true);
    expect(p2.winnerDupla).toBe('B');
  });
});

describe('validarSeed', () => {
  it('aceita placares coerentes com a regra', () => {
    expect(validarSeed(md3, { setsFechados: [{ a: 4, b: 2 }], gamesA: 2, gamesB: 1 }).valido).toBe(true);
    expect(validarSeed(md3, { gamesA: 3, gamesB: 3 }).valido).toBe(true); // 3x3 = tie-break
    expect(validarSeed(md3, { setsFechados: [{ a: 4, b: 3 }, { a: 2, b: 4 }], gamesA: 0, gamesB: 0 }).valido).toBe(true);
  });

  it('recusa set que não termina assim neste formato', () => {
    expect(validarSeed(md3, { setsFechados: [{ a: 6, b: 0 }], gamesA: 0, gamesB: 0 }).valido).toBe(false); // fechou antes
    expect(validarSeed(md3, { setsFechados: [{ a: 3, b: 2 }], gamesA: 0, gamesB: 0 }).valido).toBe(false); // ainda não fechou
    expect(validarSeed(md3, { setsFechados: [{ a: -1, b: 4 }], gamesA: 0, gamesB: 0 }).erro).toMatch(/negativos/);
  });

  it('recusa sets que já decidiriam a partida, games que fecham o set ou excedem o máximo', () => {
    expect(validarSeed(md3, { setsFechados: [{ a: 4, b: 0 }, { a: 4, b: 1 }], gamesA: 0, gamesB: 0 }).erro).toMatch(/decidiria/);
    expect(validarSeed(md3, { gamesA: 4, gamesB: 1 }).valido).toBe(false); // já fecharia
    expect(validarSeed(md3, { gamesA: 5, gamesB: 0 }).valido).toBe(false);
  });

  it('com sets empatados e super tie-break, o set atual não tem games', () => {
    const seed = { setsFechados: [{ a: 4, b: 1 }, { a: 1, b: 4 }], gamesA: 1, gamesB: 0 };
    expect(validarSeed(md3Stb, seed).erro).toMatch(/super tie-break/);
    expect(validarSeed(md3Stb, { ...seed, gamesA: 0 }).valido).toBe(true);
  });
});

describe('módulos que recalculam do zero respeitam a semente', () => {
  const inicial = { setsFechados: [{ a: 4, b: 2 }], gamesA: 0, gamesB: 0 };
  const j = { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2' };

  it('placar depois do ponto parte do placar semeado', () => {
    const r = placaresAposPontos({ pontos: [ponto('A1', 'A')], rule: md3, inicial });
    expect(r[0]).toBe('Set 2 · 0x0 15x0');
  });

  it('rotação: o 1º game do set semeado começa sem sequência', () => {
    const pontos = [...game('A1', 'A'), ...game('B1', 'B')];
    expect(deriveSeqSacadores(pontos, md3, inicial)).toEqual(['A1', 'B1']);
  });

  it('tie-break do set jogado entra no índice certo (depois do set semeado)', () => {
    // 3x3 em games => tie-break vencido por A (3 a 1 é pouco; usa 7-0)
    const jogo = [...game('A1', 'A'), ...game('B1', 'B'), ...game('A2', 'A'), ...game('B2', 'B'), ...game('A1', 'A'), ...game('B1', 'B')];
    const tb = Array.from({ length: 7 }, () => ponto('A1', 'A'));
    const t = tiebreaksDosSets({ pontos: [...jogo, ...tb], rule: md3, inicial });
    expect(t[0]).toBeUndefined();
    expect(t[1]).toEqual({ a: 7, b: 0 });
  });

  it('estatística e confirmação de saque partem do placar semeado', () => {
    const pontos = [...game('A1', 'A'), ...game('B1', 'B')];
    const a: BtAnalise = { id: 'm', competitionId: 'c', matchId: 'm', criadaEm: 1, rule: md3, jogadores: j, nomes: {}, pontos, inicial };
    const st = calcularEstatisticas(a);
    expect(st.dupla.A.gamesSacando).toBe(1);
    expect(confirmacaoDeSaque(a, 'A1')).toEqual({ n: 1, total: 1, pct: 100 });
    expect(confirmacaoDeSaque(a, 'B1')).toEqual({ n: 1, total: 1, pct: 100 });
  });

  it('tie-break semeado (3x3): quem saca vem da rotação', () => {
    const seed = { gamesA: 3, gamesB: 3 };
    // sem pontos e com sequência vazia (jogos anteriores desconhecidos) não há como sugerir
    expect(sacadorNoTiebreak([], md3, [], ['A1', 'A2'], ['B1', 'B2'], true, seed)).toBeNull();
    // depois do 1º ponto o 1º sacador conhecido é o de quem sacou
    const pts = [ponto('A1', 'A')];
    expect(sacadorNoTiebreak(pts, md3, [], ['A1', 'A2'], ['B1', 'B2'], true, seed)).toBe('B1');
  });
});
