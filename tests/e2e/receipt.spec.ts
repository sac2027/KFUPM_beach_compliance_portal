import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fillLogin, L, settleReceipt, signatureInkAboveLine } from './helpers';
import { STUDENTS } from './students';

async function toDone(page: Page, creds = STUDENTS.mai) {
  const s = L;
  await page.goto('/');
  await fillLogin(page, creds);
  await page.locator('.term').first().waitFor();
  for (let i = 0; i < 5; i++) await page.locator('.term').nth(i).locator('.term__title label').click();
  await page.getByRole('button', { name: s.cont }).click();
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const b = (await canvas.boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.2, { steps: 10 });
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.7, { steps: 10 });
  await page.mouse.move(b.x + b.width * 0.9, b.y + b.height * 0.3, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: s.submit }).click();
  await expect(page.getByRole('heading', { level: 2, name: s.heading })).toBeFocused({ timeout: 8000 });
  await settleReceipt(page);
  await page.evaluate(() => document.fonts.ready);
}

const REF = /^PACF-\d{4}-[A-HJ-NP-Z2-9]{6}$/;

test('shows the receipt with a reference number and moves to Done', async ({ page }) => {
  await toDone(page);
  await expect(page.locator('.stepper [aria-current="step"]').first()).toContainText('Done');
  const ref = (await page.locator('.receipt__ref').textContent())!;
  expect(ref).toMatch(REF);
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
});

test('leaves no personal data in the URL or browser storage, and Finish wipes the page', async ({ page }) => {
  await toDone(page);
  const leaks = await page.evaluate(() => ({
    url: location.href,
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    cookie: document.cookie,
  }));
  expect(new URL(leaks.url).search).toBe('');
  expect(new URL(leaks.url).hash).toBe('#done'); // the step name only; nothing about the student
  expect(leaks.local).toEqual([]); // nothing at all: not even a language choice
  expect(leaks.session).toEqual([]);
  expect(leaks.cookie).toBe('');

  await page.getByRole('button', { name: 'Finish and clear my details' }).click();
  await expect(page.getByRole('alert')).toContainText('Print or save it first'); // one click does not destroy the declaration
  await expect(page.getByRole('button', { name: 'Yes, clear my details' })).toBeFocused();
  await page.getByRole('button', { name: 'Yes, clear my details' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Passport number')).toHaveValue('');
  await expect(page.getByLabel('Full name')).toHaveValue('');
  const body = await page.evaluate(() => document.body.innerHTML);
  for (const secret of [STUDENTS.mai.passport, STUDENTS.mai.email, 'Mai Nguyễn', 'Nguyen Thi Mai', 'data:image/png']) expect(body).not.toContain(secret);
  await expect(page.locator('.stepper [aria-current="step"]').first()).toContainText('Sign in');
});

test('print media shows only the formal declaration, with letterhead, seal and Matrix loaded', async ({ page }) => {
  await toDone(page);
  await page.emulateMedia({ media: 'print' });
  for (const hidden of ['.masthead', '.stepper', '.receipt', '.page__footer']) await expect(page.locator(hidden).first()).toBeHidden();
  const sheet = page.locator('.print-sheet');
  await expect(sheet).toBeVisible();
  for (const img of await sheet.locator('img').all()) {
    expect(await img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
  }
  expect(await sheet.locator('.print-sheet__band').evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('matrix-beige-sand.svg');
  await expect(sheet).not.toContainText(STUDENTS.mai.passport);
  await expect(sheet).toContainText('0001'); // last four of E2E00001
});

test('the receipt fits at this width', async ({ page }) => {
  await toDone(page, STUDENTS.longName);
  const r = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const escapes = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && getComputedStyle(el).position !== 'absolute' && (b.left < -0.5 || b.right > w + 0.5);
      })
      .map((el) => `${el.tagName}.${el.className}`);
    return { overflow: document.documentElement.scrollWidth - innerWidth, escapes };
  });
  expect(r).toEqual({ overflow: 0, escapes: [] });
});

{
  test('saves a real PDF that carries the declaration and none of the screen chrome', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-1280', 'PDF output does not depend on the viewport');
    const creds = STUDENTS.mai;
    await toDone(page, creds);
    const ref = (await page.locator('.receipt__ref').textContent())!;
    await page.emulateMedia({ media: 'print' });
    const dir = mkdtempSync(join(tmpdir(), 'pacf-'));
    const file = join(dir, `declaration-en.pdf`);
    writeFileSync(file, await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
    const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
    const pages = Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [file], { encoding: 'utf8' }))![1]);
    expect(pages).toBe(1); // what the student prints is one A4 page
    expect(text).toContain(ref);
    expect(text).toContain('KFUPM-INTL-PACF');
    expect(text).toContain(creds.passport.slice(-4));
    expect(text).not.toContain(creds.passport);
    expect(text).toContain('Vietnam'); // the nationality the student chose
    for (const chrome of ['Continue to signature', 'Print', 'Pre-Arrival Compliance Portal', 'Deanship of Student Affairs • ']) expect(text).not.toContain(chrome);
    expect(text).toContain('Pre-Arrival Compliance Form for International Students');
    expect(text).toContain('Compliance with Saudi Laws and Regulations');
    expect(text).toContain('Reporting and Understanding Consequences');
    expect(text).toContain('Nguyen Thi Mai');

    // The signature is in the printed page, not only in the data: look for handwriting above the signature line.
    execFileSync('pdftoppm', ['-r', '80', '-png', '-singlefile', file, join(dir, 'page')]);
    const ink = await signatureInkAboveLine(page, execFileSync('cat', [join(dir, 'page.png')]));
    expect(ink.lineFound).toBe(true);
    expect(ink.inkPixels).toBeGreaterThan(40);
    // Optional: keep the PDFs for a human to look at (PACF_PDF_OUT=/some/dir npm run test:e2e).
    if (process.env.PACF_PDF_OUT) execFileSync('cp', [file, `${process.env.PACF_PDF_OUT}/`]);
  });
}
