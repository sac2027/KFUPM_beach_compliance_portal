import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = <T>(file: string): T => JSON.parse(readFileSync(join(process.cwd(), file), 'utf8')) as T;

/** The same strings the app shows, so the browser tests never repeat them. */
const arStrings = read<Record<string, string>>('src/i18n/ar.json');
/** Arabic UI string by key; throws on a missing key so a typo fails loudly. */
export const ar = (key: string): string => {
  const v = arStrings[key];
  if (v === undefined) throw new Error(`missing ar key ${key}`);
  return v;
};
export const terms = read<{ document: { title: { en: string; ar: string } } }>('src/data/compliance-terms.json');
