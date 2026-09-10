'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';
import { calculateSM2, getToday, isDue, classifyCard } from '@/lib/sm2';
import type { ReviewQuality, CardReview, ReviewStats, ClassifiedCards } from '@/types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

function recalculateStats(reviews: Record<string, CardReview>): ReviewStats {
  const today = getToday();
  const reviewValues = Object.values(reviews);

  if (reviewValues.length === 0) {
    return INITIAL_STATS;
  }

  const todayReviews = reviewValues.filter(r => r.lastReview === today).length;
  const cardsLearned = reviewValues.filter(r => r.repetitions >= 1).length;
  const totalEase = reviewValues.reduce((sum, r) => sum + r.ease, 0);
  const averageEase = reviewValues.length > 0 ? totalEase / reviewValues.length : 2.5;

  // Streak: count consecutive days with reviews going backwards from today
  const reviewDates = new Set(reviewValues.map(r => r.lastReview));
  let streak = 0;
  const checkDate = new Date();

  // If no reviews today, start checking from yesterday
  if (!reviewDates.has(today)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (reviewDates.has(checkDate.toISOString().split('T')[0])) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    totalReviews: reviewValues.reduce((sum, r) => sum + r.repetitions, 0) + reviewValues.length,
    todayReviews,
    cardsLearned,
    averageEase: Math.round(averageEase * 100) / 100,
    streak,
    lastStudyDate: today,
  };
}

const INITIAL_STATS: ReviewStats = {
  totalReviews: 0,
  todayReviews: 0,
  cardsLearned: 0,
  averageEase: 2.5,
  streak: 0,
  lastStudyDate: '',
};

// ─── Store interface ───────────────────────────────────────────────────────────

interface ReviewStoreState {
  reviews: Record<string, CardReview>;
  stats: ReviewStats;
  isSyncing: boolean;

  getReview: (cardId: string) => CardReview | undefined;
  recordReview: (cardId: string, quality: ReviewQuality) => CardReview;
  getDueCards: (cardIds: string[]) => string[];
  classifyCards: (cardIds: string[]) => ClassifiedCards;
  getDueCount: (cardIds: string[]) => number;

  syncToCloud: (userId: string) => Promise<void>;
  fetchFromCloud: (userId: string) => Promise<void>;
  fullSync: (userId: string) => Promise<void>;
  clearAllData: () => void;
}

// ─── Store implementation ──────────────────────────────────────────────────────

export const useReviewStore = create<ReviewStoreState>()(
  persist(
    (set, get) => ({
      reviews: {},
      stats: INITIAL_STATS,
      isSyncing: false,

      getReview: (cardId: string): CardReview | undefined => {
        return get().reviews[cardId];
      },

      recordReview: (cardId: string, quality: ReviewQuality): CardReview => {
        const { reviews } = get();
        const existing = reviews[cardId];

        const sm2Result = calculateSM2(
          existing
            ? { ease: existing.ease, interval: existing.interval, repetitions: existing.repetitions }
            : undefined,
          quality
        );

        const updated: CardReview = {
          cardId,
          ease: sm2Result.ease,
          interval: sm2Result.interval,
          repetitions: sm2Result.repetitions,
          dueDate: sm2Result.dueDate,
          lastReview: getToday(),
          synced: false,
        };

        const newReviews = { ...reviews, [cardId]: updated };
        const newStats = recalculateStats(newReviews);

        set({ reviews: newReviews, stats: newStats });

        return updated;
      },

      getDueCards: (cardIds: string[]): string[] => {
        const { reviews } = get();
        return cardIds.filter(id => {
          const review = reviews[id];
          return !review || isDue(review.dueDate);
        });
      },

      getDueCount: (cardIds: string[]): number => {
        return get().getDueCards(cardIds).length;
      },

      classifyCards: (cardIds: string[]): ClassifiedCards => {
        const { reviews } = get();
        const classified: ClassifiedCards = { new: [], learning: [], review: [] };

        for (const id of cardIds) {
          const review = reviews[id];
          const classification = classifyCard(review?.repetitions, review?.dueDate);
          if (classification) {
            classified[classification].push(id);
          }
        }

        return classified;
      },

      // ─── Cloud sync ────────────────────────────────────────────────────────
      // Uses user_card_state table (matching the React Native app)

      syncToCloud: async (userId: string) => {
        const { reviews } = get();
        set({ isSyncing: true });

        try {
          const unsyncedReviews = Object.values(reviews).filter(r => !r.synced);
          if (unsyncedReviews.length === 0) return;

          const supabase = createClient();
          const rows = unsyncedReviews.map(r => ({
            user_id: userId,
            card_id: r.cardId,
            ease_factor: r.ease,
            interval_days: r.interval,
            repetitions: r.repetitions,
            next_review: r.dueDate,
            updated_at: new Date().toISOString(),
          }));

          const { error } = await supabase
            .from('user_card_state')
            .upsert(rows, { onConflict: 'user_id,card_id' });

          if (error) {
            console.error('Failed to sync reviews to cloud:', error);
            return;
          }

          // Mark all as synced
          const updatedReviews = { ...reviews };
          for (const r of unsyncedReviews) {
            if (updatedReviews[r.cardId]) {
              updatedReviews[r.cardId] = { ...updatedReviews[r.cardId], synced: true };
            }
          }

          set({ reviews: updatedReviews });
        } finally {
          set({ isSyncing: false });
        }
      },

      fetchFromCloud: async (userId: string) => {
        set({ isSyncing: true });

        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('user_card_state')
            .select('card_id, ease_factor, interval_days, repetitions, next_review, updated_at')
            .eq('user_id', userId);

          if (error) {
            console.error('Failed to fetch reviews from cloud:', error);
            return;
          }

          if (!data || data.length === 0) return;

          const { reviews: localReviews } = get();
          const mergedReviews = { ...localReviews };

          for (const row of data) {
            const cardId = row.card_id as string;
            const remoteLastReview = (row.updated_at as string)?.split('T')[0] ?? getToday();

            const cloudReview: CardReview = {
              cardId,
              ease: row.ease_factor as number,
              interval: row.interval_days as number,
              repetitions: row.repetitions as number,
              dueDate: (row.next_review as string) ?? getToday(),
              lastReview: remoteLastReview,
              synced: true,
            };

            const local = mergedReviews[cardId];

            // Cloud wins if no local, or cloud is more recent
            if (!local || local.lastReview < cloudReview.lastReview) {
              mergedReviews[cardId] = cloudReview;
            }
            // If local is newer and unsynced, keep local
          }

          set({
            reviews: mergedReviews,
            stats: recalculateStats(mergedReviews),
          });
        } finally {
          set({ isSyncing: false });
        }
      },

      fullSync: async (userId: string) => {
        await get().fetchFromCloud(userId);
        await get().syncToCloud(userId);
      },

      clearAllData: () => {
        set({ reviews: {}, stats: INITIAL_STATS });
      },
    }),
    {
      name: 'medcards-reviews-v2',
      partialize: (state) => ({
        reviews: state.reviews,
        stats: state.stats,
      }),
    }
  )
);
