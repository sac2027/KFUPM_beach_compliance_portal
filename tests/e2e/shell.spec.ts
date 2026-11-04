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

test('lockup keeps its native aspect ratio (never stretched) and the Matrix is never mirrored', async ({ page }) => {
  await open(page);
  const box = await page.locator('.masthead__logo').boundingBox();
  expect(Math.abs(box!.width / box!.height - 2657 / 1083)).toBeLessThan(0.03);
  const transform = await page.locator('.page-matrix').evaluate((e) => getComputedStyle(e).transform);
  expect(transform).toBe('none');
  expect(await page.locator('.masthead .page-matrix, .masthead__matrix').count()).toBe(0); // no Matrix in the heading
});

test('the masthead has the lockup on the left and headings use KFUPM Display', async ({ page }) => {
  await open(page);
  const logo = await page.locator('.masthead__logo').boundingBox();
  const vw = page.viewportSize()!.width;
  expect(logo!.x + logo!.width / 2).toBeLessThan(vw / 2); // edge-based checks break when the logo is over half the width
  expect(await page.locator('h1').evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/^KFUPM/);
});

test('the masthead carries the portal title beside the lockup on wider screens, and only the lockup on phones', async ({ page }) => {
  await open(page);
  const title = page.locator('.masthead__title');
  await expect(title).toHaveText('Pre-Arrival Compliance Portal');
  const vw = page.viewportSize()!.width;
  if (vw > 640) {
    await expect(title).toBeVisible();
    const [t, logo] = await Promise.all([title.boundingBox(), page.locator('.masthead__logo').boundingBox()]);
    expect(t!.x).toBeGreaterThan(logo!.x + logo!.width); // beside it, not under it
    expect(Math.abs(t!.y + t!.height / 2 - (logo!.y + logo!.height / 2))).toBeLessThan(8); // on the same line
  } else {
    await expect(title).toBeHidden();
  }
});

test('there is no language switch and the footer names the Deanship only', async ({ page }) => {
  await open(page);
  await expect(page.locator('.masthead button')).toHaveCount(0);
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
