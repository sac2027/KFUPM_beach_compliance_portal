import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StepPanel } from '../../src/components/StepPanel';
import type { Step } from '../../src/state/flow';

const heading = (step: Step) => (
  <h2 data-step-heading tabIndex={-1}>
    heading-{step}
  </h2>
);
const view = (step: Step) => <StepPanel step={step}>{heading(step)}</StepPanel>;
const panel = () => document.querySelector('.step') as HTMLElement;

describe('StepPanel', () => {
  it('does not steal focus or animate on first render', () => {
    render(view('login'));
    expect(screen.getByText('heading-login')).not.toHaveFocus();
    expect(panel()).not.toHaveAttribute('data-animate');
  });

  it('moves focus to the new step heading and animates when the step changes', () => {
    const { rerender } = render(view('login'));
    rerender(view('terms'));
    expect(screen.getByText('heading-terms')).toHaveFocus();
    expect(panel()).toHaveAttribute('data-animate', 'true');
    expect(panel()).toHaveAttribute('data-step', 'terms');
  });

  it('marks direction: forward when advancing, back when returning', () => {
    const { rerender } = render(view('terms'));
    rerender(view('sign'));
    expect(panel()).toHaveAttribute('data-direction', 'forward');
    rerender(view('terms'));
    expect(panel()).toHaveAttribute('data-direction', 'back');
  });

  it('keeps focus where it is when only the language/content re-renders', () => {
    const { rerender } = render(
      <>
        <button>toggle</button>
        {view('terms')}
      </>,
    );
    screen.getByText('toggle').focus();
    rerender(
      <>
        <button>toggle</button>
        {view('terms')}
      </>,
    );
    expect(screen.getByText('toggle')).toHaveFocus();
  });

  it('does not crash when a step has no heading', () => {
    const { rerender } = render(<StepPanel step="login">x</StepPanel>);
    expect(() => rerender(<StepPanel step="terms">y</StepPanel>)).not.toThrow();
  });
});

describe('motion.css', () => {
  const css = readFileSync('src/styles/motion.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  it('animates only transform and opacity, with the strong ease-out, under 300ms, never transition: all', () => {
    expect(css).not.toMatch(/transition:\s*all/);
    const props = [...css.matchAll(/transition:\s*([^;]+);/g)].flatMap((m) => m[1]!.split(',').map((p) => p.trim().split(/\s+/)[0]));
    expect(props.length).toBeGreaterThan(0);
    for (const p of props) expect(['opacity', 'transform'], p).toContain(p);
    expect(css).toContain('var(--ease-out)');
    expect(css).not.toMatch(/ease-in(?!-out)/);
    for (const [, ms] of css.matchAll(/(\d+)ms/g)) expect(Number(ms)).toBeLessThanOrEqual(300);
  });
  it('has a reduced-motion variant that drops the travel but keeps a fade', () => {
    const block = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(block).toMatch(/transition:\s*opacity/);
    expect(block).toMatch(/transform:\s*none/);
  });
});
