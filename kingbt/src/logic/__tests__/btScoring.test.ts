jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { getBeachTennisScoreState, isValidFinalScore, getScoreHint } from '../btScoring';
import { placardInicial, avancaPonto, type BtPlacardState, type BtWinRule } from '../btTracker';

// Regra do tênis clássico: 6 games, tie-break em 6-6. No modelo do app isso é
// `tiebreakAt: 'full'` — o padrão dos presets é 'deuce' (tie em 5-5).
const FULL6 = { games: 6, tiebreak: 7, tiebreakAt: 'full' as const };

describe('getBeachTennisScoreState — regra padrão (6 games, TB 7)', () => {
  it('reconhece placares finais diretos (6-0 até 6-4)', () => {
    expect(getBeachTennisScoreState(6, 0, FULL6)).toBe('done');
    expect(getBeachTennisScoreState(6, 2, FULL6)).toBe('done');
    expect(getBeachTennisScoreState(6, 4, FULL6)).toBe('done');
    expect(getBeachTennisScoreState(0, 6, FULL6)).toBe('done');
  });

  it('reconhece vitória por 7-5 após empate em 5-5', () => {
    expect(getBeachTennisScoreState(7, 5, FULL6)).toBe('done');
    expect(getBeachTennisScoreState(5, 7, FULL6)).toBe('done');
  });

  it('reconhece vitória no tie-break (7-6)', () => {
    expect(getBeachTennisScoreState(7, 6, FULL6)).toBe('done');
    expect(getBeachTennisScoreState(6, 7, FULL6)).toBe('done');
  });

  it('6-5 ainda não é fim de set', () => {
    expect(getBeachTennisScoreState(6, 5, FULL6)).toBe('advantage');
  });

  it("em 'full', 5-5 ainda é jogo normal (o tie-break é em 6-6)", () => {
    expect(getBeachTennisScoreState(5, 5, FULL6)).toBe('normal');
  });

  it('6-6 vai para tie-break', () => {
    expect(getBeachTennisScoreState(6, 6, FULL6)).toBe('tiebreak');
  });

  it('placar em andamento é normal', () => {
    expect(getBeachTennisScoreState(0, 0, FULL6)).toBe('normal');
    expect(getBeachTennisScoreState(3, 2, FULL6)).toBe('normal');
    expect(getBeachTennisScoreState(5, 4, FULL6)).toBe('normal');
  });

  it('rejeita placares impossíveis', () => {
    expect(getBeachTennisScoreState(-1, 0)).toBe('invalid');
    expect(getBeachTennisScoreState(8, 0, FULL6)).toBe('invalid');
    expect(getBeachTennisScoreState(7, 3, FULL6)).toBe('invalid'); // 7 só via 7-5 ou 7-6
    expect(getBeachTennisScoreState(7, 7, FULL6)).toBe('invalid');
  });
});

describe("getBeachTennisScoreState — set curto (4 games, TB 7, tie em 4-4)", () => {
  // 5-3 / 4-4 / 5-4 são a regra 'full'. No padrão do app ('deuce') o mesmo set
  // de 4 games vai a 3-3 e fecha em 4-3 — coberto no describe mais abaixo.
  const rule = { games: 4, tiebreak: 7, tiebreakAt: 'full' as const };

  it('finais diretos: 4-0 até 4-2', () => {
    expect(getBeachTennisScoreState(4, 0, rule)).toBe('done');
    expect(getBeachTennisScoreState(4, 2, rule)).toBe('done');
  });

  it('5-3 e 5-4 são finais válidos', () => {
    expect(getBeachTennisScoreState(5, 3, rule)).toBe('done');
    expect(getBeachTennisScoreState(5, 4, rule)).toBe('done');
  });

  it("3-3 é jogo normal, 4-4 é tie-break", () => {
    expect(getBeachTennisScoreState(3, 3, rule)).toBe('normal');
    expect(getBeachTennisScoreState(4, 4, rule)).toBe('tiebreak');
  });

  it('4-3 ainda não é fim', () => {
    expect(getBeachTennisScoreState(4, 3, rule)).toBe('advantage');
  });
});

describe('isValidFinalScore', () => {
  it('aceita apenas estados done', () => {
    expect(isValidFinalScore(6, 4, FULL6)).toBe(true);
    expect(isValidFinalScore(7, 6, FULL6)).toBe(true);
    expect(isValidFinalScore(6, 5, FULL6)).toBe(false);
    expect(isValidFinalScore(6, 6, FULL6)).toBe(false);
    expect(isValidFinalScore(3, 2, FULL6)).toBe(false);
  });
});

describe('getScoreHint', () => {
  it('avisa do tie-break em 6-6', () => {
    expect(getScoreHint(6, 6, FULL6)).toContain('Tie-break');
  });

  it("avisa que falta a vantagem de 2 em 6-5", () => {
    expect(getScoreHint(6, 5, FULL6)).toContain('7');
  });

  it('sem hint para placar normal ou final', () => {
    expect(getScoreHint(2, 1, FULL6)).toBeNull();
    expect(getScoreHint(6, 3, FULL6)).toBeNull();
  });
});

// ─── tiebreakAt: os dois modos, e os dois motores de acordo ────────────────

describe('getBeachTennisScoreState — respeita o ponto de tie-break', () => {
  // Preset padrão do app: "MD3 · 4 games, tie 7 em 3-3"
  const DEUCE4 = { games: 4, tiebreak: 7, tiebreakAt: 'deuce' as const };
  // "MD1 · 4 games, tie 7 em 4-4"
  const FULL4 = { games: 4, tiebreak: 7, tiebreakAt: 'full' as const };

  it("'deuce': tie-break em 3-3, set fecha em 4-3", () => {
    expect(getBeachTennisScoreState(3, 3, DEUCE4)).toBe('tiebreak');
    expect(getBeachTennisScoreState(4, 3, DEUCE4)).toBe('done');
    expect(getBeachTennisScoreState(4, 0, DEUCE4)).toBe('done');
    expect(getBeachTennisScoreState(3, 2, DEUCE4)).toBe('normal');
    // 4-4 e 5-4 não existem neste modo
    expect(getBeachTennisScoreState(4, 4, DEUCE4)).toBe('invalid');
    expect(getBeachTennisScoreState(5, 4, DEUCE4)).toBe('invalid');
  });

  it("'full': 3-3 segue normal, tie-break em 4-4, set fecha em 5-4", () => {
    expect(getBeachTennisScoreState(3, 3, FULL4)).toBe('normal');
    expect(getBeachTennisScoreState(4, 3, FULL4)).toBe('advantage');
    expect(getBeachTennisScoreState(4, 4, FULL4)).toBe('tiebreak');
    expect(getBeachTennisScoreState(5, 4, FULL4)).toBe('done');
    expect(getBeachTennisScoreState(4, 2, FULL4)).toBe('done');
  });

  it('o aviso ao árbitro usa o ponto configurado', () => {
    expect(getScoreHint(3, 3, DEUCE4)).toContain('3-3');
    expect(getScoreHint(4, 4, FULL4)).toContain('4-4');
  });
});

describe('btTracker e btScoring concordam sobre o fim do set', () => {
  // Joga games alternados até o set fechar e compara, a cada passo, o veredito
  // do motor ao vivo com o do validador. Era exatamente aqui que os dois
  // divergiam: o motor ao vivo ignorava tiebreakAt e jogava sempre 'full'.
  function simular(rule: BtWinRule) {
    const winGame = (p: BtPlacardState, d: 'A' | 'B') => {
      // num tie-break o game é decidido a pontos; joga o suficiente para fechar
      for (let i = 0; i < 40; i++) {
        const antes = p.historicGamesA.length;
        p = avancaPonto(p, d);
        if (p.historicGamesA.length > antes || (!p.tiebreak && p.pontosA === 0 && p.pontosB === 0)) break;
      }
      return p;
    };
    let pl = placardInicial(rule);
    const passos: { a: number; b: number; fechado: boolean }[] = [];
    let lado: 'A' | 'B' = 'A';
    for (let i = 0; i < 30 && pl.historicGamesA.length === 0; i++) {
      const a = pl.gamesA, b = pl.gamesB;
      pl = winGame(pl, lado);
      lado = lado === 'A' ? 'B' : 'A';
      const fechado = pl.historicGamesA.length > 0;
      passos.push({ a: fechado ? pl.historicGamesA[0] : pl.gamesA, b: fechado ? pl.historicGamesB[0] : pl.gamesB, fechado });
      if (fechado) break;
      void a; void b;
    }
    return passos;
  }

  for (const rule of [
    { sets: 1, games: 4, tiebreak: 7, tiebreakAt: 'deuce' as const },
    { sets: 1, games: 4, tiebreak: 7, tiebreakAt: 'full' as const },
    { sets: 1, games: 6, tiebreak: 7, tiebreakAt: 'deuce' as const },
    { sets: 1, games: 6, tiebreak: 7, tiebreakAt: 'full' as const },
  ]) {
    it(`${rule.games} games / ${rule.tiebreakAt}`, () => {
      const passos = simular(rule);
      expect(passos.length).toBeGreaterThan(0);
      for (const p of passos) {
        const estado = getBeachTennisScoreState(p.a, p.b, rule);
        if (p.fechado) expect(estado).toBe('done');
        else expect(estado).not.toBe('done');
      }
    });
  }
});
