// ============================================================
// Review Service
// Responsible for persisting SM-2 state to Supabase.
// Matches the React Native app's user_card_state table schema.
// ============================================================

import { createClient } from '@/lib/supabase/client';
import type { CardReview } from '@/types';

// ─── user_card_state upsert ────────────────────────────────────────────────────

/**
 * Persist a single card review to Supabase user_card_state.
 * Uses the same column names as the React Native app.
 */
export async function saveReview(userId: string, review: CardReview): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('user_card_state')
    .upsert(
      {
        user_id: userId,
        card_id: review.cardId,
        ease_factor: review.ease,
        interval_days: review.interval,
        repetitions: review.repetitions,
        next_review: review.dueDate,
        updated_at: new Date().toISOString(),
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
 * Persist daily stats to Supabase daily_stats.
 * Increments cards_studied for today.
 */
export async function saveDailyStats(
  userId: string,
  date: string,
  totalStudiedToday: number
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('daily_stats')
    .upsert(
      {
        user_id: userId,
        date,
        cards_studied: totalStudiedToday,
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
 * Fetch all card states for a user from Supabase.
 */
export async function fetchUserCardStates(userId: string): Promise<CardReview[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_card_state')
    .select('card_id, ease_factor, interval_days, repetitions, next_review, updated_at')
    .eq('user_id', userId);

  if (error) {
    console.error('fetchUserCardStates error:', error);
    return [];
  }

  return (data ?? []).map(row => ({
    cardId: row.card_id as string,
    ease: row.ease_factor as number,
    interval: row.interval_days as number,
    repetitions: row.repetitions as number,
    dueDate: row.next_review as string,
    lastReview: (row.updated_at as string)?.split('T')[0] ?? '',
    synced: true,
  }));
}

/**
 * Fetch daily stats for streak calculation.
 * Returns last 30 days ordered newest first.
 */
export async function fetchDailyStats(
  userId: string
): Promise<Array<{ date: string; cards_studied: number }>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('daily_stats')
    .select('date, cards_studied')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(30);

  if (error) {
    console.error('fetchDailyStats error:', error);
    return [];
  }

  return (data ?? []) as Array<{ date: string; cards_studied: number }>;
}

/**
 * Calculate streak from daily_stats rows (ordered newest first).
 */
export function calculateStreakFromStats(
  dailyStats: Array<{ date: string; cards_studied: number }>
): number {
  if (dailyStats.length === 0) return 0;

  const today = new Date().toISOString().split('T')[0];
  let streak = 0;
  let checkDate = new Date();

  for (const stat of dailyStats) {
    const expectedDate = checkDate.toISOString().split('T')[0];

    if (stat.date === expectedDate && stat.cards_studied > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (stat.date < expectedDate) {
      // Gap found
      break;
    }
  }

  return streak;
}

/**
 * Get today's review count from daily_stats.
 */
export async function getTodayReviewCount(userId: string): Promise<number> {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_stats')
    .select('cards_studied')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (error || !data) return 0;
  return (data.cards_studied as number) ?? 0;
}
