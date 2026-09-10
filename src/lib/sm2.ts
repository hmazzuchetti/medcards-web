// ============================================================
// SM-2 Algorithm — Pure function, no side effects
// Port from React Native app (src/store/reviews.ts)
// ============================================================

export type ReviewQuality = 1 | 2 | 3 | 4;

export interface SM2Input {
  ease: number;       // ease factor (starts at 2.5)
  interval: number;   // days until next review
  repetitions: number; // consecutive correct answers
}

export interface SM2Output {
  ease: number;
  interval: number;
  repetitions: number;
  dueDate: string;  // ISO date string YYYY-MM-DD
}

/**
 * Map 1-4 quality to SM-2's 0-5 scale.
 * 1 (Failed)   → 0
 * 2 (Hard)     → 3
 * 3 (Good)     → 4
 * 4 (Easy)     → 5
 */
function mapQuality(quality: ReviewQuality): number {
  return quality === 1 ? 0 : quality + 1;
}

/**
 * Calculate next review schedule using SM-2 algorithm.
 *
 * SM-2 reference: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method
 */
export function calculateSM2(
  current: SM2Input | undefined,
  quality: ReviewQuality
): SM2Output {
  const sm2Quality = mapQuality(quality);
  const now = new Date();

  let ease = current?.ease ?? 2.5;
  let interval = current?.interval ?? 0;
  let repetitions = current?.repetitions ?? 0;

  if (sm2Quality < 3) {
    // Failed: reset repetitions and restart from interval = 1
    repetitions = 0;
    interval = 1;
    // Note: ease factor is NOT changed on failure (matches RN app behavior)
  } else {
    // Correct: advance the schedule
    repetitions += 1;

    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * ease);
    }

    // SM-2 ease adjustment: higher quality = higher ease
    ease = ease + (0.1 - (5 - sm2Quality) * (0.08 + (5 - sm2Quality) * 0.02));
    ease = Math.max(1.3, ease); // minimum ease factor
  }

  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + interval);

  return {
    ease,
    interval,
    repetitions,
    dueDate: dueDate.toISOString().split('T')[0],
  };
}

/**
 * Returns today's date as YYYY-MM-DD string.
 */
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Returns true if a card is due for review today.
 * Cards never reviewed are always due.
 */
export function isDue(dueDate: string | undefined): boolean {
  if (!dueDate) return true;
  return dueDate <= getToday();
}

/**
 * Classify a card's SM-2 state.
 * new:      never reviewed
 * learning: fewer than 2 repetitions
 * review:   2+ repetitions
 */
export type CardClassification = 'new' | 'learning' | 'review';

export function classifyCard(
  repetitions: number | undefined,
  dueDate: string | undefined
): CardClassification | null {
  if (repetitions === undefined) return 'new';
  if (repetitions < 2) {
    return isDue(dueDate) ? 'learning' : null;
  }
  return isDue(dueDate) ? 'review' : null;
}
