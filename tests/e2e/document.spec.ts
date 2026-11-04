import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { confirmAllTerms, drawSignature, fillLogin, L, settleReceipt, signatureInkAboveLine } from './helpers';
import { STUDENTS } from './students';

test('the PDF is sent to the typed address, and the download is a one-page A4 PDF with the signature on it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'not viewport dependent');
  const creds = STUDENTS.mai;
  await page.goto('/');
  await fillLogin(page, creds);
  await confirmAllTerms(page);
  await drawSignature(page);
  await page.getByRole('button', { name: L.submit }).click();
  await expect(page.getByRole('heading', { level: 2, name: L.heading })).toBeFocused({ timeout: 15_000 });
  const ref = (await page.locator('.receipt__ref').textContent())!;
  expect(ref).toMatch(/^UBR-\d{4}-[A-HJ-NP-Z2-9]{6}$/);
  await settleReceipt(page);
  await expect(page.locator('.receipt__email--sent')).toContainText(creds.email); // EMAIL_MODE=log: reported as sent

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()]);
  expect(download.suggestedFilename()).toBe(`KFUPM-${ref}.pdf`);
  const path = (await download.path())!;
  expect(execFileSync('head', ['-c', '4', path]).toString()).toBe('%PDF');
  expect(Number(/Pages:\s+(\d+)/.exec(execFileSync('pdfinfo', [path], { encoding: 'utf8' }))![1])).toBe(1);

  const dir = info.outputPath('pdf');
  execFileSync('mkdir', ['-p', dir]);
  execFileSync('pdftoppm', ['-r', '80', '-png', '-singlefile', path, `${dir}/page`]);
  const ink = await signatureInkAboveLine(page, execFileSync('cat', [`${dir}/page.png`]));
  expect(ink.lineFound).toBe(true);
  expect(ink.inkPixels).toBeGreaterThan(40);
});

test('the server receives exactly one multipart declaration for the typed address', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'not viewport dependent');
  const seen: { email: string | null; hasPdf: boolean }[] = [];
  await page.route('**/api/declarations', async (route) => {
    const body = route.request().postDataBuffer()!.toString('latin1');
    seen.push({ email: /name="email"\r\n\r\n([^\r]+)/.exec(body)?.[1] ?? null, hasPdf: body.includes('%PDF') });
    await route.continue();
  });
  await page.goto('/');
  await fillLogin(page, STUDENTS.mohammed);
  await confirmAllTerms(page);
  await drawSignature(page);
  await page.getByRole('button', { name: L.submit }).click();
  await settleReceipt(page);
  expect(seen).toEqual([{ email: STUDENTS.mohammed.email, hasPdf: true }]);
});
