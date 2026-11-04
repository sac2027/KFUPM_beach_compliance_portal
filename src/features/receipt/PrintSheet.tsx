import { useI18n } from '../../i18n/I18nProvider';
import { formatDateTime, maskPassport } from '../../lib/format';
import { countryName } from '../../data/countries';
import { loadTerms } from '../../lib/terms';
import type { Segment, TermId } from '../../lib/termsSchema';
import type { Session, Signature, SubmissionReceipt } from '../../services/types';

const TERMS = loadTerms();

function Plain({ segments }: { segments: Segment[] }) {
  const { locale } = useI18n();
  return (
    <>
      {segments.map((seg, i) => {
        if ('text' in seg) return seg.text;
        if ('strong' in seg) return <strong key={i}>{seg.strong}</strong>;
        return TERMS.links[seg.linkId]?.label[locale] ?? '';
      })}
    </>
  );
}

/**
 * The signed declaration as a formal document. Hidden on screen, the only thing shown when printing
 * or saving as PDF: letterhead (Full Stacked lockup and the Seal, which is reserved for formal
 * documents), the full terms the student confirmed, the signature, and the receipt reference.
 * The passport number is masked. It is laid out in physical units (mm, pt) so that the browser's Print and the
 * off-screen capture that makes the PDF file render the very same page: one A4 sheet for the standard wording.
 */
export function PrintSheet({
  session,
  acceptedTermIds,
  signature,
  receipt,
}: {
  session: Session;
  acceptedTermIds: TermId[];
  signature: Signature;
  receipt: SubmissionReceipt;
}) {
  const { t, locale } = useI18n();
  const doc = TERMS.document;
  const terms = TERMS.terms.filter((term) => acceptedTermIds.includes(term.id));
  return (
    <article className="print-sheet">
      <header className="print-sheet__head">
        <img className="print-sheet__logo" src="/brand/full-stacked.png" alt={t('brand.logoAlt')} width={240} height={98} />
        <img className="print-sheet__seal" src="/brand/seal/seal-legacy.webp" alt={t('print.sealAlt')} width={96} height={96} />
      </header>
      <div className="print-sheet__band" aria-hidden="true" />

      <h2 className="print-sheet__title">{doc.title[locale]}</h2>
      <dl className="print-sheet__ids">
        <div>
          <dt>{t('print.ref')}</dt>
          <dd translate="no">{doc.ref}</dd>
        </div>
        <div>
          <dt>{t('print.stage')}</dt>
          <dd>{doc.stage[locale]}</dd>
        </div>
        <div>
          <dt>{t('receipt.reference')}</dt>
          <dd translate="no">{receipt.referenceNumber}</dd>
        </div>
      </dl>

      <p>{doc.intro[locale]}</p>
      <ol className="print-sheet__terms">
        {terms.map((term, i) => (
          <li key={term.id}>
            <h3>
              {i + 1}. {term.title[locale]}
            </h3>
            <p>
              <Plain segments={term.body[locale]} />
            </p>
          </li>
        ))}
      </ol>
      <section className="print-sheet__sign">
        <p>{doc.closing[locale]}</p>
        <div className="print-sheet__signed">
          <div className="print-sheet__ink">
            <img className="print-sheet__signature" src={signature.dataUrl} alt={t('print.signature')} />
            <span className="print-sheet__line" aria-hidden="true" />
          </div>
          <dl className="print-sheet__meta">
            <dt>{t('print.signedBy')}</dt>
            <dd dir="auto" translate="no">
              {session.student.fullName}
            </dd>
            <dt>{t('print.nationality')}</dt>
            <dd translate="no">{countryName(session.nationality) ?? ''}</dd>
            <dt>{t('print.passport')}</dt>
            <dd dir="ltr" translate="no">
              {maskPassport(session.student.passportLast4)}
            </dd>
            <dt>{t('print.signedOn')}</dt>
            <dd>{formatDateTime(receipt.receivedAt, locale)}</dd>
          </dl>
        </div>
      </section>
    </article>
  );
}
