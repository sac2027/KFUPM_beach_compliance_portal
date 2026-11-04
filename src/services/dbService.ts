/**
 * Declarations: nothing is stored. `submitCompliance` checks the declaration and issues its reference number in the
 * browser; `sendDocument` posts the rendered PDF to POST /api/declarations, which emails it to the address typed at sign-in
 * (functions/api/declarations.ts).
 */
import { shouldFailOnce } from '../dev/worstCase';
import { generateReference, attachmentName } from '../lib/reference';
import { assertValidSubmission } from '../lib/submission';
import { api } from './http';
import { ServiceError } from './types';
import type { DbService, DocumentStatus, SubmissionPayload, SubmissionReceipt } from './types';

export const dbService: DbService = {
  async submitCompliance(payload: SubmissionPayload): Promise<SubmissionReceipt> {
    if (import.meta.env.DEV && shouldFailOnce('submit')) throw new ServiceError('network', 'dev: simulated outage');
    assertValidSubmission(payload);
    return { id: crypto.randomUUID(), referenceNumber: generateReference(), receivedAt: new Date().toISOString() };
  },
  async sendDocument(request, pdf): Promise<DocumentStatus> {
    if (import.meta.env.DEV && shouldFailOnce('document')) throw new ServiceError('network', 'dev: simulated outage');
    const form = new FormData();
    form.set('email', request.email);
    form.set('locale', request.locale);
    form.set('referenceNumber', request.referenceNumber);
    form.set('submittedAt', request.submittedAt);
    form.set('pdf', new File([pdf], attachmentName(request.referenceNumber), { type: 'application/pdf' }));
    const r = await api<{ emailStatus: DocumentStatus['state']; emailTo: string }>('/api/declarations', { method: 'POST', body: form });
    return { state: r.emailStatus, emailTo: r.emailTo };
  },
};
