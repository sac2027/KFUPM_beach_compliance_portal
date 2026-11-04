import { expect, test } from '@playwright/test';

const pdf = (body = '%PDF-1.7 e2e declaration') => ({ name: 'KFUPM-UBR-2026-ABCDEF.pdf', mimeType: 'application/pdf', buffer: Buffer.from(body) });
const fields = () => ({ email: 'api@example.com', locale: 'en', referenceNumber: 'UBR-2026-ABCDEF', submittedAt: new Date().toISOString() });

test('POST /api/declarations emails a PDF (logged locally), refuses a non-PDF and a malformed field', async ({ request }, info) => {
  test.skip(info.project.name !== 'desktop-1280', 'not viewport dependent');
  const ok = await request.post('/api/declarations', { multipart: { ...fields(), pdf: pdf() } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toEqual({ emailStatus: 'logged', emailTo: 'a•••@example.com' });
  expect(ok.headers()['cache-control']).toBe('no-store');

  const html = await request.post('/api/declarations', { multipart: { ...fields(), pdf: pdf('<html>not a pdf') } });
  expect(html.status()).toBe(400);
  expect((await html.json()).code).toBe('invalid_document');

  const bad = await request.post('/api/declarations', { multipart: { ...fields(), email: 'nope', pdf: pdf() } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).code).toBe('invalid_submission');
});
