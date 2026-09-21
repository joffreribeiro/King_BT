import { classifySet, isDecidingSet, reachedDecidingSet } from '../setOutcome';
import type { SetScore } from '../types';

// Item 4 foi marcado como "não é bug" — a lógica de classifySet estava
// correta; o erro anterior estava na minha suposição de teste (eu passava
// `winRule: {}` que defaultava `superTiebreak: true`). Esta auditoria
// confirma a lógica:

describe('classifySet — classificação de sets normais, tie-breaks e super tie-breaks', () => {
  it('set normal: perdedor com menos games que tieAt', () => {
    const sets: SetScore[] = [{ a: 6, b: 2 }];
    expect(classifySet(0, sets, undefined)).toBe('normal');
  });

  it('tie-break em deuce mode: perdedor tem 5 games (tieAt = games-1)', () => {
    // Com deuce mode, tieAt = games - 1 = 5. Um set 6-5 passou pelo tie-break.
    // loserGames = Math.min(6, 5) = 5. 5 === tieAt? Sim, é tie-break.
    const sets: SetScore[] = [{ a: 6, b: 5 }];
    expect(classifySet(0, sets, { tiebreakAt: 'deuce' })).toBe('tiebreak');
  });

  it('tie-break em full mode: perdedor tem 6 games (tieAt = games)', () => {
    // Com full mode, tieAt = games = 6. Um set 7-6 passou pelo tie-break.
    // loserGames = Math.min(7, 6) = 6. 6 === tieAt? Sim, é tie-break.
    const sets: SetScore[] = [{ a: 7, b: 6 }];
    expect(classifySet(0, sets, { tiebreakAt: 'full' })).toBe('tiebreak');
  });

  it('super tie-break: terceiro set em partida 1-1', () => {
    // Match com 2 sets (máximo 3). Partida 1-1 (dois primeiros sets divididos).
    // Terceiro set é decisivo, disputado em super tie-break (pontos, não games).
    const sets: SetScore[] = [
      { a: 6, b: 4 }, // Set 0: A venceu
      { a: 4, b: 6 }, // Set 1: B venceu
      { a: 10, b: 8 }, // Set 2: A venceu em super tie-break
    ];
    // isDecidingSet espera DerivedWinRule com superTb (não superTiebreak).
    const derivedRule = { maxSets: 3, setsToWin: 2, superTb: true, superTbPts: 10, gamesWin: 6, tieAt: 6 };
    expect(isDecidingSet(2, sets.slice(0, 2), derivedRule as any)).toBe(true);
    expect(classifySet(2, sets, { superTiebreak: true })).toBe('superTiebreak');
  });

  it('set inexistente retorna normal', () => {
    const sets: SetScore[] = [];
    expect(classifySet(5, sets, undefined)).toBe('normal');
  });

  it('superTiebreak desabilitado: nenhum set é decisivo, mesmo em empate', () => {
    const sets: SetScore[] = [
      { a: 6, b: 4 },
      { a: 4, b: 6 },
      { a: 6, b: 4 }, // Terceiro set, mas sem super tie-break
    ];
    // Com superTiebreak: false, o terceiro set não é "decidindo", é normal.
    const ruleNoStb = { maxSets: 3, setsToWin: 2, superTb: false, superTbPts: 10, gamesWin: 6, tieAt: 6 };
    expect(isDecidingSet(2, sets.slice(0, 2), ruleNoStb as any)).toBe(false);
    expect(classifySet(2, sets, { superTiebreak: false })).toBe('normal');
  });
});

describe('reachedDecidingSet — confirmação de que foi ao final', () => {
  it('três sets (com maxSets: 3 padrão) em empate: chegou ao decisivo', () => {
    // reachedDecidingSet retorna true se sets.length === rule.maxSets.
    // Com winRule padrão, maxSets = 3.
    // Se chegou ao terceiro set, é porque chegou ao set decisivo.
    const sets: SetScore[] = [
      { a: 6, b: 4 },
      { a: 4, b: 6 },
      { a: 10, b: 8 }, // Terceiro set (super tie-break)
    ];
    expect(reachedDecidingSet(sets, { superTiebreak: true })).toBe(true);
  });

  it('dois sets (maxSets: 3): não chegou ao decisivo', () => {
    const sets: SetScore[] = [
      { a: 6, b: 4 },
      { a: 6, b: 2 }, // A ganhou, 2-0
    ];
    expect(reachedDecidingSet(sets, { superTiebreak: true })).toBe(false);
  });

  it('um set, sem winRule: retorna false', () => {
    const sets: SetScore[] = [{ a: 6, b: 4 }];
    expect(reachedDecidingSet(sets, undefined)).toBe(false);
  });
});
