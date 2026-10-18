import type { Competition, Format } from './types';

/** Filtro de status da lista de competições. */
export type StatusFilter = 'all' | 'upcoming' | 'active' | 'done';

/** "Em andamento" inclui as que ainda estão sendo montadas (status 'setup'). */
export function matchesStatus(c: Pick<Competition, 'status'>, key: StatusFilter): boolean {
  if (key === 'all') return true;
  if (key === 'active') return c.status === 'active' || c.status === 'setup';
  return c.status === key;
}

/**
 * Tudo o que vale ANTES do status: some a sessão avulsa de "Jogo Rápido", aplica o formato e a busca por nome.
 * A contagem de cada status sai daqui, então o número mostrado é o que a pessoa vê ao escolher aquele status
 * com os outros filtros como estão.
 */
export function filterBeforeStatus<T extends Pick<Competition, 'name' | 'format' | 'isFriendly'>>(
  comps: T[],
  opts: { format: Format | 'all'; search: string },
): T[] {
  const term = opts.search.trim().toLowerCase();
  return comps.filter(c => {
    if (c.isFriendly) return false;
    if (opts.format !== 'all' && c.format !== opts.format) return false;
    if (term && !c.name.toLowerCase().includes(term)) return false;
    return true;
  });
}

export function countByStatus(list: Pick<Competition, 'status'>[]): Record<StatusFilter, number> {
  return {
    all: list.length,
    upcoming: list.filter(c => matchesStatus(c, 'upcoming')).length,
    active: list.filter(c => matchesStatus(c, 'active')).length,
    done: list.filter(c => matchesStatus(c, 'done')).length,
  };
}
