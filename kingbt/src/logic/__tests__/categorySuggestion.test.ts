import { DEFAULT_CATEGORY_CUTS, validateCategoryCuts, isValidCategoryCuts, skillScore, categoryFromScore, blendWeights, suggestCategory, SKILL_WEIGHTS, CATEGORY_BONUS } from '@/logic/categorySuggestion';
import { SKILLS, type Skills } from '@/logic/skills';

const all = (n: number): Skills => Object.fromEntries(SKILLS.map(s => [s.key, n])) as Skills;

describe('categorySuggestion', () => {
  it('os pesos somam 90', () => {
    expect(Object.values(SKILL_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(90);
  });
  it('nota: habilidades valem até 90 (tudo 10 = 90, tudo 5 = 45)', () => {
    expect(skillScore(all(10))).toBeCloseTo(90);
    expect(skillScore(all(5))).toBeCloseTo(45);
  });
  it('o bônus da categoria percebida soma pontos (até +10)', () => {
    expect(skillScore(all(7), 'B')).toBeCloseTo(63 + CATEGORY_BONUS.B);
    expect(skillScore(all(10), 'Open')).toBeCloseTo(100);
    expect(skillScore(all(5), 'Iniciante')).toBeCloseTo(46);
    expect(skillScore(all(5), null)).toBeCloseTo(45);
  });
  it('avaliação com poucas habilidades não vale', () => {
    expect(skillScore({ smash: 9, lob: 9 })).toBeNull();
    expect(skillScore(undefined)).toBeNull();
  });
  it('faixas de categoria', () => {
    expect([95, 85, 70, 55, 40, 10].map(n => categoryFromScore(n))).toEqual(['Open', 'A', 'B', 'C', 'D', 'Iniciante']);
    expect(categoryFromScore(90)).toBe('Open');
    expect(categoryFromScore(79.9)).toBe('B');
  });
  it('cortes personalizados mudam a categoria', () => {
    const easy = { Open: 80, A: 70, B: 55, C: 40, D: 20 };
    expect(categoryFromScore(72)).toBe('B');
    expect(categoryFromScore(72, easy)).toBe('A');
    expect(suggestCategory(all(8), [], undefined, easy)!.category).toBe('A'); // 72 pontos
  });
  it('validateCategoryCuts: inválido volta ao padrão', () => {
    expect(validateCategoryCuts(undefined)).toEqual(DEFAULT_CATEGORY_CUTS);
    expect(isValidCategoryCuts({ Open: 90, A: 90, B: 62, C: 50, D: 30 })).toBe(false); // não decrescente
    expect(isValidCategoryCuts({ Open: 90, A: 80, B: 62, C: 50, D: 0 })).toBe(false);  // D ≥ 1
    expect(validateCategoryCuts({ Open: 95, A: 85, B: 70, C: 50, D: 25 })).toEqual({ Open: 95, A: 85, B: 70, C: 50, D: 25 });
  });
  it('peso da comunidade cresce com o número de avaliações', () => {
    expect(blendWeights(0)).toEqual({ self: 1, community: 0 });
    expect(blendWeights(5).community).toBe(0.1);
    expect(blendWeights(6).community).toBe(0.2);
    expect(blendWeights(11).community).toBe(0.5);
    expect(blendWeights(21).community).toBe(0.8);
  });
  it('sem dados nenhum: sem sugestão', () => {
    expect(suggestCategory(undefined, [])).toBeNull();
  });
  it('só autoavaliação: vale ela, confiança baixa', () => {
    const r = suggestCategory(all(7), [])!;
    expect(r).toMatchObject({ category: 'B', count: 0, confidence: 'baixa', weights: { self: 1, community: 0 } });
    expect(suggestCategory(all(7), [], 'A')!.score).toBeCloseTo(63 + 8); // categoria declarada entra como bônus
  });
  it('só colegas (sem autoavaliação): vale a média deles', () => {
    const r = suggestCategory(undefined, [{ skills: all(10), category: 'Open' }, { skills: all(10), category: 'A' }])!;
    expect(r).toMatchObject({ category: 'Open', count: 2, selfScore: null });
    expect(r.score).toBeCloseTo(99); // 90 + média do bônus (10 e 8)
  });
  it('muitos colegas puxam a categoria para a opinião deles', () => {
    const colegas = Array.from({ length: 25 }, () => ({ skills: all(4) }));
    const r = suggestCategory(all(9), colegas)!; // auto 81 × 0,2 + comunidade 36 × 0,8 = 45
    expect(r.score).toBeCloseTo(45);
    expect(r.category).toBe('D');
    expect(r.confidence).toBe('alta');
  });
  it('só as 20 mais recentes entram na média da comunidade', () => {
    const velhas = Array.from({ length: 5 }, (_, i) => ({ skills: all(1), updatedAtMs: i }));
    const novas = Array.from({ length: 20 }, (_, i) => ({ skills: all(10), updatedAtMs: 1000 + i }));
    const r = suggestCategory(undefined, [...velhas, ...novas])!;
    expect(r.communityScore).toBeCloseTo(90);
    expect(r.count).toBe(25);
  });
});
