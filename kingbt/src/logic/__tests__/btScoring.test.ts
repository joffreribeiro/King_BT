import { getBeachTennisScoreState, isValidFinalScore, getScoreHint } from '../btScoring';

describe('getBeachTennisScoreState — regra padrão (6 games, TB 7)', () => {
  it('reconhece placares finais diretos (6-0 até 6-4)', () => {
    expect(getBeachTennisScoreState(6, 0)).toBe('done');
    expect(getBeachTennisScoreState(6, 2)).toBe('done');
    expect(getBeachTennisScoreState(6, 4)).toBe('done');
    expect(getBeachTennisScoreState(0, 6)).toBe('done');
  });

  it('reconhece vitória por 7-5 após empate em 5-5', () => {
    expect(getBeachTennisScoreState(7, 5)).toBe('done');
    expect(getBeachTennisScoreState(5, 7)).toBe('done');
  });

  it('reconhece vitória no tie-break (7-6)', () => {
    expect(getBeachTennisScoreState(7, 6)).toBe('done');
    expect(getBeachTennisScoreState(6, 7)).toBe('done');
  });

  it('6-5 ainda não é fim de set', () => {
    expect(getBeachTennisScoreState(6, 5)).toBe('advantage');
  });

  it('5-5 exige jogar até 7', () => {
    expect(getBeachTennisScoreState(5, 5)).toBe('advantage');
  });

  it('6-6 vai para tie-break', () => {
    expect(getBeachTennisScoreState(6, 6)).toBe('tiebreak');
  });

  it('placar em andamento é normal', () => {
    expect(getBeachTennisScoreState(0, 0)).toBe('normal');
    expect(getBeachTennisScoreState(3, 2)).toBe('normal');
    expect(getBeachTennisScoreState(5, 4)).toBe('normal');
  });

  it('rejeita placares impossíveis', () => {
    expect(getBeachTennisScoreState(-1, 0)).toBe('invalid');
    expect(getBeachTennisScoreState(8, 0)).toBe('invalid');
    expect(getBeachTennisScoreState(7, 3)).toBe('invalid'); // 7 só via 7-5 ou 7-6
    expect(getBeachTennisScoreState(7, 7)).toBe('invalid');
  });
});

describe('getBeachTennisScoreState — set curto (4 games, TB 7)', () => {
  const rule = { games: 4, tiebreak: 7 };

  it('finais diretos: 4-0 até 4-2', () => {
    expect(getBeachTennisScoreState(4, 0, rule)).toBe('done');
    expect(getBeachTennisScoreState(4, 2, rule)).toBe('done');
  });

  it('5-3 e 5-4 são finais válidos', () => {
    expect(getBeachTennisScoreState(5, 3, rule)).toBe('done');
    expect(getBeachTennisScoreState(5, 4, rule)).toBe('done');
  });

  it('3-3 é advantage, 4-4 é tie-break', () => {
    expect(getBeachTennisScoreState(3, 3, rule)).toBe('advantage');
    expect(getBeachTennisScoreState(4, 4, rule)).toBe('tiebreak');
  });

  it('4-3 ainda não é fim', () => {
    expect(getBeachTennisScoreState(4, 3, rule)).toBe('advantage');
  });
});

describe('isValidFinalScore', () => {
  it('aceita apenas estados done', () => {
    expect(isValidFinalScore(6, 4)).toBe(true);
    expect(isValidFinalScore(7, 6)).toBe(true);
    expect(isValidFinalScore(6, 5)).toBe(false);
    expect(isValidFinalScore(6, 6)).toBe(false);
    expect(isValidFinalScore(3, 2)).toBe(false);
  });
});

describe('getScoreHint', () => {
  it('avisa do tie-break em 6-6', () => {
    expect(getScoreHint(6, 6)).toContain('Tie-break');
  });

  it('avisa para jogar até 7 em 5-5', () => {
    expect(getScoreHint(5, 5)).toContain('7');
  });

  it('sem hint para placar normal ou final', () => {
    expect(getScoreHint(2, 1)).toBeNull();
    expect(getScoreHint(6, 3)).toBeNull();
  });
});
