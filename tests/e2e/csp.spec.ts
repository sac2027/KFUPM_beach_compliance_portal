/** Enforces the real Content-Security-Policy from public/_headers and walks the whole flow: nothing may be blocked. */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { confirmAllTerms, drawSignature, fillLogin, L, makePng, settleReceipt } from './helpers';
import { STUDENTS } from './students';

const HEADERS = readFileSync('public/_headers', 'utf8');
const CSP = /Content-Security-Policy:\s*(.+)/.exec(HEADERS)![1]!.trim();

test('the whole flow runs under the production CSP with no violations and no console errors', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'the policy does not depend on the viewport');
  const s = L;
  const problems: string[] = [];

  // `vite preview` does not read _headers, so add the policy the way Cloudflare will.
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': CSP } });
  });
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      ((window as unknown as { __csp: string[] }).__csp ??= []).push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await fillLogin(page, STUDENTS.mai);
  await expect(page.locator('#terms-heading')).toBeFocused();
  await confirmAllTerms(page);

  await drawSignature(page); // canvas + signature_pad
  await page.getByRole('tab', { name: 'Upload' }).click(); // data: URL preview under img-src
  const buffer = Buffer.from(await makePng(page, { w: 600, h: 200, ink: true }), 'base64');
  await page.locator('input[type="file"]').setInputFiles({ name: 'sig.png', mimeType: 'image/png', buffer });
  await expect(page.getByRole('img', { name: 'Your uploaded signature' })).toBeVisible();
  await page.getByRole('button', { name: s.submit }).click();
  await expect(page.getByRole('heading', { level: 2, name: s.heading })).toBeFocused({ timeout: 8000 });
  await settleReceipt(page);

  // Fonts, the lockup, the Matrix and the seal all load from 'self'.
  expect(await page.evaluate(async () => (await document.fonts.ready, [...document.fonts].filter((f) => f.status === 'loaded').length))).toBeGreaterThanOrEqual(2);
  await page.emulateMedia({ media: 'print' });
  expect(await page.locator('.print-sheet img').evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0))).toBe(true);

  const violations = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
  expect(violations, 'CSP violations').toEqual([]);
  expect(problems).toEqual([]);

  // And the policy really is enforced: an inline script is refused.
  const ran = await page.evaluate(() => {
    const el = document.createElement('script');
    el.textContent = 'window.__inlineRan = true';
    document.head.appendChild(el);
    return (window as unknown as { __inlineRan?: boolean }).__inlineRan === true;
  });
  expect(ran).toBe(false);
});
