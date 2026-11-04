import { readFileSync, existsSync } from 'node:fs';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../src/i18n/en.json';
import { I18nProvider, translate, useI18n } from '../../src/i18n/I18nProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => <I18nProvider>{children}</I18nProvider>;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = '';
  document.documentElement.dir = '';
});
afterEach(() => vi.restoreAllMocks());

describe('i18n (English only)', () => {
  it('sets the document to English, left to right', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('has no empty strings and no leftover phone or language-switch text', () => {
    for (const [k, v] of Object.entries(en)) expect(v, k).not.toBe('');
    expect(Object.keys(en).filter((k) => /phone|^lang\./.test(k))).toEqual([]);
  });

  it('translate throws on a missing key in strict mode and returns the key otherwise', () => {
    expect(() => translate(en, 'nope.missing', true)).toThrow(/nope\.missing/);
    expect(translate(en, 'nope.missing', false)).toBe('nope.missing');
  });

  it('does not read or write a stored language any more', () => {
    renderHook(() => useI18n(), { wrapper });
    expect(localStorage.length).toBe(0);
  });
});

describe('fonts', () => {
  const fontsCss = readFileSync('src/styles/fonts.css', 'utf8');
  const baseCss = readFileSync('src/styles/base.css', 'utf8');
  const tokens = readFileSync('src/styles/tokens.css', 'utf8');

  it('registers every brand face from files that exist in public/fonts', () => {
    const urls = [...fontsCss.matchAll(/url\(['"]?\/fonts\/([^'")]+)['"]?\)/g)].map((m) => m[1]!);
    expect(urls.length).toBeGreaterThanOrEqual(7);
    for (const u of urls) expect(existsSync(`public/fonts/${u}`), u).toBe(true);
    expect(fontsCss.match(/font-family:\s*'KFUPM'/g)).toHaveLength(3);
    expect(fontsCss.match(/font-family:\s*'IBM Plex Sans Arabic'/g)).toHaveLength(4);
    expect(fontsCss.match(/font-display:\s*swap/g)!.length).toBe(urls.length);
  });

  it('serves the KFUPM display font as supplied (no WOFF conversion of the licensed files)', () => {
    expect(fontsCss).toMatch(/KFUPM-Regular\.otf/);
    expect(fontsCss).not.toMatch(/KFUPM[^)]*\.woff/);
  });

  it('never puts KFUPM Display on body text or form controls', () => {
    expect(tokens).toMatch(/--font-body:\s*'IBM Plex Sans Arabic'/);
    expect(tokens.match(/--font-body:[^;]*;/)![0]).not.toMatch(/KFUPM/);
    expect(baseCss).toMatch(/input,[\s\S]*?textarea,[\s\S]*?select,[\s\S]*?button\s*\{[^}]*font-family:\s*var\(--font-body\)/);
  });
});

describe('format', () => {
  it('fills {placeholders}, leaves unknown ones and plain strings untouched', async () => {
    const { format } = await import('../../src/i18n/I18nProvider');
    expect(format('{n} of {total} confirmed', { n: 3, total: 5 })).toBe('3 of 5 confirmed');
    expect(format('{n} of {x}', { n: 1 })).toBe('1 of {x}');
    expect(format('plain')).toBe('plain');
  });
});
