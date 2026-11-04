import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Parses Cloudflare's `_headers` format into { path -> { header -> value } }. */
function parse(text: string): Record<string, Record<string, string>> {
  const rules: Record<string, Record<string, string>> = {};
  let path = '';
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      path = raw.trim();
      rules[path] = {};
    } else {
      const i = raw.indexOf(':');
      rules[path]![raw.slice(0, i).trim()] = raw.slice(i + 1).trim();
    }
  }
  return rules;
}

const rules = parse(readFileSync('public/_headers', 'utf8'));
const all = rules['/*']!;
const csp = Object.fromEntries(all['Content-Security-Policy']!.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v])) as Record<string, string[]>;

describe('public/_headers', () => {
  it('has a strict Content-Security-Policy: same-origin only, nothing inline, no eval, no framing, no foreign base', () => {
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toEqual(["'self'"]);
    expect(csp['style-src']).toEqual(["'self'"]);
    expect(csp['object-src']).toEqual(["'none'"]);
    expect(csp['base-uri']).toEqual(["'self'"]); // 'self', not 'none': the PDF capture sets a same-origin <base> to resolve font URLs
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    const raw = all['Content-Security-Policy']!;
    expect(raw).not.toMatch(/unsafe-inline|unsafe-eval|\s\*(\s|;|$)/);
  });
  it('allows data: and blob: images only (the signature preview and canvas), and no remote origins', () => {
    expect(csp['img-src']).toEqual(["'self'", 'data:', 'blob:']);
    expect(all['Content-Security-Policy']).not.toMatch(/https?:\/\//);
  });
  it('sets the standard hardening headers', () => {
    expect(all['X-Content-Type-Options']).toBe('nosniff');
    expect(all['X-Frame-Options']).toBe('DENY');
    expect(all['Referrer-Policy']).toBe('no-referrer'); // the page URL never carries PII, but referrers should carry nothing at all
    expect(all['Permissions-Policy']).toMatch(/camera=\(\).*microphone=\(\).*geolocation=\(\)/);
    expect(all['Strict-Transport-Security']).toMatch(/max-age=\d{7,}/);
  });
  it('caches fingerprinted assets for a year and never sets Cache-Control on /* (rules merge by joining)', () => {
    expect(all['Cache-Control']).toBeUndefined();
    expect(rules['/assets/*']!['Cache-Control']).toMatch(/max-age=31536000.*immutable/);
    expect(rules['/fonts/*']!['Cache-Control']).toMatch(/max-age=604800/);
  });
});
