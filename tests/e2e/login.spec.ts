import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fillLogin, L, overflow } from './helpers';
import { STUDENTS } from './students';

const open = async (page: Page) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
};

test('the form asks for email and passport number, in that order, and nothing else', async ({ page }) => {
  await open(page);
  expect(await page.locator('.field__label').allTextContents()).toEqual(['Email address', 'Passport number']);
  for (const gone of [/phone/i, /full name/i, /nationality/i]) await expect(page.getByLabel(gone)).toHaveCount(0);
});

test('empty submit shows two errors, focuses the first field, and never scrolls sideways', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.field__error')).toHaveCount(2);
  await expect(page.getByLabel('Email address')).toBeFocused();
  expect(await overflow(page)).toEqual({ overflow: 0, escapes: [] });
});

test('well-formed details sign in and the terms show the typed email', async ({ page }) => {
  await open(page);
  await fillLogin(page, STUDENTS.mai);
  await expect(page.locator('.stepper [aria-current="step"]').first()).toContainText('Review terms', { timeout: 10_000 });
  await expect(page.locator('.declarant')).toContainText(STUDENTS.mai.email);
});

test('Arabic-Indic digits, spacing and case in the typed details are normalised', async ({ page }) => {
  await open(page);
  await fillLogin(page, { email: ' Mohammed@Example.com ', passport: 'n١٢٣٤٥٦٧' });
  await expect(page.locator('#terms-heading')).toBeFocused({ timeout: 10_000 });
  await expect(page.locator('.declarant')).toContainText('mohammed@example.com');
});

test('a badly formatted passport is refused with a message, and pressing Sign in is not lost to the message appearing', async ({ page }) => {
  await open(page);
  await fillLogin(page, { email: STUDENTS.mai.email, passport: 'P<' });
  await expect(page.locator('#passport-error')).toContainText('5–20 letters and numbers');
  await expect(page.getByLabel('Email address')).toHaveValue(STUDENTS.mai.email);
  await page.getByLabel('Passport number').fill(STUDENTS.mai.passport);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#terms-heading')).toBeFocused({ timeout: 10_000 });
});

test('the longest realistic input at this width stays inside the viewport', async ({ page }) => {
  await open(page);
  await page.getByLabel(L.email).fill(`${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.com`);
  await page.getByLabel(L.passport).fill('A'.repeat(20));
  expect(await overflow(page)).toEqual({ overflow: 0, escapes: [] });
  await page.getByRole('button', { name: L.signin }).click();
  await expect(page.locator('#terms-heading')).toBeFocused({ timeout: 10_000 });
  expect(await overflow(page)).toEqual({ overflow: 0, escapes: [] });
});

test('typed text is never set in the KFUPM display font (it has no glyphs for most names)', async ({ page }) => {
  await open(page);
  for (const label of ['Passport number', 'Email address']) {
    const family = await page.getByLabel(label).evaluate((e) => getComputedStyle(e).fontFamily);
    expect(family, label).not.toMatch(/KFUPM/);
    expect(family, label).toMatch(/^"?IBM Plex Sans Arabic/);
  }
});

test('errors are announced with the field description', async ({ page }) => {
  await open(page);
  await page.getByLabel('Passport number').fill('P<');
  await page.getByLabel('Passport number').blur();
  await expect(page.locator('#passport-error')).toBeVisible();
  expect(await page.getByLabel('Passport number').getAttribute('aria-describedby')).toContain('passport-error');
});

test('there is no language switch yet: the portal is English only', async ({ page }) => {
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('button', { name: 'العربية' })).toHaveCount(0);
  await page.goto('/?lang=ar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByLabel('Email address')).toBeVisible();
});
