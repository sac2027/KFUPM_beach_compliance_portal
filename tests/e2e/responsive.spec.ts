/** The responsive matrix: every step at every supported width. Viewport-independent, so one project runs it. */
import { expect, test } from '@playwright/test';
import { clipped, confirmAllTerms, drawSignature, fillLogin, L, overflow, settleReceipt } from './helpers';
import { STUDENTS } from './students';

const WIDTHS = [320, 360, 375, 768, 1024, 1280, 1920] as const;

{
  for (const width of WIDTHS) {
    test(`every step fits at ${width}px`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop-1280', 'this test sets its own viewport');
      const s = L;
      await page.setViewportSize({ width, height: width >= 1024 ? 900 : 740 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);

      const fits = async (where: string) => {
        expect(await overflow(page), `${width}px ${where}: overflow`).toEqual({ overflow: 0, escapes: [] });
        expect(await clipped(page), `${width}px ${where}: clipped`).toEqual([]);
      };

      await fits('login');
      if (width >= 1024) {
        // Wide screens: the sheet stays a readable column, centred, not stranded on one side.
        const doc = (await page.locator('.doc').boundingBox())!;
        expect(doc.width).toBeLessThanOrEqual(900);
        expect(Math.abs(doc.x + doc.width / 2 - width / 2)).toBeLessThan(2);
      }
      const logo = (await page.locator('.masthead__logo').boundingBox())!;
      expect(Math.abs(logo.width / logo.height - 2657 / 1083)).toBeLessThan(0.03); // lockup never distorted

      await fillLogin(page, STUDENTS.mai);
      await expect(page.locator('#terms-heading')).toBeFocused();
      await fits('terms');
      await confirmAllTerms(page);
      await fits('sign');
      await drawSignature(page);
      await page.getByRole('button', { name: s.submit }).click();
      await expect(page.getByRole('heading', { level: 2, name: s.heading })).toBeFocused({ timeout: 8000 });
      await settleReceipt(page);
      await fits('receipt');
    });
  }
}
