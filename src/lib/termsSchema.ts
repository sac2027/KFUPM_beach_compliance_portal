/* Pure schema: no JSON import, so scripts/validate-terms.ts can run it under plain Node. */
import * as v from 'valibot';

export const TERM_IDS = ['dress-code', 'cleanliness', 'respect-privacy', 'beach-regulations', 'swimming-safety'] as const;
export type TermId = (typeof TERM_IDS)[number];
export type Locale = 'en' | 'ar';

const text = v.pipe(v.string(), v.trim(), v.minLength(1, 'must not be empty'));
const bilingual = v.object({ en: text, ar: text });

/** A body is a list of segments so staff can edit wording and links without touching markup. */
const segment = v.union([
  v.strictObject({ text: v.string() }),
  v.strictObject({ strong: text }),
  v.strictObject({ linkId: text }),
]);
const segments = v.pipe(v.array(segment), v.minLength(1, 'must have at least one segment'));
const body = v.object({ en: segments, ar: segments });
/** Bullet points under a term's lead sentence. Same number in both languages, so the two read as one list. */
const points = v.object({ en: v.array(segments), ar: v.array(segments) });

const link = v.object({
  url: v.pipe(v.string(), v.url(), v.startsWith('https://', 'URL must start with https://')),
  label: bilingual,
  status: v.picklist(['verified', 'unverified', 'placeholder']),
  note: v.optional(v.string()),
});

const review = v.picklist(['approved', 'needs-review']);

const termsSchema = v.pipe(
  v.object({
    meta: v.object({ source: v.string(), reviewStatus: v.object({ en: review, ar: review }) }),
    document: v.object({ ref: text, scope: bilingual, title: bilingual, intro: bilingual, closing: bilingual }),
    links: v.record(v.string(), link),
    terms: v.pipe(
      v.array(v.object({ id: v.picklist(TERM_IDS), title: bilingual, body, points: v.optional(points) })),
      v.length(TERM_IDS.length, `must contain exactly ${TERM_IDS.length} terms`),
    ),
  }),
  v.rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed) return;
    const { terms, links } = dataset.value;
    terms.forEach((t, i) => {
      if (t.id !== TERM_IDS[i]) addIssue({ message: `terms.${i}.id must be "${TERM_IDS[i]}" (got "${t.id}")` });
      if (t.points && t.points.en.length !== t.points.ar.length) {
        addIssue({ message: `terms.${i}.points must have the same number of points in en (${t.points.en.length}) and ar (${t.points.ar.length})` });
      }
      for (const loc of ['en', 'ar'] as const) {
        const all = [...t.body[loc], ...(t.points?.[loc].flat() ?? [])];
        for (const seg of all) {
          if ('linkId' in seg && !(seg.linkId in links)) {
            addIssue({ message: `terms.${i}.${loc} references unknown link "${seg.linkId}"` });
          }
        }
      }
    });
  }),
);

export type ComplianceTerms = v.InferOutput<typeof termsSchema>;
export type Term = ComplianceTerms['terms'][number];
export type Segment = v.InferOutput<typeof segment>;

/**
 * Validates untrusted JSON; throws one error listing the problems with their dotted paths.
 * Structural errors are reported first; cross-reference checks (unknown linkId, term order) only
 * run once the structure is valid, so fixing one round of errors may reveal another.
 */
export function parseTerms(input: unknown): ComplianceTerms {
  const result = v.safeParse(termsSchema, input);
  if (result.success) return result.output;
  const lines = result.issues.map((i) => {
    const path = i.path?.map((p) => String(p.key)).join('.') ?? '(root)';
    return `${path}: ${i.message}`;
  });
  throw new Error(`compliance-terms.json is invalid:\n${lines.join('\n')}`);
}

/** Plain-text rendering of a term: the lead sentence, then each point, joined by single spaces (tests, screen-reader summaries). */
export function termText(term: Term, locale: Locale, links: ComplianceTerms['links']): string {
  const plain = (segs: Segment[]) => segs.map((s) => ('text' in s ? s.text : 'strong' in s ? s.strong : (links[s.linkId]?.label[locale] ?? ''))).join('');
  return [plain(term.body[locale]), ...(term.points?.[locale] ?? []).map(plain)].join(' ');
}
