/*
 * Import (or update) students from a CSV into the roster database.
 *   npm run roster:import -- data/roster.sample.csv            (local database, for development and tests)
 *   npm run roster:import -- path/to/students.csv --remote     (the live database in Cloudflare)
 * Columns: passport_number,full_name,email,nationality,program,intake_term,status
 * Rows with problems are listed and skipped; good rows are upserted by passport number.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseRosterCsv, toUpsertSql } from './lib/roster.ts';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('usage: roster-import <file.csv> [--remote]');
  process.exit(2);
}
const remote = flags.includes('--remote');
const { rows, errors } = parseRosterCsv(readFileSync(file, 'utf8'));
for (const e of errors) console.error(`✖ ${e}`);
if (rows.length === 0) {
  console.error('No valid rows; nothing imported.');
  process.exit(1);
}
mkdirSync('.wrangler/tmp', { recursive: true });
const sqlPath = '.wrangler/tmp/roster-import.sql';
writeFileSync(sqlPath, toUpsertSql(rows) + '\n');
execFileSync('npx', ['wrangler', 'd1', 'execute', 'pacf-roster', remote ? '--remote' : '--local', '--file', sqlPath], {
  stdio: 'inherit',
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
});
console.log(`✔ ${rows.length} student(s) imported${errors.length ? `, ${errors.length} row(s) skipped` : ''} (${remote ? 'remote' : 'local'})`);
process.exit(errors.length ? 1 : 0);
