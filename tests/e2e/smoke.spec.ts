import { expect, test } from '@playwright/test';

test('app loads with a main landmark and no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeAttached();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
