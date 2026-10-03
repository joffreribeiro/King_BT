import { useMemo } from 'react';
import { useRatings } from './useRatings';
import { suggestCategory, type CategorySuggestion } from '@/logic/categorySuggestion';
import type { Skills } from '@/logic/skills';
import type { Category } from '@/logic/playerAbout';
import { useSettings } from '@/store/SettingsContext';

/** Categoria sugerida pelo Radar (autoavaliação + avaliações dos colegas). null se ainda não há dados. */
export function useCategorySuggestion(playerId: string | undefined, self?: Skills, selfCategory?: Category): CategorySuggestion | null {
  const { ratings } = useRatings(playerId);
  const { categoryCuts } = useSettings();
  return useMemo(
    () => suggestCategory(self, ratings.map(r => ({ skills: r.skills, category: r.category, updatedAtMs: r.updatedAtMs })), selfCategory, categoryCuts),
    [self, selfCategory, ratings, categoryCuts],
  );
}
