import { test, expect } from '@playwright/test';
import {
  ANKI_DEFAULTS,
  schedule,
  previewAll,
  formatPreview,
  newCardState,
  isDue,
  dateKey,
  dayStart,
  toRow,
  fromRow,
  type CardState,
} from '../../src/lib/scheduler';

// Fixed "now": a Tuesday at 15:00 local time
const NOW = new Date(2026, 8, 15, 15, 0, 0);
const MIN = 60_000;

function labels(state: CardState | undefined, now = NOW) {
  const p = previewAll(state, now);
  return [formatPreview(p[1]), formatPreview(p[2]), formatPreview(p[3]), formatPreview(p[4])];
}

function minutesFromNow(iso: string, now = NOW) {
  return Math.round((new Date(iso).getTime() - now.getTime()) / MIN);
}

test.describe('Anki defaults', () => {
  test('match the documented deck options', () => {
    expect(ANKI_DEFAULTS.learningSteps).toEqual([1, 10]);
    expect(ANKI_DEFAULTS.relearningSteps).toEqual([10]);
    expect(ANKI_DEFAULTS.graduatingInterval).toBe(1);
    expect(ANKI_DEFAULTS.easyInterval).toBe(4);
    expect(ANKI_DEFAULTS.startingEase).toBe(2.5);
    expect(ANKI_DEFAULTS.hardMultiplier).toBe(1.2);
    expect(ANKI_DEFAULTS.easyBonus).toBe(1.3);
  });
});

test.describe('New card (FB-15 acceptance)', () => {
  test('buttons show 1m / 6m / 10m / 4d', () => {
    expect(labels(undefined)).toEqual(['1m', '6m', '10m', '4d']);
  });

  test('Errei → back in 1 minute, still learning', () => {
    const s = schedule(undefined, 1, NOW);
    expect(s.phase).toBe('learning');
    expect(s.step).toBe(0);
    expect(minutesFromNow(s.due)).toBe(1);
    expect(s.reps).toBe(1);
  });

  test('Difícil on the first step → average of the two steps (5.5m)', () => {
    const s = schedule(undefined, 2, NOW);
    expect(s.phase).toBe('learning');
    expect(new Date(s.due).getTime() - NOW.getTime()).toBe(5.5 * MIN);
  });

  test('Bom → second step (10m); Bom again → graduates to 1d', () => {
    const s1 = schedule(undefined, 3, NOW);
    expect(s1.phase).toBe('learning');
    expect(s1.step).toBe(1);
    expect(minutesFromNow(s1.due)).toBe(10);
    expect(labels(s1)).toEqual(['1m', '10m', '1d', '4d']);

    const later = new Date(NOW.getTime() + 10 * MIN);
    const s2 = schedule(s1, 3, later);
    expect(s2.phase).toBe('review');
    expect(s2.interval).toBe(1);
    expect(s2.ease).toBe(2.5); // ease untouched while learning
    // Due at the start of tomorrow's study day (4am)
    const expected = dayStart(later);
    expected.setDate(expected.getDate() + 1);
    expect(new Date(s2.due).getTime()).toBe(expected.getTime());
  });

  test('Fácil → graduates immediately with 4d', () => {
    const s = schedule(undefined, 4, NOW);
    expect(s.phase).toBe('review');
    expect(s.interval).toBe(4);
  });

  test('Errei in learning goes back to step 1 without touching ease', () => {
    const s1 = schedule(undefined, 3, NOW);
    const s2 = schedule(s1, 1, new Date(NOW.getTime() + 10 * MIN));
    expect(s2.phase).toBe('learning');
    expect(s2.step).toBe(0);
    expect(s2.ease).toBe(2.5);
    expect(s2.lapses).toBe(0);
  });
});

test.describe('Review card (FB-15 acceptance)', () => {
  const review: CardState = {
    phase: 'review',
    step: 0,
    ease: 2.5,
    interval: 10,
    due: NOW.toISOString(),
    reps: 5,
    lapses: 0,
  };

  test('10d @ ease 2.5 → Difícil 12d, Bom 25d, Fácil 33d, Errei 10m', () => {
    expect(labels(review)).toEqual(['10m', '12d', '25d', '1.1mo']);
    expect(schedule(review, 2, NOW).interval).toBe(12);
    expect(schedule(review, 3, NOW).interval).toBe(25);
    expect(schedule(review, 4, NOW).interval).toBe(33);
  });

  test('ease changes: Difícil −0.15, Bom 0, Fácil +0.15', () => {
    expect(schedule(review, 2, NOW).ease).toBeCloseTo(2.35, 5);
    expect(schedule(review, 3, NOW).ease).toBeCloseTo(2.5, 5);
    expect(schedule(review, 4, NOW).ease).toBeCloseTo(2.65, 5);
  });

  test('Errei → relearning in 10m, ease −0.2, lapse counted, interval resets to 1d', () => {
    const s = schedule(review, 1, NOW);
    expect(s.phase).toBe('relearning');
    expect(minutesFromNow(s.due)).toBe(10);
    expect(s.ease).toBeCloseTo(2.3, 5);
    expect(s.lapses).toBe(1);
    expect(s.interval).toBe(1);

    // Bom in relearning graduates back to review with 1d
    const s2 = schedule(s, 3, new Date(NOW.getTime() + 10 * MIN));
    expect(s2.phase).toBe('review');
    expect(s2.interval).toBe(1);
    expect(labels(s)).toEqual(['10m', '15m', '1d', '2d']);
  });

  test('intervals are always strictly increasing across Difícil < Bom < Fácil', () => {
    const tiny: CardState = { ...review, interval: 1, ease: 1.3 };
    const a = schedule(tiny, 2, NOW).interval;
    const b = schedule(tiny, 3, NOW).interval;
    const c = schedule(tiny, 4, NOW).interval;
    expect(a).toBeGreaterThan(tiny.interval);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  test('ease never drops below 1.3 and interval never exceeds the maximum', () => {
    const low: CardState = { ...review, ease: 1.35 };
    expect(schedule(low, 1, NOW).ease).toBe(1.3);
    expect(schedule(low, 2, NOW).ease).toBe(1.3);
    const huge: CardState = { ...review, interval: 30000, ease: 2.5 };
    expect(schedule(huge, 4, NOW).interval).toBe(ANKI_DEFAULTS.maxInterval);
  });

  test('a card due tomorrow is not due today; a card due at 4am today is', () => {
    const tomorrow = dayStart(NOW);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isDue({ ...review, due: tomorrow.toISOString() }, NOW)).toBe(false);
    expect(isDue({ ...review, due: dayStart(NOW).toISOString() }, NOW)).toBe(true);
    expect(isDue(undefined, NOW)).toBe(true);
  });
});

test.describe('Study day (4am rollover)', () => {
  test('03:59 still belongs to the previous day', () => {
    expect(dateKey(new Date(2026, 8, 15, 3, 59))).toBe('2026-09-14');
    expect(dateKey(new Date(2026, 8, 15, 4, 0))).toBe('2026-09-15');
    expect(dateKey(new Date(2026, 8, 15, 23, 30))).toBe('2026-09-15');
  });
});

test.describe('formatPreview', () => {
  test('uses Anki-style units', () => {
    expect(formatPreview({ minutes: 0.4 })).toBe('<1m');
    expect(formatPreview({ minutes: 5.5 })).toBe('6m');
    expect(formatPreview({ minutes: 90 })).toBe('1.5h');
    expect(formatPreview({ days: 1 })).toBe('1d');
    expect(formatPreview({ days: 29 })).toBe('29d');
    expect(formatPreview({ days: 36 })).toBe('1.2mo');
    expect(formatPreview({ days: 400 })).toBe('1.1y');
  });
});

test.describe('Persistence mapping (user_card_state)', () => {
  test('review card round-trips through toRow/fromRow', () => {
    const s = schedule(schedule(undefined, 4, NOW), 3, new Date(NOW.getTime() + 5 * 86_400_000));
    const row = toRow(s, 2, NOW);
    expect(row.interval_days).toBe(s.interval);
    expect(row.repetitions).toBe(2);
    expect(row.last_quality).toBe(3);
    const back = fromRow(row);
    expect(back.phase).toBe('review');
    expect(back.interval).toBe(s.interval);
    expect(back.ease).toBe(s.ease);
    expect(back.due).toBe(s.due);
  });

  test('learning card stores a fractional interval and comes back as learning', () => {
    const s = schedule(undefined, 3, NOW); // 10m step
    const row = toRow(s, 1, NOW);
    expect(row.interval_days).toBeGreaterThan(0);
    expect(row.interval_days).toBeLessThan(1);
    const back = fromRow(row);
    expect(back.phase).toBe('learning');
    expect(back.step).toBe(1);
  });

  test('brand-new card maps to interval 0 / reps 0 and back', () => {
    const row = toRow(newCardState(NOW), 0, NOW);
    expect(row.interval_days).toBe(0);
    expect(fromRow(row).phase).toBe('new');
  });
});
