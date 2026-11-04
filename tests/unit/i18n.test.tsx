import { readFileSync, existsSync } from 'node:fs';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../src/i18n/ar.json';
import en from '../../src/i18n/en.json';
import { I18nProvider, detectLocale, translate, useI18n } from '../../src/i18n/I18nProvider';
import { LanguageToggle } from '../../src/components/LanguageToggle';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider initialLocale="en">{children}</I18nProvider>
);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
});
afterEach(() => vi.restoreAllMocks());

describe('i18n', () => {
  it('flips lang and dir on the document when the locale changes', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(document.documentElement.dir).toBe('ltr');
    act(() => result.current.setLocale('ar'));
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(result.current.dir).toBe('rtl');
  });

  it('keeps en.json and ar.json key sets identical and non-empty', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    for (const [k, v] of Object.entries({ ...en, ...ar })) expect(v, k).not.toBe('');
  });

  it('translate throws on a missing key in strict mode and returns the key otherwise', () => {
    expect(() => translate(en, 'nope.missing', true)).toThrow(/nope\.missing/);
    expect(translate(en, 'nope.missing', false)).toBe('nope.missing');
  });

  it('detects Arabic from navigator.language, defaulting to English', () => {
    expect(detectLocale('ar-SA')).toBe('ar');
    expect(detectLocale('ar')).toBe('ar');
    expect(detectLocale('en-GB')).toBe('en');
    expect(detectLocale('vi-VN')).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });

  it('persists the locale but survives storage that throws', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLocale('ar'));
    expect(localStorage.getItem('beach.locale')).toBe('ar');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => act(() => result.current.setLocale('en'))).not.toThrow();
    expect(result.current.locale).toBe('en');
  });
});

describe('LanguageToggle', () => {
  it('shows the other language in its own script and switches on click', async () => {
    render(<LanguageToggle />, { wrapper });
    const btn = screen.getByRole('button', { name: 'العربية' });
    expect(btn).toHaveAttribute('lang', 'ar');
    await userEvent.click(btn);
    const back = screen.getByRole('button', { name: 'English' });
    expect(back).toHaveAttribute('lang', 'en');
    expect(document.documentElement.dir).toBe('rtl');
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

describe('localeFromSearch (?lang= links)', () => {
  it('reads en and ar, case-insensitively, and ignores anything else', async () => {
    const { localeFromSearch } = await import('../../src/i18n/I18nProvider');
    expect(localeFromSearch('?lang=ar')).toBe('ar');
    expect(localeFromSearch('?x=1&lang=EN')).toBe('en');
    expect(localeFromSearch('?lang=fr')).toBeNull();
    expect(localeFromSearch('')).toBeNull();
  });
});
