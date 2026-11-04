import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fillLogin } from './helpers';
import { STUDENTS } from './students';

const T = {
  cont: 'Continue to signature',
  submit: 'Sign and submit',
  upload: 'Upload',
};

async function toSign(page: Page) {
  const s = T;
  await page.goto('/');
  await fillLogin(page, STUDENTS.mai);
  await page.locator('.term').first().waitFor();
  for (let i = 0; i < 5; i++) await page.locator('.term').nth(i).locator('.term__title label').click();
  await page.getByRole('button', { name: s.cont }).click();
  await expect(page.locator('#sign-heading')).toBeFocused();
  await page.evaluate(() => document.fonts.ready);
}

const inkPixels = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector('canvas')!;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
    return n;
  });

async function scribble(page: Page, tiny = false) {
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!;
  const at = (fx: number, fy: number) => [b.x + b.width * fx, b.y + b.height * fy] as const;
  await page.mouse.move(...at(0.1, 0.6));
  await page.mouse.down();
  if (tiny) await page.mouse.move(b.x + b.width * 0.1 + 2, b.y + b.height * 0.6 + 1, { steps: 3 });
  else {
    await page.mouse.move(...at(0.3, 0.25), { steps: 12 });
    await page.mouse.move(...at(0.5, 0.75), { steps: 12 });
    await page.mouse.move(...at(0.9, 0.35), { steps: 12 });
  }
  await page.mouse.up();
}

const pngBase64 = (page: Page) =>
  page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 100;
    const x = c.getContext('2d')!;
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 300, 100);
    x.strokeStyle = '#000';
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(10, 80);
    x.bezierCurveTo(60, 0, 120, 120, 290, 20);
    x.stroke();
    return c.toDataURL('image/png').split(',')[1]!;
  });

const submitBtn = (page: Page) => page.getByRole('button', { name: T.submit });

test('drawing puts real ink on the canvas and activates Submit', async ({ page }) => {
  await toSign(page);
  await expect(submitBtn(page)).toHaveAttribute('aria-disabled', 'true');
  expect(await inkPixels(page)).toBe(0);
  await scribble(page);
  expect(await inkPixels(page)).toBeGreaterThan(200);
  await expect(submitBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
});

test('only the selected tab is visible, and ink survives being hidden and shown again', async ({ page }) => {
  await toSign(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.drop')).toBeHidden();
  await scribble(page);
  const before = await inkPixels(page);
  await page.getByRole('tab', { name: 'Upload' }).click();
  await expect(page.locator('.drop')).toBeVisible();
  await expect(page.locator('canvas')).toBeHidden();
  await page.getByRole('tab', { name: 'Draw' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.drop')).toBeHidden();
  await expect.poll(() => inkPixels(page)).toBeGreaterThan(before * 0.5); // redrawn after the canvas was display:none
});

test('an accidental dot is not a signature', async ({ page }) => {
  await toSign(page);
  await scribble(page, true);
  await expect(page.getByText(/too short/i)).toBeVisible();
  await expect(submitBtn(page)).toHaveAttribute('aria-disabled', 'true');
});

test('ink survives a viewport resize and a tab round-trip', async ({ page }) => {
  await toSign(page);
  await scribble(page);
  const before = await inkPixels(page);
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.width - 20, height: vp.height });
  await expect.poll(() => inkPixels(page)).toBeGreaterThan(before * 0.5);
  await page.getByRole('tab', { name: 'Upload' }).click();
  await page.getByRole('tab', { name: 'Draw' }).click();
  await expect.poll(() => inkPixels(page)).toBeGreaterThan(before * 0.5);
  await expect(submitBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
});

test('Clear empties the canvas and deactivates Submit', async ({ page }) => {
  await toSign(page);
  await scribble(page);
  await page.getByRole('button', { name: 'Clear' }).click();
  expect(await inkPixels(page)).toBe(0);
  await expect(submitBtn(page)).toHaveAttribute('aria-disabled', 'true');
});

test('uploading a real PNG shows a decodable preview and activates Submit', async ({ page }) => {
  await toSign(page);
  const buffer = Buffer.from(await pngBase64(page), 'base64');
  await page.getByRole('tab', { name: 'Upload' }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'sig.png', mimeType: 'image/png', buffer });
  const img = page.getByRole('img', { name: 'Your uploaded signature' });
  await expect(img).toBeVisible();
  expect(await img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);
  await expect(submitBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(submitBtn(page)).toHaveAttribute('aria-disabled', 'true');
});

test('drag and drop works, with a visible drag-over state', async ({ page }) => {
  await toSign(page);
  const b64 = await pngBase64(page);
  await page.getByRole('tab', { name: 'Upload' }).click();
  const dt = await page.evaluateHandle((data) => {
    const t = new DataTransfer();
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    t.items.add(new File([bytes], 'sig.png', { type: 'image/png' }));
    return t;
  }, b64);
  const zone = page.locator('.drop');
  await zone.dispatchEvent('dragover', { dataTransfer: dt });
  await expect(zone).toHaveAttribute('data-over', 'true');
  await zone.dispatchEvent('drop', { dataTransfer: dt });
  await expect(zone).toHaveAttribute('data-over', 'false');
  await expect(page.getByRole('img', { name: 'Your uploaded signature' })).toBeVisible();
});

test('rejects an SVG, an HTML file pretending to be a PNG, and an oversize image', async ({ page }) => {
  await toSign(page);
  await page.getByRole('tab', { name: 'Upload' }).click();
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: 's.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>') });
  await expect(page.getByRole('alert')).toContainText('PNG or JPEG');
  await input.setInputFiles({ name: 's.png', mimeType: 'image/png', buffer: Buffer.from('<html><script>alert(1)</script></html>') });
  await expect(page.getByRole('alert')).toContainText('PNG or JPEG');
  const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(3 * 1024 * 1024)]);
  await input.setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: big });
  await expect(page.getByRole('alert')).toContainText('larger than 2 MB');
  await expect(page.getByRole('img', { name: 'Your uploaded signature' })).toHaveCount(0);
  await expect(submitBtn(page)).toHaveAttribute('aria-disabled', 'true');
});

test('tabs work from the keyboard', async ({ page }) => {
  await toSign(page);
  await page.getByRole('tab', { name: 'Draw' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Upload' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.drop')).toBeVisible();
});

test('signing submits and moves to Done; Back returns to the terms with all five still confirmed', async ({ page }) => {
  await toSign(page);
  await page.getByRole('button', { name: 'Back to terms' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Terms and responsibilities');
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(5);
  await page.getByRole('button', { name: 'Continue to signature' }).click();
  await scribble(page);
  await submitBtn(page).click();
  await expect(page.locator('.stepper [aria-current="step"]').first()).toContainText('Done', { timeout: 5000 });
});

{
  test('the signature step fits the viewport, including the upload tab and an error', async ({ page }) => {
    await toSign(page);
    const check = () =>
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
    expect(await check()).toEqual({ overflow: 0, escapes: [] });
    await page.getByRole('tab', { name: T.upload }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: 's.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    await expect(page.getByRole('alert')).toBeVisible();
    expect(await check()).toEqual({ overflow: 0, escapes: [] });
  });
}

test('the Draw tab comes first on the left, and the canvas takes ink as drawn', async ({ page }) => {
  await toSign(page);
  const draw = (await page.getByRole('tab', { name: 'Draw' }).boundingBox())!;
  const up = (await page.getByRole('tab', { name: 'Upload' }).boundingBox())!;
  expect(draw.x).toBeLessThan(up.x);
  await scribble(page);
  expect(await inkPixels(page)).toBeGreaterThan(200);
  await expect(submitBtn(page)).not.toHaveAttribute('aria-disabled', 'true');
});
