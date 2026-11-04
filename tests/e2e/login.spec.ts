import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fillLogin, L, overflow } from './helpers';
import { STUDENTS } from './students';

const open = async (page: Page) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
};

test('the form asks for name, email, nationality and passport number, in that order, and not for a phone number', async ({ page }) => {
  await open(page);
  expect(await page.locator('.field__label').allTextContents()).toEqual(['Full name', 'Email address', 'Nationality', 'Passport number']);
  await expect(page.getByLabel(/phone/i)).toHaveCount(0);
});

test('empty submit shows four errors, focuses the first field, and never scrolls sideways', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.field__error')).toHaveCount(4);
  await expect(page.getByText('Choose your nationality from the list.')).toBeVisible();
  await expect(page.getByLabel('Full name')).toBeFocused();
  expect(await overflow(page)).toEqual({ overflow: 0, escapes: [] });
});

test('a roster student signs in and sees the terms; the declaration carries the roster name', async ({ page }) => {
  await open(page);
  await fillLogin(page, STUDENTS.eyad);
  await expect(page.locator('.stepper [aria-current="step"]').first()).toContainText('Review terms', { timeout: 10_000 });
  await expect(page.locator('.declarant')).toContainText('Eyad Salem');
});

test('the nationality is never checked: a different country still signs in', async ({ page }) => {
  await open(page);
  await fillLogin(page, { ...STUDENTS.eyad, nationality: 'JP' });
  await expect(page.locator('#terms-heading')).toBeFocused({ timeout: 10_000 });
});

test('Arabic-Indic digits, spacing, case and word order in the typed details still verify', async ({ page }) => {
  await open(page);
  await fillLogin(page, { passport: 'e2e٠٠٠٠٢', email: ' EyadSalem139@Gmail.com ', nationality: 'SA', name: 'mohammed alghamdi' });
  await expect(page.locator('#terms-heading')).toBeFocused({ timeout: 10_000 });
  await expect(page.locator('.declarant')).toContainText('Mohammed Abdullah Alghamdi');
});

test('one wrong detail gets the generic message, keeps the form filled, and a corrected retry succeeds', async ({ page }) => {
  await open(page);
  await fillLogin(page, { ...STUDENTS.eyad, email: 'wrong@example.com' });
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('do not match our records');
  const forEmail = await alert.textContent();
  await page.getByLabel('Email address').fill(STUDENTS.eyad.email);
  await page.getByLabel('Passport number').fill('TEST0009');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(alert).toBeVisible();
  expect(await alert.textContent()).toBe(forEmail); // identical for a wrong passport: never says which one
  await page.getByLabel('Passport number').fill(STUDENTS.eyad.passport);
  await expect(page.getByLabel('Full name')).toHaveValue('Eyad Salem');
  await expect(page.getByLabel('Nationality')).toHaveValue('SA');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#terms-heading')).toBeFocused({ timeout: 10_000 });
});

test('worst case input at this width stays inside the viewport', async ({ page }) => {
  await open(page);
  const s = L;
  await page.getByLabel(s.name).fill('م'.repeat(100));
  await page.getByLabel(s.email).fill(`${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.com`);
  await page.getByLabel(s.nationality).selectOption('GB');
  await page.getByLabel(s.passport).fill('A'.repeat(20));
  await page.getByRole('button', { name: s.signin }).click();
  await expect(page.getByRole('alert')).toBeVisible(); // valid-looking input, but not on the roster
  expect(await overflow(page)).toEqual({ overflow: 0, escapes: [] });
});

test('the nationality is a native dropdown that fits the form and reads as one of its fields', async ({ page }) => {
  await open(page);
  const select = page.getByLabel('Nationality');
  expect(await select.evaluate((e) => e.tagName)).toBe('SELECT');
  const [sel, input] = await Promise.all([select.boundingBox(), page.getByLabel('Passport number').boundingBox()]);
  expect(Math.abs(sel!.width - input!.width)).toBeLessThan(2);
  expect(sel!.height).toBeGreaterThanOrEqual(44);
});

test('typed text is never set in the KFUPM display font (it has no glyphs for most names)', async ({ page }) => {
  await open(page);
  for (const label of ['Passport number', 'Email address', 'Full name', 'Nationality']) {
    const family = await page.getByLabel(label).evaluate((e) => getComputedStyle(e).fontFamily);
    expect(family, label).not.toMatch(/KFUPM/);
    expect(family, label).toMatch(/^"?IBM Plex Sans Arabic/);
  }
});

test('errors are announced with the field description', async ({ page }) => {
  await open(page);
  await page.getByLabel('Full name').fill('Mai Nguyễn');
  await page.getByLabel('Passport number').fill('P<');
  await page.getByLabel('Passport number').blur();
  await expect(page.locator('#passport-error')).toBeVisible();
  expect(await page.getByLabel('Passport number').getAttribute('aria-describedby')).toContain('passport-error');
});

test('there is no language switch: the portal is English only', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('button', { name: 'العربية' })).toHaveCount(0);
  await page.goto('/?lang=ar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByLabel('Full name')).toBeVisible();
});
