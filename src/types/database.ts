// ============================================================
// MedCards Database Types
// Mirrors the Supabase schema exactly
// ============================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
}

export interface Card {
  id: string;
  subcategory_id: string;
  front: string;
  back: string;
  is_active: boolean;
  created_at: string;
}

export interface UserCardState {
  id: string;
  user_id: string;
  card_id: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string;
  last_reviewed: string | null;
}

export interface DailyStats {
  id: string;
  user_id: string;
  date: string;
  cards_reviewed: number;
  correct: number;
  incorrect: number;
}

// Supabase Database schema type for createClient generics
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<Profile, 'id'>>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id'>;
        Update: Partial<Omit<Category, 'id'>>;
      };
      subcategories: {
        Row: Subcategory;
        Insert: Omit<Subcategory, 'id'>;
        Update: Partial<Omit<Subcategory, 'id'>>;
      };
      cards: {
        Row: Card;
        Insert: Omit<Card, 'id' | 'created_at'> & { created_at?: string };
        Update: Partial<Omit<Card, 'id'>>;
      };
      user_card_state: {
        Row: UserCardState;
        Insert: Omit<UserCardState, 'id'>;
        Update: Partial<Omit<UserCardState, 'id'>>;
      };
      daily_stats: {
        Row: DailyStats;
        Insert: Omit<DailyStats, 'id'>;
        Update: Partial<Omit<DailyStats, 'id'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
