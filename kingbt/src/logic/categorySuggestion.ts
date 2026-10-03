import { SKILLS, cleanSkills, withDefaults, type SkillKey, type Skills } from './skills';
import { CATEGORIES, type Category } from './playerAbout';

/**
 * Categoria sugerida pelo Radar (mesmo método do Atlas): cada avaliação vira uma
 * nota de 0 a 100 = soma das notas × peso de cada habilidade (até 90) + um bônus
 * pela "categoria percebida" (em que categoria quem avalia acha que o jogador
 * joga; na autoavaliação, a categoria que o próprio jogador declarou). A nota
 * final mistura a autoavaliação com a média dos colegas, e quanto mais colegas
 * avaliam, mais a opinião deles pesa. Tudo calibrável aqui.
 */
export const SKILL_WEIGHTS: Record<SkillKey, number> = {
  voleio: 12, defesa: 11, movimentacao: 11, posicionamento: 10, smash: 9,
  saque: 8, consistencia: 8, lob: 7, curtinha: 7, mental: 7,
};

/** Pontos somados à nota pela categoria percebida (Open vale mais). Sem categoria = 0. */
export const CATEGORY_BONUS: Record<Category, number> = { Open: 10, A: 8, B: 6, C: 4, D: 2, Iniciante: 1 };

/** Mínimo de habilidades preenchidas para uma avaliação valer para a categoria. */
export const MIN_SKILLS = 5;
/** Só as avaliações mais recentes entram na média da comunidade. */
export const MAX_RECENT = 20;

/** Nota mínima (0 a 100) de cada categoria, da mais alta para a mais baixa; abaixo de D é Iniciante. */
export type CategoryCuts = Record<'Open' | 'A' | 'B' | 'C' | 'D', number>;
export const CUT_ORDER = ['Open', 'A', 'B', 'C', 'D'] as const;
export const DEFAULT_CATEGORY_CUTS: CategoryCuts = { Open: 90, A: 80, B: 62, C: 50, D: 30 };

/** Cortes válidos: números de 1 a 100, cada categoria acima da seguinte. */
export function isValidCategoryCuts(c: unknown): c is CategoryCuts {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  let prev = 101;
  for (const k of CUT_ORDER) {
    const v = o[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 100 || v >= prev) return false;
    prev = v;
  }
  return true;
}

/** Lê cortes brutos (Firestore ou formulário); inválidos voltam ao padrão. */
export function validateCategoryCuts(raw: unknown): CategoryCuts {
  if (!isValidCategoryCuts(raw)) return DEFAULT_CATEGORY_CUTS;
  const r = raw as CategoryCuts;
  return { Open: r.Open, A: r.A, B: r.B, C: r.C, D: r.D };
}

/** Peso da autoavaliação e da comunidade conforme quantos colegas avaliaram. */
export function blendWeights(count: number): { self: number; community: number } {
  if (count <= 0) return { self: 1, community: 0 };
  if (count <= 5) return { self: 0.9, community: 0.1 };
  if (count <= 10) return { self: 0.8, community: 0.2 };
  if (count <= 20) return { self: 0.5, community: 0.5 };
  return { self: 0.2, community: 0.8 };
}

/**
 * Nota de uma avaliação, de 0 a 100: habilidades (até 90) + bônus da categoria
 * percebida (até 10). null se faltam habilidades.
 */
export function skillScore(s: Skills | undefined, perceived?: Category | null): number | null {
  if (Object.keys(cleanSkills(s)).length < MIN_SKILLS) return null;
  const w = withDefaults(s);
  let sum = 0;
  for (const { key } of SKILLS) sum += w[key] * SKILL_WEIGHTS[key];
  return sum / 10 + (perceived ? CATEGORY_BONUS[perceived] : 0);
}

export function categoryFromScore(score: number, cuts: CategoryCuts = DEFAULT_CATEGORY_CUTS): Category {
  for (const k of CUT_ORDER) if (score >= cuts[k]) return k;
  return 'Iniciante';
}

export interface RatingInput {
  skills: Skills;
  /** Categoria em que quem avaliou acha que o jogador está (opcional). */
  category?: Category;
  /** Quando foi gravada (ms). Sem data, conta como a mais recente. */
  updatedAtMs?: number;
}

export type Confidence = 'baixa' | 'media' | 'alta';

export interface CategorySuggestion {
  category: Category;
  /** Nota final de 0 a 100. */
  score: number;
  selfScore: number | null;
  communityScore: number | null;
  /** Avaliações válidas de colegas (todas, não só as 20 mais recentes). */
  count: number;
  weights: { self: number; community: number };
  confidence: Confidence;
}

/** Sugestão de categoria, ou null se não há nem autoavaliação nem avaliação de colegas válidas. */
export function suggestCategory(
  self: Skills | undefined, ratings: RatingInput[], selfCategory?: Category | null, cuts: CategoryCuts = DEFAULT_CATEGORY_CUTS,
): CategorySuggestion | null {
  const selfScore = skillScore(self, selfCategory);
  const valid = ratings
    .map(r => ({ score: skillScore(r.skills, r.category), at: r.updatedAtMs ?? Number.MAX_SAFE_INTEGER }))
    .filter((r): r is { score: number; at: number } => r.score != null);
  const recent = [...valid].sort((a, b) => b.at - a.at).slice(0, MAX_RECENT);
  const communityScore = recent.length ? recent.reduce((a, r) => a + r.score, 0) / recent.length : null;
  const count = valid.length;

  if (selfScore == null && communityScore == null) return null;
  let score: number;
  let weights = blendWeights(count);
  if (selfScore == null) { score = communityScore as number; weights = { self: 0, community: 1 }; }
  else if (communityScore == null) { score = selfScore; weights = { self: 1, community: 0 }; }
  else score = selfScore * weights.self + communityScore * weights.community;

  const confidence: Confidence = count > 10 ? 'alta' : count > 5 ? 'media' : 'baixa';
  return { category: categoryFromScore(score, cuts), score: Math.round(score * 10) / 10, selfScore, communityScore, count, weights, confidence };
}

/** Texto curto de onde vem a sugestão, para mostrar junto da categoria. */
export function suggestionBasis(s: CategorySuggestion): string {
  if (s.count === 0) return 'Baseada só na sua autoavaliação. Peça avaliações aos colegas para ficar mais precisa.';
  const who = s.count === 1 ? '1 avaliação de colega' : `${s.count} avaliações de colegas`;
  if (s.selfScore == null) return `Baseada em ${who} (sem autoavaliação).`;
  const pc = Math.round(s.weights.community * 100);
  return `Baseada na autoavaliação (${100 - pc}%) e em ${who} (${pc}%).`;
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  baixa: 'Poucos dados',
  media: 'Confiança média',
  alta: 'Confiança alta',
};

export const isCategory = (v: unknown): v is Category => (CATEGORIES as readonly string[]).includes(v as string);
