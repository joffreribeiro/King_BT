import type { Competition } from '../logic/types';
import { MOCK_COMPETITIONS } from './competitions';

// Store em memória para competições criadas durante a sessão
const store: Competition[] = [...MOCK_COMPETITIONS];

export function getAllCompetitions(): Competition[] {
  return store;
}

export function getCompetition(id: string): Competition | undefined {
  return store.find(c => c.id === id);
}

export function addCompetition(comp: Competition): void {
  store.unshift(comp); // adiciona no topo da lista
}

export function updateCompetition(updated: Competition): void {
  const idx = store.findIndex(c => c.id === updated.id);
  if (idx !== -1) store[idx] = updated;
}
