import { expect, test } from '@playwright/test';
import { confirmAllTerms, drawSignature, fillLogin, L, settleReceipt } from './helpers';
import { STUDENTS } from './students';

test('the URL names the step and nothing else; a deep link to a later step opens sign-in', async ({ page }) => {
  await page.goto('/#sign');
  await expect(page.locator('#login-heading')).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#login');
  await fillLogin(page, STUDENTS.mai);
  await expect(page.locator('#terms-heading')).toBeFocused();
  const u = new URL(page.url());
  expect(u.hash).toBe('#terms');
  expect(u.search).toBe('');
  expect(u.pathname).toBe('/');
});

test('Back from the signature returns to the terms with the ticks kept; Forward returns to the signature', async ({ page }) => {
  await page.goto('/');
  await fillLogin(page, STUDENTS.mai);
  await confirmAllTerms(page);
  await page.goBack();
  await expect(page.locator('#terms-heading')).toBeVisible();
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(5);
  expect(new URL(page.url()).hash).toBe('#terms');
  await page.goForward();
  await expect(page.locator('#sign-heading')).toBeVisible();
});

test('Back from the terms asks first; declining stays, confirming returns to a cleared sign-in that remembers the ticks', async ({ page }) => {
  await page.goto('/');
  await fillLogin(page, STUDENTS.mai);
  await expect(page.locator('#terms-heading')).toBeFocused();
  await page.locator('.term').nth(0).locator('.term__title label').click();
  await page.locator('.term').nth(1).locator('.term__title label').click();

  await page.goBack();
  await expect(page.getByRole('alert')).toContainText('ends your verified sign-in');
  await expect(page.locator('#terms-heading')).toBeVisible(); // still on the terms
  await page.getByRole('button', { name: 'Stay here' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(2);

  await page.getByRole('button', { name: 'Change my details' }).click();
  await page.getByRole('button', { name: 'Yes, sign in again' }).click();
  await expect(page.locator('#login-heading')).toBeVisible();
  await expect(page.getByLabel('Passport number')).toHaveValue('');
  await expect(page.getByRole('status')).toContainText(/terms you confirmed are kept/);
  await fillLogin(page, STUDENTS.mai);
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(2); // the ticks came back
});

test('Back on the receipt stays on the receipt', async ({ page }) => {
  await page.goto('/');
  await fillLogin(page, STUDENTS.mai);
  await confirmAllTerms(page);
  await drawSignature(page);
  await page.getByRole('button', { name: L.submit }).click();
  await expect(page.getByRole('heading', { level: 2, name: L.heading })).toBeFocused({ timeout: 15_000 });
  await settleReceipt(page);
  const ref = await page.locator('.receipt__ref').textContent();
  await page.goBack();
  await page.waitForTimeout(300);
  await expect(page.locator('.receipt__ref')).toHaveText(ref!);
  expect(new URL(page.url()).hash).toBe('#done');
});
