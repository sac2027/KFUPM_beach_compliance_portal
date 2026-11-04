/**
 * Single source of truth for colour. `tokens.css` mirrors these values (a unit test enforces it)
 * and every text/UI pairing the app uses is registered in PAIRINGS and checked against WCAG 2.2 AA.
 * Brand values are artwork-verified (Brand Guidelines §6; the guideline's printed Yellow hex
 * `F0BA4F` is a typo — its RGB 240-186-69 and the artwork are `F0BA45`).
 */
export const PALETTE = {
  // Brand primary
  turquoise: '#115F66',
  green: '#009767',
  beige: '#ECE0C7',
  // Brand secondary
  sand: '#AA8C6D',
  gold: '#F0BA45',
  blue: '#71B8D4',
  gray: '#ADACAD',
  white: '#FFFFFF',
  ink: '#000000',
  // Brand feedback (§6.7) — borders, icons and fills only
  success: '#2AA880',
  error: '#DE5E5E',
  warning: '#F2C56C',
  info: '#89C4DB',
  // Derived for accessible text (not brand colours; see plan Global Constraints)
  'green-700': '#00704D',
  'error-text': '#B42318',
} as const;

export type ColorName = keyof typeof PALETTE;
export type Use = 'text' | 'large' | 'ui';

/** Minimum contrast per use: body text, large text (≥24px or ≥18.66px bold), UI boundaries/graphics. */
export const THRESHOLD: Record<Use, number> = { text: 4.5, large: 3, ui: 3 };

export interface Pairing {
  fg: ColorName;
  bg: ColorName;
  use: Use;
}

export const PAIRINGS: readonly Pairing[] = [
  // Body and label text
  { fg: 'ink', bg: 'white', use: 'text' },
  { fg: 'ink', bg: 'beige', use: 'text' },
  { fg: 'turquoise', bg: 'white', use: 'text' },
  { fg: 'turquoise', bg: 'beige', use: 'text' },
  { fg: 'green-700', bg: 'white', use: 'text' },
  { fg: 'green-700', bg: 'beige', use: 'text' },
  { fg: 'error-text', bg: 'white', use: 'text' },
  { fg: 'error-text', bg: 'beige', use: 'text' },
  { fg: 'white', bg: 'turquoise', use: 'text' },
  { fg: 'beige', bg: 'turquoise', use: 'text' },
  // Large text only (brand chart is looser than WCAG for these)
  { fg: 'gold', bg: 'turquoise', use: 'large' },
  { fg: 'white', bg: 'green', use: 'large' },
  // UI boundaries and graphics
  { fg: 'sand', bg: 'white', use: 'ui' }, // input borders
  { fg: 'green', bg: 'white', use: 'ui' }, // check mark, success icon
  { fg: 'error', bg: 'white', use: 'ui' }, // invalid border
  { fg: 'gold', bg: 'turquoise', use: 'ui' }, // focus ring on masthead, accent rule
  { fg: 'turquoise', bg: 'white', use: 'ui' }, // focus ring on paper, checkbox border
];
