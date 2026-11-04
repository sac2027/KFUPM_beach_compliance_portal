import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../src/lib/contrast';
import { PAIRINGS, PALETTE, THRESHOLD } from '../../src/styles/palette';

const tokensCss = readFileSync('src/styles/tokens.css', 'utf8');

describe('contrastRatio', () => {
  it('matches known brand values', () => {
    expect(contrastRatio('#115F66', '#FFFFFF')).toBeCloseTo(7.36, 1);
    expect(contrastRatio('#009767', '#FFFFFF')).toBeCloseTo(3.73, 1);
    expect(contrastRatio('#F0BA45', '#115F66')).toBeCloseTo(4.14, 1);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });
});

describe('palette', () => {
  it('keeps tokens.css in sync with palette.ts', () => {
    for (const [name, hex] of Object.entries(PALETTE)) {
      expect(tokensCss, `--${name}`).toMatch(new RegExp(`--${name}:\\s*${hex}\\b`, 'i'));
    }
  });

  it('uses the artwork-verified brand hex values', () => {
    expect(PALETTE.turquoise).toBe('#115F66');
    expect(PALETTE.green).toBe('#009767');
    expect(PALETTE.gold).toBe('#F0BA45');
    expect(PALETTE.sand).toBe('#AA8C6D');
  });

  it('every registered pairing meets the WCAG threshold for its use', () => {
    for (const p of PAIRINGS) {
      const ratio = contrastRatio(PALETTE[p.fg], PALETTE[p.bg]);
      expect(ratio, `${p.fg} on ${p.bg} (${p.use})`).toBeGreaterThanOrEqual(THRESHOLD[p.use]);
    }
  });

  it('never registers brand Green or Gold as body text on light surfaces', () => {
    const bad = PAIRINGS.filter(
      (p) =>
        p.use === 'text' &&
        (p.fg === 'green' || p.fg === 'gold') &&
        ['white', 'beige'].includes(p.bg),
    );
    expect(bad).toEqual([]);
  });

  it('registers yellow-on-turquoise and white-on-green as large/UI only', () => {
    const find = (fg: string, bg: string) => PAIRINGS.find((p) => p.fg === fg && p.bg === bg);
    expect(find('gold', 'turquoise')?.use).not.toBe('text');
    expect(find('white', 'green')?.use).not.toBe('text');
  });
});
