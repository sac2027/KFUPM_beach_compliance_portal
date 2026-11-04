import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReceiptScreen } from '../../src/features/receipt/ReceiptScreen';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { loadTerms } from '../../src/lib/terms';
import { TERM_IDS } from '../../src/lib/termsSchema';
import { termText } from '../../src/lib/termsSchema';
import type { DbService, DocumentStatus, Session } from '../../src/services/types';

const TERMS = loadTerms();
const session: Session = {
  sessionId: 's-1',
  student: { fullName: 'Mai Nguyễn', email: 'm•••@example.com', passportLast4: '4567' },
  issuedAt: '2026-11-01T10:00:00.000Z',
  expiresAt: '2026-11-01T10:30:00.000Z',
  nationality: 'VN',
  token: 't',
};
const receipt = { id: '11111111-1111-4111-8111-111111111111', referenceNumber: 'PACF-2026-K7M2QX', receivedAt: '2026-11-01T10:06:30.000Z' };
const signature = { method: 'draw' as const, dataUrl: 'data:image/png;base64,SIGNED' };

const pdfBlob = new Blob(['%PDF-1.7 test'], { type: 'application/pdf' });
function setup(opts: { upload?: () => Promise<DocumentStatus>; document?: DocumentStatus } = {}) {
  const onFinish = vi.fn();
  const onDocumentStatus = vi.fn();
  const db: DbService = {
    submitCompliance: vi.fn(),
    uploadDocument: vi.fn(opts.upload ?? (async () => ({ state: 'sent' as const, emailTo: 'm•••@example.com' }))),
    resendEmail: vi.fn(async () => ({ state: 'sent' as const, emailTo: 'm•••@example.com' })),
    downloadDocument: vi.fn(async () => pdfBlob),
  };
  const renderPdf = vi.fn(async () => pdfBlob);
  render(
    <I18nProvider>
      <ReceiptScreen
        session={session}
        acceptedTermIds={[...TERM_IDS]}
        signature={signature}
        receipt={receipt}
        document={opts.document ?? { state: 'pending' }}
        onDocumentStatus={onDocumentStatus}
        onFinish={onFinish}
        db={db}
        renderPdf={renderPdf}
      />
    </I18nProvider>,
  );
  return { onFinish, onDocumentStatus, db, renderPdf, user: userEvent.setup() };
}

afterEach(() => vi.restoreAllMocks());

describe('ReceiptScreen (on screen)', () => {
  it('confirms receipt and shows the reference number and time', () => {
    setup();
    expect(screen.getByRole('heading', { level: 2, name: 'Declaration submitted' })).toBeInTheDocument();
    const screenPart = document.querySelector('.receipt') as HTMLElement;
    expect(within(screenPart).getByText('PACF-2026-K7M2QX')).toBeInTheDocument();
    expect(within(screenPart).getByText(/1 November 2026/)).toBeInTheDocument();
  });

  it('renders the declaration to a PDF once and hands it to the server, then reports where it went', async () => {
    const { onDocumentStatus, db, renderPdf } = setup();
    await waitFor(() => expect(onDocumentStatus).toHaveBeenCalledWith({ state: 'sent', emailTo: 'm•••@example.com' }));
    expect(renderPdf).toHaveBeenCalledTimes(1);
    expect(db.uploadDocument).toHaveBeenCalledWith(session, receipt.id, pdfBlob);
  });

  it('shows the email status line for each state, with retry only on failure', () => {
    const { user } = setup({ document: { state: 'failed', emailTo: 'm•••@example.com' } });
    expect(screen.getByRole('alert')).toHaveTextContent('could not email your copy to m•••@example.com');
    expect(screen.getByRole('button', { name: 'Send the email again' })).toBeInTheDocument();
    void user;
  });

  it('retries by resending once the document is stored, or by uploading again if it never got there', async () => {
    const upload = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ state: 'sent', emailTo: 'm•••@example.com' });
    const { onDocumentStatus, db, user } = setup({ upload, document: { state: 'failed', emailTo: 'm•••@example.com' } });
    await waitFor(() => expect(onDocumentStatus).toHaveBeenCalledWith(expect.objectContaining({ state: 'failed' })));
    await user.click(screen.getByRole('button', { name: 'Send the email again' }));
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2)); // the upload itself had failed: upload again
    expect(db.resendEmail).not.toHaveBeenCalled();
  });

  it('downloads the same PDF that was uploaded', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user, onDocumentStatus } = setup();
    await waitFor(() => expect(onDocumentStatus).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    expect(createObjectURL).toHaveBeenCalledWith(pdfBlob);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('prints', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('asks before clearing (it destroys the only copy of the declaration), then clears', async () => {
    const { user, onFinish } = setup();
    await user.click(screen.getByRole('button', { name: 'Finish and clear my details' }));
    expect(onFinish).not.toHaveBeenCalled(); // one click is not enough
    expect(screen.getByRole('alert')).toHaveTextContent(/print or save it first/i);
    const confirm = screen.getByRole('button', { name: 'Yes, clear my details' });
    expect(confirm).toHaveFocus(); // keyboard users land on the decision
    await user.click(confirm);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('lets the student change their mind', async () => {
    const { user, onFinish } = setup();
    await user.click(screen.getByRole('button', { name: 'Finish and clear my details' }));
    await user.click(screen.getByRole('button', { name: 'Keep my declaration' }));
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Finish and clear my details' })).toHaveFocus();
  });

  it('marks names and reference numbers as never-to-translate', () => {
    setup();
    expect(document.querySelector('.receipt__ref')).toHaveAttribute('translate', 'no');
    expect(document.querySelector('.print-sheet [dir="auto"]')).toHaveAttribute('translate', 'no');
  });
});

describe('printable signed declaration', () => {
  const sheet = () => document.querySelector('.print-sheet') as HTMLElement;

  it('is on the page for print, with the brand letterhead and the interim seal', () => {
    setup();
    expect(sheet()).not.toBeNull();
    expect(within(sheet()).getByRole('img', { name: 'KFUPM Student Affairs' })).toHaveAttribute('src', '/brand/full-stacked.png');
    expect(within(sheet()).getByRole('img', { name: /seal/i })).toHaveAttribute('src', '/brand/seal/seal-legacy.webp');
  });

  it('contains the full title, every term in full, the closing statement', () => {
    const locale = 'en';
    setup();
    const text = sheet().textContent!.replace(/\s+/g, ' ');
    expect(text).toContain(TERMS.document.title[locale]);
    expect(text).toContain(TERMS.document.closing[locale]);
    TERMS.terms.forEach((t, i) => {
      expect(text).toContain(`${i + 1}. ${t.title[locale]}`);
      expect(text).toContain(termText(t, locale, TERMS.links).replace(/\s+/g, ' '));
    });
  });

  it('shows who signed, a masked passport, the dates, the reference and the signature image', () => {
    setup();
    const text = sheet().textContent!;
    expect(text).toContain('Mai Nguyễn');
    expect(text).toContain('••••4567');
    expect(text).not.toContain('N1234567'); // the full passport number is never printed
    expect(text).toContain('Vietnam'); // the nationality the student chose
    expect(text).toContain('PACF-2026-K7M2QX');
    expect(within(sheet()).getByRole('img', { name: /signature/i })).toHaveAttribute('src', signature.dataUrl);
  });
});
