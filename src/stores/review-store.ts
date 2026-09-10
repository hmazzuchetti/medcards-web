'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  schedule,
  isDue,
  bucketOf,
  dateKey,
  fromRow,
  toRow,
  type ReviewQuality,
} from '@/lib/scheduler';
import { createClient } from '@/lib/supabase/client';
import type { CardReview, DayStats, ReviewStats, ClassifiedCards } from '@/types';

// ─── Stats ───────────────────────────────────────────────────────────────────

const INITIAL_STATS: ReviewStats = {
  totalReviews: 0,
  todayReviews: 0,
  todayCorrect: 0,
  todayIncorrect: 0,
  cardsLearned: 0,
  averageEase: 2.5,
  streak: 0,
  lastStudyDate: '',
};

function shiftDateKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + deltaDays, 12);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function computeStreak(days: Record<string, DayStats>, today: string): number {
  let streak = 0;
  let cursor = today;
  // If nothing studied today yet, the streak still counts from yesterday
  if (!days[cursor] || days[cursor].count === 0) {
    cursor = shiftDateKey(cursor, -1);
  }
  while (days[cursor] && days[cursor].count > 0) {
    streak++;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

export function recalculateStats(
  reviews: Record<string, CardReview>,
  days: Record<string, DayStats>,
  now: Date = new Date()
): ReviewStats {
  const today = dateKey(now);
  const values = Object.values(reviews);
  const todayStats = days[today] ?? { count: 0, correct: 0, incorrect: 0 };

  const totalReviews = values.reduce((sum, r) => sum + r.reps, 0);
  const cardsLearned = values.filter(r => r.phase === 'review').length;
  const averageEase =
    values.length > 0 ? values.reduce((sum, r) => sum + r.ease, 0) / values.length : 2.5;

  const studiedDates = Object.keys(days).filter(k => days[k].count > 0).sort();

  return {
    totalReviews,
    todayReviews: todayStats.count,
    todayCorrect: todayStats.correct,
    todayIncorrect: todayStats.incorrect,
    cardsLearned,
    averageEase: Math.round(averageEase * 100) / 100,
    streak: computeStreak(days, today),
    lastStudyDate: studiedDates[studiedDates.length - 1] ?? '',
  };
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface ReviewStoreState {
  reviews: Record<string, CardReview>;
  /** Per study-day counters (key = YYYY-MM-DD) */
  days: Record<string, DayStats>;
  stats: ReviewStats;
  isSyncing: boolean;

  getReview: (cardId: string) => CardReview | undefined;
  recordReview: (cardId: string, quality: ReviewQuality, now?: Date) => CardReview;
  getDueCards: (cardIds: string[], now?: Date) => string[];
  getDueCount: (cardIds: string[], now?: Date) => number;
  classifyCards: (cardIds: string[], now?: Date) => ClassifiedCards;

  syncToCloud: (userId: string) => Promise<void>;
  fetchFromCloud: (userId: string) => Promise<void>;
  fullSync: (userId: string) => Promise<void>;
  clearAllData: () => void;
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useReviewStore = create<ReviewStoreState>()(
  persist(
    (set, get) => ({
      reviews: {},
      days: {},
      stats: INITIAL_STATS,
      isSyncing: false,

      getReview: (cardId) => get().reviews[cardId],

      recordReview: (cardId, quality, now = new Date()) => {
        const { reviews, days } = get();
        const existing = reviews[cardId];
        const nextState = schedule(existing, quality, now);
        const today = dateKey(now);

        const updated: CardReview = {
          ...nextState,
          cardId,
          lastReview: today,
          updatedAt: now.toISOString(),
          correctCount: (existing?.correctCount ?? 0) + (quality > 1 ? 1 : 0),
          synced: false,
        };

        const prevDay = days[today] ?? { count: 0, correct: 0, incorrect: 0 };
        const newDays = {
          ...days,
          [today]: {
            count: prevDay.count + 1,
            correct: prevDay.correct + (quality > 1 ? 1 : 0),
            incorrect: prevDay.incorrect + (quality === 1 ? 1 : 0),
          },
        };

        const newReviews = { ...reviews, [cardId]: updated };
        set({
          reviews: newReviews,
          days: newDays,
          stats: recalculateStats(newReviews, newDays, now),
        });

        return updated;
      },

      getDueCards: (cardIds, now = new Date()) => {
        const { reviews } = get();
        return cardIds.filter(id => isDue(reviews[id], now));
      },

      getDueCount: (cardIds, now = new Date()) => get().getDueCards(cardIds, now).length,

      classifyCards: (cardIds, now = new Date()) => {
        const { reviews } = get();
        const classified: ClassifiedCards = { new: [], learning: [], review: [] };
        for (const id of cardIds) {
          const review = reviews[id];
          const bucket = bucketOf(review);
          if (bucket === 'new') {
            classified.new.push(id);
          } else if (isDue(review, now)) {
            classified[bucket].push(id);
          } else if (bucket === 'learning') {
            // Learning cards due later today still belong to the session
            const dueKey = dateKey(new Date(review!.due));
            if (dueKey <= dateKey(now)) classified.learning.push(id);
          }
        }
        return classified;
      },

      // ─── Cloud sync (user_card_state + daily_stats) ─────────────────────────

      syncToCloud: async (userId) => {
        const { reviews, days } = get();
        set({ isSyncing: true });
        try {
          const supabase = createClient();
          const unsynced = Object.values(reviews).filter(r => !r.synced);

          if (unsynced.length > 0) {
            const rows = unsynced.map(r => ({
              user_id: userId,
              card_id: r.cardId,
              ...toRow(r, r.correctCount, new Date(r.updatedAt)),
              updated_at: r.updatedAt,
            }));

            const { error } = await supabase
              .from('user_card_state')
              .upsert(rows, { onConflict: 'user_id,card_id' });

            if (error) {
              console.error('Failed to sync reviews to cloud:', error);
            } else {
              const updatedReviews = { ...get().reviews };
              for (const r of unsynced) {
                if (updatedReviews[r.cardId]) {
                  updatedReviews[r.cardId] = { ...updatedReviews[r.cardId], synced: true };
                }
              }
              set({ reviews: updatedReviews });
            }
          }

          const dayRows = Object.entries(days).map(([date, d]) => ({
            user_id: userId,
            date,
            cards_studied: d.count,
            correct: d.correct,
            incorrect: d.incorrect,
          }));
          if (dayRows.length > 0) {
            const { error } = await supabase
              .from('daily_stats')
              .upsert(dayRows, { onConflict: 'user_id,date' });
            if (error) console.error('Failed to sync daily stats:', error);
          }
        } finally {
          set({ isSyncing: false });
        }
      },

      fetchFromCloud: async (userId) => {
        set({ isSyncing: true });
        try {
          const supabase = createClient();
          const [stateResult, daysResult] = await Promise.all([
            supabase
              .from('user_card_state')
              .select('card_id, ease_factor, interval_days, repetitions, next_review, last_quality, total_reviews, correct_count, updated_at')
              .eq('user_id', userId),
            supabase
              .from('daily_stats')
              .select('date, cards_studied, correct, incorrect')
              .eq('user_id', userId),
          ]);

          if (stateResult.error) {
            console.error('Failed to fetch reviews from cloud:', stateResult.error);
          }
          if (daysResult.error) {
            console.error('Failed to fetch daily stats from cloud:', daysResult.error);
          }

          const { reviews: localReviews, days: localDays } = get();
          const merged = { ...localReviews };

          for (const row of stateResult.data ?? []) {
            const cardId = row.card_id as string;
            const updatedAt = (row.updated_at as string | null) ?? new Date(0).toISOString();
            const cloud: CardReview = {
              ...fromRow({
                ease_factor: row.ease_factor as number,
                interval_days: row.interval_days as number,
                repetitions: row.repetitions as number,
                next_review: row.next_review as string | null,
                last_quality: row.last_quality as number | null,
                total_reviews: row.total_reviews as number | null,
                correct_count: row.correct_count as number | null,
              }),
              cardId,
              lastReview: dateKey(new Date(updatedAt)),
              updatedAt,
              correctCount: (row.correct_count as number | null) ?? 0,
              synced: true,
            };

            const local = merged[cardId];
            if (!local) {
              merged[cardId] = cloud;
            } else if (!local.synced && local.updatedAt >= cloud.updatedAt) {
              // Local has unsynced, newer work: keep it
            } else if (cloud.updatedAt > local.updatedAt) {
              merged[cardId] = cloud;
            }
          }

          const mergedDays = { ...localDays };
          for (const row of daysResult.data ?? []) {
            const date = row.date as string;
            const cloudDay: DayStats = {
              count: (row.cards_studied as number) ?? 0,
              correct: (row.correct as number) ?? 0,
              incorrect: (row.incorrect as number) ?? 0,
            };
            const local = mergedDays[date];
            if (!local || cloudDay.count > local.count) {
              mergedDays[date] = cloudDay;
            }
          }

          set({
            reviews: merged,
            days: mergedDays,
            stats: recalculateStats(merged, mergedDays),
          });
        } finally {
          set({ isSyncing: false });
        }
      },

      fullSync: async (userId) => {
        await get().fetchFromCloud(userId);
        await get().syncToCloud(userId);
      },

      clearAllData: () => {
        set({ reviews: {}, days: {}, stats: INITIAL_STATS });
      },
    }),
    {
      name: 'medcards-reviews-v2',
      partialize: (state) => ({
        reviews: state.reviews,
        days: state.days,
        stats: state.stats,
      }),
    }
  )
);
