'use client';

import { useState, useEffect } from 'react';
import { useReviewStore } from '@/stores/review-store';
import { useAuthStore } from '@/store/authStore';
import { fetchDailyStats, calculateStreakFromStats } from '@/services/review.service';

interface DailyStatsResult {
  todayCount: number;
  streak: number;
  totalReviews: number;
  isLoading: boolean;
}

/**
 * Hook to get daily study statistics.
 * Uses local store as source of truth, syncs from cloud on mount.
 */
export function useDailyStats(): DailyStatsResult {
  const { stats } = useReviewStore();
  const { user } = useAuthStore();
  const [cloudStreak, setCloudStreak] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    setIsLoading(true);
    fetchDailyStats(user.id)
      .then(rows => {
        if (rows.length > 0) {
          const streak = calculateStreakFromStats(rows);
          setCloudStreak(streak);
        }
      })
      .finally(() => setIsLoading(false));
  }, [user?.id]);

  return {
    todayCount: stats.todayReviews,
    streak: cloudStreak ?? stats.streak,
    totalReviews: stats.totalReviews,
    isLoading,
  };
}
