/** The five mandated term ids, in order. Mirrors src/lib/termsSchema.ts (a unit test keeps them identical). */
export const TERM_IDS = ['saudi-laws', 'cultural-norms', 'university-policies', 'representation', 'reporting'] as const;
export type TermId = (typeof TERM_IDS)[number];
