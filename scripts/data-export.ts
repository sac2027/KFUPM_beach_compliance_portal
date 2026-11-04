/*
 * Full export of the live data: both databases as SQL and every object in the documents bucket.
 *   npm run data:export            → ./export/ (remote data)
 *   npm run data:export -- --local → the local development data instead
 * The result contains passport numbers and signatures: store it encrypted and delete it when done.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const local = process.argv.includes('--local');
const where = local ? '--local' : '--remote';
const out = 'export';
mkdirSync(join(out, 'documents'), { recursive: true });
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
const wrangler = (args: string[], capture = false) => execFileSync('npx', ['wrangler', ...args], { env, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' }) as string;

for (const db of ['pacf-roster', 'pacf-records']) {
  console.log(`\n== ${db}`);
  wrangler(['d1', 'export', db, where, '--output', join(out, `${db.replace('pacf-', '')}.sql`)]);
}

console.log('\n== pacf-documents');
const raw = wrangler(['r2', 'object', 'list', 'pacf-documents', ...(local ? ['--local'] : []), '--json'], true);
const list = JSON.parse(raw.slice(raw.indexOf('['))) as Array<{ key: string }>;
for (const { key } of list) {
  const file = join(out, 'documents', key);
  mkdirSync(join(file, '..'), { recursive: true });
  wrangler(['r2', 'object', 'get', `pacf-documents/${key}`, ...(local ? ['--local'] : []), '--file', file]);
}
writeFileSync(join(out, 'README.txt'), `Exported ${new Date().toISOString()} (${local ? 'local' : 'remote'}). ${list.length} document(s). Contains personal data: keep encrypted, delete when no longer needed.\n`);
console.log(`\n✔ Exported to ./${out} (${list.length} document(s))`);
