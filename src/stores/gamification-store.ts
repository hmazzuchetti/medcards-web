'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { LeaderboardEntry, MyRank, ReviewQuality } from '@/types';

const CACHE_TTL_MS = 60_000; // 60 seconds

interface GamificationStoreState {
  leaderboard: LeaderboardEntry[];
  myRank: MyRank | null;
  isLoading: boolean;
  _leaderboardCachedAt: number;
  _myRankCachedAt: number;

  addPoints: (
    userId: string,
    quality: ReviewQuality,
    streak: number,
    isNewCard: boolean
  ) => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
  fetchMyRank: (userId: string) => Promise<void>;
  invalidateCache: () => void;
}

function calculatePoints(
  quality: ReviewQuality,
  streak: number,
  isNewCard: boolean
): number {
  const basePoints = quality;
  const streakBonus = Math.min(streak, 7);
  const newCardBonus = isNewCard ? 2 : 0;
  return basePoints + streakBonus + newCardBonus;
}

export const useGamificationStore = create<GamificationStoreState>()((set, get) => ({
  leaderboard: [],
  myRank: null,
  isLoading: false,
  _leaderboardCachedAt: 0,
  _myRankCachedAt: 0,

  addPoints: async (
    userId: string,
    quality: ReviewQuality,
    streak: number,
    isNewCard: boolean
  ) => {
    const points = calculatePoints(quality, streak, isNewCard);

    const { error } = await supabase.rpc('add_points', {
      p_user_id: userId,
      p_points: points,
      p_cards_done: 1,
      p_streak: streak,
    });

    if (error) {
      console.error('Failed to add points:', error);
      return;
    }

    // Invalidate cache so next fetch gets fresh data
    get().invalidateCache();
  },

  fetchLeaderboard: async () => {
    const { _leaderboardCachedAt } = get();
    const now = Date.now();

    // Return cached if within TTL
    if (now - _leaderboardCachedAt < CACHE_TTL_MS) {
      return;
    }

    set({ isLoading: true });
    try {
      const { data, error } = await supabase.rpc('get_leaderboard');

      if (error) {
        console.error('Failed to fetch leaderboard:', error);
        return;
      }

      const entries: LeaderboardEntry[] = (data ?? []).map(
        (row: Record<string, unknown>, index: number) => ({
          rank: (row.rank as number) ?? index + 1,
          user_id: row.user_id as string,
          display_name: (row.display_name as string) ?? 'Anonymous',
          avatar_url: (row.avatar_url as string | null) ?? null,
          points: (row.points as number) ?? 0,
          cards_done: (row.cards_done as number) ?? 0,
          best_streak: (row.best_streak as number) ?? 0,
        })
      );

      set({
        leaderboard: entries,
        _leaderboardCachedAt: now,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMyRank: async (userId: string) => {
    const { _myRankCachedAt } = get();
    const now = Date.now();

    // Return cached if within TTL
    if (now - _myRankCachedAt < CACHE_TTL_MS) {
      return;
    }

    set({ isLoading: true });
    try {
      const { data, error } = await supabase.rpc('get_my_rank', {
        p_user_id: userId,
      });

      if (error) {
        console.error('Failed to fetch my rank:', error);
        return;
      }

      if (data && (Array.isArray(data) ? data.length > 0 : true)) {
        const row = Array.isArray(data) ? data[0] : data;
        const myRank: MyRank = {
          rank: (row.rank as number) ?? 0,
          points: (row.points as number) ?? 0,
          cards_done: (row.cards_done as number) ?? 0,
          best_streak: (row.best_streak as number) ?? 0,
          total_players: (row.total_players as number) ?? 0,
        };

        set({
          myRank,
          _myRankCachedAt: now,
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  invalidateCache: () => {
    set({
      _leaderboardCachedAt: 0,
      _myRankCachedAt: 0,
    });
  },
}));
