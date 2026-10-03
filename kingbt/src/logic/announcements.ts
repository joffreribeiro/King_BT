/**
 * Comunicados do admin: avisos para o grupo inteiro ("jogo cancelado por chuva", "inscrições abertas").
 * Aparecem no topo da Home de todos. Ficam no campo `announcements` do doc do grupo, onde só o admin escreve.
 */
export interface Announcement {
  id: string;
  /** Título curto (opcional). */
  title?: string;
  text: string;
  /** Quando foi publicado (ISO). */
  date: string;
  /** Até quando vale (ISO). Ausente = sem prazo. */
  expiresAt?: string;
  /** Fixado: fica no topo e não dá para dispensar. */
  pinned?: boolean;
  by?: string;
}

export const ANNOUNCEMENT_TITLE_MAX = 60;
export const ANNOUNCEMENT_TEXT_MAX = 280;
export const ANNOUNCEMENTS_MAX = 50;

/** Opções de validade, em dias (null = sem prazo). */
export const VALIDITY_OPTIONS: { days: number | null; label: string }[] = [
  { days: 3, label: '3 dias' },
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: null, label: 'Sem prazo' },
];

/** Lê os comunicados gravados, ignorando lixo; fixados primeiro, depois os mais recentes. */
export function parseAnnouncements(raw: unknown): Announcement[] {
  if (!Array.isArray(raw)) return [];
  const out: Announcement[] = [];
  for (const x of raw) {
    const o = x as Partial<Announcement> | null;
    if (!o || typeof o.id !== 'string' || typeof o.text !== 'string' || !o.text.trim()) continue;
    out.push({
      id: o.id,
      ...(typeof o.title === 'string' && o.title.trim() ? { title: o.title.trim().slice(0, ANNOUNCEMENT_TITLE_MAX) } : {}),
      text: o.text.trim().slice(0, ANNOUNCEMENT_TEXT_MAX),
      date: typeof o.date === 'string' ? o.date : '',
      ...(typeof o.expiresAt === 'string' && o.expiresAt ? { expiresAt: o.expiresAt } : {}),
      ...(o.pinned === true ? { pinned: true } : {}),
      ...(typeof o.by === 'string' ? { by: o.by } : {}),
    });
  }
  return sortAnnouncements(out);
}

export function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.date.localeCompare(a.date));
}

export function validateAnnouncement(title: string, text: string): string | null {
  if (!text.trim()) return 'Escreva a mensagem do comunicado.';
  if (text.trim().length > ANNOUNCEMENT_TEXT_MAX) return `A mensagem pode ter até ${ANNOUNCEMENT_TEXT_MAX} caracteres.`;
  if (title.trim().length > ANNOUNCEMENT_TITLE_MAX) return `O título pode ter até ${ANNOUNCEMENT_TITLE_MAX} caracteres.`;
  return null;
}

/** Monta o comunicado a gravar (já limpo), ou null se for inválido. `validityDays` null = sem prazo. */
export function newAnnouncement(
  input: { title?: string; text: string; validityDays: number | null; pinned?: boolean },
  by?: string | null,
  now: Date = new Date(),
): Announcement | null {
  if (validateAnnouncement(input.title ?? '', input.text)) return null;
  const title = (input.title ?? '').trim();
  return {
    id: `a${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ...(title ? { title } : {}),
    text: input.text.trim(),
    date: now.toISOString(),
    ...(input.validityDays != null ? { expiresAt: new Date(now.getTime() + input.validityDays * 86_400_000).toISOString() } : {}),
    ...(input.pinned ? { pinned: true } : {}),
    ...(by ? { by } : {}),
  };
}

export function isActive(a: Announcement, now: Date = new Date()): boolean {
  if (!a.expiresAt) return true;
  const t = Date.parse(a.expiresAt);
  return !Number.isFinite(t) || t > now.getTime();
}

/** O que aparece na Home: vigentes, sem os que a pessoa dispensou (os fixados nunca somem). */
export function visibleAnnouncements(list: Announcement[], dismissedIds: string[], now: Date = new Date(), limit = 3): Announcement[] {
  const dismissed = new Set(dismissedIds);
  return sortAnnouncements(list).filter(a => isActive(a, now) && (a.pinned || !dismissed.has(a.id))).slice(0, limit);
}

/** Acrescenta um comunicado, mantendo no máximo ANNOUNCEMENTS_MAX (os mais antigos não fixados saem primeiro). */
export function withAnnouncement(current: Announcement[], a: Announcement): Announcement[] {
  const all = sortAnnouncements([a, ...current]);
  if (all.length <= ANNOUNCEMENTS_MAX) return all;
  const pinned = all.filter(x => x.pinned);
  const rest = all.filter(x => !x.pinned).slice(0, Math.max(0, ANNOUNCEMENTS_MAX - pinned.length));
  return sortAnnouncements([...pinned, ...rest]);
}
