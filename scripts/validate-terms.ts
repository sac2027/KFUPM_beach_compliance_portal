/* Run with `npm run validate:terms`. Exits 1 on schema errors; warnings never fail the build. */
import { readFileSync } from 'node:fs';
import { parseTerms } from '../src/lib/termsSchema.ts';

const file = new URL('../src/data/compliance-terms.json', import.meta.url);
let terms;
try {
  terms = parseTerms(JSON.parse(readFileSync(file, 'utf8')));
} catch (err) {
  console.error(`✖ ${(err as Error).message}`);
  process.exit(1);
}

console.log(`✔ compliance-terms.json is valid (${terms.terms.length} terms, ${Object.keys(terms.links).length} links)`);

const warnings: string[] = [];
for (const [id, l] of Object.entries(terms.links)) {
  if (l.status !== 'verified') warnings.push(`link "${id}" is ${l.status}: ${l.url}`);
}
for (const loc of ['en', 'ar'] as const) {
  if (terms.meta.reviewStatus[loc] !== 'approved') warnings.push(`${loc.toUpperCase()} text is "${terms.meta.reviewStatus[loc]}"`);
}
const MAX_TITLE = 110;
const MAX_BODY = 1200;
for (const t of terms.terms) {
  for (const loc of ['en', 'ar'] as const) {
    const body = t.body[loc].map((s) => ('text' in s ? s.text : 'strong' in s ? s.strong : (terms.links[s.linkId]?.label[loc] ?? ''))).join('');
    if (t.title[loc].length > MAX_TITLE) warnings.push(`term "${t.id}" ${loc} title is ${t.title[loc].length} characters (over ${MAX_TITLE}): it will wrap to many lines on phones`);
    if (body.length > MAX_BODY) warnings.push(`term "${t.id}" ${loc} text is ${body.length} characters (over ${MAX_BODY}): the printed declaration may run past one page`);
  }
}
for (const [id, l] of Object.entries(terms.links)) {
  if (l.url.length > 500) warnings.push(`link "${id}" URL is ${l.url.length} characters`);
}
const strict = process.argv.includes('--strict');
if (warnings.length) {
  console.warn(`\n⚠ ${warnings.length} item(s) to resolve before launch:`);
  for (const w of warnings) console.warn(`  - ${w}`);
}
if (strict && warnings.length) {
  console.error('\n\u2716 --strict: resolve every item above before a release.');
  process.exit(1);
}
