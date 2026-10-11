import { withCompetitionScoring, DEFAULT_SCORING } from '../scoringConfig';
import { competitionFromForm, emptyForm, missingFields, ownScoringOf } from '../competitionPlan';

const form = (over: Partial<ReturnType<typeof emptyForm>> = {}) => ({
  ...emptyForm(), name: 'X', format: 'super8' as const, unit: 'duplas' as const, gender: 'misto' as const, level: 'Aberta', presetIndex: 0, ...over,
});

describe('pontuação própria da competição', () => {
  it('sem pontuação própria segue a fórmula do grupo', () => {
    expect(withCompetitionScoring(DEFAULT_SCORING, undefined)).toBe(DEFAULT_SCORING);
    expect(withCompetitionScoring(DEFAULT_SCORING, { scoring: {} })).toBe(DEFAULT_SCORING);
  });
  it('com pontuação própria usa os 4 coeficientes e mantém os demais ajustes do grupo', () => {
    const grupo = { ...DEFAULT_SCORING, minGames: 3 };
    const r = withCompetitionScoring(grupo, { scoring: { custom: { winCoef: 5, playedCoef: 1, gaCoef: 4, eventCoef: 2 } } });
    expect(r).toMatchObject({ winCoef: 5, playedCoef: 1, gaCoef: 4, eventCoef: 2, minGames: 3 });
  });
  it('números inválidos caem na fórmula do grupo', () => {
    expect(withCompetitionScoring(DEFAULT_SCORING, { scoring: { custom: { winCoef: -1, playedCoef: 1, gaCoef: 1 } } })).toBe(DEFAULT_SCORING);
  });
  it('formulário: desligada não grava nada; ligada grava custom; inválida pede correção', () => {
    expect(competitionFromForm(form()).config.scoring).toBeUndefined();
    const f = form({ ownScoring: true, scWin: '4', scPlayed: '1,5', scGa: '3', scEvent: '0' });
    expect(competitionFromForm(f).config.scoring).toEqual({ custom: { winCoef: 4, playedCoef: 1.5, gaCoef: 3, eventCoef: 0 } });
    expect(ownScoringOf(form({ ownScoring: true, scWin: 'abc' }))).toBeNull();
    expect(missingFields(form({ ownScoring: true, scWin: '' }))).toContain('pontuação (números de 0 a 100)');
    expect(missingFields(form({ ownScoring: false, scWin: '' }))).not.toContain('pontuação (números de 0 a 100)');
  });
});
