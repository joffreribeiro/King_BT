import type { Category } from './playerAbout';

/** Uma linha da lista de Atletas da Arena. */
export interface AthleteRow {
  id: string;
  name: string;
  color: string;
  guest: boolean;
  /** Categoria informada no Sobre do jogador. */
  category?: Category;
  /** Posição no ranking geral (0 = ainda sem jogos). */
  position: number;
  points: number;
  played: number;
}

export type AthleteSort = 'az' | 'ranking';

export interface AthleteFilter {
  /** 'todas' ou uma categoria. */
  category: Category | 'todas';
  /** Trecho do nome (sem diferenciar acento nem maiúscula). */
  query: string;
  sort: AthleteSort;
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Filtra e ordena os atletas. A–Z: por nome. Ranking: quem tem posição vem
 * primeiro, do 1º para baixo; quem ainda não jogou vai para o fim, em ordem alfabética.
 */
export function filterAthletes(rows: AthleteRow[], f: AthleteFilter): AthleteRow[] {
  const q = norm(f.query);
  const list = rows.filter(r =>
    (f.category === 'todas' || r.category === f.category) &&
    (!q || norm(r.name).includes(q)));
  const byName = (a: AthleteRow, b: AthleteRow) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
  return list.sort(f.sort === 'az'
    ? byName
    : (a, b) => {
        if (a.position > 0 && b.position > 0) return a.position - b.position;
        if (a.position > 0) return -1;
        if (b.position > 0) return 1;
        return byName(a, b);
      });
}

/** Quantos atletas há em cada categoria (para mostrar nos filtros). */
export function categoryCounts(rows: AthleteRow[]): Record<string, number> {
  const out: Record<string, number> = { todas: rows.length };
  for (const r of rows) if (r.category) out[r.category] = (out[r.category] ?? 0) + 1;
  return out;
}
