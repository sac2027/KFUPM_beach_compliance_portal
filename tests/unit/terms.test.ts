import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import raw from '../../src/data/compliance-terms.json';
import { loadTerms } from '../../src/lib/terms';
import { TERM_IDS, parseTerms, termText } from '../../src/lib/termsSchema';

const terms = loadTerms();

/** The English terms exactly as written in the brief of 2026-11-03: one paragraph per term. */
const BRIEF = {
  'dress-code': "Adherence to the morals, values, and customs observed in the Kingdom of Saudi Arabia, avoiding anything inconsistent with Saudi traditions. Maintaining a decent appearance within the University campus and adhering to modest attire. Avoiding clothing that violates public decency, such as pajamas, shorts, overly short, transparent, or tight clothing, or attire bearing inappropriate images or phrases. Female students are required to wear an abaya, or equivalent modest attire, with full head covering. Appropriate beachwear that aligns with our community values and traditions is required.",
  cleanliness: 'Maintaining public property and keeping all beach facilities clean. To maintain general cleanliness and avoid consuming food or drinks in prohibited areas. Spitting or littering outside designated areas is prohibited.',
  'respect-privacy': "Comply with Islamic ethics and respect the privacy of others. To treat all University members, guests, and service providers with due respect, preserving their dignity and refraining from any form of insult, abuse, or inappropriate behavior. Playing loud music or causing disturbance with excessive noise is prohibited. To respect the privacy of all University members, including refraining from photography, collecting personal information without prior authorization, or publishing such material by any means. It is forbidden to cross from the Singles area to the Families' area.",
  'beach-regulations': "Advance reservation is required to enter the beach, and attendance is based on the reservation time. The person who makes the reservation (the host) must be present with his visitors entering the beach, and he is the first to be held liable for any subsequent damages and breaches of the beach's rules and regulations.",
  'swimming-safety': "Ensure lifeguards are present and follow their instructions. Do not exceed the designated swimming area. Swim parallel to the shore. Swimming after sunset is prohibited. Diving is not allowed at any time. Rough play, climbing on others' shoulders, diving, or pushing others into the water is not allowed.",
} as const;

const TITLES = ['Dress Code and Public Decency', 'Cleanliness and University Property', 'Respecting Others and Privacy', 'University Beach Regulations', 'Swimming Safety Guidelines'];

describe('compliance-terms.json', () => {
  it('has exactly the five terms in the mandated order', () => {
    expect(terms.terms.map((t) => t.id)).toEqual(['dress-code', 'cleanliness', 'respect-privacy', 'beach-regulations', 'swimming-safety']);
    expect([...TERM_IDS]).toEqual(terms.terms.map((t) => t.id));
  });

  it('has the exact title, document ref and the five titles', () => {
    expect(terms.document.title.en).toBe('University and University Beach Regulations & Procedures');
    expect(terms.document.ref).toBe('KFUPM-UBR');
    expect(terms.document.scope.en).toBe('University Beach');
    expect(terms.terms.map((t) => t.title.en)).toEqual(TITLES);
  });

  it.each(Object.entries(BRIEF))('keeps the English wording of %s verbatim from the brief', (id, paragraph) => {
    const term = terms.terms.find((t) => t.id === id)!;
    expect(termText(term, 'en', terms.links)).toBe(paragraph);
  });

  it('has non-empty English and Arabic for every user-visible string, with the same points in both', () => {
    for (const t of terms.terms) {
      for (const loc of ['en', 'ar'] as const) {
        expect(t.title[loc].trim(), `${t.id} title ${loc}`).not.toBe('');
        expect(termText(t, loc, terms.links).trim().length, `${t.id} body ${loc}`).toBeGreaterThan(30);
      }
      expect(t.points?.en.length, t.id).toBe(t.points?.ar.length);
    }
    for (const loc of ['en', 'ar'] as const) {
      expect(terms.document.title[loc]).toBeTruthy();
      expect(terms.document.intro[loc]).toBeTruthy();
      expect(terms.document.closing[loc]).toBeTruthy();
      expect(terms.document.scope[loc]).toBeTruthy();
    }
  });

  it('writes the Arabic in Arabic script and the English without any', () => {
    for (const t of terms.terms) {
      expect(termText(t, 'ar', terms.links)).toMatch(/[؀-ۿ]/);
      expect(termText(t, 'en', terms.links)).not.toMatch(/[؀-ۿ]/);
    }
  });

  it('splits terms 1, 2, 3 and 5 into points (4, 2, 4 and 5) and leaves term 4 as one paragraph', () => {
    expect(terms.terms.map((t) => t.points?.en.length ?? 0)).toEqual([4, 2, 4, 0, 5]);
  });

  it('has no links (and so no external URL) in the shipped wording', () => {
    expect(Object.keys(terms.links)).toEqual([]);
  });

  it('rejects a term missing its title and names the path', () => {
    const bad = structuredClone(raw) as unknown as { terms: Array<{ title: Record<string, unknown> }> };
    delete bad.terms[1]!.title.en;
    expect(() => parseTerms(bad)).toThrow(/terms\.1\.title\.en/);
  });

  it('rejects a term whose Arabic is missing', () => {
    const bad = structuredClone(raw) as unknown as { terms: Array<{ title: Record<string, unknown> }> };
    delete bad.terms[0]!.title.ar;
    expect(() => parseTerms(bad)).toThrow(/terms\.0\.title\.ar/);
  });

  it('rejects points that differ in number between the languages', () => {
    const bad = structuredClone(raw) as unknown as { terms: Array<{ points: { ar: unknown[] } }> };
    bad.terms[0]!.points.ar.pop();
    expect(() => parseTerms(bad)).toThrow(/terms\.0\.points must have the same number/);
  });

  it('rejects a body that references an unknown link', () => {
    const bad = structuredClone(raw) as unknown as { terms: Array<{ body: { en: unknown[] } }> };
    bad.terms[0]!.body.en.push({ linkId: 'does-not-exist' });
    expect(() => parseTerms(bad)).toThrow(/does-not-exist/);
  });

  it('rejects an http (non-TLS) URL', () => {
    const bad = structuredClone(raw) as unknown as { links: Record<string, unknown> };
    bad.links.x = { url: 'http://example.com', label: { en: 'x', ar: 'س' }, status: 'verified' };
    expect(() => parseTerms(bad)).toThrow(/https/);
  });
});

describe('content decoupling', () => {
  /** No policy copy or external URL may live in a component: it belongs in compliance-terms.json. */
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
    });
  }
  it('has no https URLs or policy phrases in any .tsx file', () => {
    for (const f of walk('src')) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/https?:\/\//);
      expect(src, f).not.toMatch(/Public Decency|abaya|lifeguards|Singles area|beachwear/i);
    }
  });
});
