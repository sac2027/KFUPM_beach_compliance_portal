import type { Env } from '../lib/env';
import { handle, json } from '../lib/http';

/** Confirms every binding answers. No data is returned. */
export const onRequestGet = handle<Env>(async ({ env }) => {
  const [roster, records, documents] = await Promise.all([
    env.ROSTER.prepare('SELECT 1 AS ok').first<{ ok: number }>().then((r) => r?.ok === 1).catch(() => false),
    env.RECORDS.prepare('SELECT 1 AS ok').first<{ ok: number }>().then((r) => r?.ok === 1).catch(() => false),
    env.DOCUMENTS.list({ limit: 1 }).then(() => true).catch(() => false),
  ]);
  const ok = roster && records && documents;
  return json(ok ? 200 : 503, { ok, roster, records, documents });
});
