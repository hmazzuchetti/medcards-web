'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useReviewStore } from '@/stores/review-store';
import { useDeckStore } from '@/stores/deck-store';
import { useAuthStore } from '@/store/authStore';
import {
  fetchCardsByCategory,
  fetchEnabledCards,
  fetchSubcategoriesWithCards,
} from '@/services/cards.service';
import { saveReview, saveDailyStats } from '@/services/review.service';
import {
  ANKI_DEFAULTS,
  MS_PER_MINUTE,
  bucketOf,
  dateKey,
  isDue,
  previewAll,
  type IntervalPreview,
  type QueueBucket,
} from '@/lib/scheduler';
import type { Card, CardReview, ReviewQuality } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseStudySessionOptions {
  /** Study one category (all its subcategories) */
  categoryId?: string;
  /** Study an explicit list of subcategories (overrides categoryId) */
  subcategoryIds?: string[];
  /** Skip loading until true (e.g. while the subcategory list is being resolved) */
  enabled?: boolean;
}

export interface QueueCounts {
  new: number;
  learning: number;
  review: number;
}

interface LearningEntry {
  cardId: string;
  /** Epoch ms at which the card becomes due again */
  due: number;
}

interface SessionState {
  /** Cards in the session, by id */
  cards: Record<string, Card>;
  /** Review + new cards waiting to be shown (in order) */
  mainQueue: string[];
  /** Cards in (re)learning that will come back later in this session */
  learningQueue: LearningEntry[];
  currentId: string | null;
  /** When non-null, nothing is due yet: epoch ms at which the next learning card should be shown */
  waitUntil: number | null;
  /** Number of cards answered in this session */
  sessionCount: number;
  /** True when the queue was empty when the session was loaded */
  emptyOnLoad: boolean;
}

export interface UseStudySessionReturn {
  currentCard: Card | null;
  currentReview: CardReview | undefined;
  isRevealed: boolean;
  isLoading: boolean;
  /** Nothing to study at all (queue empty on load) */
  isEmpty: boolean;
  /** All cards answered and nothing waiting */
  isDone: boolean;
  /** Waiting for a learning card to become due; epoch ms of that moment */
  waitUntil: number | null;
  counts: QueueCounts;
  sessionCount: number;
  todayCount: number;
  /** Intervals each button would produce for the current card */
  previews: Record<ReviewQuality, IntervalPreview> | null;
  revealAnswer: () => void;
  answerCard: (quality: ReviewQuality) => Promise<void>;
  /** Show the next waiting learning card right away (learn ahead) */
  showNow: () => void;
  reload: () => Promise<void>;
}

const EMPTY_STATE: SessionState = {
  cards: {},
  mainQueue: [],
  learningQueue: [],
  currentId: null,
  waitUntil: null,
  sessionCount: 0,
  emptyOnLoad: false,
};

// ─── Pure queue logic ─────────────────────────────────────────────────────────

const LEARN_AHEAD_MS = ANKI_DEFAULTS.learnAheadLimit * MS_PER_MINUTE;

/**
 * Pick the next card, Anki-style:
 * 1. learning cards that are already due (earliest first)
 * 2. the main queue (reviews first, then new cards)
 * 3. learning cards due within the learn-ahead limit
 * 4. otherwise wait until the earliest learning card is due
 */
export function pickNext(
  state: SessionState,
  now: number,
  force = false
): SessionState {
  const sorted = [...state.learningQueue].sort((a, b) => a.due - b.due);

  const dueNow = sorted.find(l => l.due <= now);
  if (dueNow) {
    return {
      ...state,
      currentId: dueNow.cardId,
      learningQueue: sorted.filter(l => l !== dueNow),
      waitUntil: null,
    };
  }

  if (state.mainQueue.length > 0) {
    const [next, ...rest] = state.mainQueue;
    return { ...state, currentId: next, mainQueue: rest, waitUntil: null };
  }

  const ahead = sorted.find(l => l.due <= now + LEARN_AHEAD_MS) ?? (force ? sorted[0] : undefined);
  if (ahead) {
    return {
      ...state,
      currentId: ahead.cardId,
      learningQueue: sorted.filter(l => l !== ahead),
      waitUntil: null,
    };
  }

  if (sorted.length > 0) {
    return { ...state, currentId: null, waitUntil: sorted[0].due - LEARN_AHEAD_MS };
  }

  return { ...state, currentId: null, waitUntil: null };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStudySession(options: UseStudySessionOptions = {}): UseStudySessionReturn {
  const { categoryId, subcategoryIds, enabled = true } = options;
  const subcategoryKey = JSON.stringify(subcategoryIds ?? null);

  const [state, setState] = useState<SessionState>(EMPTY_STATE);
  const [isRevealed, setIsRevealed] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  /** Key of the options the current session was built for */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const answeringRef = useRef(false);

  const loadKey = `${enabled ? 1 : 0}|${categoryId ?? ""}|${subcategoryKey}|${reloadTick}`;
  const isLoading = !enabled || loadedKey !== loadKey;

  const reviews = useReviewStore(s => s.reviews);
  const stats = useReviewStore(s => s.stats);
  const recordReview = useReviewStore(s => s.recordReview);
  const days = useReviewStore(s => s.days);
  const { getNewCardsRemainingToday, recordNewCardIntroduced } = useDeckStore();
  const user = useAuthStore(s => s.user);

  // ─── Build the session queue ───
  const buildSession = useCallback(
    (cards: Card[], now: Date): SessionState => {
      const store = useReviewStore.getState();
      const nowMs = now.getTime();
      const todayKey = dateKey(now);

      const cardMap: Record<string, Card> = {};
      const reviewQueue: string[] = [];
      const newQueue: string[] = [];
      const learning: LearningEntry[] = [];
      const newBySubcategory: Record<string, number> = {};

      for (const card of cards) {
        cardMap[card.id] = card;
        const review = store.reviews[card.id];
        const bucket: QueueBucket = bucketOf(review);

        if (bucket === 'new') {
          const admitted = newBySubcategory[card.subcategory_id] ?? 0;
          if (admitted < getNewCardsRemainingToday(card.subcategory_id)) {
            newQueue.push(card.id);
            newBySubcategory[card.subcategory_id] = admitted + 1;
          }
        } else if (bucket === 'review') {
          if (isDue(review, now)) reviewQueue.push(card.id);
        } else {
          // learning / relearning: part of today's session if due today
          const dueMs = new Date(review!.due).getTime();
          if (dueMs <= nowMs || dateKey(new Date(dueMs)) <= todayKey) {
            learning.push({ cardId: card.id, due: dueMs });
          }
        }
      }

      const base: SessionState = {
        cards: cardMap,
        mainQueue: [...reviewQueue, ...newQueue],
        learningQueue: learning,
        currentId: null,
        waitUntil: null,
        sessionCount: 0,
        emptyOnLoad: reviewQueue.length + newQueue.length + learning.length === 0,
      };
      return pickNext(base, nowMs);
    },
    [getNewCardsRemainingToday]
  );

  /** Fetch the cards for the current options and build a fresh session (no state updates here). */
  const fetchSession = useCallback(async (): Promise<SessionState | null> => {
    if (!enabled) return null;
    let cards: Card[];
    if (subcategoryIds) {
      cards = subcategoryIds.length > 0 ? await fetchEnabledCards(subcategoryIds) : [];
    } else if (categoryId) {
      cards = await fetchCardsByCategory(categoryId);
    } else {
      const subcats = await fetchSubcategoriesWithCards();
      cards = await fetchEnabledCards(subcats.map(s => s.id));
    }
    return buildSession(cards, new Date());
  }, [enabled, categoryId, subcategoryKey, buildSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load (and reload when the options or the reload tick change); stale loads are dropped
  useEffect(() => {
    let cancelled = false;
    void fetchSession().then(session => {
      if (cancelled || !session) return;
      setState(session);
      setIsRevealed(false);
      setLoadedKey(loadKey);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchSession, loadKey]);

  // ─── Wake up when a learning card becomes due ───
  useEffect(() => {
    if (state.waitUntil === null || state.currentId !== null) return;
    const delay = Math.max(0, state.waitUntil - Date.now());
    const timer = setTimeout(() => {
      setState(prev => (prev.currentId === null ? pickNext(prev, Date.now()) : prev));
    }, delay + 50);
    return () => clearTimeout(timer);
  }, [state.waitUntil, state.currentId]);

  // ─── Actions ───
  const revealAnswer = useCallback(() => setIsRevealed(true), []);

  const answerCard = useCallback(
    async (quality: ReviewQuality) => {
      const cardId = state.currentId;
      if (!cardId || answeringRef.current) return;
      answeringRef.current = true;
      try {
        const card = state.cards[cardId];
        const now = new Date();
        const wasNew = bucketOf(useReviewStore.getState().reviews[cardId]) === 'new';

        const updated = recordReview(cardId, quality, now);

        if (wasNew) {
          recordNewCardIntroduced(card.subcategory_id, cardId);
        }

        if (user?.id) {
          const today = dateKey(now);
          const dayStats = useReviewStore.getState().days[today];
          void saveReview(user.id, updated);
          if (dayStats) void saveDailyStats(user.id, today, dayStats);
        }

        setState(prev => {
          const learningQueue =
            updated.phase === 'learning' || updated.phase === 'relearning'
              ? [...prev.learningQueue, { cardId, due: new Date(updated.due).getTime() }]
              : prev.learningQueue;
          return pickNext(
            { ...prev, learningQueue, currentId: null, sessionCount: prev.sessionCount + 1 },
            now.getTime()
          );
        });
        setIsRevealed(false);
      } finally {
        answeringRef.current = false;
      }
    },
    [state.currentId, state.cards, recordReview, recordNewCardIntroduced, user?.id]
  );

  const showNow = useCallback(() => {
    setState(prev => (prev.currentId === null ? pickNext(prev, Date.now(), true) : prev));
  }, []);

  const reload = useCallback(async () => {
    setReloadTick(t => t + 1);
  }, []);

  // ─── Derived ───
  const currentCard = state.currentId ? state.cards[state.currentId] ?? null : null;
  const currentReview = state.currentId ? reviews[state.currentId] : undefined;

  const counts = useMemo<QueueCounts>(() => {
    const c: QueueCounts = { new: 0, learning: state.learningQueue.length, review: 0 };
    for (const id of state.mainQueue) {
      const b = bucketOf(reviews[id]);
      if (b === 'new') c.new++;
      else if (b === 'review') c.review++;
      else c.learning++;
    }
    if (state.currentId) {
      const b = bucketOf(reviews[state.currentId]);
      c[b]++;
    }
    return c;
  }, [state.mainQueue, state.learningQueue, state.currentId, reviews]);

  const previews = useMemo(
    () => (currentCard ? previewAll(currentReview, new Date()) : null),
    [currentCard, currentReview]
  );

  const todayCount = days[dateKey(new Date())]?.count ?? stats.todayReviews;

  const isDone =
    !isLoading &&
    !state.emptyOnLoad &&
    state.currentId === null &&
    state.mainQueue.length === 0 &&
    state.learningQueue.length === 0;

  return {
    currentCard,
    currentReview,
    isRevealed,
    isLoading,
    isEmpty: !isLoading && state.emptyOnLoad,
    isDone,
    waitUntil: state.currentId === null ? state.waitUntil : null,
    counts,
    sessionCount: state.sessionCount,
    todayCount,
    previews,
    revealAnswer,
    answerCard,
    showNow,
    reload,
  };
}
