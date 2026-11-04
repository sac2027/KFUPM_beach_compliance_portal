/** Production build: environment and input edge cases from the break-ui catalogue. */
import { expect, test } from '@playwright/test';
import { clipped, confirmAllTerms, drawSignature, fillLogin, L, makePng, overflow, settleReceipt } from './helpers';
import { STUDENTS } from './students';

const open = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
};
const GOOD = STUDENTS.mai;

test.describe('emails that real students have', () => {
  test('the terms show the address as typed, trimmed and lower-cased', async ({ page }) => {
    await open(page);
    await fillLogin(page, { ...STUDENTS.mai, email: '  Mai.Nguyen@Example.COM ' });
    await expect(page.locator('#terms-heading')).toBeFocused();
    expect(await page.locator('.declarant dd').first().textContent()).toBe('mai.nguyen@example.com');
  });

  test('a plus-tagged and a sub-domained address are accepted', async ({ page }) => {
    await open(page);
    await fillLogin(page, { ...GOOD, email: 'first.last+beach@mail.students.example.co.uk' });
    await expect(page.locator('#terms-heading')).toBeFocused();
  });

  test('an address with a space is refused with a clear message', async ({ page }) => {
    await open(page);
    await fillLogin(page, { ...GOOD, email: 'mai nguyen@example.com' });
    await expect(page.locator('#email-error')).toContainText('valid email');
    await expect(page.locator('#login-heading')).toBeVisible();
  });
});

test.describe('uploaded signature images', () => {
  const toUpload = async (page: import('@playwright/test').Page) => {
    await open(page);
    await fillLogin(page, STUDENTS.mai);
    await confirmAllTerms(page);
    await page.getByRole('tab', { name: 'Upload' }).click();
  };
  const upload = async (page: import('@playwright/test').Page, o: Parameters<typeof makePng>[1]) => {
    const buffer = Buffer.from(await makePng(page, o), 'base64');
    await page.locator('input[type="file"]').setInputFiles({ name: 'sig.png', mimeType: 'image/png', buffer });
  };

  test('a blank white page is not a signature', async ({ page }) => {
    await toUpload(page);
    await upload(page, { w: 600, h: 200, ink: false });
    await expect(page.getByRole('alert')).toContainText('looks blank');
    await expect(page.getByRole('button', { name: 'Sign and submit' })).toHaveAttribute('aria-disabled', 'true');
  });

  test('white ink on a transparent ground (invisible once flattened) is rejected as blank', async ({ page }) => {
    await toUpload(page);
    await upload(page, { w: 600, h: 200, ink: true, transparent: true, strokeColor: '#ffffff' });
    await expect(page.getByRole('alert')).toContainText('looks blank');
  });

  test('a 1×1 pixel image is too small', async ({ page }) => {
    await toUpload(page);
    await upload(page, { w: 1, h: 1, ink: false, ground: '#000000' });
    await expect(page.getByRole('alert')).toContainText('too small');
  });

  test('black ink on a transparent ground (typical of signature apps) is accepted', async ({ page }) => {
    await toUpload(page);
    await upload(page, { w: 600, h: 200, ink: true, transparent: true });
    await expect(page.getByRole('img', { name: 'Your uploaded signature' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign and submit' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  for (const [label, w, h] of [['a 4000×200 panorama', 4000, 200], ['a 200×4000 tall strip', 200, 4000], ['an 8000×6000 phone scan', 8000, 6000]] as const) {
    test(`${label} is downscaled, undistorted and fits its preview`, async ({ page }) => {
      await toUpload(page);
      await upload(page, { w, h, ink: true });
      const img = page.getByRole('img', { name: 'Your uploaded signature' });
      await expect(img).toBeVisible({ timeout: 10_000 });
      // clientWidth/Height exclude the 2px border, which would otherwise skew the ratio of a 15px-tall strip.
      const m = await img.evaluate((e: HTMLImageElement) => ({ nw: e.naturalWidth, nh: e.naturalHeight, r: { width: e.clientWidth, height: e.clientHeight } }));
      expect(m.nw).toBeLessThanOrEqual(900);
      expect(m.nh).toBeLessThanOrEqual(400);
      expect(m.r.height).toBeLessThanOrEqual(129); // 8rem
      expect(Math.abs(m.r.width / m.r.height - m.nw / m.nh)).toBeLessThan(0.12 * (m.nw / m.nh) + 0.02); // aspect ratio kept (integer pixel rounding on thin strips)
      expect(await overflow(page)).toEqual({ overflow: 0, escapes: [] });
    });
  }
});

test.describe('environments', () => {
  test('forced-colours (high contrast): progress, the checked box and the buttons still show their state', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await open(page);
    const bg = (sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e, '::before').backgroundColor);
    const current = await bg('.stepper__item[data-state="current"]');
    const upcoming = await bg('.stepper__item[data-state="upcoming"]');
    expect(current).not.toBe(upcoming);
    for (const c of [current, upcoming]) expect(c).not.toBe('rgba(0, 0, 0, 0)');

    await fillLogin(page, STUDENTS.mai);
    await page.locator('.term').first().waitFor();
    const box = (i: number) => page.locator('.term__box').nth(i).evaluate((e) => getComputedStyle(e).backgroundColor);
    const before = await box(0);
    await page.locator('.term').nth(0).locator('.term__title label').click();
    await expect.poll(() => box(0)).not.toBe(before); // a checked box looks different without any author colours (after its colour transition)
    const inactive = await page.getByRole('button', { name: 'Continue to signature' }).evaluate((e) => getComputedStyle(e).color);
    const meterOn = await page.locator('.meter__seg').first().evaluate((e) => getComputedStyle(e).backgroundColor);
    const meterOff = await page.locator('.meter__seg').nth(4).evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(meterOn).not.toBe(meterOff);
    expect(inactive).toBeTruthy();
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('says what is wrong instead of showing a blank page', async ({ page }) => {
      await page.goto('/');
      // Playwright's text locators deliberately skip <noscript>, so address the block by CSS.
      await expect(page.locator('.noscript')).toBeVisible();
      await expect(page.locator('.noscript p').first()).toContainText('This form needs JavaScript');
    });
  });

  {
    test('text enlarged to 200%: every step still fits with nothing clipped', async ({ page }) => {
      await open(page);
      // Through the CSSOM (what a browser's text-size setting does); an injected <style> would be blocked by the site's own CSP.
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '200%';
      });
      const fits = async (where: string) => {
        expect(await overflow(page), `${where}: overflow`).toEqual({ overflow: 0, escapes: [] });
        expect(await clipped(page), `${where}: clipped`).toEqual([]);
      };
      await fits('login');
      await fillLogin(page, STUDENTS.mai);
      await expect(page.locator('#terms-heading')).toBeFocused();
      await fits('terms');
      await confirmAllTerms(page);
      await fits('sign');
      await drawSignature(page);
      await page.getByRole('button', { name: L.submit }).click();
      await expect(page.getByRole('heading', { level: 2, name: L.heading })).toBeFocused({ timeout: 8000 });
      await settleReceipt(page);
      await fits('receipt');
    });
  }
});
