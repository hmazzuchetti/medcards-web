import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { dateKey } from '../../src/lib/scheduler';

/**
 * End-to-end flow against the real Supabase project:
 *   cadastro → pastas → estudo (toques + botões + intervalos Anki) → perfil → banco → ranking → busca por pasta
 *
 * Creates a throwaway user `playwright+e2e<timestamp>@medcards.test`.
 * Requires NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (loaded from .env.local by playwright.config.ts).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const STAMP = Date.now();
const EMAIL = `playwright+e2e${STAMP}@medcards.test`;
const PASSWORD = 'Playwright123!';
const NAME = `Playwright E2E ${STAMP % 1000}`;
const FOLDER_NAME = 'Fundamentos';
const NEW_CARDS_PER_DAY = 5;

test.describe.configure({ mode: 'serial' });
test.skip(!SUPABASE_URL || !SUPABASE_ANON_KEY, 'Supabase env vars missing');

let page: Page;
let folderId: string;
let folderCardCount = 0;

async function revealByTappingEmptyArea(p: Page) {
  const tapArea = p.getByTestId('tap-area');
  const box = (await tapArea.boundingBox())!;
  // Bottom-center of the tap area: outside the card, inside the study screen
  await p.mouse.click(box.x + box.width / 2, box.y + box.height - 20);
  await expect(p.getByTestId('card-back')).toBeVisible();
}

async function answerBy(p: Page, key: 'again' | 'hard' | 'good' | 'easy') {
  await p.getByTestId(`quality-${key}`).click();
}

async function counts(p: Page) {
  return {
    new: Number(await p.getByTestId('count-new').innerText()),
    learning: Number(await p.getByTestId('count-learning').innerText()),
    review: Number(await p.getByTestId('count-review').innerText()),
  };
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

test('1. cadastro cria a conta e abre direto na tela de estudo (FB-12)', async () => {
  await page.goto('/signup');
  await page.fill('#full-name', NAME);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.fill('#confirm-password', PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });

  // The home tab is the study screen itself: counter + first card (no dashboard in between)
  await expect(page.getByTestId('queue-counter')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('card-front')).toBeVisible({ timeout: 30_000 });
});

test('2. pastas: só Fundamentos ligada, 5 novos por dia; nomes linkam para a busca (FB-11)', async () => {
  // Resolve folder ids through the API (same data the page uses)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  expect(signInError).toBeNull();
  const { data: subs } = await supabase.from('subcategories').select('id, name');
  const folder = subs!.find((s) => s.name === FOLDER_NAME);
  expect(folder, `subcategory "${FOLDER_NAME}" must exist`).toBeTruthy();
  folderId = folder!.id as string;
  const { data: cards } = await supabase.from('cards').select('id').eq('subcategory_id', folderId).eq('is_active', true);
  folderCardCount = cards!.length;
  expect(folderCardCount).toBeGreaterThan(NEW_CARDS_PER_DAY);

  await page.goto('/decks');
  const toggles = page.locator('[data-testid^="subcategory-toggle-"]');
  await expect(toggles.first()).toBeVisible({ timeout: 30_000 });

  // Expand every category so all toggles are reachable; category names link to the search (FB-11)
  for (const expand of await page.locator('[data-testid^="category-expand-"]').all()) {
    const id = (await expand.getAttribute('data-testid'))!.replace('category-expand-', '');
    await expect(page.getByTestId(`category-link-${id}`)).toHaveAttribute('href', `/search?category=${id}`);
    if ((await expand.getAttribute('aria-expanded')) !== 'true') {
      await expand.click();
      await expect(expand).toHaveAttribute('aria-expanded', 'true');
    }
  }

  // Turn every other subcategory off
  for (const sub of subs!) {
    const toggle = page.getByTestId(`subcategory-toggle-${sub.id}`);
    await expect(toggle).toBeVisible();
    const pressed = (await toggle.getAttribute('aria-pressed')) === 'true';
    const wantOn = sub.id === folderId;
    if (pressed !== wantOn) await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', String(wantOn));
  }

  // 20 → 5 new cards/day for the folder
  const value = page.getByTestId(`new-cards-value-${folderId}`);
  await expect(value).toHaveText('20');
  const minus = page.getByTestId(`new-cards-minus-${folderId}`);
  for (let i = 0; i < 3; i++) await minus.click();
  await expect(value).toHaveText(String(NEW_CARDS_PER_DAY));

  // Subcategory name links to the folder search (FB-11)
  await expect(page.getByTestId(`subcategory-link-${folderId}`)).toHaveAttribute('href', `/search?folder=${folderId}`);
});

test('3. estudo: fila respeita a pasta/limite, toques revelam e respondem, intervalos seguem o Anki (FB-13/14/15)', async () => {
  await page.goto('/');
  await expect(page.getByTestId('card-front')).toBeVisible({ timeout: 30_000 });
  expect(await counts(page)).toEqual({ new: NEW_CARDS_PER_DAY, learning: 0, review: 0 });

  // Card 1: reveal by tapping outside the card, check Anki intervals for a new card, answer Bom (button)
  await revealByTappingEmptyArea(page);
  await expect(page.getByTestId('interval-again')).toHaveText('1m');
  await expect(page.getByTestId('interval-hard')).toHaveText('6m');
  await expect(page.getByTestId('interval-good')).toHaveText('10m');
  await expect(page.getByTestId('interval-easy')).toHaveText('4d');
  await answerBy(page, 'good');
  await expect(page.getByTestId('count-new')).toHaveText('4');
  await expect(page.getByTestId('count-learning')).toHaveText('1');

  // Card 2: tap right half of the screen = Bom (FB-14)
  await revealByTappingEmptyArea(page);
  let box = (await page.getByTestId('tap-area').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.85, box.y + box.height - 20);
  await expect(page.getByTestId('count-new')).toHaveText('3');
  await expect(page.getByTestId('count-learning')).toHaveText('2');

  // Card 3: tap left half = Errei (FB-14)
  await revealByTappingEmptyArea(page);
  box = (await page.getByTestId('tap-area').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.15, box.y + box.height - 20);
  await expect(page.getByTestId('count-new')).toHaveText('2');
  await expect(page.getByTestId('count-learning')).toHaveText('3');

  // Card 4: Fácil graduates straight to review (4d) → not in learning
  await revealByTappingEmptyArea(page);
  await answerBy(page, 'easy');
  await expect(page.getByTestId('count-new')).toHaveText('1');
  await expect(page.getByTestId('count-learning')).toHaveText('3');

  // Card 5: Difícil stays on the first step
  await revealByTappingEmptyArea(page);
  await answerBy(page, 'hard');
  await expect(page.getByTestId('count-new')).toHaveText('0');
  await expect(page.getByTestId('count-learning')).toHaveText('4');
  await expect(page.getByTestId('today-count')).toHaveText('5');

  // Learning cards come back in the same session (learn-ahead): the Errei card is first (due in 1m)
  await expect(page.getByTestId('card-front')).toBeVisible();
  await revealByTappingEmptyArea(page);
  await expect(page.getByTestId('card-meta')).toContainText('Aprendendo');

  // Keep answering Bom (keyboard shortcut "3", like Anki) until the session is done
  for (let guard = 0; guard < 20; guard++) {
    if (await page.getByTestId('study-done').isVisible()) break;
    if (await page.getByTestId('show-now-btn').isVisible()) {
      await page.getByTestId('show-now-btn').click();
      continue;
    }
    if (await page.getByTestId('card-front').isVisible()) {
      await revealByTappingEmptyArea(page);
    }
    if (await page.getByTestId('card-back').isVisible()) {
      const answered = await page.getByTestId('today-count').innerText();
      await page.keyboard.press('3');
      await expect(page.getByTestId('today-count')).not.toHaveText(answered);
    }
  }
  await expect(page.getByTestId('study-done')).toBeVisible();

  // 5 first answers + 6 learning answers (C→10m, E→10m, A, B, C, E graduate)
  await expect(page.getByTestId('session-count')).toHaveText('11');
  await expect(page.getByTestId('done-today-count')).toHaveText('11');
});

test('4. perfil mostra as estatísticas do dia e o nome do cadastro', async () => {
  await page.goto('/profile');
  await expect(page.getByText(NAME)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('stat-hoje')).toHaveText('11');
  await expect(page.getByTestId('stat-aprendidos')).toHaveText(String(NEW_CARDS_PER_DAY));
  await expect(page.getByTestId('stat-total')).toHaveText('11');
});

test('5. banco: user_card_state e daily_stats batem com o scheduler', async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  expect(error).toBeNull();
  const userId = auth.user!.id;

  // Give the background upserts a moment to land
  await expect
    .poll(async () => {
      const { data } = await supabase.from('user_card_state').select('card_id').eq('user_id', userId);
      return data?.length ?? 0;
    }, { timeout: 20_000 })
    .toBe(NEW_CARDS_PER_DAY);

  const { data: rows } = await supabase
    .from('user_card_state')
    .select('card_id, ease_factor, interval_days, repetitions, next_review, last_quality, total_reviews, correct_count')
    .eq('user_id', userId);

  expect(rows).toHaveLength(NEW_CARDS_PER_DAY);
  const easy = rows!.filter((r) => r.last_quality === 4);
  const good = rows!.filter((r) => r.last_quality === 3);
  expect(easy).toHaveLength(1);
  expect(good).toHaveLength(4);
  // Fácil → 4 days; every other card graduated with Bom → 1 day. All are review cards (interval ≥ 1).
  expect(easy[0].interval_days).toBe(4);
  for (const r of good) expect(r.interval_days).toBe(1);
  for (const r of rows!) {
    expect(r.ease_factor).toBeCloseTo(2.5, 5); // ease is untouched while learning
    expect(new Date(r.next_review as string).getTime()).toBeGreaterThan(Date.now());
  }
  // Answers per card: easy 1, hard-then-good 3, again-then-good-good 3, good-good 2, good-good 2 = 11
  expect(rows!.reduce((sum, r) => sum + (r.repetitions as number), 0)).toBe(11);
  expect(rows!.reduce((sum, r) => sum + ((r.correct_count as number) ?? 0), 0)).toBe(10);

  const today = dateKey(new Date());
  const { data: day } = await supabase
    .from('daily_stats')
    .select('cards_studied, correct, incorrect')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();
  expect(day).toMatchObject({ cards_studied: 11, correct: 10, incorrect: 1 });
});

test('6. ranking lista o usuário com pontos', async () => {
  await page.goto('/ranking');
  const row = page.locator('[data-testid="ranking-row"]', { hasText: NAME });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText('110');
});

test('7. busca por pasta: tocar em "Fundamentos" lista todos os cards da pasta com estado (FB-11)', async () => {
  await page.goto('/decks');
  await page.getByTestId(`subcategory-link-${folderId}`).click();
  await page.waitForURL((url) => url.pathname === '/search' && url.searchParams.get('folder') === folderId);

  await expect(page.getByTestId('folder-chip')).toContainText(FOLDER_NAME);
  await expect(page.getByTestId('result-count')).toHaveText(`${folderCardCount} cards`, { timeout: 30_000 });
  await expect(page.getByTestId('study-folder-btn')).toHaveAttribute('href', `/study/folder/${folderId}`);

  // Studied cards show "Revisão", the rest "Novo"
  const results = page.getByTestId('search-result');
  await expect(results.filter({ hasText: 'Revisão' })).toHaveCount(NEW_CARDS_PER_DAY);
  expect(await results.filter({ hasText: 'Novo' }).count()).toBeGreaterThan(0);

  // Free text still filters inside the folder
  await page.getByTestId('search-input').fill('zzzz-nao-existe');
  await expect(page.getByText('Nenhum card encontrado')).toBeVisible();
});
