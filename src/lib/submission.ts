import { TERM_IDS } from './termsSchema';
import { ServiceError } from '../services/types';
import type { SubmissionPayload } from '../services/types';

const SIGNATURE_DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

/** All five terms, in order, and a PNG or JPEG signature: the rules every submission must meet. */
export function assertValidSubmission(p: SubmissionPayload): void {
  const ids = p.acceptedTermIds;
  if (ids.length !== TERM_IDS.length || !TERM_IDS.every((id, i) => ids[i] === id)) {
    throw new ServiceError('invalid_submission', 'All five terms must be accepted, in order.');
  }
  if (!SIGNATURE_DATA_URL.test(p.signature.dataUrl)) {
    throw new ServiceError('invalid_submission', 'Signature must be a PNG or JPEG image.');
  }
}
