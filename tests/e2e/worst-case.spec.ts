/** Runs against the DEV server (`?data=worst`): the break-ui stress data. See playwright.config.ts. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { clipped, confirmAllTerms, drawSignature, fillLogin, L, overflow, settleReceipt } from './helpers';
import { ar } from './data';
import { STUDENTS } from './students';

{
  test('worst case: every step fits, nothing is clipped, markup stays literal', async ({ page }) => {
    const s = L;
    await page.addInitScript(() => {
      (window as unknown as { __alerts: number }).__alerts = 0;
      window.alert = () => void ((window as unknown as { __alerts: number }).__alerts += 1);
    });
    await page.goto('/?data=worst');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('button', { name: 'Worst case' })).toHaveAttribute('aria-pressed', 'true');

    const fits = async (where: string) => {
      expect(await overflow(page), `${where}: overflow`).toEqual({ overflow: 0, escapes: [] });
      expect(await clipped(page), `${where}: clipped`).toEqual([]);
    };

    // The stress document title (150+ chars) and stage still wrap and fit.
    expect((await page.locator('h1').innerText()).length).toBeGreaterThan(100);
    await fits('login');

    // Longest valid typed input first (20-char password, 100 unbroken letters, 254-char email): the form must hold it.
    await page.getByLabel(s.email).fill(`${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`);
    await page.getByLabel(s.password).fill('AB1234567890123456CD');
    await fits('login (long input)');
    // Then sign in with the longest realistic address.
    await fillLogin(page, STUDENTS.longEmail);
    await expect(page.locator('#terms-heading')).toBeFocused();
    await expect(page.locator('.declarant dd').first()).toContainText(STUDENTS.longEmail.email);
    await fits('terms');

    // Markup in staff-written text is shown as text and never runs.
    await expect(page.getByText('<script>alert(1)</script>').first()).toBeVisible();
    await expect(page.getByText('**', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('{n} of {total}', { exact: false }).first()).toBeVisible(); // not mistaken for a placeholder
    expect(await page.evaluate(() => (window as unknown as { __alerts: number }).__alerts)).toBe(0);

    await confirmAllTerms(page);
    await fits('sign');
    await page.getByRole('tab', { name: s.upload }).click();
    await fits('sign (upload tab)');
    await page.getByRole('tab', { name: 'Draw' }).click();
    await drawSignature(page);
    await page.getByRole('button', { name: s.submit }).click();
    await expect(page.getByRole('heading', { level: 2, name: s.heading })).toBeFocused({ timeout: 8000 });
    await settleReceipt(page);
    await fits('receipt');
    const ref = page.locator('.receipt__ref');
    await expect(ref).toHaveText(/^UBR-\d{4}-[A-HJ-NP-Z2-9]{6}$/);
    expect(await ref.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  });
}

test('worst case: the printed declaration keeps the closing statement and the signature on one page', async ({ page }, info) => {
  test.skip(info.project.name !== 'worst-1280', 'PDF output does not depend on the viewport');
  await page.goto('/?data=worst');
  await fillLogin(page, STUDENTS.longEmail);
  await confirmAllTerms(page);
  await drawSignature(page);
  await page.getByRole('button', { name: L.submit }).click();
  await expect(page.getByRole('heading', { level: 2, name: L.heading })).toBeFocused({ timeout: 8000 });
  await settleReceipt(page);
  await page.emulateMedia({ media: 'print' });
  const file = join(mkdtempSync(join(tmpdir(), 'pacf-worst-')), 'worst.pdf');
  writeFileSync(file, await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
  const pages = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).split('\f').filter((p) => p.trim());
  expect(pages.length).toBeGreaterThan(1); // long staff text really does run to several pages
  expect(pages.length).toBeLessThanOrEqual(6);
  const closingPage = pages.map((p, i) => (p.includes('By signing below') ? i : -1)).filter((i) => i >= 0).at(-1);
  const signedPage = pages.findIndex((p) => p.includes('Signed on'));
  expect(closingPage).toBeDefined();
  expect(signedPage).toBe(closingPage); // a signature never sits alone on a page away from what it signs
});

test('worst case: a link inside a term opens in a new tab and does not confirm the term', async ({ page }) => {
  await page.goto('/?data=worst');
  await fillLogin(page, STUDENTS.mai);
  await expect(page.locator('#terms-heading')).toBeFocused({ timeout: 10_000 });
  page.on('popup', (p) => void p.close());
  const card = page.locator('.term').first();
  await card.scrollIntoViewIfNeeded();
  await card.getByRole('link').first().click();
  await expect(page.getByRole('checkbox').first()).not.toBeChecked(); // following a link is not agreeing
});

test.describe('worst case in Arabic (RTL)', () => {
  const fits = async (page: import('@playwright/test').Page, where: string) => {
    expect(await overflow(page), `${where}: overflow`).toEqual({ overflow: 0, escapes: [] });
    expect(await clipped(page), `${where}: clipped`).toEqual([]);
  };

  test('every step fits with the stress terms, also with text enlarged to 200%, and list markers stay inside the card', async ({ page }) => {
    await page.goto('/?data=worst&lang=ar');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await fits(page, 'login');
    await page.getByLabel(ar('login.email')).fill(STUDENTS.longEmail.email);
    await page.getByLabel(ar('login.password')).fill(STUDENTS.longEmail.password);
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('#terms-heading')).toBeFocused({ timeout: 10_000 });
    await fits(page, 'terms');

    // Bullets sit on the inline-start (right) side and inside the card, never outside it.
    const card = (await page.locator('.term').first().boundingBox())!;
    const marker = (await page.locator('.term__points li').first().boundingBox())!;
    expect(marker.x + marker.width).toBeLessThanOrEqual(card.x + card.width);
    expect(marker.x).toBeGreaterThanOrEqual(card.x);

    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    await fits(page, 'terms at 200%');
    await page.evaluate(() => (document.documentElement.style.fontSize = ''));

    for (let i = 0; i < 5; i++) await page.locator('.term').nth(i).locator('.term__title label').click();
    await page.locator('.terms__actions .btn').first().click();
    await expect(page.locator('#sign-heading')).toBeFocused();
    await fits(page, 'sign');
    await drawSignature(page);
    await page.locator('.sign__actions .btn').first().click();
    await expect(page.getByRole('heading', { level: 2, name: ar('receipt.heading') })).toBeFocused({ timeout: 8000 });
    await settleReceipt(page);
    await fits(page, 'receipt');
  });
});
