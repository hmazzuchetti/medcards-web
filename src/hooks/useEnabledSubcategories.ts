'use client';

import { useEffect, useState } from 'react';
import { fetchSubcategoriesWithCards, type SubcategoryWithCards } from '@/services/cards.service';
import { useDeckStore } from '@/stores/deck-store';

interface EnabledSubcategoriesResult {
  /** All subcategories known to the app */
  all: SubcategoryWithCards[];
  /** IDs of the subcategories enabled in "Pastas" */
  enabledIds: string[] | null;
  isLoading: boolean;
}

/**
 * Resolves which subcategories are enabled in the Pastas tab (opt-out model:
 * everything is enabled unless the user disabled it).
 */
export function useEnabledSubcategories(): EnabledSubcategoriesResult {
  const [all, setAll] = useState<SubcategoryWithCards[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const disabled = useDeckStore(s => s.disabledSubcategories);

  useEffect(() => {
    let cancelled = false;
    fetchSubcategoriesWithCards()
      .then(subs => { if (!cancelled) setAll(subs); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const enabledIds = isLoading ? null : all.filter(s => !disabled[s.id]).map(s => s.id);

  return { all, enabledIds, isLoading };
}
