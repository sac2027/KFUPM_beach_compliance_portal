import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { confirmAllTerms, drawSignature, fillLogin, L, makePng, settleReceipt } from './helpers';
import { STUDENTS } from './students';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const GOOD = STUDENTS.mai;

async function scan(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const found = r.violations.map((v) => `${v.id} [${v.impact}] ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  expect(found, where).toEqual([]);
}

{
  test(`axe (WCAG 2.2 AA and best practice): every step has no violations`, async ({ page }) => {
    const s = L;
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await scan(page, 'login');

    await page.getByRole('button', { name: s.signin }).click(); // empty submit: four inline errors
    await expect(page.locator('.field__error')).toHaveCount(4);
    await scan(page, 'login with errors');

    await fillLogin(page, GOOD);
    await page.locator('.term').first().waitFor();
    await page.locator('.term').nth(0).locator('.term__title label').click();
    await scan(page, 'terms (one confirmed)');

    for (let i = 1; i < 5; i++) await page.locator('.term').nth(i).locator('.term__title label').click(); // term 1 is already confirmed
    await page.getByRole('button', { name: s.cont }).click();
    await expect(page.locator('#sign-heading')).toBeFocused();
    await scan(page, 'sign (draw)');
    await page.getByRole('tab', { name: s.upload }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: 's.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    await expect(page.getByRole('alert')).toBeVisible();
    await scan(page, 'sign (upload with error)');

    await page.getByRole('tab', { name: 'Draw' }).click();
    await drawSignature(page);
    await page.getByRole('button', { name: s.submit }).click();
    await expect(page.getByRole('heading', { level: 2, name: s.heading })).toBeFocused({ timeout: 8000 });
    await settleReceipt(page);
    await scan(page, 'receipt');
    await page.getByRole('button', { name: 'Finish and clear my details' }).click();
    await scan(page, 'receipt (confirming)');
  });
}

/** Is the control that has focus visibly marked? The checkbox and file input are visually hidden, so their proxy shows the ring. */
const focusIsVisible = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a) return { ok: false, what: 'nothing focused' };
    const ring = (el: Element | null) => !!el && getComputedStyle(el).outlineStyle !== 'none' && parseFloat(getComputedStyle(el).outlineWidth) >= 2;
    let ok = ring(a);
    if (a.classList.contains('term__input')) ok = ring(a.nextElementSibling);
    if (a.classList.contains('drop__input')) ok = ring(a.closest('.drop'));
    return { ok, what: `${a.tagName}.${a.className} ${a.textContent?.trim().slice(0, 30) ?? ''}` };
  });

test('keyboard only: the whole flow can be completed, in a sensible order, with a visible focus at every stop', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const stops: string[] = [];
  const tab = async () => {
    await page.keyboard.press('Tab');
    const f = await focusIsVisible(page);
    expect(f.ok, `visible focus on: ${f.what}`).toBe(true);
    stops.push(f.what);
  };

  // Login: skip link, then the four fields (name, email, nationality, passport) and the button, in reading order.
  for (let i = 0; i < 6; i++) await tab();
  expect(stops.map((s) => s.split('.')[0])).toEqual(['A', 'INPUT', 'INPUT', 'SELECT', 'INPUT', 'BUTTON']);
  const me = STUDENTS.mai;
  await page.keyboard.press('Shift+Tab'); // Passport
  await page.keyboard.type(me.passport);
  await page.keyboard.press('Shift+Tab'); // Nationality: typing the country's name picks it
  await page.keyboard.type('Vietnam');
  await expect(page.getByLabel('Nationality')).toHaveValue('VN');
  await page.keyboard.press('Shift+Tab'); // Email
  await page.keyboard.type(me.email);
  await page.keyboard.press('Shift+Tab'); // Full name
  await page.keyboard.type(me.name);
  await page.keyboard.press('Enter'); // submit from inside a field
  await expect(page.locator('#terms-heading')).toBeFocused();
  expect((await focusIsVisible(page)).ok).toBe(true); // the heading we land on shows where we are

  // Terms: five checkboxes with Space, then Continue with Enter.
  await page.keyboard.press('Tab');
  const lang = await page.evaluate(() => document.activeElement?.tagName);
  expect(lang).toBeTruthy();
  for (let i = 0; i < 5; i++) {
    await page.locator('.term__input').nth(i).focus();
    expect((await focusIsVisible(page)).ok).toBe(true);
    await page.keyboard.press('Space');
  }
  await expect(page.getByText('5 of 5 confirmed')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to signature' }).focus();
  expect((await focusIsVisible(page)).ok).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('#sign-heading')).toBeFocused();

  // Signature: the canvas cannot be drawn on without a pointer, so the keyboard path is the Upload tab.
  await page.getByRole('tab', { name: 'Draw' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Upload' })).toHaveAttribute('aria-selected', 'true');
  await page.locator('.drop__input').focus();
  expect((await focusIsVisible(page)).ok).toBe(true);
  const buffer = Buffer.from(await makePng(page, { w: 600, h: 200, ink: true }), 'base64');
  await page.locator('.drop__input').setInputFiles({ name: 'sig.png', mimeType: 'image/png', buffer });
  await expect(page.getByRole('img', { name: 'Your uploaded signature' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign and submit' }).focus();
  expect((await focusIsVisible(page)).ok).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'Declaration submitted' })).toBeFocused({ timeout: 8000 });

  // Receipt: clearing is a two-step decision that keyboard users can complete.
  await page.getByRole('button', { name: 'Finish and clear my details' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Yes, clear my details' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#login-heading')).toBeVisible();
});

test('the skip link moves the next Tab into the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Full name')).toBeFocused(); // straight to the first field
});

test.describe('other guideline checks', () => {
  test('leaving mid-form asks for confirmation on the terms and signature steps, not on the login step', async ({ browser }) => {
    const asked = async (stopAt: 'login' | 'terms') => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      let dialog = '';
      page.on('dialog', (d) => {
        dialog = d.type();
        void d.dismiss();
      });
      await page.goto('/');
      await fillLogin(page, stopAt === 'login' ? { name: '', email: '', nationality: '', passport: '' } : GOOD);
      if (stopAt === 'terms') await page.locator('.term').first().waitFor();
      await page.locator('body').click({ position: { x: 5, y: 5 } }); // a user gesture, which browsers require before they will ask
      await page.close({ runBeforeUnload: true });
      await ctx.close();
      return dialog;
    };
    expect(await asked('terms')).toBe('beforeunload');
    expect(await asked('login')).toBe('');
  });

  test('controls opt out of the double-tap delay, but the signature canvas keeps its own touch handling', async ({ page }) => {
    await page.goto('/');
    expect(await page.getByRole('button', { name: 'Sign in' }).evaluate((e) => getComputedStyle(e).touchAction)).toBe('manipulation');
    await fillLogin(page, GOOD);
    await confirmAllTerms(page);
    expect(await page.locator('canvas').evaluate((e) => getComputedStyle(e).touchAction)).toBe('none');
  });

  test('names and reference numbers are marked so browser translation leaves them alone', async ({ page }) => {
    await page.goto('/');
    await fillLogin(page, GOOD);
    await expect(page.locator('.declarant dd').first()).toHaveAttribute('translate', 'no');
    await expect(page.locator('.declarant dd').first()).toHaveAttribute('dir', 'auto');
  });

  test('the viewport allows pinch-zoom and has no cover-without-insets', async ({ page }) => {
    await page.goto('/');
    const meta = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(meta).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/);
    expect(meta).not.toContain('viewport-fit=cover');
  });
});
