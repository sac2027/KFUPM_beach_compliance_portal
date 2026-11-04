import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDateTime } from '../../lib/format';
import { attachmentName } from '../../lib/reference';
import type { TermId } from '../../lib/termsSchema';
import { dbService } from '../../services/dbService';
import type { DbService, DocumentStatus, Session, Signature, SubmissionReceipt } from '../../services/types';
import { EmailStatus } from './EmailStatus';
import { PrintSheet } from './PrintSheet';

/** The PDF libraries (~400 kB) load only when a student reaches the receipt, not on first paint. */
const lazyRenderPdf = async (sheet: HTMLElement) => (await import('../../lib/pdf')).renderDeclarationPdf(sheet);

export function ReceiptScreen({
  session,
  acceptedTermIds,
  signature,
  receipt,
  document,
  onDocumentStatus,
  onFinish,
  db = dbService,
  renderPdf = lazyRenderPdf,
}: {
  session: Session;
  acceptedTermIds: TermId[];
  signature: Signature;
  receipt: SubmissionReceipt;
  document: DocumentStatus;
  onDocumentStatus: (status: DocumentStatus) => void;
  onFinish: () => void;
  db?: DbService;
  renderPdf?: (sheet: HTMLElement) => Promise<Blob>;
}) {
  const { t, locale } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const finishRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);
  const started = useRef(false);
  const pdfRef = useRef<Blob | null>(null);
  const email = session.student.email;

  /** The declaration as a PDF, rendered once and kept: the emailed file, a resend and the download are the same bytes. */
  const getPdf = async (): Promise<Blob> => {
    if (pdfRef.current) return pdfRef.current;
    const sheet = sheetRef.current?.querySelector<HTMLElement>('.print-sheet');
    if (!sheet) throw new Error('declaration not on the page');
    pdfRef.current = await renderPdf(sheet);
    return pdfRef.current;
  };

  /** Render the declaration to a PDF and hand it to the server, which emails it. */
  const sendDocument = async () => {
    try {
      const pdf = await getPdf();
      const status = await db.sendDocument({ email, locale, referenceNumber: receipt.referenceNumber, submittedAt: receipt.receivedAt }, pdf);
      onDocumentStatus({ ...status, emailTo: email });
    } catch {
      onDocumentStatus({ state: 'failed', emailTo: email });
    }
  };

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; the document is sent once
    started.current = true;
    void sendDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = async () => {
    setRetrying(true);
    try {
      await sendDocument();
    } finally {
      setRetrying(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const blob = await getPdf();
      const url = URL.createObjectURL(blob);
      const a = globalThis.document.createElement('a');
      a.href = url;
      a.download = attachmentName(receipt.referenceNumber);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      /* the declaration can still be printed */
    } finally {
      setDownloading(false);
    }
  };

  // Move focus to the decision when it appears, and back to where the student was if they decline.
  useEffect(() => {
    if (confirming) {
      asked.current = true;
      confirmRef.current?.focus();
    } else if (asked.current) {
      finishRef.current?.focus();
    }
  }, [confirming]);

  return (
    <>
      <section className="receipt" aria-labelledby="receipt-heading">
        <h2 id="receipt-heading" data-step-heading tabIndex={-1}>
          {t('receipt.heading')}
        </h2>
        <p className="receipt__lead">{t('receipt.lead')}</p>
        <dl className="receipt__facts">
          <dt>{t('receipt.reference')}</dt>
          <dd className="receipt__ref" translate="no">
            {receipt.referenceNumber}
          </dd>
          <dt>{t('receipt.received')}</dt>
          <dd>{formatDateTime(receipt.receivedAt, locale)}</dd>
        </dl>
        <EmailStatus status={{ ...document, emailTo: email }} onRetry={() => void retry()} retrying={retrying} />
        <div className="receipt__actions">
          <Button type="button" busy={downloading} onClick={() => void download()}>
            <Icon name="download" />
            <span>{t('receipt.download')}</span>
          </Button>
          <Button type="button" variant="quiet" onClick={() => window.print()}>
            <Icon name="print" />
            <span>{t('receipt.print')}</span>
          </Button>
          {!confirming && (
            <button ref={finishRef} type="button" className="btn btn--quiet" onClick={() => setConfirming(true)}>
              {t('receipt.finish')}
            </button>
          )}
        </div>
        {confirming && (
          <div className="receipt__confirm">
            <p role="alert">{t('receipt.finishWarn')}</p>
            <div className="receipt__actions">
              <button ref={confirmRef} type="button" className="btn" onClick={onFinish}>
                {t('receipt.finishConfirm')}
              </button>
              <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
                {t('receipt.finishCancel')}
              </Button>
            </div>
          </div>
        )}
        <p className="receipt__privacy">{t('receipt.privacy')}</p>
      </section>
      <div ref={sheetRef}>
        <PrintSheet session={session} acceptedTermIds={acceptedTermIds} signature={signature} receipt={receipt} />
      </div>
    </>
  );
}
