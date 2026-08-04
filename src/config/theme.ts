// ============================================================
// MedCards Theme Constants
// Extracted from React Native app's inline styles
// ============================================================

export const colors = {
  // Primary
  primary: "#e94560",

  // Backgrounds
  bgDark: "#16213e",
  bgCard: "#1a1a2e",
  bgInput: "#252a4a",
  bgButton: "#252540",

  // Text
  textPrimary: "#ffffff",
  textSecondary: "#a0a0a0",
  textTertiary: "#666666",
  textDark: "#444444",

  // Accents
  cyan: "#00d9ff",
  green: "#00c853",
  blue: "#2979ff",
  orange: "#ff9f43",

  // Card quality indicators
  qualityAgain: "#e94560",
  qualityHard: "#ff9f43",
  qualityGood: "#00d9ff",
  qualityEasy: "#00c853",

  // Card status indicators
  statusNew: "#2979ff",
  statusLearning: "#e94560",
  statusReview: "#00c853",
} as const;

export const SUPABASE_STORAGE_URL =
  "https://bzzbynmksvbhdkywvccf.supabase.co/storage/v1/object/public/card-images/anki/";

export const DEFAULT_NEW_CARDS_PER_DAY = 20;
export const NEW_CARDS_STEP = 5;
export const MAX_NEW_CARDS_PER_DAY = 999;
export const LEADERBOARD_LIMIT = 50;
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_DEBOUNCE_MS = 300;
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 30;
