// ============================================================
// MedCards Scheduler — port of Anki's default (SM-2 based) scheduler
//
// Pure functions, no side effects. Mirrors Anki v3 with default deck options:
//   learning steps 1m 10m · graduating 1d · easy 4d · starting ease 250%
//   hard ×1.2 · easy bonus ×1.3 · lapse → relearning 10m, ease −20%, new ivl 1d
//   day rollover at 4am (like Anki's "next day starts at")
//
// Card life cycle (same names as Anki):
//   new ──Good/Good──▶ learning ──graduate──▶ review ──Again──▶ relearning ──▶ review
// ============================================================

export type ReviewQuality = 1 | 2 | 3 | 4; // 1 Again (Errei) · 2 Hard (Difícil) · 3 Good (Bom) · 4 Easy (Fácil)
export type CardPhase = 'new' | 'learning' | 'review' | 'relearning';

export interface SchedulerConfig {
  /** Learning steps for new cards, in minutes (Anki default "1m 10m") */
  learningSteps: number[];
  /** Relearning steps after a lapse, in minutes (Anki default "10m") */
  relearningSteps: number[];
  /** Interval (days) when a card graduates from learning with Good */
  graduatingInterval: number;
  /** Interval (days) when a card graduates with Easy */
  easyInterval: number;
  /** Starting ease factor (Anki 250%) */
  startingEase: number;
  /** Minimum ease factor (Anki 130%) */
  minEase: number;
  /** Multiplier applied to the interval on Hard (Anki 1.2) */
  hardMultiplier: number;
  /** Extra multiplier applied on Easy (Anki 1.3) */
  easyBonus: number;
  /** Global interval modifier (Anki 1.0) */
  intervalModifier: number;
  /** Multiplier applied to the previous interval on a lapse (Anki 0%) */
  lapseNewIntervalMultiplier: number;
  /** Minimum interval (days) after a lapse (Anki 1d) */
  lapseMinInterval: number;
  /** Maximum interval in days (Anki 36500) */
  maxInterval: number;
  /** Show learning cards up to this many minutes early when nothing else is due (Anki 20m) */
  learnAheadLimit: number;
  /** Hour at which a new "study day" starts (Anki 4am) */
  dayStartHour: number;
}

export const ANKI_DEFAULTS: SchedulerConfig = {
  learningSteps: [1, 10],
  relearningSteps: [10],
  graduatingInterval: 1,
  easyInterval: 4,
  startingEase: 2.5,
  minEase: 1.3,
  hardMultiplier: 1.2,
  easyBonus: 1.3,
  intervalModifier: 1.0,
  lapseNewIntervalMultiplier: 0,
  lapseMinInterval: 1,
  maxInterval: 36500,
  learnAheadLimit: 20,
  dayStartHour: 4,
};

export interface CardState {
  phase: CardPhase;
  /** Current index in learning/relearning steps (0-based) */
  step: number;
  /** Ease factor (2.5 = 250%) */
  ease: number;
  /** Review interval in days (for relearning cards: the interval to use after graduating) */
  interval: number;
  /** ISO datetime at which the card becomes due */
  due: string;
  /** Total number of answers recorded */
  reps: number;
  /** Number of times the card was forgotten in review */
  lapses: number;
  /** Last answer given */
  lastQuality?: ReviewQuality;
}

export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;

// ─── Day helpers (Anki-style rollover at 4am) ────────────────────────────────

/** Start of the current study day (local time, at dayStartHour). */
export function dayStart(now: Date, cfg: SchedulerConfig = ANKI_DEFAULTS): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cfg.dayStartHour, 0, 0, 0);
  if (now.getTime() < d.getTime()) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

/** Date key (YYYY-MM-DD, local) of the study day that `now` belongs to. */
export function dateKey(now: Date = new Date(), cfg: SchedulerConfig = ANKI_DEFAULTS): string {
  const d = dayStart(now, cfg);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Due datetime for a review card `days` study-days from now. */
function reviewDue(now: Date, days: number, cfg: SchedulerConfig): Date {
  const d = dayStart(now, cfg);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── State helpers ───────────────────────────────────────────────────────────

export function newCardState(now: Date = new Date(), cfg: SchedulerConfig = ANKI_DEFAULTS): CardState {
  return {
    phase: 'new',
    step: 0,
    ease: cfg.startingEase,
    interval: 0,
    due: now.toISOString(),
    reps: 0,
    lapses: 0,
  };
}

/** True when the card should be shown now (learning: by time; review: by study day). */
export function isDue(state: CardState | undefined, now: Date = new Date()): boolean {
  if (!state || state.phase === 'new') return true;
  return new Date(state.due).getTime() <= now.getTime();
}

/** Anki-style bucket used by the counters and queue ordering. */
export type QueueBucket = 'new' | 'learning' | 'review';

export function bucketOf(state: CardState | undefined): QueueBucket {
  if (!state || state.phase === 'new') return 'new';
  if (state.phase === 'review') return 'review';
  return 'learning';
}

// ─── Learning step delays ────────────────────────────────────────────────────

function stepsFor(phase: CardPhase, cfg: SchedulerConfig): number[] {
  return phase === 'relearning' ? cfg.relearningSteps : cfg.learningSteps;
}

/**
 * Delay (minutes) for Hard while in learning: repeat the current step.
 * On the first step Anki uses the average of the first two steps (or ×1.5 with a single step).
 */
function hardDelayMinutes(steps: number[], step: number): number {
  const current = steps[Math.min(step, steps.length - 1)] ?? 1;
  if (step === 0) {
    const next = steps[1];
    const delay = next !== undefined ? (current + next) / 2 : current * 1.5;
    return Math.min(delay, 24 * 60);
  }
  return current;
}

// ─── Interval constraints ────────────────────────────────────────────────────

function constrainInterval(days: number, minimum: number, cfg: SchedulerConfig): number {
  const rounded = Math.max(minimum, Math.round(days));
  return Math.min(cfg.maxInterval, rounded);
}

/** Review intervals (days) for Hard / Good / Easy, chained like Anki (each at least previous + 1). */
export function reviewIntervals(state: CardState, cfg: SchedulerConfig = ANKI_DEFAULTS) {
  const ivl = Math.max(1, state.interval);
  const hard = constrainInterval(ivl * cfg.hardMultiplier * cfg.intervalModifier, ivl + 1, cfg);
  const good = constrainInterval(ivl * state.ease * cfg.intervalModifier, hard + 1, cfg);
  const easy = constrainInterval(ivl * state.ease * cfg.easyBonus * cfg.intervalModifier, good + 1, cfg);
  return { hard, good, easy };
}

function lapseInterval(state: CardState, cfg: SchedulerConfig): number {
  return constrainInterval(state.interval * cfg.lapseNewIntervalMultiplier, cfg.lapseMinInterval, cfg);
}

// ─── Core: answer a card ─────────────────────────────────────────────────────

/**
 * Compute the next state for a card after answering with `quality`.
 * Never mutates the input.
 */
export function schedule(
  previous: CardState | undefined,
  quality: ReviewQuality,
  now: Date = new Date(),
  cfg: SchedulerConfig = ANKI_DEFAULTS
): CardState {
  const state = previous ?? newCardState(now, cfg);
  const base: CardState = { ...state, reps: state.reps + 1, lastQuality: quality };

  if (state.phase === 'new' || state.phase === 'learning' || state.phase === 'relearning') {
    const phase: CardPhase = state.phase === 'relearning' ? 'relearning' : 'learning';
    const steps = stepsFor(phase, cfg);
    const graduateInterval =
      phase === 'relearning' ? Math.max(1, state.interval) : cfg.graduatingInterval;

    if (steps.length === 0) {
      // No learning steps configured: graduate immediately
      const ivl = quality === 4 ? Math.max(graduateInterval, cfg.easyInterval) : graduateInterval;
      return { ...base, phase: 'review', step: 0, interval: ivl, due: reviewDue(now, ivl, cfg).toISOString() };
    }

    switch (quality) {
      case 1: {
        const minutes = steps[0];
        return { ...base, phase, step: 0, due: new Date(now.getTime() + minutes * MS_PER_MINUTE).toISOString() };
      }
      case 2: {
        const minutes = hardDelayMinutes(steps, state.phase === 'new' ? 0 : state.step);
        const step = state.phase === 'new' ? 0 : state.step;
        return { ...base, phase, step, due: new Date(now.getTime() + minutes * MS_PER_MINUTE).toISOString() };
      }
      case 3: {
        const nextStep = state.phase === 'new' ? 1 : state.step + 1;
        if (nextStep >= steps.length) {
          // Graduate
          return {
            ...base,
            phase: 'review',
            step: 0,
            interval: graduateInterval,
            due: reviewDue(now, graduateInterval, cfg).toISOString(),
          };
        }
        const minutes = steps[nextStep];
        return { ...base, phase, step: nextStep, due: new Date(now.getTime() + minutes * MS_PER_MINUTE).toISOString() };
      }
      case 4: {
        const ivl =
          phase === 'relearning' ? Math.max(graduateInterval + 1, cfg.lapseMinInterval) : cfg.easyInterval;
        return { ...base, phase: 'review', step: 0, interval: ivl, due: reviewDue(now, ivl, cfg).toISOString() };
      }
    }
  }

  // ─── Review phase ───
  switch (quality) {
    case 1: {
      const ease = Math.max(cfg.minEase, state.ease - 0.2);
      const ivl = lapseInterval(state, cfg);
      const lapses = state.lapses + 1;
      if (cfg.relearningSteps.length > 0) {
        const minutes = cfg.relearningSteps[0];
        return {
          ...base,
          phase: 'relearning',
          step: 0,
          ease,
          interval: ivl,
          lapses,
          due: new Date(now.getTime() + minutes * MS_PER_MINUTE).toISOString(),
        };
      }
      return { ...base, phase: 'review', step: 0, ease, interval: ivl, lapses, due: reviewDue(now, ivl, cfg).toISOString() };
    }
    case 2: {
      const { hard } = reviewIntervals(state, cfg);
      const ease = Math.max(cfg.minEase, state.ease - 0.15);
      return { ...base, phase: 'review', ease, interval: hard, due: reviewDue(now, hard, cfg).toISOString() };
    }
    case 3: {
      const { good } = reviewIntervals(state, cfg);
      return { ...base, phase: 'review', interval: good, due: reviewDue(now, good, cfg).toISOString() };
    }
    case 4: {
      const { easy } = reviewIntervals(state, cfg);
      const ease = state.ease + 0.15;
      return { ...base, phase: 'review', ease, interval: easy, due: reviewDue(now, easy, cfg).toISOString() };
    }
  }
}

// ─── Previews (what the buttons show) ────────────────────────────────────────

export interface IntervalPreview {
  /** Delay in minutes, when the card will come back within the session/day */
  minutes?: number;
  /** Delay in study days, when the card is scheduled for a future day */
  days?: number;
}

export function previewAnswer(
  state: CardState | undefined,
  quality: ReviewQuality,
  now: Date = new Date(),
  cfg: SchedulerConfig = ANKI_DEFAULTS
): IntervalPreview {
  const next = schedule(state, quality, now, cfg);
  if (next.phase === 'review') {
    return { days: next.interval };
  }
  const ms = new Date(next.due).getTime() - now.getTime();
  return { minutes: ms / MS_PER_MINUTE };
}

export function previewAll(
  state: CardState | undefined,
  now: Date = new Date(),
  cfg: SchedulerConfig = ANKI_DEFAULTS
): Record<ReviewQuality, IntervalPreview> {
  return {
    1: previewAnswer(state, 1, now, cfg),
    2: previewAnswer(state, 2, now, cfg),
    3: previewAnswer(state, 3, now, cfg),
    4: previewAnswer(state, 4, now, cfg),
  };
}

/** Anki-style short label: "<1m", "6m", "10m", "1d", "4d", "1.2mo", "1.5y". */
export function formatPreview(p: IntervalPreview): string {
  if (p.minutes !== undefined) {
    const m = Math.round(p.minutes);
    if (m < 1) return '<1m';
    if (m < 60) return `${m}m`;
    const h = p.minutes / 60;
    if (h < 24) return `${trimNumber(h)}h`;
    return formatDays(p.minutes / (24 * 60));
  }
  return formatDays(p.days ?? 0);
}

export function formatDays(days: number): string {
  if (days < 30) return `${Math.max(1, Math.round(days))}d`;
  if (days < 365) return `${trimNumber(days / 30)}mo`;
  return `${trimNumber(days / 365)}y`;
}

function trimNumber(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// ─── Persistence helpers (user_card_state table) ─────────────────────────────

export interface UserCardStateRow {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string | null;
  last_quality: number | null;
  total_reviews: number | null;
  correct_count: number | null;
  updated_at?: string | null;
}

/**
 * Map a card state to the columns of `user_card_state`.
 * Learning cards store the step delay as a fraction of a day so that other
 * clients (and `fromRow`) can tell them apart from graduated cards.
 */
export function toRow(
  state: CardState,
  correctCount: number,
  now: Date = new Date()
): UserCardStateRow {
  const inLearning = state.phase === 'learning' || state.phase === 'relearning';
  const stepDays = inLearning
    ? Math.max(1 / 1440, (new Date(state.due).getTime() - now.getTime()) / MS_PER_DAY)
    : state.interval;
  return {
    ease_factor: state.ease,
    interval_days: state.phase === 'new' ? 0 : stepDays,
    repetitions: state.reps,
    next_review: state.due,
    last_quality: state.lastQuality ?? null,
    total_reviews: state.reps,
    correct_count: correctCount,
  };
}

/** Rebuild a card state from a `user_card_state` row (best effort for rows written by other clients). */
export function fromRow(row: UserCardStateRow, cfg: SchedulerConfig = ANKI_DEFAULTS): CardState {
  const reps = row.repetitions ?? 0;
  const ease = row.ease_factor ?? cfg.startingEase;
  const ivl = row.interval_days ?? 0;
  const due = row.next_review ?? new Date().toISOString();
  const lastQuality = (row.last_quality ?? undefined) as ReviewQuality | undefined;

  if (reps === 0 && ivl === 0) {
    return { ...newCardState(new Date(), cfg), ease };
  }

  if (ivl > 0 && ivl < 1) {
    // Intra-day delay → learning or relearning
    const minutes = Math.round(ivl * 1440);
    const relearning = lastQuality === 1 && reps > cfg.learningSteps.length;
    const steps = relearning ? cfg.relearningSteps : cfg.learningSteps;
    let step = steps.findIndex(s => s === minutes);
    if (step < 0) step = 0;
    return {
      phase: relearning ? 'relearning' : 'learning',
      step,
      ease,
      interval: cfg.graduatingInterval,
      due,
      reps,
      lapses: relearning ? 1 : 0,
      lastQuality,
    };
  }

  return {
    phase: 'review',
    step: 0,
    ease,
    interval: Math.max(1, Math.round(ivl)),
    due,
    reps,
    lapses: 0,
    lastQuality,
  };
}
