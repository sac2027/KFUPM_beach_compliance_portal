/** Runs against the DEV server (`?data=worst`): the break-ui stress data. See playwright.config.ts. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { clipped, confirmAllTerms, drawSignature, fillLogin, L, overflow, settleReceipt } from './helpers';
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

    // Longest valid typed input first (20-char passport, 100 unbroken letters, 254-char email): the form must hold it.
    await page.getByLabel(s.name).fill('م'.repeat(100));
    await page.getByLabel(s.email).fill(`${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`);
    await page.getByLabel(s.nationality).selectOption('GB');
    await page.getByLabel(s.passport).fill('AB1234567890123456CD');
    await fits('login (long input)');
    // Then sign in as the student with the 190-character roster name.
    await fillLogin(page, STUDENTS.longName);
    await expect(page.locator('#terms-heading')).toBeFocused();
    await expect(page.locator('.declarant dd').first()).toContainText('Abdulrahman bin Mohammed bin Abdullah');
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
    await expect(ref).toHaveText(/^PACF-\d{4}-[A-HJ-NP-Z2-9]{6}$/);
    expect(await ref.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  });
}

test('worst case: the printed declaration keeps the closing statement and the signature on one page', async ({ page }, info) => {
  test.skip(info.project.name !== 'worst-1280', 'PDF output does not depend on the viewport');
  await page.goto('/?data=worst');
  await fillLogin(page, STUDENTS.longName);
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
  const signedPage = pages.findIndex((p) => p.includes('Signed by'));
  expect(closingPage).toBeDefined();
  expect(signedPage).toBe(closingPage); // a signature never sits alone on a page away from what it signs
});
