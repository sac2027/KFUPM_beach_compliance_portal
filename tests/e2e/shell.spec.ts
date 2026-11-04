import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const open = async (page: Page) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
};

test('no horizontal scroll and every element fits inside the viewport', async ({ page }) => {
  await open(page);
  const { overflow, escapes } = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const escapes = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && cs.position !== 'absolute' && (r.left < -0.5 || r.right > w + 0.5);
      })
      .map((el) => el.className || el.tagName);
    return { overflow: document.documentElement.scrollWidth - innerWidth, escapes };
  });
  expect(overflow).toBeLessThanOrEqual(0);
  expect(escapes).toEqual([]);
});

test('lockup keeps its native aspect ratio (never stretched) and nothing is mirrored', async ({ page }) => {
  await open(page);
  const box = await page.locator('.masthead__logo').boundingBox();
  expect(Math.abs(box!.width / box!.height - 2657 / 1083)).toBeLessThan(0.03);
  expect(await page.locator('.masthead__logo').evaluate((e) => getComputedStyle(e).transform)).toBe('none');
  expect(await page.locator('.shore').evaluate((e) => getComputedStyle(e).transform)).toBe('none');
  expect(await page.locator('.page-matrix').count()).toBe(0); // the Matrix is gone
});

test('the shoreline: turquoise sea, light-blue shallows line, and the sheet crosses the waterline', async ({ page }) => {
  await open(page);
  const shore = page.locator('.shore');
  expect(await shore.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(17, 95, 102)');
  expect(await shore.evaluate((e) => getComputedStyle(e, '::after').backgroundColor)).toBe('rgb(113, 184, 212)');
  expect(await page.locator('body').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(236, 224, 199)');
  const [sea, sheet] = await Promise.all([shore.boundingBox(), page.locator('.doc').boundingBox()]);
  const vw = page.viewportSize()!.width;
  expect(sea!.width).toBe(vw); // it spans the page edge to edge
  expect(sheet!.y).toBeLessThan(sea!.y + sea!.height); // the sheet starts in the sea...
  expect(sheet!.y + sheet!.height).toBeGreaterThan(sea!.y + sea!.height); // ...and ends on the sand
});

test('the masthead has the lockup on the left and headings use KFUPM Display', async ({ page }) => {
  await open(page);
  const logo = await page.locator('.masthead__logo').boundingBox();
  const vw = page.viewportSize()!.width;
  expect(logo!.x + logo!.width / 2).toBeLessThan(vw / 2); // edge-based checks break when the logo is over half the width
  expect(await page.locator('h1').evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^KFUPM/);
});

test('the masthead carries the language switch at the opposite end from the lockup', async ({ page }) => {
  await open(page);
  const [toggle, logo] = await Promise.all([page.locator('.lang-toggle').boundingBox(), page.locator('.masthead__logo').boundingBox()]);
  expect(toggle!.x).toBeGreaterThan(logo!.x + logo!.width);
});

test('the footer names the Deanship only', async ({ page }) => {
  await open(page);
  await expect(page.locator('.page__footer')).toHaveText('Deanship of Student Affairs');
  await expect(page.locator('body')).not.toContainText('International Students Office');
});

test('the current step is named and visible at this width', async ({ page }) => {
  await open(page);
  const visible = page.locator('.stepper [aria-current="step"] .stepper__label, .stepper__current');
  const texts = await visible.evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 4).map((e) => e.textContent?.trim()));
  expect(texts.length).toBeGreaterThan(0);
  expect(texts[0]).toContain('Sign in');
});

test('the page title fits in two lines at every width from 390 px up', async ({ page }) => {
  await open(page);
  test.skip(page.viewportSize()!.width < 390, 'a 320 px phone cannot fit the title in two lines');
  const lines = await page.locator('h1').evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
  expect(lines).toBeLessThanOrEqual(2);
});

test('the header carries the portal title between the lockup and the language switch on wider screens', async ({ page }) => {
  await open(page);
  const title = page.locator('.masthead__title');
  await expect(title).toHaveText('University Beach Portal');
  if (page.viewportSize()!.width > 640) {
    await expect(title).toBeVisible();
    const [t, logo, toggle] = await Promise.all([title.boundingBox(), page.locator('.masthead__logo').boundingBox(), page.locator('.lang-toggle').boundingBox()]);
    expect(t!.x).toBeGreaterThan(logo!.x + logo!.width);
    expect(t!.x + t!.width).toBeLessThan(toggle!.x);
  } else {
    await expect(title).toBeHidden();
  }
});
