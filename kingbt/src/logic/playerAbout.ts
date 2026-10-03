import { parseBrDate } from './eventDateTime';

/** Categorias, na ordem da lista suspensa (a mesma do Atlas). */
export const CATEGORIES = ['Open', 'A', 'B', 'C', 'D', 'Iniciante'] as const;
export type Category = typeof CATEGORIES[number];

export const HANDS = [
  { key: 'destro', label: 'Destro' },
  { key: 'canhoto', label: 'Canhoto' },
] as const;
export type Hand = typeof HANDS[number]['key'];

export const SIDES = [
  { key: 'direita', label: 'Direita' },
  { key: 'esquerda', label: 'Esquerda' },
  { key: 'ambos', label: 'Ambos' },
] as const;
export type Side = typeof SIDES[number]['key'];

/** Ficha do jogador (aba "Sobre"). Tudo opcional. */
export interface PlayerAbout {
  /** Data de aniversário, "AAAA-MM-DD". A idade é calculada a partir dela. */
  birthday?: string;
  /** Altura em metros, ex.: 1.78 */
  heightM?: number;
  hand?: Hand;
  side?: Side;
  /** Data em que começou a praticar, "AAAA-MM-DD". */
  since?: string;
  category?: Category;
}

/** "1,78" ou "1.78" → 1.78; fora de 1,00–2,50 ou vazio → null. */
export function parseHeight(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 1 || n > 2.5) return null;
  return Math.round(n * 100) / 100;
}

/** 1.78 → "1,78" */
export function formatHeight(m: number | undefined): string {
  return m == null ? '' : m.toFixed(2).replace('.', ',');
}

/** Data de aniversário: data real, não futura, de 1920 em diante. */
export function parseBirthday(text: string, now = new Date()): string | null {
  const iso = parseBrDate(text);
  if (!iso || iso < '1920-01-01') return null;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return iso <= today ? iso : null;
}

/** Idade em anos completos a partir do aniversário, ou null. */
export function ageFromBirthday(iso: string | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  let age = now.getFullYear() - Number(m[1]);
  const month = now.getMonth() + 1;
  if (month < Number(m[2]) || (month === Number(m[2]) && now.getDate() < Number(m[3]))) age -= 1;
  return age >= 0 ? age : null;
}

/** "AAAA-MM-DD" → "DD/MM/AAAA" */
export function isoToBr(iso: string | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Data de início da prática: precisa existir no calendário e não ser futura. */
export function parseSince(text: string, now = new Date()): string | null {
  const iso = parseBrDate(text);
  if (!iso) return null;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return iso <= today ? iso : null;
}

/** "3 anos e 2 meses", "8 meses", "menos de 1 mês" — a partir da data de início. */
export function practiceTime(sinceIso: string | undefined, now = new Date()): string | null {
  if (!sinceIso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sinceIso);
  if (!m) return null;
  let months = (now.getFullYear() - Number(m[1])) * 12 + (now.getMonth() + 1 - Number(m[2]));
  if (now.getDate() < Number(m[3])) months -= 1;
  if (months < 0) return null;
  if (months < 1) return 'menos de 1 mês';
  const y = Math.floor(months / 12), mo = months % 12;
  const ys = y > 0 ? `${y} ${y === 1 ? 'ano' : 'anos'}` : '';
  const ms = mo > 0 ? `${mo} ${mo === 1 ? 'mês' : 'meses'}` : '';
  return [ys, ms].filter(Boolean).join(' e ');
}

/** Remove campos vazios/inválidos — o Firestore não aceita `undefined`. */
export function cleanAbout(a: PlayerAbout): PlayerAbout {
  const out: PlayerAbout = {};
  if (a.birthday) out.birthday = a.birthday;
  if (a.heightM != null) out.heightM = a.heightM;
  if (a.hand) out.hand = a.hand;
  if (a.side) out.side = a.side;
  if (a.since) out.since = a.since;
  if (a.category) out.category = a.category;
  return out;
}
