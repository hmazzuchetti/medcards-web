'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dateKey } from '@/lib/scheduler';

/** Study-day key (local time, Anki-style 4am rollover) */
function getToday(): string {
  return dateKey(new Date());
}

const DEFAULT_NEW_CARDS_PER_DAY = 20;
const NEW_CARDS_STEP = 5;
const MAX_NEW_CARDS = 999;
const DEFAULT_SUBCATEGORY_KEY = '__default__';

interface DeckStoreState {
  disabledSubcategories: Record<string, true>;
  newCardsPerDay: Record<string, number>;
  newCardsToday: {
    date: string;
    counts: Record<string, string[]>;
  };

  toggleSubcategory: (subcategoryId: string) => void;
  toggleCategory: (subcategoryIds: string[]) => void;
  isSubcategoryEnabled: (subcategoryId: string) => boolean;
  getEnabledSubcategoryIds: (allSubcategoryIds: string[]) => string[];
  setNewCardsPerDay: (subcategoryId: string | null, count: number) => void;
  getNewCardsPerDay: (subcategoryId: string | null) => number;
  recordNewCardIntroduced: (subcategoryId: string, cardId: string) => void;
  getNewCardsRemainingToday: (subcategoryId: string) => number;
}

export const useDeckStore = create<DeckStoreState>()(
  persist(
    (set, get) => ({
      disabledSubcategories: {},
      newCardsPerDay: {},
      newCardsToday: {
        date: getToday(),
        counts: {},
      },

      toggleSubcategory: (subcategoryId: string) => {
        const { disabledSubcategories } = get();
        const updated = { ...disabledSubcategories };

        if (updated[subcategoryId]) {
          delete updated[subcategoryId];
        } else {
          updated[subcategoryId] = true;
        }

        set({ disabledSubcategories: updated });
      },

      toggleCategory: (subcategoryIds: string[]) => {
        const { disabledSubcategories } = get();

        // If all subcategories in this category are enabled, disable them all
        // Otherwise, enable them all
        const allEnabled = subcategoryIds.every(id => !disabledSubcategories[id]);
        const updated = { ...disabledSubcategories };

        if (allEnabled) {
          // Disable all subcategories in category
          for (const id of subcategoryIds) {
            updated[id] = true;
          }
        } else {
          // Enable all subcategories in category
          for (const id of subcategoryIds) {
            delete updated[id];
          }
        }

        set({ disabledSubcategories: updated });
      },

      isSubcategoryEnabled: (subcategoryId: string): boolean => {
        const { disabledSubcategories } = get();
        return !disabledSubcategories[subcategoryId];
      },

      getEnabledSubcategoryIds: (allSubcategoryIds: string[]): string[] => {
        const { disabledSubcategories } = get();
        return allSubcategoryIds.filter(id => !disabledSubcategories[id]);
      },

      setNewCardsPerDay: (subcategoryId: string | null, count: number) => {
        const key = subcategoryId ?? DEFAULT_SUBCATEGORY_KEY;
        const clamped = Math.max(0, Math.min(MAX_NEW_CARDS, Math.round(count / NEW_CARDS_STEP) * NEW_CARDS_STEP));

        set(state => ({
          newCardsPerDay: {
            ...state.newCardsPerDay,
            [key]: clamped,
          },
        }));
      },

      getNewCardsPerDay: (subcategoryId: string | null): number => {
        const { newCardsPerDay } = get();
        const key = subcategoryId ?? DEFAULT_SUBCATEGORY_KEY;
        return newCardsPerDay[key] ?? DEFAULT_NEW_CARDS_PER_DAY;
      },

      recordNewCardIntroduced: (subcategoryId: string, cardId: string) => {
        const { newCardsToday } = get();
        const today = getToday();

        // Reset if it's a new day
        const currentData = newCardsToday.date === today
          ? newCardsToday
          : { date: today, counts: {} };

        const currentCards = currentData.counts[subcategoryId] ?? [];

        // Don't double-count
        if (currentCards.includes(cardId)) return;

        set({
          newCardsToday: {
            date: today,
            counts: {
              ...currentData.counts,
              [subcategoryId]: [...currentCards, cardId],
            },
          },
        });
      },

      getNewCardsRemainingToday: (subcategoryId: string): number => {
        const { newCardsToday } = get();
        const today = getToday();

        // If it's a new day, all cards are remaining
        if (newCardsToday.date !== today) {
          return get().getNewCardsPerDay(subcategoryId);
        }

        const introduced = newCardsToday.counts[subcategoryId]?.length ?? 0;
        const limit = get().getNewCardsPerDay(subcategoryId);

        return Math.max(0, limit - introduced);
      },
    }),
    {
      name: 'medcards-deck',
      partialize: (state) => ({
        disabledSubcategories: state.disabledSubcategories,
        newCardsPerDay: state.newCardsPerDay,
        newCardsToday: state.newCardsToday,
      }),
    }
  )
);
