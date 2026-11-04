import { readFileSync, readdirSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Masthead } from '../../src/components/Masthead';
import { Stepper } from '../../src/components/Stepper';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import type { Step } from '../../src/state/flow';

const ui = (node: React.ReactNode) => render(<I18nProvider>{node}</I18nProvider>);

describe('Stepper', () => {
  it('lists four steps and marks only the current one with aria-current="step"', () => {
    ui(<Stepper current="terms" />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    const current = items.filter((i) => i.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Review terms');
    expect(items.map((i) => i.getAttribute('data-state'))).toEqual(['done', 'current', 'upcoming', 'upcoming']);
  });

  it.each<[Step, string[]]>([
    ['login', ['current', 'upcoming', 'upcoming', 'upcoming']],
    ['sign', ['done', 'done', 'current', 'upcoming']],
    ['done', ['done', 'done', 'done', 'current']],
  ])('state for %s', (step, states) => {
    ui(<Stepper current={step} />);
    expect(screen.getAllByRole('listitem').map((i) => i.getAttribute('data-state'))).toEqual(states);
  });
});

describe('Masthead', () => {
  it('shows the unaltered Full Stacked negative lockup with an accessible name, and the portal title', () => {
    ui(<Masthead />);
    const logo = screen.getByRole('img', { name: /KFUPM/ });
    expect(logo).toHaveAttribute('src', '/brand/full-stacked-negative.png');
    expect(logo).toHaveAttribute('width');
    expect(logo).toHaveAttribute('height');
    expect(screen.getByText('Pre-Arrival Compliance Portal')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull(); // no language switch: the portal is English only
    expect(screen.queryByText(/Dhahran|Onboarding Portal/)).toBeNull(); // the location line is gone
  });
});

describe('stylesheets', () => {
  const dir = 'src/styles';
  const css = readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => [f, readFileSync(`${dir}/${f}`, 'utf8')] as const);

  it('uses logical properties only (no physical left/right) so RTL mirrors', () => {
    const physical = /(?:^|[\s;{])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right|text-align:\s*(?:left|right))\b/m;
    for (const [name, text] of css) {
      const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/background-position\s*:[^;]*;/g, '');
      expect(stripped, name).not.toMatch(physical);
    }
  });

  it('never mirrors or flips the Matrix (brand misuse): no negative scale or rotateY anywhere', () => {
    for (const [name, text] of css) {
      expect(text, name).not.toMatch(/scaleX\(\s*-|scale\(\s*-|rotateY|rotate3d/);
    }
  });

  it('uses the generator export unaltered as the page ground, never mirrored', () => {
    const shell = css.find(([n]) => n === 'shell.css')![1];
    expect(shell).toContain("url('/brand/matrix/matrix-beige-sand.svg')");
    expect(shell).toMatch(/background-size:\s*cover/);
    expect(shell).not.toMatch(/\[dir=['"]?rtl/); // English only: no right-to-left rules remain
    expect(shell).not.toContain('masthead__matrix'); // the Matrix left the heading
  });

  it('has no gradients and no resting shadows (house style)', () => {
    for (const [name, text] of css) {
      expect(text, name).not.toMatch(/gradient\(/);
      expect(text.replace(/\/\*[\s\S]*?\*\//g, ''), name).not.toMatch(/box-shadow\s*:(?!\s*none)/);
    }
  });
});
