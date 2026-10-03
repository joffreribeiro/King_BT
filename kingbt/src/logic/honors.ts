/**
 * Honrarias concedidas pelo admin: troféus manuais ("Fair Play", "Melhor da Temporada"...) que
 * aparecem no perfil do jogador, na aba Conquistas. Ficam no campo `honors` do doc do grupo, onde
 * só o admin escreve.
 */
export interface Honor {
  id: string;
  playerId: string;
  title: string;
  /** Emoji que ilustra a honraria. */
  icon: string;
  note?: string;
  /** Quando foi concedida (ISO). */
  date: string;
  /** uid de quem concedeu. */
  by?: string;
}

export const HONOR_TITLE_MAX = 40;
export const HONOR_NOTE_MAX = 140;
export const HONORS_MAX = 300;
export const DEFAULT_HONOR_ICON = '🏅';

export const HONOR_PRESETS: { title: string; icon: string }[] = [
  { title: 'Fair Play', icon: '🤝' },
  { title: 'Melhor da Temporada', icon: '🏆' },
  { title: 'Revelação', icon: '🌟' },
  { title: 'Garra', icon: '💪' },
  { title: 'Craque da Rodada', icon: '🎾' },
  { title: 'Evolução', icon: '📈' },
  { title: 'Espírito de Equipe', icon: '🐝' },
];

/** Lê as honrarias gravadas, ignorando lixo, da mais recente para a mais antiga. */
export function parseHonors(raw: unknown): Honor[] {
  if (!Array.isArray(raw)) return [];
  const out: Honor[] = [];
  for (const x of raw) {
    const o = x as Partial<Honor> | null;
    if (!o || typeof o.id !== 'string' || typeof o.playerId !== 'string' || typeof o.title !== 'string' || !o.title.trim()) continue;
    out.push({
      id: o.id, playerId: o.playerId, title: o.title.trim().slice(0, HONOR_TITLE_MAX),
      icon: typeof o.icon === 'string' && o.icon.trim() ? o.icon.trim().slice(0, 8) : DEFAULT_HONOR_ICON,
      ...(typeof o.note === 'string' && o.note.trim() ? { note: o.note.trim().slice(0, HONOR_NOTE_MAX) } : {}),
      date: typeof o.date === 'string' ? o.date : '',
      ...(typeof o.by === 'string' ? { by: o.by } : {}),
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Mensagem de erro se o título/observação não servem; null se estão ok. */
export function validateHonor(title: string, note: string): string | null {
  if (!title.trim()) return 'Escolha ou escreva o nome da honraria.';
  if (title.trim().length > HONOR_TITLE_MAX) return `O nome pode ter até ${HONOR_TITLE_MAX} caracteres.`;
  if (note.trim().length > HONOR_NOTE_MAX) return `A observação pode ter até ${HONOR_NOTE_MAX} caracteres.`;
  return null;
}

/** Monta a honraria a gravar (já limpa), ou null se for inválida. */
export function newHonor(
  input: { playerId: string; title: string; icon?: string; note?: string },
  by?: string | null,
  now: Date = new Date(),
): Honor | null {
  if (!input.playerId || validateHonor(input.title, input.note ?? '')) return null;
  const note = (input.note ?? '').trim();
  return {
    id: `h${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    playerId: input.playerId,
    title: input.title.trim(),
    icon: input.icon?.trim() ? input.icon.trim().slice(0, 8) : DEFAULT_HONOR_ICON,
    ...(note ? { note } : {}),
    date: now.toISOString(),
    ...(by ? { by } : {}),
  };
}

export const honorsOf = (honors: Honor[], playerId: string): Honor[] => honors.filter(h => h.playerId === playerId);

/** Quantas honrarias aparecem no feed (as mais recentes). */
export const HONOR_FEED_MAX = 20;

export interface HonorFeedItem { id: string; playerId: string; playerName: string; icon: string; title: string; desc: string; date: Date }

/** Honrarias como cards do feed: "Fulano recebeu a honraria X" (com a observação do admin, se houver). */
export function honorFeedItems(honors: Honor[], nameOf: (id: string) => string): HonorFeedItem[] {
  const out: HonorFeedItem[] = [];
  for (const h of honors.slice(0, HONOR_FEED_MAX)) {
    const t = Date.parse(h.date);
    if (!Number.isFinite(t)) continue;
    const name = nameOf(h.playerId);
    if (!name) continue;
    out.push({
      id: 'honor_' + h.id, playerId: h.playerId, playerName: name, icon: h.icon, title: h.title,
      desc: `${name} recebeu a honraria ${h.title}.${h.note ? ' ' + h.note : ''}`, date: new Date(t),
    });
  }
  return out;
}
