// ============================================================
// Ranking Service
// Fetches leaderboard data from Supabase daily_stats + profiles
// ============================================================

import { createClient } from '@/lib/supabase/client';
import type { LeaderboardEntry } from '@/types';

export interface RankingResult {
  leaderboard: LeaderboardEntry[];
  fallback: boolean;
  error?: string;
}

/**
 * Fetch global leaderboard.
 *
 * Strategy:
 * 1. Try to aggregate daily_stats JOIN profiles for all visible users
 * 2. If RLS blocks other users, fall back to fetching only current user's data
 *
 * Points formula: total_cards * 10  (simplified — no server-side streak)
 */
export async function fetchLeaderboard(currentUserId: string | undefined): Promise<RankingResult> {
  const supabase = createClient();

  try {
    // Attempt: fetch daily_stats (RLS may limit rows to own user)
    const { data: statsData, error: statsError } = await supabase
      .from('daily_stats')
      .select('user_id, cards_studied, date')
      .order('date', { ascending: false });

    if (statsError) {
      console.error('fetchLeaderboard daily_stats error:', statsError);
      return await fetchFallback(supabase, currentUserId);
    }

    if (!statsData || statsData.length === 0) {
      // No data at all — return empty with fallback flag
      return await fetchFallback(supabase, currentUserId);
    }

    // Aggregate by user_id
    const userTotals: Record<string, { total: number; best: number }> = {};
    for (const row of statsData) {
      const uid = row.user_id as string;
      const studied = (row.cards_studied as number) ?? 0;
      if (!userTotals[uid]) {
        userTotals[uid] = { total: 0, best: 0 };
      }
      userTotals[uid].total += studied;
      if (studied > userTotals[uid].best) {
        userTotals[uid].best = studied;
      }
    }

    const userIds = Object.keys(userTotals);
    if (userIds.length === 0) {
      return await fetchFallback(supabase, currentUserId);
    }

    // Fetch display names from profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds);

    if (profilesError) {
      console.error('fetchLeaderboard profiles error:', profilesError);
    }

    const profileMap: Record<string, string> = {};
    for (const p of profilesData ?? []) {
      const name = (p.display_name as string | null) ?? 'Anônimo';
      profileMap[p.id as string] = name;
    }

    // Build sorted leaderboard
    const entries: LeaderboardEntry[] = userIds
      .map((uid) => {
        const agg = userTotals[uid];
        const points = agg.total * 10;
        return {
          rank: 0, // assigned below
          user_id: uid,
          display_name: profileMap[uid] ?? 'Anônimo',
          avatar_url: null,
          points,
          cards_done: agg.total,
          best_streak: agg.best, // repurposed: best_day cards
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 50)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    // If only 1 user visible and it's the current user, flag as fallback
    const isFallback = entries.length === 1 && entries[0].user_id === currentUserId;

    return { leaderboard: entries, fallback: isFallback };
  } catch (err) {
    console.error('fetchLeaderboard unexpected error:', err);
    return await fetchFallback(supabase, currentUserId);
  }
}

/**
 * Fallback: show only the current user in the ranking.
 */
async function fetchFallback(
  supabase: ReturnType<typeof createClient>,
  currentUserId: string | undefined
): Promise<RankingResult> {
  if (!currentUserId) {
    return { leaderboard: [], fallback: true, error: 'Usuário não autenticado' };
  }

  try {
    const [statsResult, profileResult] = await Promise.all([
      supabase
        .from('daily_stats')
        .select('cards_studied')
        .eq('user_id', currentUserId),
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', currentUserId)
        .maybeSingle<{ display_name: string | null }>(),
    ]);

    const totalCards = (statsResult.data ?? []).reduce(
      (sum, row) => sum + ((row.cards_studied as number) ?? 0),
      0
    );

    const displayName = profileResult.data?.display_name ?? 'Você';

    const entry: LeaderboardEntry = {
      rank: 1,
      user_id: currentUserId,
      display_name: displayName,
      avatar_url: null,
      points: totalCards * 10,
      cards_done: totalCards,
      best_streak: 0,
    };

    return { leaderboard: [entry], fallback: true };
  } catch {
    return { leaderboard: [], fallback: true, error: 'Erro ao carregar ranking' };
  }
}
