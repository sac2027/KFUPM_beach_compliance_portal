import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import raw from '../../src/data/compliance-terms.json';
import { loadTerms } from '../../src/lib/terms';
import { TERM_IDS, parseTerms, termText } from '../../src/lib/termsSchema';

const terms = loadTerms();

describe('compliance-terms.json', () => {
  it('has exactly the five terms in the mandated order', () => {
    expect(terms.terms.map((t) => t.id)).toEqual([
      'saudi-laws',
      'cultural-norms',
      'university-policies',
      'representation',
      'reporting',
    ]);
    expect([...TERM_IDS]).toEqual(terms.terms.map((t) => t.id));
  });

  it('has non-empty English for every user-visible string', () => {
    for (const t of terms.terms) {
      for (const loc of ['en'] as const) {
        expect(t.title[loc].trim(), `${t.id} title ${loc}`).not.toBe('');
        expect(termText(t, loc, terms.links).trim().length, `${t.id} body ${loc}`).toBeGreaterThan(40);
      }
    }
    for (const loc of ['en'] as const) {
      expect(terms.document.title[loc]).toBeTruthy();
      expect(terms.document.intro[loc]).toBeTruthy();
      expect(terms.document.closing[loc]).toBeTruthy();
    }
  });

  it('resolves every linkId and uses https URLs only', () => {
    for (const t of terms.terms) {
      for (const loc of ['en'] as const) {
        for (const seg of t.body[loc]) {
          if ('linkId' in seg) expect(terms.links[seg.linkId], seg.linkId).toBeDefined();
        }
      }
    }
    for (const [id, link] of Object.entries(terms.links)) {
      expect(link.url, id).toMatch(/^https:\/\//);
      expect(link.label.en, id).toBeTruthy();
    }
  });

  it('has no Arabic text left in the policy file', () => {
    expect(JSON.stringify(raw)).not.toMatch(/[\u0600-\u06FF]/);
    expect(JSON.stringify(raw)).not.toContain('"ar"');
  });

  it('keeps term 3 at the docx base wording: appearance spelled correctly, no tracked "ensure that" suggestion', () => {
    const en = termText(terms.terms[2]!, 'en', terms.links);
    expect(en).toContain('behavior, appearance, and responsible use');
    expect(en).not.toContain('apperance');
    expect(en).toContain('I will ensure my actions align');
    expect(en).not.toContain('ensure that');
  });

  // Guards against accidental wording drift while the legacy text is the source of truth.
  // When KFUPM legal approves new wording, update the strings below in the same commit as the JSON.
  it('matches the legacy page verbatim for the intro and terms 1-2 (verified against Full_Page_Embed.pdf)', () => {
    expect(terms.document.intro.en).toBe(
      'As an international student at King Fahd University of Petroleum & Minerals, I understand that my stay in the Kingdom of Saudi Arabia requires full compliance with the country’s laws, cultural norms, and University policies. By signing this form, I acknowledge my responsibilities and agree to the following terms:',
    );
    expect(termText(terms.terms[0]!, 'en', terms.links)).toBe(
      'I commit to adhering to all applicable laws and regulations of the Kingdom of Saudi Arabia, including the Public Decency Regulations, which govern public behavior, dress code, and interactions. I have reviewed the Ministry of Interior Public Decency Regulations (Official Public Decency Regulations PDF • Overview) and other relevant legal resources. I acknowledge that violations of these laws may result in legal consequences that could affect my status in the country.',
    );
    expect(termText(terms.terms[1]!, 'en', terms.links)).toBe(
      'I will respect the cultural values, customs, and traditions of Saudi Arabia, including appropriate conduct, attire, and communication. I have reviewed cultural guidelines provided by Visit Saudi (Saudi Culture and Customs Guide) to familiarize myself with local expectations. I understand that respecting these norms is essential for fostering a positive experience for myself and the local community.',
    );
  });

  it('records document ref and stage', () => {
    expect(terms.document.ref).toBe('KFUPM-INTL-PACF');
    expect(terms.document.stage.en).toBe('Pre-Arrival State');
  });

  it('rejects a term missing its title and names the path', () => {
    const bad = structuredClone(raw) as unknown as { terms: Array<{ title: Record<string, unknown> }> };
    delete bad.terms[1]!.title.en;
    expect(() => parseTerms(bad)).toThrow(/terms\.1\.title\.en/);
  });

  it('rejects a body that references an unknown link', () => {
    const bad = structuredClone(raw) as typeof raw;
    (bad.terms[0]!.body.en as unknown[]).push({ linkId: 'does-not-exist' });
    expect(() => parseTerms(bad)).toThrow(/does-not-exist/);
  });

  it('rejects an http (non-TLS) URL', () => {
    const bad = structuredClone(raw) as typeof raw;
    Object.values(bad.links)[0]!.url = 'http://example.com';
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
      expect(src, f).not.toMatch(/Public Decency|Visit Saudi|disciplinary action/i);
    }
  });
});
