/** Mock used by component tests: validates like the server and returns a receipt. Nothing is stored. */
import { TERM_IDS } from '../lib/termsSchema';
import { DEFAULT_LATENCY_MS, randomCode, simulate } from './mockUtils';
import type { MockOptions } from './mockUtils';
import { ServiceError } from './types';
import type { DbService, SubmissionPayload, SubmissionReceipt } from './types';

const SIGNATURE_DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

function assertValid(p: SubmissionPayload): void {
  const ids = p.acceptedTermIds;
  if (ids.length !== TERM_IDS.length || !TERM_IDS.every((id, i) => ids[i] === id)) {
    throw new ServiceError('invalid_submission', 'All five terms must be accepted, in order.');
  }
  if (!SIGNATURE_DATA_URL.test(p.signature.dataUrl)) {
    throw new ServiceError('invalid_submission', 'Signature must be a PNG or JPEG image.');
  }
}

export function createMockDbService(opts: MockOptions = {}): DbService {
  return {
    submitCompliance(payload: SubmissionPayload): Promise<SubmissionReceipt> {
      return simulate(opts, () => {
        assertValid(payload);
        const receivedAt = new Date().toISOString();
        return { id: crypto.randomUUID(), referenceNumber: `PACF-${receivedAt.slice(0, 4)}-${randomCode(6)}`, receivedAt };
      });
    },
    uploadDocument(_session, _id, pdf) {
      return simulate(opts, () => {
        if (pdf.size === 0) throw new ServiceError('invalid_submission', 'empty');
        return { state: 'logged' as const, emailTo: 'e•••@example.com' };
      });
    },
    resendEmail() {
      return simulate(opts, () => ({ state: 'logged' as const, emailTo: 'e•••@example.com' }));
    },
    downloadDocument() {
      return simulate(opts, () => new Blob(['%PDF-1.7 mock'], { type: 'application/pdf' }));
    },
  };
}

export const mockDbService: DbService = createMockDbService({ latencyMs: DEFAULT_LATENCY_MS });
