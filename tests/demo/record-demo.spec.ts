import { test, expect, type Page, type Locator } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Demo recording: walks through every feature with a visible cursor and captions.
 * Run with: npm run demo   (DEMO=1 playwright test --project=demo)
 * The video lands in test-results/<test>/video.webm; convert to MP4 with ffmpeg (see README).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const STAMP = Date.now();
const EMAIL = `playwright+demo${STAMP}@medcards.test`;
const PASSWORD = 'Playwright123!';
const NAME = 'Demo MedCards';
const FOLDER_NAME = 'Fundamentos';

// ─── Cursor + caption overlay injected into every page ────────────────────────

const OVERLAY_SCRIPT = `
(() => {
  if (window.__demoOverlay) return;
  window.__demoOverlay = true;
  const style = document.createElement('style');
  style.textContent = \`
    #demo-cursor { position: fixed; z-index: 2147483647; width: 28px; height: 28px; pointer-events: none;
      left: 0; top: 0; transform: translate(-4px, -2px); transition: none;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.6)); }
    #demo-ripple { position: fixed; z-index: 2147483646; width: 44px; height: 44px; border-radius: 50%;
      pointer-events: none; border: 3px solid #e94560; background: rgba(233,69,96,.25); opacity: 0;
      transform: translate(-50%, -50%) scale(.4); }
    #demo-ripple.go { animation: demo-ripple .5s ease-out; }
    @keyframes demo-ripple { 0% { opacity: 1; transform: translate(-50%,-50%) scale(.4); }
      100% { opacity: 0; transform: translate(-50%,-50%) scale(1.6); } }
    #demo-caption { position: fixed; z-index: 2147483645; left: 12px; right: 12px; bottom: 76px;
      background: rgba(10,12,30,.92); color: #fff; font: 600 15px/1.35 system-ui, sans-serif;
      padding: 10px 14px; border-radius: 12px; border-left: 4px solid #e94560; opacity: 0;
      transition: opacity .25s; pointer-events: none; }
    #demo-caption.show { opacity: 1; }
  \`;
  const mount = () => {
    if (!document.body || document.getElementById('demo-cursor')) return;
    document.head.appendChild(style);
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M5 3l14 9-6 1.5L16 20l-2.5 1-3-6.5L6 18z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    const ripple = document.createElement('div');
    ripple.id = 'demo-ripple';
    const caption = document.createElement('div');
    caption.id = 'demo-caption';
    document.body.append(cursor, ripple, caption);
    const move = (x, y) => { cursor.style.left = x + 'px'; cursor.style.top = y + 'px'; };
    document.addEventListener('mousemove', e => move(e.clientX, e.clientY), true);
    document.addEventListener('pointermove', e => move(e.clientX, e.clientY), true);
    const pulse = e => {
      ripple.style.left = e.clientX + 'px'; ripple.style.top = e.clientY + 'px';
      ripple.classList.remove('go'); void ripple.offsetWidth; ripple.classList.add('go');
    };
    document.addEventListener('mousedown', pulse, true);
    document.addEventListener('pointerdown', pulse, true);
    if (window.__demoCursorPos) move(window.__demoCursorPos.x, window.__demoCursorPos.y);
    if (window.__demoCaption) { caption.textContent = window.__demoCaption; caption.classList.add('show'); }
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  window.__demoSetCaption = (text) => {
    window.__demoCaption = text;
    const el = document.getElementById('demo-caption');
    if (!el) return;
    if (!text) { el.classList.remove('show'); return; }
    el.textContent = text; el.classList.add('show');
  };
})();
`;

let cursor = { x: 200, y: 400 };

async function caption(page: Page, text: string, holdMs = 1600) {
  await page.evaluate((t) => (window as unknown as { __demoSetCaption: (s: string) => void }).__demoSetCaption(t), text);
  await page.waitForTimeout(holdMs);
}

async function glide(page: Page, x: number, y: number, steps = 24) {
  await page.mouse.move(cursor.x, cursor.y);
  await page.mouse.move(x, y, { steps });
  cursor = { x, y };
  await page.evaluate((p) => { (window as unknown as { __demoCursorPos: unknown }).__demoCursorPos = p; }, cursor);
}

async function tapAt(page: Page, x: number, y: number, pauseMs = 900) {
  await glide(page, x, y);
  await page.waitForTimeout(350);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
  await page.waitForTimeout(pauseMs);
}

async function tap(page: Page, target: Locator, pauseMs = 900) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  await tapAt(page, box.x + box.width / 2, box.y + box.height / 2, pauseMs);
}

async function typeInto(page: Page, target: Locator, text: string) {
  await tap(page, target, 300);
  await target.pressSequentially(text, { delay: 45 });
  await page.waitForTimeout(400);
}

/** Tap inside the study area but never on a control (extra button, links) — same rule the app uses. */
async function tapEmptyArea(page: Page, side: 'center' | 'left' | 'right' = 'center') {
  const box = (await page.getByTestId('tap-area').boundingBox())!;
  const x = side === 'left' ? box.x + box.width * 0.15 : side === 'right' ? box.x + box.width * 0.85 : box.x + box.width / 2;
  let y = box.y + box.height - 40;
  for (let i = 0; i < 12; i++) {
    const onControl = await page.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px, py) as HTMLElement | null;
      return !!el?.closest('[data-no-tap], a, button, input, textarea, select');
    }, [x, y]);
    if (!onControl) break;
    y -= 40;
  }
  await tapAt(page, x, y, 1100);
}

test.describe.configure({ mode: 'serial' });
test.skip(!SUPABASE_URL || !SUPABASE_ANON_KEY, 'Supabase env vars missing');

test('gravação de demonstração de todas as features', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  await page.addInitScript(OVERLAY_SCRIPT);

  // ── 1. Cadastro ──
  await page.goto('/signup');
  await page.waitForLoadState('networkidle');
  await caption(page, '1 · Criar conta');
  await typeInto(page, page.locator('#full-name'), NAME);
  await typeInto(page, page.locator('#email'), EMAIL);
  await typeInto(page, page.locator('#password'), PASSWORD);
  await typeInto(page, page.locator('#confirm-password'), PASSWORD);
  await tap(page, page.locator('button[type="submit"]'), 500);
  await page.waitForURL((u) => u.pathname === '/');
  await expect(page.getByTestId('card-front')).toBeVisible({ timeout: 30_000 });
  await caption(page, 'O app abre direto no card, pronto para estudar (como o Anki)', 2600);
  await caption(page, 'Contador: azul = novos · vermelho = aprendendo · verde = revisão', 2600);

  // ── 2. Pastas ──
  await caption(page, '2 · Pastas: escolher o que estudar');
  await tap(page, page.locator('nav a[href="/decks"]'), 1200);
  await expect(page.locator('[data-testid^="subcategory-toggle-"]').first()).toBeVisible({ timeout: 30_000 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  const { data: subs } = await supabase.from('subcategories').select('id, name');
  const folderId = subs!.find((s) => s.name === FOLDER_NAME)!.id as string;

  for (const expand of await page.locator('[data-testid^="category-expand-"]').all()) {
    if ((await expand.getAttribute('aria-expanded')) !== 'true') await tap(page, expand, 600);
  }
  await caption(page, 'Desligando as pastas que não quero estudar agora');
  for (const sub of subs!) {
    if (sub.id === folderId) continue;
    const toggle = page.getByTestId(`subcategory-toggle-${sub.id}`);
    if ((await toggle.getAttribute('aria-pressed')) === 'true') await tap(page, toggle, 700);
  }
  await caption(page, 'Novos cards por dia: 20 → 5 (limite por assunto)');
  const minus = page.getByTestId(`new-cards-minus-${folderId}`);
  for (let i = 0; i < 3; i++) await tap(page, minus, 450);
  await page.waitForTimeout(800);

  // ── 3. Pasta → Busca ──
  await caption(page, '3 · Tocar no nome da pasta abre a Busca com os cards dela');
  await tap(page, page.getByTestId(`subcategory-link-${folderId}`), 1200);
  await expect(page.getByTestId('result-count')).toBeVisible({ timeout: 30_000 });
  await caption(page, 'Todos os cards de "Fundamentos", com o estado de cada um (Novo / Aprendendo / Revisão)', 2600);
  await tap(page, page.getByTestId('search-result').first(), 1800);
  await caption(page, 'Digitar filtra dentro da pasta');
  await typeInto(page, page.getByTestId('search-input'), 'cirurgia');
  await page.waitForTimeout(1500);
  await caption(page, 'O "x" no chip remove o filtro da pasta', 1200);

  // ── 4. Estudo ──
  await caption(page, '4 · Estudar');
  await tap(page, page.locator('nav a[href="/"]'), 1200);
  await expect(page.getByTestId('card-front')).toBeVisible({ timeout: 30_000 });
  await caption(page, 'Só 5 novos, da pasta escolhida', 1800);

  await caption(page, 'Tocar em QUALQUER lugar da tela revela a resposta');
  await tapEmptyArea(page, 'center');
  await expect(page.getByTestId('card-back')).toBeVisible();
  await caption(page, 'Intervalos do Anki: Errei 1m · Difícil 6m · Bom 10m · Fácil 4d', 3000);
  if (await page.getByTestId('extra-btn').isVisible()) {
    await caption(page, 'O "Extra" abre em uma janela separada');
    await tap(page, page.getByTestId('extra-btn'), 2200);
    await tap(page, page.getByTestId('extra-sheet').getByLabel('Fechar'), 900);
  }
  await caption(page, 'Botão Bom');
  await tap(page, page.getByTestId('quality-good'), 1300);
  await caption(page, 'Azul caiu de 5 para 4 e o card entrou em "aprendendo" (vermelho)', 2600);

  await tapEmptyArea(page, 'center');
  await caption(page, 'Depois de revelar: tocar na DIREITA = Bom');
  await tapEmptyArea(page, 'right');
  await page.waitForTimeout(600);

  await tapEmptyArea(page, 'center');
  await caption(page, 'Tocar na ESQUERDA = Errei (volta em 1 minuto)');
  await tapEmptyArea(page, 'left');
  await page.waitForTimeout(600);

  await tapEmptyArea(page, 'center');
  await caption(page, 'Fácil gradua direto: 4 dias');
  await tap(page, page.getByTestId('quality-easy'), 1300);

  await tapEmptyArea(page, 'center');
  await caption(page, 'Difícil repete o passo (6 min)');
  await tap(page, page.getByTestId('quality-hard'), 1300);

  await caption(page, 'Acabaram os novos: os cards em aprendizado voltam na MESMA sessão', 2600);
  for (let guard = 0; guard < 20; guard++) {
    if (await page.getByTestId('study-done').isVisible()) break;
    if (await page.getByTestId('show-now-btn').isVisible()) {
      await tap(page, page.getByTestId('show-now-btn'), 800);
      continue;
    }
    if (await page.getByTestId('card-front').isVisible()) await tapEmptyArea(page, 'center');
    if (await page.getByTestId('card-back').isVisible()) {
      if (guard === 0) await caption(page, 'Este é o card do "Errei" voltando; agora mostra 10m no Bom', 2600);
      else if (guard === 1) await caption(page, 'Respondendo Bom nos cards em aprendizado até graduarem (1 dia)', 1200);
      await tap(page, page.getByTestId('quality-good'), 700);
    }
  }
  await expect(page.getByTestId('study-done')).toBeVisible();
  await caption(page, 'Sessão completa!', 2200);

  // ── 5. Perfil e Ranking ──
  await caption(page, '5 · Perfil: estatísticas do dia');
  await tap(page, page.locator('nav a[href="/profile"]'), 1500);
  await expect(page.getByTestId('stat-hoje')).toBeVisible({ timeout: 30_000 });
  await caption(page, 'Hoje · sequência · aprendidos · total de revisões', 3200);
  await caption(page, '6 · Ranking');
  await tap(page, page.locator('nav a[href="/ranking"]'), 1500);
  await expect(page.getByTestId('ranking-row').first()).toBeVisible({ timeout: 30_000 });
  await caption(page, 'Pontos e posição entre os usuários', 3200);
  await caption(page, 'Fim da demonstração', 2000);
});
