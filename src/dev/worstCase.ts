/**
 * DEV ONLY (break-ui stress data). Every use must be guarded as `import.meta.env.DEV && isWorstCase()`
 * at the call site so the production build folds the branch away and drops this module's data
 * (tests/unit/dist.test.ts builds the bundle and searches it to prove nothing leaks).
 */
export function isWorstCase(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).get('data') === 'worst';
}



const failed = new Set<string>();

/**
 * DEV ONLY: `?fail=login`, `?fail=submit` or `?fail=document` makes the mock backend fail the first such call with a network
 * error, so the retry path can be exercised in a real browser. Guard every call with `import.meta.env.DEV`.
 */
export function shouldFailOnce(kind: 'login' | 'submit' | 'document'): boolean {
  if (typeof location === 'undefined' || new URLSearchParams(location.search).get('fail') !== kind || failed.has(kind)) return false;
  failed.add(kind);
  return true;
}
