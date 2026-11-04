import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fillLogin } from './helpers';
import { STUDENTS } from './students';

const open = async (page: Page) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
};

const login = (page: Page) => fillLogin(page, STUDENTS.mai);

/** Armed before the click: grabs the step's entrance transition on the frame it starts, then samples both ends. */
const armCapture = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ props: string[]; durations: number[]; easings: string[]; startX: number; endX: number; startOpacity: number }>((resolve) => {
        const obs = new MutationObserver(() => {
          const el = document.querySelector('.step[data-animate]') as HTMLElement | null;
          if (!el) return;
          obs.disconnect();
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const anims = el.getAnimations() as CSSTransition[];
              const heading = el.querySelector('h2') as HTMLElement;
              anims.forEach((a) => a.pause());
              anims.forEach((a) => (a.currentTime = 0));
              const startX = heading.getBoundingClientRect().x;
              const startOpacity = Number(getComputedStyle(el).opacity);
              anims.forEach((a) => (a.currentTime = Number(a.effect!.getTiming().duration)));
              const endX = heading.getBoundingClientRect().x;
              resolve({
                props: anims.map((a) => a.transitionProperty).sort(),
                durations: anims.map((a) => Number(a.effect!.getTiming().duration)),
                easings: anims.map((a) => String(a.effect!.getTiming().easing)),
                startX,
                endX,
                startOpacity,
              });
            }),
          );
        });
        obs.observe(document.body, { childList: true, subtree: true });
      }),
  );

test(`after sign-in the Terms heading takes focus and the panel enters from the right`, async ({ page }) => {
  await open(page);
  const captured = armCapture(page);
  await login(page);
  const c = await captured;

  // What animates, how fast, with which curve.
  expect(c.props).toEqual(['opacity', 'transform']);
  expect(c.durations.every((d) => d === 220)).toBe(true);
  expect(c.easings.every((e) => e === 'cubic-bezier(0.23, 1, 0.32, 1)')).toBe(true);
  expect(c.startOpacity).toBe(0);

  // Direction: starts 12px towards the inline-end (right) and settles in place.
  const travel = c.startX - c.endX;
  expect(Math.abs(Math.abs(travel) - 12)).toBeLessThan(1);
  expect(travel > 0).toBe(true);

  // Focus lands on the new step's heading.
  await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Terms and responsibilities');
  await expect(page.locator('.stepper [aria-current="step"]').first()).toContainText('Review terms');
});

test('reduced motion keeps a gentle fade and drops the travel', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const captured = armCapture(page);
  await login(page);
  const c = await captured;
  expect(c.props).toEqual(['opacity']);
  expect(c.durations.every((d) => d <= 200)).toBe(true);
  expect(Math.abs(c.startX - c.endX)).toBeLessThan(0.5);
  await expect(page.getByRole('heading', { level: 2 })).toBeFocused(); // focus still moves
});

test('nothing animates on first load, and the step change moves focus to the new heading', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => document.querySelector('.step')!.getAnimations().length)).toBe(0);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  await login(page);
  await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Terms and responsibilities');
});
