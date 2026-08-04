'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Card, Category, Subcategory, SubcategoryWithCount } from '@/types';

interface CardsStoreState {
  cards: Card[];
  categories: Category[];
  subcategories: SubcategoryWithCount[];
  allSubcategories: Subcategory[];
  searchResults: Card[];
  isLoading: boolean;

  fetchCategories: () => Promise<void>;
  fetchSubcategories: (categoryId: string) => Promise<void>;
  fetchAllSubcategoriesFlat: () => Promise<void>;
  fetchCards: (subcategoryId: string) => Promise<Card[]>;
  fetchEnabledCards: (subcategoryIds: string[]) => Promise<Card[]>;
  searchCards: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export const useCardsStore = create<CardsStoreState>()((set, get) => ({
  cards: [],
  categories: [],
  subcategories: [],
  allSubcategories: [],
  searchResults: [],
  isLoading: false,

  fetchCategories: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) {
        console.error('Failed to fetch categories:', error);
        return;
      }

      set({ categories: (data as Category[]) ?? [] });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSubcategories: async (categoryId: string) => {
    set({ isLoading: true });
    try {
      // Fetch subcategories for a category
      const { data: subcats, error: subcatError } = await supabase
        .from('subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .order('name');

      if (subcatError) {
        console.error('Failed to fetch subcategories:', subcatError);
        return;
      }

      if (!subcats || subcats.length === 0) {
        set({ subcategories: [] });
        return;
      }

      // Fetch card counts for each subcategory
      const subcategoryIds = subcats.map(s => s.id);
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('id, subcategory_id')
        .in('subcategory_id', subcategoryIds);

      if (cardsError) {
        console.error('Failed to fetch card counts:', cardsError);
        return;
      }

      const cardsBySubcategory: Record<string, string[]> = {};
      for (const card of cards ?? []) {
        const subId = card.subcategory_id as string;
        if (!cardsBySubcategory[subId]) {
          cardsBySubcategory[subId] = [];
        }
        cardsBySubcategory[subId].push(card.id as string);
      }

      const subcategoriesWithCount: SubcategoryWithCount[] = subcats.map(sub => ({
        ...sub,
        card_count: cardsBySubcategory[sub.id]?.length ?? 0,
        card_ids: cardsBySubcategory[sub.id] ?? [],
      }));

      set({ subcategories: subcategoriesWithCount });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAllSubcategoriesFlat: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .order('name');

      if (error) {
        console.error('Failed to fetch all subcategories:', error);
        return;
      }

      set({ allSubcategories: (data as Subcategory[]) ?? [] });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchCards: async (subcategoryId: string): Promise<Card[]> => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('subcategory_id', subcategoryId)
        .order('created_at');

      if (error) {
        console.error('Failed to fetch cards:', error);
        return [];
      }

      const cards = (data as Card[]) ?? [];
      set({ cards });
      return cards;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchEnabledCards: async (subcategoryIds: string[]): Promise<Card[]> => {
    if (subcategoryIds.length === 0) {
      set({ cards: [] });
      return [];
    }

    set({ isLoading: true });
    try {
      // Supabase has a limit on IN clause size, so batch if needed
      const batchSize = 100;
      const allCards: Card[] = [];

      for (let i = 0; i < subcategoryIds.length; i += batchSize) {
        const batch = subcategoryIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('cards')
          .select('*')
          .in('subcategory_id', batch)
          .order('created_at');

        if (error) {
          console.error('Failed to fetch enabled cards:', error);
          continue;
        }

        if (data) {
          allCards.push(...(data as Card[]));
        }
      }

      set({ cards: allCards });
      return allCards;
    } finally {
      set({ isLoading: false });
    }
  },

  searchCards: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }

    set({ isLoading: true });
    try {
      // Try full-text search with Portuguese config first
      const tsQuery = query
        .trim()
        .split(/\s+/)
        .map(term => `'${term}'`)
        .join(' & ');

      const { data: ftsData, error: ftsError } = await supabase
        .from('cards')
        .select('*')
        .textSearch('front', tsQuery, { config: 'portuguese' })
        .limit(50);

      if (!ftsError && ftsData && ftsData.length > 0) {
        set({ searchResults: ftsData as Card[] });
        return;
      }

      // Fallback to ILIKE search
      const likeQuery = `%${query.trim()}%`;
      const { data: likeData, error: likeError } = await supabase
        .from('cards')
        .select('*')
        .or(`front.ilike.${likeQuery},back.ilike.${likeQuery}`)
        .limit(50);

      if (likeError) {
        console.error('Failed to search cards:', likeError);
        return;
      }

      set({ searchResults: (likeData as Card[]) ?? [] });
    } finally {
      set({ isLoading: false });
    }
  },

  clearSearch: () => {
    set({ searchResults: [] });
  },
}));
