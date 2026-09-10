// ============================================================
// Review Service
// Persists scheduler state to Supabase (user_card_state + daily_stats).
// Same table/columns as the React Native app.
// ============================================================

import { createClient } from '@/lib/supabase/client';
import { toRow, fromRow, dateKey } from '@/lib/scheduler';
import type { CardReview, DayStats } from '@/types';

/**
 * Persist a single card review to `user_card_state`.
 */
export async function saveReview(userId: string, review: CardReview): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('user_card_state')
    .upsert(
      {
        user_id: userId,
        card_id: review.cardId,
        ...toRow(review, review.correctCount, new Date(review.updatedAt)),
        updated_at: review.updatedAt,
      },
      { onConflict: 'user_id,card_id' }
    );

  if (error) {
    console.error('saveReview error:', error);
    return false;
  }
  return true;
}

/**
 * Persist the counters of one study day to `daily_stats`.
 */
export async function saveDailyStats(userId: string, date: string, day: DayStats): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('daily_stats')
    .upsert(
      {
        user_id: userId,
        date,
        cards_studied: day.count,
        correct: day.correct,
        incorrect: day.incorrect,
      },
      { onConflict: 'user_id,date' }
    );

  if (error) {
    console.error('saveDailyStats error:', error);
    return false;
  }
  return true;
}

/**
 * Fetch all card states for a user.
 */
export async function fetchUserCardStates(userId: string): Promise<CardReview[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_card_state')
    .select('card_id, ease_factor, interval_days, repetitions, next_review, last_quality, total_reviews, correct_count, updated_at')
    .eq('user_id', userId);

  if (error) {
    console.error('fetchUserCardStates error:', error);
    return [];
  }

  return (data ?? []).map(row => {
    const updatedAt = (row.updated_at as string | null) ?? new Date(0).toISOString();
    return {
      ...fromRow({
        ease_factor: row.ease_factor as number,
        interval_days: row.interval_days as number,
        repetitions: row.repetitions as number,
        next_review: row.next_review as string | null,
        last_quality: row.last_quality as number | null,
        total_reviews: row.total_reviews as number | null,
        correct_count: row.correct_count as number | null,
      }),
      cardId: row.card_id as string,
      lastReview: dateKey(new Date(updatedAt)),
      updatedAt,
      correctCount: (row.correct_count as number | null) ?? 0,
      synced: true,
    };
  });
}

export interface DailyStatRow {
  date: string;
  cards_studied: number;
  correct?: number;
  incorrect?: number;
}

/**
 * Fetch daily stats (last 60 days, newest first).
 */
export async function fetchDailyStats(userId: string): Promise<DailyStatRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('daily_stats')
    .select('date, cards_studied, correct, incorrect')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(60);

  if (error) {
    console.error('fetchDailyStats error:', error);
    return [];
  }

  return (data ?? []) as DailyStatRow[];
}
