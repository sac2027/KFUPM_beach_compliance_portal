import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const L = {
  name: 'Full name',
  email: 'Email address',
  nationality: 'Nationality',
  passport: 'Passport number',
  signin: 'Sign in',
  cont: 'Continue to signature',
  submit: 'Sign and submit',
  heading: 'Declaration submitted',
  upload: 'Upload',
};

/** Horizontal overflow, and any element that pokes outside the viewport. */
export const overflow = (page: Page) =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const escapes = [...document.querySelectorAll('body *')]
      .filter((el) => {
        if (el.closest('[data-dev-chrome]') || el.closest('[data-capture-stage]')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && getComputedStyle(el).position !== 'absolute' && (r.left < -0.5 || r.right > w + 0.5);
      })
      .map((el) => `${el.tagName}.${(el as HTMLElement).className}`);
    return { overflow: document.documentElement.scrollWidth - innerWidth, escapes };
  });

/** Content cut off by a box that hides its overflow (the "clipped diacritics / fixed height" family). */
export const clipped = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => {
        if (el.closest('[data-dev-chrome]') || el.closest('.sr-only') || el.closest('[data-capture-stage]')) return false;
        const cs = getComputedStyle(el);
        if (!/(hidden|clip)/.test(cs.overflowY) || cs.clipPath !== 'none') return false;
        return el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 2;
      })
      .map((el) => `${el.tagName}.${(el as HTMLElement).className}`),
  );

export async function fillLogin(page: Page, p: { name: string; email: string; nationality: string; passport: string }) {
  const s = L;
  await page.getByLabel(s.name).fill(p.name);
  await page.getByLabel(s.email).fill(p.email);
  if (p.nationality) await page.getByLabel(s.nationality).selectOption(p.nationality);
  await page.getByLabel(s.passport).fill(p.passport);
  await page.getByRole('button', { name: s.signin }).click();
}

/** Signs in as a roster student and waits for the terms step. */
export async function signIn(page: Page, creds: { name: string; email: string; nationality: string; passport: string }) {
  await fillLogin(page, creds);
  await expect(page.locator('#terms-heading')).toBeFocused({ timeout: 10_000 });
}

export async function confirmAllTerms(page: Page) {
  await page.locator('.term').first().waitFor();
  for (let i = 0; i < 5; i++) await page.locator('.term').nth(i).locator('.term__title label').click();
  await page.getByRole('button', { name: L.cont }).click();
  await expect(page.locator('#sign-heading')).toBeFocused();
}

export async function drawSignature(page: Page) {
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.2, { steps: 10 });
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.7, { steps: 10 });
  await page.mouse.move(b.x + b.width * 0.9, b.y + b.height * 0.3, { steps: 10 });
  await page.mouse.up();
}

/** A PNG made in the page: `ink` draws dark strokes, otherwise it is a blank ground of the given colour. */
export const makePng = (page: Page, o: { w: number; h: number; ink: boolean; ground?: string; transparent?: boolean; strokeColor?: string }) =>
  page.evaluate((o) => {
    const c = document.createElement('canvas');
    c.width = o.w;
    c.height = o.h;
    const x = c.getContext('2d')!;
    if (!o.transparent) {
      x.fillStyle = o.ground ?? '#ffffff';
      x.fillRect(0, 0, o.w, o.h);
    }
    if (o.ink) {
      x.strokeStyle = o.strokeColor ?? '#000000';
      x.lineWidth = Math.max(2, Math.round(Math.min(o.w, o.h) / 25));
      x.beginPath();
      x.moveTo(o.w * 0.05, o.h * 0.8);
      x.bezierCurveTo(o.w * 0.2, o.h * 0.05, o.w * 0.4, o.h * 0.95, o.w * 0.95, o.h * 0.2);
      x.stroke();
    }
    return c.toDataURL('image/png').split(',')[1]!;
  }, o);

/** The receipt renders and uploads the PDF right after it opens; wait until that has settled before measuring it. */
export async function settleReceipt(page: Page) {
  await expect(page.locator('.receipt__email--sent, .receipt__email--failed')).toBeVisible({ timeout: 25_000 });
  await expect(page.locator('[data-capture-stage]')).toHaveCount(0);
}

/**
 * Looks at a rendered page (a PNG of the declaration) and answers whether there is handwriting above the signature line:
 * it finds the long horizontal rule under the signature, then looks for dark pixels in the band just above it, left half.
 */
export async function signatureInkAboveLine(page: Page, png: Buffer): Promise<{ lineFound: boolean; inkPixels: number }> {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0);
    const { data } = x.getImageData(0, 0, c.width, c.height);
    const dark = (px: number, py: number) => {
      const i = (py * c.width + px) * 4;
      return data[i]! + data[i + 1]! + data[i + 2]! < 300;
    };
    // The rule: the lowest row whose dark run is at least a fifth of the page width (text rows never are).
    let lineY = -1;
    for (let y = c.height - 1; y > 0 && lineY < 0; y--) {
      let run = 0;
      let best = 0;
      for (let px = 0; px < c.width; px++) {
        run = dark(px, y) ? run + 1 : 0;
        best = Math.max(best, run);
      }
      if (best > c.width * 0.2) lineY = y;
    }
    if (lineY < 0) return { lineFound: false, inkPixels: 0 };
    const band = Math.round(c.height * 0.07); // roughly 20 mm of an A4 page
    let ink = 0;
    for (let y = Math.max(0, lineY - band); y < lineY - 2; y++) for (let px = 0; px < c.width * 0.5; px++) if (dark(px, y)) ink++;
    return { lineFound: true, inkPixels: ink };
  }, png.toString('base64'));
}
