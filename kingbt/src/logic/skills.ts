/** Habilidades avaliadas no Radar do perfil (nota de 1 a 10), na ordem em que aparecem no gráfico. */
export const SKILLS = [
  { key: 'smash',        label: 'Smash',          short: 'Smash',   emoji: '💥' },
  { key: 'lob',          label: 'Lob',            short: 'Lob',     emoji: '🌙' },
  { key: 'defesa',       label: 'Defesa',         short: 'Defesa',  emoji: '🛡️' },
  { key: 'voleio',       label: 'Voleio',         short: 'Voleio',  emoji: '⚔️' },
  { key: 'curtinha',     label: 'Curtinha',       short: 'Curtinha', emoji: '🪶' },
  { key: 'saque',        label: 'Saque',          short: 'Saque',   emoji: '🎾' },
  { key: 'movimentacao', label: 'Movimentação',   short: 'Movim.',  emoji: '👟' },
  { key: 'posicionamento', label: 'Posicionamento', short: 'Posic.', emoji: '📍' },
  { key: 'mental',       label: 'Mental',         short: 'Mental',  emoji: '🧠' },
  { key: 'consistencia', label: 'Consistência',   short: 'Consist.', emoji: '🎯' },
] as const;

export type SkillKey = typeof SKILLS[number]['key'];
export type Skills = Partial<Record<SkillKey, number>>;

export const SKILL_MIN = 1;
export const SKILL_MAX = 10;

/** Nota inteira de 1 a 10; qualquer outra coisa (inclusive 0 de versões antigas) vira 1. */
export function clampSkill(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : SKILL_MIN;
  return Math.max(SKILL_MIN, Math.min(SKILL_MAX, v));
}

/** Só as notas conhecidas, já limpas — para gravar no Firestore sem `undefined`. */
export function cleanSkills(s: Skills | undefined): Skills {
  const out: Skills = {};
  for (const { key } of SKILLS) {
    if (s && s[key] != null) out[key] = clampSkill(s[key]);
  }
  return out;
}

/** Média das notas preenchidas, ou null se não há nenhuma. */
export function skillAverage(s: Skills | undefined): number | null {
  const vals = SKILLS.map(({ key }) => s?.[key]).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export interface Pt { x: number; y: number }

/** Ponto do eixo `i` (de `n`) a `frac` (0–1) do raio, começando no topo e girando no sentido horário. */
export function radarPoint(i: number, n: number, frac: number, cx: number, cy: number, r: number): Pt {
  const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
  return { x: cx + Math.cos(ang) * r * frac, y: cy + Math.sin(ang) * r * frac };
}

/** Vértices do polígono das notas. */
export function radarPolygon(values: number[], cx: number, cy: number, r: number): Pt[] {
  return values.map((v, i) => radarPoint(i, values.length, clampSkill(v) / SKILL_MAX, cx, cy, r));
}

/** Nota inicial de toda habilidade ainda não avaliada. */
export const SKILL_DEFAULT = 5;

/** Todas as habilidades com nota: as que faltam começam em 5. */
export function withDefaults(s: Skills | undefined): Record<SkillKey, number> {
  const out = {} as Record<SkillKey, number>;
  for (const { key } of SKILLS) out[key] = s && s[key] != null ? clampSkill(s[key]) : SKILL_DEFAULT;
  return out;
}

export interface CommunityAverage {
  /** Média por habilidade (1 casa decimal) entre quem avaliou; null se ninguém avaliou. */
  avg: Record<SkillKey, number> | null;
  /** Quantas pessoas avaliaram. */
  count: number;
}

/** Média das avaliações dos outros jogadores, habilidade por habilidade. */
export function communityAverage(ratings: (Skills | undefined)[]): CommunityAverage {
  const valid = ratings.filter((r): r is Skills => !!r && Object.keys(cleanSkills(r)).length > 0);
  if (valid.length === 0) return { avg: null, count: 0 };
  const avg = {} as Record<SkillKey, number>;
  for (const { key } of SKILLS) {
    const vals = valid.map(r => r[key]).filter((v): v is number => v != null).map(clampSkill);
    avg[key] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
  }
  return { avg, count: valid.length };
}
