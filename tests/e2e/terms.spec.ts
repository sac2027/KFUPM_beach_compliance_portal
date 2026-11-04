import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fillLogin } from './helpers';
import { STUDENTS } from './students';

async function toTerms(page: Page, creds = STUDENTS.mai) {
  await page.goto('/');
  await fillLogin(page, creds);
  await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
  await page.evaluate(() => document.fonts.ready);
}

const noOverflow = (page: Page) =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const escapes = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && getComputedStyle(el).position !== 'absolute' && (r.left < -0.5 || r.right > w + 0.5);
      })
      .map((el) => `${el.tagName}.${el.className}`);
    return { overflow: document.documentElement.scrollWidth - innerWidth, escapes };
  });

test('shows the declarant, the sign-in date, five unchecked terms and no select-all', async ({ page }) => {
  await toTerms(page);
  await expect(page.locator('.declarant')).toContainText('Nguyen Thi Mai'); // the roster's name, not the typed one
  await expect(page.locator('.declarant')).toContainText(/\d{1,2} \w+ 2026/);
  await expect(page.locator('.term')).toHaveCount(5);
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await expect(page.getByText('0 of 5 confirmed')).toBeVisible();
});

test('the whole card toggles, a link inside does not, and the keyboard works', async ({ page }) => {
  await toTerms(page);
  const cards = page.locator('.term');
  // Click the body text like a person would, by coordinates: the label's overlay is the real hit target.
  await cards.nth(1).scrollIntoViewIfNeeded();
  const body = (await cards.nth(1).locator('.term__body').boundingBox())!;
  await page.mouse.click(body.x + 40, body.y + 12);
  await expect(page.getByRole('checkbox').nth(1)).toBeChecked();
  await cards.nth(0).scrollIntoViewIfNeeded();

  page.on('popup', (p) => void p.close());
  await cards.nth(0).getByRole('link').first().click();
  await expect(page.getByRole('checkbox').nth(0)).not.toBeChecked(); // following a link is not agreeing

  await page.getByRole('checkbox').nth(2).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('checkbox').nth(2)).toBeChecked();
  await expect(page.getByText('2 of 5 confirmed')).toBeVisible();
  const ring = await page.locator('.term').nth(2).locator('.term__box').evaluate((e) => getComputedStyle(e).outlineStyle);
  expect(ring).toBe('solid'); // visible keyboard focus on the box
});

test('press feels tactile (scale 0.94) and the check mark reveals from nothing', async ({ page }) => {
  await toTerms(page);
  const card = page.locator('.term').nth(3);
  const box = card.locator('.term__box');
  const check = card.locator('.term__check');
  await card.scrollIntoViewIfNeeded(); // pointer events outside the viewport never register
  expect(await check.evaluate((e) => getComputedStyle(e).clipPath)).toMatch(/inset\(0px 100% 0px 0px\)/);

  const b = (await card.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect
    .poll(async () => {
      const m = (await box.evaluate((e) => getComputedStyle(e).transform)).match(/matrix\(([^,]+),/);
      return m ? Number(m[1]) : 1;
    })
    .toBeCloseTo(0.94, 2);
  await page.mouse.up();

  await expect(page.getByRole('checkbox').nth(3)).toBeChecked();
  await expect.poll(() => check.evaluate((e) => getComputedStyle(e).clipPath)).toMatch(/inset\(0px(?: 0px 0px 0px)?\)/);
});

test('Continue is inactive until all five are confirmed, then advances to the signature step', async ({ page }) => {
  await toTerms(page);
  const cont = page.getByRole('button', { name: 'Continue to signature' });
  await expect(cont).toHaveAttribute('aria-disabled', 'true');
  await cont.click({ force: true }); // inactive, not disabled: a real user can click it (Playwright treats aria-disabled as unclickable)
  await expect(page.getByRole('checkbox').first()).toBeFocused(); // sent to the first missing term
  const covered = await page.getByRole('checkbox').first().evaluate((el) => {
    const card = el.closest('.term')!.getBoundingClientRect();
    const bar = document.querySelector('.terms__progress')!.getBoundingClientRect();
    return card.top < bar.bottom - 1; // card top hidden under the sticky meter?
  });
  expect(covered).toBe(false);
  await expect(page.locator('.stepper [aria-current="step"]').first()).toContainText('Review terms');

  for (let i = 0; i < 5; i++) await page.locator('.term').nth(i).locator('.term__title label').click();
  await expect(page.getByText('5 of 5 confirmed')).toBeVisible();
  await expect(cont).not.toHaveAttribute('aria-disabled', 'true');
  await cont.click();
  await expect(page.locator('.stepper [aria-current="step"]').first()).toContainText('Sign');
});

test('the progress meter stays in view on tall screens, and gets out of the way on short ones', async ({ page }) => {
  await toTerms(page);
  const tall = page.viewportSize()!.height > 700;
  const position = await page.locator('.terms__progress').evaluate((e) => getComputedStyle(e).position);
  expect(position).toBe(tall ? 'sticky' : 'static'); // short screens: a sticky bar would hide the term being read
  await page.locator('.term').nth(3).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 300));
  const top = await page.locator('.terms__progress').evaluate((e) => e.getBoundingClientRect().top);
  if (tall) {
    expect(top).toBeGreaterThanOrEqual(-1);
    expect(top).toBeLessThan(2);
  } else {
    expect(top).toBeLessThan(0); // it scrolled away with the page
  }
});

{
  test('worst-case name and long terms fit the viewport', async ({ page }) => {
    await toTerms(page, STUDENTS.longName); // a 190-character roster name
    expect(await noOverflow(page)).toEqual({ overflow: 0, escapes: [] });
    for (let i = 0; i < 5; i++) await page.locator('.term').nth(i).locator('.term__title label').click();
    expect(await noOverflow(page)).toEqual({ overflow: 0, escapes: [] });
  });
}

test('the box sits at the left of each card and the check is not mirrored', async ({ page }) => {
  await toTerms(page);
  const card = page.locator('.term').first();
  const box = (await card.locator('.term__box').boundingBox())!;
  const text = (await card.locator('.term__text').boundingBox())!;
  expect(box.x).toBeLessThan(text.x);
  expect(await card.locator('.term__check').evaluate((e) => getComputedStyle(e).transform)).toBe('none');
});

test('reduced motion removes the press scale and the reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toTerms(page);
  const card = page.locator('.term').nth(0);
  await card.scrollIntoViewIfNeeded();
  const b2 = (await card.boundingBox())!;
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.mouse.down();
  // The press must really be registered, or "no scale" would pass for the wrong reason.
  await expect.poll(() => card.evaluate((e) => e.matches(':active'))).toBe(true);
  expect(await card.locator('.term__box').evaluate((e) => getComputedStyle(e).transform)).toBe('none');
  await page.mouse.up();
  expect(await card.locator('.term__check').evaluate((e) => getComputedStyle(e).transitionDuration)).toBe('0s');
});
