import { createContext, useCallback, useContext, useLayoutEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import en from './en.json';

/** The portal is English only. `locale` stays in the API so every `x[locale]` lookup in the terms data keeps working. */
export type Locale = 'en';
export type MessageKey = keyof typeof en;

const LOCALE: Locale = 'en';

/** Looks up `key`. Strict mode (dev/test) throws on a missing key; production returns the key itself. */
export function translate(dict: Record<string, string>, key: string, strict: boolean): string {
  const value = dict[key];
  if (value !== undefined) return value;
  if (strict) throw new Error(`Missing translation key: ${key}`);
  return key;
}

type Vars = Record<string, string | number>;

/** Replaces `{name}` placeholders; unknown placeholders are left as written. */
export function format(message: string, vars?: Vars): string {
  return vars ? message.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : message;
}

interface I18nValue {
  locale: Locale;
  t: (key: MessageKey, vars?: Vars) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const t = useCallback((key: MessageKey, vars?: Vars) => format(translate(en, key, import.meta.env.DEV), vars), []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.lang = LOCALE;
    root.dir = 'ltr';
    document.title = `${translate(en, 'app.title', false)} | KFUPM`;
  }, []);

  const value = useMemo(() => ({ locale: LOCALE, t }), [t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
