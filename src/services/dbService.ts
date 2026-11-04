/**
 * Submissions: POST /api/submissions records the declaration for the student the session belongs to;
 * PUT …/document stores the browser-rendered PDF and emails it; the other two read that same stored file.
 * (functions/api/submissions/*). The server re-validates everything and decides whose record it is.
 */
import { shouldFailOnce } from '../dev/worstCase';
import { api } from './http';
import { ServiceError } from './types';
import type { DbService, DocumentStatus, SubmissionPayload, SubmissionReceipt } from './types';

const status = (r: { emailStatus: DocumentStatus['state']; emailTo: string }): DocumentStatus => ({ state: r.emailStatus, emailTo: r.emailTo });

export const dbService: DbService = {
  async submitCompliance(payload: SubmissionPayload): Promise<SubmissionReceipt> {
    if (import.meta.env.DEV && shouldFailOnce('submit')) throw new ServiceError('network', 'dev: simulated outage');
    const r = await api<{ id: string; referenceNumber: string; submittedAt: string }>('/api/submissions', {
      method: 'POST',
      token: payload.session.token,
      body: JSON.stringify({ nationality: payload.session.nationality, acceptedTermIds: payload.acceptedTermIds, signature: payload.signature }),
    });
    return { id: r.id, referenceNumber: r.referenceNumber, receivedAt: r.submittedAt };
  },
  async uploadDocument(session, submissionId, pdf) {
    if (import.meta.env.DEV && shouldFailOnce('document')) throw new ServiceError('network', 'dev: simulated outage');
    return status(await api(`/api/submissions/${encodeURIComponent(submissionId)}/document`, { method: 'PUT', token: session.token, body: pdf, headers: { 'content-type': 'application/pdf' } }));
  },
  async resendEmail(session, submissionId) {
    return status(await api(`/api/submissions/${encodeURIComponent(submissionId)}/resend-email`, { method: 'POST', token: session.token }));
  },
  async downloadDocument(session, submissionId) {
    let res: Response;
    try {
      res = await fetch(`/api/submissions/${encodeURIComponent(submissionId)}/document.pdf`, { headers: { authorization: `Bearer ${session.token}` } });
    } catch {
      throw new ServiceError('network', 'offline');
    }
    if (!res.ok) throw new ServiceError(res.status === 401 ? 'session_expired' : 'network', res.statusText);
    return res.blob();
  },
};
