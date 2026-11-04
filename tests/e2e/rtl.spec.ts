/** The Arabic (RTL) form, end to end: mirrored layout, unmirrored brand artwork, no sideways scroll, axe-clean, one-page PDF. */
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ar } from './data';
import { clipped, drawSignature, overflow, settleReceipt } from './helpers';
import { STUDENTS } from './students';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const scan = async (page: Page, where: string) => {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`), where).toEqual([]);
};
const fits = async (page: Page, where: string) => {
  expect(await overflow(page), `${where}: overflow`).toEqual({ overflow: 0, escapes: [] });
  expect(await clipped(page), `${where}: clipped`).toEqual([]);
};

test('Arabic: every step is mirrored, fits at this width, has no axe violations, and the PDF is one page', async ({ page }, info) => {
  await page.goto('/?lang=ar');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  // Login: brand artwork on the right (inline-start) and never transformed; the switch on the left.
  const vw = page.viewportSize()!.width;
  const logo = (await page.locator('.masthead__logo').boundingBox())!;
  const toggle = (await page.locator('.lang-toggle').boundingBox())!;
  expect(logo.x + logo.width / 2).toBeGreaterThan(vw / 2);
  expect(toggle.x + toggle.width / 2).toBeLessThan(vw / 2);
  expect(await page.locator('.masthead__logo').evaluate((e) => getComputedStyle(e).transform)).toBe('none');
  for (const id of ['email', 'password']) {
    const input = page.locator(`#${id}`);
    await expect(input).toHaveAttribute('dir', 'ltr'); // Latin data stays left-to-right
    expect(await input.evaluate((e) => getComputedStyle(e).textAlign)).toMatch(/^(end|right)$/);
  }
  await fits(page, 'login');
  await scan(page, 'login');

  await page.getByRole('button', { name: ar('login.submit') }).click();
  await expect(page.locator('.field__error')).toHaveCount(2);
  await fits(page, 'login errors');
  await scan(page, 'login errors');

  await page.getByLabel(ar('login.email')).fill(STUDENTS.mai.email);
  await page.getByLabel(ar('login.password')).fill(STUDENTS.mai.password);
  await page.getByRole('button', { name: ar('login.submit') }).click();
  await expect(page.locator('#terms-heading')).toBeFocused({ timeout: 10_000 });

  // Terms: the box sits at the inline-start (right) of each card; the way forward points left.
  const box = (await page.locator('.term__box').first().boundingBox())!;
  const text = (await page.locator('.term__text').first().boundingBox())!;
  expect(box.x).toBeGreaterThan(text.x);
  await fits(page, 'terms');
  for (let i = 0; i < 5; i++) await page.locator('.term').nth(i).locator('.term__title label').click();
  await scan(page, 'terms (all confirmed)');
  const cont = page.getByRole('button', { name: ar('terms.continue') });
  await expect(cont.locator('svg')).toHaveClass(/lucide-arrow-left/);
  await cont.click();
  await expect(page.locator('#sign-heading')).toBeFocused();
  await fits(page, 'sign');
  await scan(page, 'sign');

  await drawSignature(page);
  await page.getByRole('button', { name: ar('sign.submit') }).click();
  await expect(page.getByRole('heading', { level: 2, name: ar('receipt.heading') })).toBeFocused({ timeout: 15_000 });
  await settleReceipt(page);
  await fits(page, 'receipt');
  await scan(page, 'receipt');

  if (info.project.name === 'desktop-1280') {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: ar('receipt.download') }).click()]);
    const path = (await download.path())!;
    expect(Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [path], { encoding: 'utf8' }))![1])).toBe(1);
  }
});
