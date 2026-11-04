import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import raw from '../../src/data/compliance-terms.json';
import worst from '../../src/dev/worst-case-terms.json';
import { parseTerms, termText, TERM_IDS } from '../../src/lib/termsSchema';

describe('worst-case fixture', () => {
  const demo = parseTerms(raw);
  const stress = parseTerms(worst); // it must be valid content, or it proves nothing

  it('is valid, complete content', () => {
    expect(stress.terms.map((t) => t.id)).toEqual([...TERM_IDS]);
  });

  it('is much longer than the demo where staff are free to write, and shorter where they can be terse', () => {
    expect(stress.document.title.en.length).toBeGreaterThan(demo.document.title.en.length * 2);
    expect(termText(stress.terms[0]!, 'en', stress.links).length).toBeGreaterThan(termText(demo.terms[0]!, 'en', demo.links).length * 3);
    expect(termText(stress.terms[3]!, 'en', stress.links).length).toBeLessThan(40); // "one item 10x smaller"
  });

  it('includes unbroken strings, literal markup and a very long URL (the failures that ship)', () => {
    const all = JSON.stringify(stress);
    expect(all).toContain('<script>alert(1)</script>');
    expect(all).toMatch(/[A-Z0-9]{60,}/);
    expect(Math.max(...Object.values(stress.links).map((l) => l.url.length))).toBeGreaterThan(400);
  });
});

describe('production bundle (dev tooling must never ship)', () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));

  it('contains none of the worst-case data, the toggle or the dev hooks', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'pacf-dist-'));
    // A real production build in a child process: inside Vitest NODE_ENV is "test", which would keep the dev branches.
    execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'silent'], {
      env: { ...process.env, NODE_ENV: 'production', VITEST: '' },
      stdio: 'pipe',
    });
    const js = files(outDir).filter((f) => /\.(js|html|css|json)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const needle of ['WORSTCASE-FIXTURE-MARKER', 'Worst case', 'data-dev-chrome', 'KFUPMDSACODEOFCONDUCT', "get('data')", "get('fail')", 'simulated outage']) {
      expect(js, needle).not.toContain(needle);
    }
    expect(js.length).toBeGreaterThan(50_000); // sanity: we really did read the bundle
    expect(js).not.toContain('Invalid hook call'); // and it is the minified production React, not the development build
  }, 90_000);
});
