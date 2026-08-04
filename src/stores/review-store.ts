'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type { CardReview, ReviewStats, ReviewQuality, ClassifiedCards } from '@/types';

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

// SM-2 Algorithm Implementation
// Quality mapping: 1→0, 2→3, 3→4, 4→5
function mapQuality(quality: ReviewQuality): number {
  return quality === 1 ? 0 : quality + 1;
}

function calculateSm2(
  review: CardReview | undefined,
  quality: ReviewQuality
): CardReview {
  const sm2Quality = mapQuality(quality);
  const now = new Date();
  const today = getToday();

  const currentEase = review?.ease ?? 2.5;
  const currentReps = review?.repetitions ?? 0;
  const currentInterval = review?.interval ?? 0;

  let newEase: number;
  let newReps: number;
  let newInterval: number;

  if (sm2Quality >= 3) {
    // Correct response
    newReps = currentReps + 1;

    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(currentInterval * currentEase);
    }

    // SM-2 ease adjustment formula
    newEase = currentEase + (0.1 - (5 - sm2Quality) * (0.08 + (5 - sm2Quality) * 0.02));
  } else {
    // Failed response
    newReps = 0;
    newInterval = 1;
    newEase = currentEase; // Ease unchanged on failure
  }

  // Enforce minimum ease
  if (newEase < 1.3) {
    newEase = 1.3;
  }

  // Calculate next due date
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + newInterval);

  return {
    cardId: review?.cardId ?? '',
    ease: newEase,
    interval: newInterval,
    repetitions: newReps,
    dueDate: dueDate.toISOString().split('T')[0],
    lastReview: today,
    synced: false,
  };
}

interface ReviewStoreState {
  reviews: Record<string, CardReview>;
  stats: ReviewStats;
  isSyncing: boolean;

  recordReview: (cardId: string, quality: ReviewQuality) => CardReview;
  getDueCards: (cardIds: string[]) => string[];
  classifyCards: (cardIds: string[]) => ClassifiedCards;
  syncToCloud: (userId: string) => Promise<void>;
  fetchFromCloud: (userId: string) => Promise<void>;
  fullSync: (userId: string) => Promise<void>;
  clearAllData: () => void;
}

const initialStats: ReviewStats = {
  totalReviews: 0,
  todayReviews: 0,
  cardsLearned: 0,
  averageEase: 2.5,
  streak: 0,
  lastStudyDate: '',
};

function recalculateStats(reviews: Record<string, CardReview>): ReviewStats {
  const today = getToday();
  const reviewValues = Object.values(reviews);

  if (reviewValues.length === 0) {
    return initialStats;
  }

  const todayReviews = reviewValues.filter(r => r.lastReview === today).length;
  const cardsLearned = reviewValues.filter(r => r.repetitions >= 1).length;

  const totalEase = reviewValues.reduce((sum, r) => sum + r.ease, 0);
  const averageEase = reviewValues.length > 0 ? totalEase / reviewValues.length : 2.5;

  // Calculate streak: count consecutive days with reviews going backwards from today
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

export const useReviewStore = create<ReviewStoreState>()(
  persist(
    (set, get) => ({
      reviews: {},
      stats: initialStats,
      isSyncing: false,

      recordReview: (cardId: string, quality: ReviewQuality): CardReview => {
        const { reviews } = get();
        const existing = reviews[cardId];

        const updated = calculateSm2(existing, quality);
        updated.cardId = cardId;

        const newReviews = {
          ...reviews,
          [cardId]: updated,
        };

        const newStats = recalculateStats(newReviews);

        set({
          reviews: newReviews,
          stats: newStats,
        });

        return updated;
      },

      getDueCards: (cardIds: string[]): string[] => {
        const { reviews } = get();
        const today = getToday();

        return cardIds.filter(id => {
          const review = reviews[id];
          if (!review) return true; // Never reviewed = due
          return review.dueDate <= today;
        });
      },

      classifyCards: (cardIds: string[]): ClassifiedCards => {
        const { reviews } = get();
        const today = getToday();

        const classified: ClassifiedCards = {
          new: [],
          learning: [],
          review: [],
        };

        for (const id of cardIds) {
          const review = reviews[id];

          if (!review) {
            classified.new.push(id);
          } else if (review.repetitions < 2) {
            // Cards with 0 or 1 repetitions are "learning"
            if (review.dueDate <= today) {
              classified.learning.push(id);
            }
          } else {
            // Cards with 2+ repetitions are "review"
            if (review.dueDate <= today) {
              classified.review.push(id);
            }
          }
        }

        return classified;
      },

      syncToCloud: async (userId: string) => {
        const { reviews } = get();
        set({ isSyncing: true });

        try {
          const unsyncedReviews = Object.values(reviews).filter(r => !r.synced);

          if (unsyncedReviews.length === 0) return;

          const rows = unsyncedReviews.map(r => ({
            user_id: userId,
            card_id: r.cardId,
            ease: r.ease,
            interval: r.interval,
            repetitions: r.repetitions,
            due_date: r.dueDate,
            last_review: r.lastReview,
          }));

          const { error } = await supabase
            .from('reviews')
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
          const { data, error } = await supabase
            .from('reviews')
            .select('*')
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
            const cloudReview: CardReview = {
              cardId,
              ease: row.ease as number,
              interval: row.interval as number,
              repetitions: row.repetitions as number,
              dueDate: row.due_date as string,
              lastReview: row.last_review as string,
              synced: true,
            };

            const local = mergedReviews[cardId];

            // Cloud wins if local doesn't exist or cloud is more recent
            if (!local || local.lastReview < cloudReview.lastReview) {
              mergedReviews[cardId] = cloudReview;
            } else if (!local.synced) {
              // Local is newer and unsynced, keep local
            } else {
              // Both synced, cloud wins on tie
              mergedReviews[cardId] = cloudReview;
            }
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
        set({
          reviews: {},
          stats: initialStats,
        });
      },
    }),
    {
      name: 'medcards-reviews',
      partialize: (state) => ({
        reviews: state.reviews,
        stats: state.stats,
      }),
    }
  )
);
