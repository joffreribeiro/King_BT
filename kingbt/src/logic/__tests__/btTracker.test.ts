// btTracker.ts importa AsyncStorage para persistência local; usa o mock
// oficial do pacote para rodar em Jest (não há setup global de mocks no projeto).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import {
  calcularEstatisticas, placardInicial, avancaPonto, setsDoPlacard, winRuleFromComp,
  type BtAnalise, type BtPonto, type BtPlacardState,
} from '../btTracker';

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

// ─── Super tie-break decisivo ───────────────────────────────────────────────
// Antes desta correção o STB entrava no histórico como 0-0: os pontos nunca
// viram games, e era gamesA/gamesB (sempre 0) que ia para o placar salvo.

describe('avancaGame — super tie-break registra o placar disputado', () => {
  const RULE = { sets: 3, games: 4, tiebreak: 7, superTiebreak: true, superTiebreakPts: 10 };
  const ganharGame = (pl: BtPlacardState, d: 'A' | 'B') => {
    for (let i = 0; i < 4; i++) pl = avancaPonto(pl, d);
    return pl;
  };

  function partidaAteSTB(): BtPlacardState {
    let pl = placardInicial(RULE);
    for (let g = 0; g < 4; g++) pl = ganharGame(pl, 'A'); // set 1: 4-0
    for (let g = 0; g < 4; g++) pl = ganharGame(pl, 'B'); // set 2: 0-4
    return pl;
  }

  it('ativa o super tie-break em 1-1', () => {
    const pl = partidaAteSTB();
    expect(pl.setsA).toBe(1);
    expect(pl.setsB).toBe(1);
    expect(pl.superTiebreakAtivo).toBe(true);
    expect(pl.historicStb).toEqual([false, false]);
  });

  it('grava os pontos do STB, não 0-0, e marca o set', () => {
    let pl = partidaAteSTB();
    for (let i = 0; i < 8; i++) pl = avancaPonto(pl, 'B');
    for (let i = 0; i < 10; i++) pl = avancaPonto(pl, 'A'); // 10-8 para A

    expect(pl.encerrada).toBe(true);
    expect(pl.winnerDupla).toBe('A');
    expect(pl.historicGamesA).toEqual([4, 0, 10]);
    expect(pl.historicGamesB).toEqual([0, 4, 8]);
    expect(pl.historicStb).toEqual([false, false, true]);
  });

  it('setsDoPlacard leva a marca para o placar salvo', () => {
    let pl = partidaAteSTB();
    for (let i = 0; i < 8; i++) pl = avancaPonto(pl, 'B');
    for (let i = 0; i < 10; i++) pl = avancaPonto(pl, 'A');

    expect(setsDoPlacard(pl)).toEqual([
      { a: 4, b: 0 },
      { a: 0, b: 4 },
      { a: 10, b: 8, stb: true },
    ]);
  });

  it("tie-break normal em 'deuce' (padrão): 3-3 e set fecha em 4-3", () => {
    // Preset padrão do app: "MD3 · 4 games, tie 7 em 3-3".
    let pl = placardInicial({ ...RULE, superTiebreak: false, tiebreakAt: 'deuce' });
    // Alterna os games até 3-3 — quatro seguidos fechariam o set em 4-0.
    for (let g = 0; g < 3; g++) { pl = ganharGame(pl, 'A'); pl = ganharGame(pl, 'B'); }
    expect(pl.gamesA).toBe(3);
    expect(pl.gamesB).toBe(3);
    expect(pl.tiebreak).toBe(true);
    expect(pl.superTiebreakAtivo).toBe(false);

    for (let i = 0; i < 7; i++) pl = avancaPonto(pl, 'A'); // vence o tie-break
    // O set fecha em games (4-3), não nos pontos do tie-break.
    expect(pl.historicGamesA).toEqual([4]);
    expect(pl.historicGamesB).toEqual([3]);
    expect(pl.historicStb).toEqual([false]);
  });

  it("tie-break normal em 'full': 4-4 e set fecha em 5-4", () => {
    let pl = placardInicial({ ...RULE, superTiebreak: false, tiebreakAt: 'full' });
    for (let g = 0; g < 4; g++) { pl = ganharGame(pl, 'A'); pl = ganharGame(pl, 'B'); }
    expect(pl.gamesA).toBe(4);
    expect(pl.gamesB).toBe(4);
    expect(pl.tiebreak).toBe(true);

    for (let i = 0; i < 7; i++) pl = avancaPonto(pl, 'A');
    expect(pl.historicGamesA).toEqual([5]);
    expect(pl.historicGamesB).toEqual([4]);
    expect(pl.historicStb).toEqual([false]);
  });

  it("em 'deuce' o set não passa de G games", () => {
    // Era o bug: o motor ao vivo ignorava tiebreakAt e seguia até 4-4 / 5-4
    // mesmo no preset "tie em 3-3", registrando placares que o registro
    // manual considera impossíveis.
    let pl = placardInicial({ ...RULE, superTiebreak: false, tiebreakAt: 'deuce' });
    for (let g = 0; g < 3; g++) { pl = ganharGame(pl, 'A'); pl = ganharGame(pl, 'B'); }
    for (let i = 0; i < 7; i++) pl = avancaPonto(pl, 'B');
    expect(Math.max(...pl.historicGamesA, ...pl.historicGamesB)).toBeLessThanOrEqual(4);
  });

  it("winRuleFromComp repassa tiebreakAt da competição", () => {
    expect(winRuleFromComp({ games: 4, tiebreakAt: 'full' }).tiebreakAt).toBe('full');
    // Sem configuração explícita vale o padrão dos presets.
    expect(winRuleFromComp({ games: 4 }).tiebreakAt).toBe('deuce');
  });
});
