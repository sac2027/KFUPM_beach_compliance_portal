import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TermCard } from '../../src/features/terms/TermCard';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import type { ComplianceTerms, Term } from '../../src/lib/termsSchema';

const links: ComplianceTerms['links'] = {
  doc: { url: 'https://example.org/doc.pdf', label: { en: 'The document', ar: 'المستند' }, status: 'verified' },
};
const term: Term = {
  id: 'dress-code',
  title: { en: 'Title', ar: 'العنوان' },
  body: { en: [{ text: 'Read the ' }, { strong: 'rules' }, { text: ' (' }, { linkId: 'doc' }, { text: ').' }], ar: [{ text: 'نص' }] },
  points: { en: [[{ text: 'First point' }], [{ text: 'Second ' }, { linkId: 'doc' }]], ar: [[{ text: 'أول' }], [{ text: 'ثان' }]] },
};

describe('TermCard', () => {
  it('renders links as safe new-tab links, bold segments as <strong>, and points as list items', () => {
    render(
      <I18nProvider>
        <ol>
          <TermCard term={term} index={0} links={links} checked={false} onChange={() => {}} />
        </ol>
      </I18nProvider>,
    );
    const body = document.getElementById('term-dress-code-body')!;
    expect(within(body).getByText('rules', { selector: 'strong' })).toBeInTheDocument();
    const anchors = within(body).getAllByRole('link');
    expect(anchors).toHaveLength(2);
    for (const a of anchors) {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a).toHaveAttribute('rel', 'noopener noreferrer');
      expect(a).toHaveAttribute('href', 'https://example.org/doc.pdf');
    }
    const points = within(body).getAllByRole('listitem');
    expect(points.map((p) => p.textContent?.replace(/\s*\(.*\)$/, ''))).toEqual(['First point', 'Second The document']);
    expect(screen.getByRole('checkbox')).toHaveAccessibleName('1. Title');
  });
});
