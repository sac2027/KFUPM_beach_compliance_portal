/**
 * Contracts between the UI and the API (functions/api). The browser clients live in authService.ts and
 * dbService.ts; the mocks (*.mock.ts) exist for component tests.
 */
import type { Locale, TermId } from '../lib/termsSchema';

export type { Locale, TermId };

/** What the student types at sign-in. Only the format is checked; nothing is looked up. */
export interface Credentials {
  email: string;
  password: string;
}

/** The signed-in student. The email is the real address (memory only). The password is checked for format and then dropped. */
export interface Student {
  email: string;
}

export interface Session {
  sessionId: string;
  student: Student;
  /** ISO-8601 time of sign-in; the declaration displays this date. */
  issuedAt: string;
}

export interface AuthService {
  login(credentials: Credentials): Promise<Session>;
  logout(): Promise<void>;
}

export type SignatureMethod = 'draw' | 'upload';

export interface Signature {
  method: SignatureMethod;
  /** PNG or JPEG data URL. */
  dataUrl: string;
}

export interface SubmissionPayload {
  session: Session;
  documentRef: 'KFUPM-UBR';
  /** Must be exactly the five mandated ids, in order. */
  acceptedTermIds: TermId[];
  /** PNG or JPEG data URL. */
  signature: Signature;
  /** ISO-8601 signing time. */
  submittedAt: string;
}

export interface SubmissionReceipt {
  /** Local id for this declaration (nothing is stored on a server). */
  id: string;
  /** e.g. UBR-2026-K7M2QX */
  referenceNumber: string;
  receivedAt: string;
}

export type EmailState = 'pending' | 'sent' | 'logged' | 'failed';

/** Where the student's copy went. */
export interface DocumentStatus {
  state: EmailState;
  emailTo?: string;
  /** Why the email failed, as reported by the server (shown to help whoever runs the portal). */
  detail?: string;
}

/** What the server needs to email the declaration. The address is the one typed at sign-in. */
export interface DocumentRequest {
  email: string;
  locale: Locale;
  referenceNumber: string;
  submittedAt: string;
}

export interface DbService {
  /** Step 1: check the declaration and issue its reference number (client-side; nothing is stored). */
  submitCompliance(payload: SubmissionPayload): Promise<SubmissionReceipt>;
  /** Step 2: send the browser-rendered PDF to the server, which emails it to the student. */
  sendDocument(request: DocumentRequest, pdf: Blob): Promise<DocumentStatus>;
}

export type ServiceErrorCode = 'invalid_credentials' | 'too_many_attempts' | 'invalid_submission' | 'network';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}
