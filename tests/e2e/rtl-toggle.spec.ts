import { expect, test } from '@playwright/test';
import { terms } from './data';

const loadedFaces = (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/"/g, '')}:${f.weight}`);
  });

// Each Playwright test gets a fresh context, so localStorage starts empty.
test('English: LTR, KFUPM headings and Plex Arabic body actually load', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(html).toHaveAttribute('dir', 'ltr');
  expect((await page.locator('h1').evaluate((e) => getComputedStyle(e).fontFamily)).startsWith('KFUPM')).toBe(true);
  expect((await page.locator('body').evaluate((e) => getComputedStyle(e).fontFamily)).startsWith('"IBM Plex Sans Arabic"')).toBe(true);
  const faces = await loadedFaces(page);
  expect(faces).toContain('KFUPM:700');
  expect(faces).toContain('IBM Plex Sans Arabic:400');
});

test('toggle flips to RTL Arabic, loads Plex for Arabic text, and persists across reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(terms.document.title.ar);
  expect(await loadedFaces(page)).toContain('IBM Plex Sans Arabic:400');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('?lang=ar opens the Arabic form and wins over a stored English choice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('beach.locale', 'en'));
  await page.goto('/?lang=ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
