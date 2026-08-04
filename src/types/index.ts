// ============================================================
// MedCards Domain Types
// Single source of truth for all data structures
// ============================================================

// --- Content Domain ---

export interface Card {
  id: string;
  deck_id: string;
  subcategory_id: string;
  front: string;
  back: string;
  extra?: string;
  card_type: "basic" | "cloze";
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
}

export interface SubcategoryWithCount extends Subcategory {
  card_count: number;
  card_ids: string[];
  due_count?: number;
}

export interface SubcategoryWithCategory extends Subcategory {
  category_name: string;
}

// --- Review Domain (SM-2) ---

export type ReviewQuality = 1 | 2 | 3 | 4;

export interface CardReview {
  cardId: string;
  ease: number;
  interval: number;
  repetitions: number;
  dueDate: string;
  lastReview: string;
  synced: boolean;
}

export interface ReviewStats {
  totalReviews: number;
  todayReviews: number;
  cardsLearned: number;
  averageEase: number;
  streak: number;
  lastStudyDate: string;
}

// --- Deck Domain ---

export interface DeckState {
  disabledSubcategories: Record<string, true>;
  newCardsPerDay: Record<string, number>;
  newCardsToday: {
    date: string;
    counts: Record<string, string[]>;
  };
}

// --- Gamification Domain ---

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  cards_done: number;
  best_streak: number;
}

export interface MyRank {
  rank: number;
  points: number;
  cards_done: number;
  best_streak: number;
  total_players: number;
}

// --- Auth Domain ---

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  daily_goal: number;
}

// --- UI Types ---

export type CardClassification = "new" | "learning" | "review";

export interface ClassifiedCards {
  new: string[];
  learning: string[];
  review: string[];
}

export interface StudyQueue {
  cards: Card[];
  currentIndex: number;
  isRevealed: boolean;
}
