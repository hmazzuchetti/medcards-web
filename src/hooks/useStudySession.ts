'use client';

import { useState, useCallback, useEffect } from 'react';
import { useReviewStore } from '@/stores/review-store';
import { useDeckStore } from '@/stores/deck-store';
import { useAuthStore } from '@/store/authStore';
import { fetchCardsByCategory, fetchEnabledCards, fetchSubcategoriesWithCards } from '@/services/cards.service';
import { saveReview, saveDailyStats } from '@/services/review.service';
import { getToday } from '@/lib/sm2';
import type { Card, ReviewQuality, ClassifiedCards } from '@/types';

interface UseStudySessionOptions {
  /** Category ID to filter cards (undefined = all enabled categories) */
  categoryId?: string;
  /** Explicit list of subcategory IDs (overrides categoryId) */
  subcategoryIds?: string[];
}

interface UseStudySessionReturn {
  /** Ordered study queue */
  queue: Card[];
  /** Current index in the queue */
  currentIndex: number;
  /** Current card, or null if done */
  currentCard: Card | null;
  /** Whether the answer is revealed for the current card */
  isRevealed: boolean;
  /** Queue loading state */
  isLoading: boolean;
  /** Whether the session is complete (all cards answered) */
  isDone: boolean;
  /** Classification breakdown (new/learning/review counts) */
  classified: ClassifiedCards;
  /** Number of cards reviewed in this session */
  sessionCount: number;
  /** Total today reviews (from store stats) */
  todayCount: number;

  /** Reveal the answer for the current card */
  revealAnswer: () => void;
  /** Record review quality and advance to next card */
  answerCard: (quality: ReviewQuality) => Promise<void>;
  /** Skip current card without reviewing */
  skipCard: () => void;
  /** Reload the queue from scratch */
  reload: () => Promise<void>;
}

export function useStudySession(options: UseStudySessionOptions = {}): UseStudySessionReturn {
  const { categoryId, subcategoryIds } = options;

  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [classified, setClassified] = useState<ClassifiedCards>({ new: [], learning: [], review: [] });
  const [sessionCount, setSessionCount] = useState(0);

  const { recordReview, classifyCards, getDueCards, reviews, stats } = useReviewStore();
  const { getNewCardsRemainingToday, recordNewCardIntroduced } = useDeckStore();
  const { user } = useAuthStore();

  const buildQueue = useCallback((cards: Card[]): Card[] => {
    if (cards.length === 0) return [];

    const cardIds = cards.map(c => c.id);
    const classification = classifyCards(cardIds);

    // Limit new cards per subcategory using deck store limits
    const newCardsAllowed: string[] = [];
    // Track how many new cards we've admitted per subcategory
    const newCountBySubcat: Record<string, number> = {};

    for (const cardId of classification.new) {
      const card = cards.find(c => c.id === cardId);
      if (!card) continue;

      const subcatId = card.subcategory_id;
      const admitted = newCountBySubcat[subcatId] ?? 0;
      const remaining = getNewCardsRemainingToday(subcatId);

      if (admitted < remaining) {
        newCardsAllowed.push(cardId);
        newCountBySubcat[subcatId] = admitted + 1;
      }
    }

    setClassified({
      ...classification,
      new: newCardsAllowed,
    });

    // Order: learning → review → new (limited)
    const orderedIds = [
      ...classification.learning,
      ...classification.review,
      ...newCardsAllowed,
    ];

    const cardMap = new Map(cards.map(c => [c.id, c]));
    return orderedIds.map(id => cardMap.get(id)!).filter(Boolean);
  }, [classifyCards, getNewCardsRemainingToday]);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      let cards: Card[];

      if (subcategoryIds && subcategoryIds.length > 0) {
        cards = await fetchEnabledCards(subcategoryIds);
      } else if (categoryId) {
        cards = await fetchCardsByCategory(categoryId);
      } else {
        // All categories: fetch all subcategory IDs then all cards
        const subcats = await fetchSubcategoriesWithCards();
        const allSubIds = subcats.map(s => s.id);
        cards = await fetchEnabledCards(allSubIds);
      }

      const ordered = buildQueue(cards);
      setQueue(ordered);
      setCurrentIndex(0);
      setIsRevealed(false);
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, subcategoryIds, buildQueue]);

  // Load on mount or when options change
  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, JSON.stringify(subcategoryIds)]);

  const revealAnswer = useCallback(() => {
    setIsRevealed(true);
  }, []);

  const answerCard = useCallback(async (quality: ReviewQuality) => {
    const card = queue[currentIndex];
    if (!card) return;

    // Record locally with SM-2
    const updated = recordReview(card.id, quality);

    // If this was a new card (first review), record it in deck store for daily limit tracking
    if (updated.repetitions === 1) {
      recordNewCardIntroduced(card.subcategory_id, card.id);
    }

    // Persist to Supabase in background (don't block UI)
    if (user?.id) {
      const newSessionCount = sessionCount + 1;
      setSessionCount(newSessionCount);

      void saveReview(user.id, updated);

      // Update daily stats
      const today = getToday();
      const todayTotal = (stats.todayReviews ?? 0) + 1;
      void saveDailyStats(user.id, today, todayTotal);
    } else {
      setSessionCount(prev => prev + 1);
    }

    // Advance to next card
    setCurrentIndex(prev => prev + 1);
    setIsRevealed(false);
  }, [queue, currentIndex, recordReview, user, sessionCount, stats.todayReviews]);

  const skipCard = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
    setIsRevealed(false);
  }, []);

  const reload = useCallback(async () => {
    setSessionCount(0);
    await loadQueue();
  }, [loadQueue]);

  const currentCard = currentIndex < queue.length ? queue[currentIndex] : null;
  const isDone = !isLoading && queue.length > 0 && currentIndex >= queue.length;

  return {
    queue,
    currentIndex,
    currentCard,
    isRevealed,
    isLoading,
    isDone,
    classified,
    sessionCount,
    todayCount: stats.todayReviews,
    revealAnswer,
    answerCard,
    skipCard,
    reload,
  };
}
