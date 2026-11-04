/** DEV server only: `?fail=document` makes the PDF upload fail once; the receipt must say so and recover. */
import { expect, test } from '@playwright/test';
import { confirmAllTerms, drawSignature, fillLogin, L } from './helpers';
import { STUDENTS } from './students';

test('when the PDF upload fails the record still exists, the receipt says the email was not sent, and Retry succeeds without a second record', async ({ page }) => {
  await page.goto('/?fail=document');
  await fillLogin(page, STUDENTS.mai);
  await confirmAllTerms(page);
  await drawSignature(page);
  await page.getByRole('button', { name: L.submit }).click();
  await expect(page.getByRole('heading', { level: 2, name: L.heading })).toBeFocused({ timeout: 15_000 });
  const ref = (await page.locator('.receipt__ref').textContent())!;
  expect(ref).toMatch(/^PACF-/);
  await expect(page.locator('.receipt__email--failed')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('alert')).toContainText('could not email your copy');

  await page.getByRole('button', { name: 'Send the email again' }).click();
  await expect(page.locator('.receipt__email--sent')).toBeVisible({ timeout: 20_000 });
  expect(await page.locator('.receipt__ref').textContent()).toBe(ref); // same record
});
