import { useI18n } from '../../i18n/I18nProvider';
import type { ComplianceTerms, Segment, Term } from '../../lib/termsSchema';

function Body({ segments, links }: { segments: Segment[]; links: ComplianceTerms['links'] }) {
  const { locale, t } = useI18n();
  return (
    <>
      {segments.map((seg, i) => {
        if ('text' in seg) return seg.text;
        if ('strong' in seg) return <strong key={i}>{seg.strong}</strong>;
        const link = links[seg.linkId];
        if (!link) return null;
        return (
          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer">
            {link.label[locale]}
            <span className="sr-only"> ({t('a11y.newTab')})</span>
          </a>
        );
      })}
    </>
  );
}

/**
 * One term. The whole card is the click target (the label's ::after stretches over it) while the links
 * inside sit above that overlay. The native checkbox stays in the DOM for keyboard and screen readers:
 * its name is the term title, its description is the full term text.
 */
export function TermCard({
  term,
  index,
  links,
  checked,
  onChange,
}: {
  term: Term;
  index: number;
  links: ComplianceTerms['links'];
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { locale } = useI18n();
  const id = `term-${term.id}`;
  return (
    <li className="term" data-checked={checked ? 'true' : 'false'}>
      <input
        id={id}
        className="term__input"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
      />
      <span className="term__box" aria-hidden="true">
        <svg className="term__check" viewBox="0 0 24 24" width="20" height="20" focusable="false">
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
        </svg>
      </span>
      <div className="term__text">
        <h3 className="term__title">
          <label id={`${id}-title`} htmlFor={id}>
            {index + 1}. {term.title[locale]}
          </label>
        </h3>
        <p className="term__body" id={`${id}-body`}>
          <Body segments={term.body[locale]} links={links} />
        </p>
      </div>
    </li>
  );
}
