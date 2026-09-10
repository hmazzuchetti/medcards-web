'use client';

import { useState, useEffect } from 'react';
import { useReviewStore } from '@/stores/review-store';
import { fetchSubcategoriesWithCards } from '@/services/cards.service';
import type { Category } from '@/types';

export interface CategoryDueInfo {
  category: Category;
  dueCount: number;
  totalCards: number;
  subcategoryIds: string[];
}

interface UseCategoryDueCountsResult {
  categories: CategoryDueInfo[];
  totalDue: number;
  isLoading: boolean;
}

/**
 * Fetches all categories and computes how many cards are due today in each one.
 * Uses local SM-2 state for due calculation (no Supabase query for review state).
 */
export function useCategoryDueCounts(): UseCategoryDueCountsResult {
  const [categories, setCategories] = useState<CategoryDueInfo[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const { getDueCount } = useReviewStore();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const subcatsWithCards = await fetchSubcategoriesWithCards();
        if (cancelled) return;

        // Group by category
        const categoryMap = new Map<string, CategoryDueInfo>();

        for (const sub of subcatsWithCards) {
          const existing = categoryMap.get(sub.category_id);
          const dueInSub = getDueCount(sub.cardIds);

          if (existing) {
            existing.dueCount += dueInSub;
            existing.totalCards += sub.totalCards;
            existing.subcategoryIds.push(sub.id);
          } else {
            categoryMap.set(sub.category_id, {
              category: {
                id: sub.category_id,
                name: sub.categoryName,
                slug: '',
              },
              dueCount: dueInSub,
              totalCards: sub.totalCards,
              subcategoryIds: [sub.id],
            });
          }
        }

        const cats = Array.from(categoryMap.values()).sort((a, b) =>
          a.category.name.localeCompare(b.category.name)
        );
        const total = cats.reduce((sum, c) => sum + c.dueCount, 0);

        if (!cancelled) {
          setCategories(cats);
          setTotalDue(total);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [getDueCount]);

  return { categories, totalDue, isLoading };
}
