import { expect, test } from '@playwright/test';

test('the API is up and reports its email mode', async ({ request }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'not viewport dependent');
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, email: 'log', configured: true });
  expect(res.headers()['content-security-policy']).toContain("default-src 'none'");
  expect(res.headers()['cache-control']).toBe('no-store');
});
