'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useReviewStore } from '@/stores/review-store';
import { useCardsStore } from '@/stores/cards-store';
import { useDeckStore } from '@/stores/deck-store';
import type { Card, ReviewQuality, ClassifiedCards } from '@/types';

interface UseStudyQueueReturn {
  /** Ordered queue of cards for studying */
  queue: Card[];
  /** Index of the current card */
  currentIndex: number;
  /** The current card, or null if queue is empty/exhausted */
  currentCard: Card | null;
  /** Whether the current card's answer is revealed */
  isRevealed: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Classification breakdown of the queue */
  classified: ClassifiedCards;
  /** Number of cards remaining in this session */
  remaining: number;

  /** Load the study queue based on enabled subcategories */
  loadQueue: () => Promise<void>;
  /** Reveal the answer for the current card */
  revealAnswer: () => void;
  /** Record a review and advance to the next card */
  answerCard: (quality: ReviewQuality) => void;
  /** Skip to the next card without reviewing */
  skipCard: () => void;
  /** Reset and reload the queue */
  reset: () => Promise<void>;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function useStudyQueue(): UseStudyQueueReturn {
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [classified, setClassified] = useState<ClassifiedCards>({
    new: [],
    learning: [],
    review: [],
  });

  const loadedRef = useRef(false);

  const { getDueCards, classifyCards, recordReview } = useReviewStore();
  const { fetchAllSubcategoriesFlat, fetchEnabledCards, allSubcategories } = useCardsStore();
  const {
    getEnabledSubcategoryIds,
    getNewCardsRemainingToday,
    recordNewCardIntroduced,
  } = useDeckStore();

  const buildQueue = useCallback(
    (cards: Card[], dueCardIds: string[], classification: ClassifiedCards): Card[] => {
      const cardMap = new Map<string, Card>();
      for (const card of cards) {
        cardMap.set(card.id, card);
      }

      // Determine how many new cards we can introduce per subcategory
      const newCardsBySubcategory = new Map<string, string[]>();
      for (const cardId of classification.new) {
        const card = cardMap.get(cardId);
        if (!card) continue;

        const subId = card.subcategory_id;
        if (!newCardsBySubcategory.has(subId)) {
          newCardsBySubcategory.set(subId, []);
        }
        newCardsBySubcategory.get(subId)!.push(cardId);
      }

      // Filter new cards based on daily limit
      const allowedNewCardIds: string[] = [];
      for (const [subcategoryId, cardIds] of newCardsBySubcategory) {
        const remaining = getNewCardsRemainingToday(subcategoryId);
        const allowed = cardIds.slice(0, remaining);
        allowedNewCardIds.push(...allowed);
      }

      // Build ordered queue: learning first, then review, then new
      const orderedIds: string[] = [
        ...classification.learning,
        ...classification.review,
        ...allowedNewCardIds,
      ];

      // Map IDs to Card objects, filtering out any missing cards
      const orderedCards: Card[] = [];
      for (const id of orderedIds) {
        const card = cardMap.get(id);
        if (card) {
          orderedCards.push(card);
        }
      }

      return orderedCards;
    },
    [getNewCardsRemainingToday]
  );

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      // Ensure subcategories are loaded
      if (allSubcategories.length === 0) {
        await fetchAllSubcategoriesFlat();
      }

      const subcatState = useCardsStore.getState();
      const allSubIds = subcatState.allSubcategories.map(s => s.id);
      const enabledSubIds = getEnabledSubcategoryIds(allSubIds);

      if (enabledSubIds.length === 0) {
        setQueue([]);
        setCurrentIndex(0);
        setClassified({ new: [], learning: [], review: [] });
        return;
      }

      // Fetch all enabled cards
      const cards = await fetchEnabledCards(enabledSubIds);
      const allCardIds = cards.map(c => c.id);

      // Get due cards and classify
      const dueCardIds = getDueCards(allCardIds);
      const classification = classifyCards(allCardIds);

      setClassified(classification);

      // Build the ordered queue
      const ordered = buildQueue(cards, dueCardIds, classification);
      setQueue(ordered);
      setCurrentIndex(0);
      setIsRevealed(false);
    } finally {
      setIsLoading(false);
    }
  }, [
    allSubcategories.length,
    fetchAllSubcategoriesFlat,
    getEnabledSubcategoryIds,
    fetchEnabledCards,
    getDueCards,
    classifyCards,
    buildQueue,
  ]);

  const revealAnswer = useCallback(() => {
    setIsRevealed(true);
  }, []);

  const answerCard = useCallback(
    (quality: ReviewQuality) => {
      const card = queue[currentIndex];
      if (!card) return;

      // Check if this is a new card (not yet reviewed)
      const reviews = useReviewStore.getState().reviews;
      const isNew = !reviews[card.id];

      // Record the review with SM-2
      recordReview(card.id, quality);

      // If it was a new card, record it against the daily limit
      if (isNew) {
        recordNewCardIntroduced(card.subcategory_id, card.id);
      }

      // Advance to next card
      setCurrentIndex(prev => prev + 1);
      setIsRevealed(false);
    },
    [queue, currentIndex, recordReview, recordNewCardIntroduced]
  );

  const skipCard = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
    setIsRevealed(false);
  }, []);

  const reset = useCallback(async () => {
    setCurrentIndex(0);
    setIsRevealed(false);
    loadedRef.current = false;
    await loadQueue();
  }, [loadQueue]);

  const currentCard = currentIndex < queue.length ? queue[currentIndex] : null;
  const remaining = Math.max(0, queue.length - currentIndex);

  return {
    queue,
    currentIndex,
    currentCard,
    isRevealed,
    isLoading,
    classified,
    remaining,
    loadQueue,
    revealAnswer,
    answerCard,
    skipCard,
    reset,
  };
}
