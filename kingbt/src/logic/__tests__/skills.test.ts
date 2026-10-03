import { clampSkill, cleanSkills, skillAverage, radarPoint, radarPolygon, SKILLS } from '@/logic/skills';

describe('skills', () => {
  it('nota é inteira de 1 a 10', () => {
    expect(clampSkill(6)).toBe(6);
    expect(clampSkill(6.6)).toBe(7);
    expect(clampSkill(0)).toBe(1);
    expect(clampSkill(-3)).toBe(1);
    expect(clampSkill(99)).toBe(10);
    expect(clampSkill(NaN)).toBe(1);
    expect(clampSkill('x')).toBe(1);
  });
  it('cleanSkills mantém só chaves conhecidas e limpa os valores', () => {
    expect(cleanSkills({ smash: 12, lob: 5 } as any)).toEqual({ smash: 10, lob: 5 });
    expect(cleanSkills({ foo: 3 } as any)).toEqual({});
    expect(cleanSkills(undefined)).toEqual({});
  });
  it('média só das preenchidas', () => {
    expect(skillAverage({})).toBeNull();
    expect(skillAverage({ smash: 6, lob: 5 })).toBe(5.5);
  });
  it('geometria: eixo 0 aponta para cima, raio proporcional à nota', () => {
    const top = radarPoint(0, 10, 1, 100, 100, 50);
    expect(top.x).toBeCloseTo(100); expect(top.y).toBeCloseTo(50);
    const poly = radarPolygon(SKILLS.map(() => 5), 100, 100, 50);
    expect(poly).toHaveLength(SKILLS.length);
    expect(poly[0].y).toBeCloseTo(75);
    // nota mínima (1) fica a 10% do raio, perto do centro
    const one = radarPolygon([1, 1, 1, 1], 100, 100, 50);
    expect(one[0].y).toBeCloseTo(95);
  });
});

describe('withDefaults', () => {
  it('habilidade sem nota começa em 5; as com nota são mantidas', () => {
    const r = require('@/logic/skills').withDefaults({ smash: 8 });
    expect(r.smash).toBe(8);
    expect(r.lob).toBe(5);
    expect(Object.keys(r)).toHaveLength(10);
    expect(require('@/logic/skills').withDefaults(undefined).mental).toBe(5);
  });
});

describe('communityAverage', () => {
  const { communityAverage } = require('@/logic/skills');
  it('sem avaliações não tem média', () => {
    expect(communityAverage([])).toEqual({ avg: null, count: 0 });
    expect(communityAverage([undefined, {}])).toEqual({ avg: null, count: 0 });
  });
  it('média por habilidade entre quem avaliou, com 1 casa', () => {
    const r = communityAverage([{ smash: 8, lob: 5 }, { smash: 5, lob: 6 }, { smash: 6 }]);
    expect(r.count).toBe(3);
    expect(r.avg.smash).toBe(6.3);
    expect(r.avg.lob).toBe(5.5);
    expect(r.avg.saque).toBe(0);
  });
});
