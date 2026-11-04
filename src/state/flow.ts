import { TERM_IDS } from '../lib/termsSchema';
import type { TermId } from '../lib/termsSchema';
import type { DocumentStatus, Session, Signature, SubmissionReceipt } from '../services/types';

export type Step = 'login' | 'terms' | 'sign' | 'done';
export const STEPS: readonly Step[] = ['login', 'terms', 'sign', 'done'];

/** Held in memory only: it carries PII (the session) and is never persisted. */
export interface FlowState {
  step: Step;
  session: Session | null;
  acceptedTermIds: TermId[];
  receipt: SubmissionReceipt | null;
  /** Kept (in memory) after submission only so the printable declaration can show it. */
  signature: Signature | null;
  /** Where the PDF copy went (set by the document upload after the receipt step opens). */
  document: DocumentStatus | null;
  /** Why the student is back at sign-in, if they have been further. */
  loginNotice: 'expired' | 'changed' | null;
}

export type FlowAction =
  | { type: 'loggedIn'; session: Session }
  | { type: 'termsAccepted'; ids: TermId[] }
  | { type: 'back' }
  | { type: 'submitted'; receipt: SubmissionReceipt; signature: Signature }
  | { type: 'sessionExpired' }
  | { type: 'documentStatus'; status: DocumentStatus }
  | { type: 'goto'; step: Step }
  | { type: 'termsProgress'; ids: TermId[] }
  | { type: 'reset' };

export const initialFlowState: FlowState = { step: 'login', session: null, acceptedTermIds: [], receipt: null, signature: null, document: null, loginNotice: null };

const isAllFiveInOrder = (ids: TermId[]) => ids.length === TERM_IDS.length && TERM_IDS.every((id, i) => ids[i] === id);

/** Invalid transitions return the *same* state object, so React skips the re-render. */
export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'loggedIn':
      return state.step === 'login' ? { ...state, step: 'terms', session: action.session, loginNotice: null } : state;
    case 'termsAccepted':
      return state.step === 'terms' && state.session && isAllFiveInOrder(action.ids)
        ? { ...state, step: 'sign', acceptedTermIds: [...action.ids] }
        : state;
    case 'back':
      return state.step === 'sign' ? { ...state, step: 'terms' } : state;
    case 'submitted':
      return state.step === 'sign' && state.session && isAllFiveInOrder(state.acceptedTermIds)
        ? { ...state, step: 'done', receipt: action.receipt, signature: action.signature, document: { state: 'pending' } }
        : state;
    case 'termsProgress':
      // Ticks are kept here (not only in the step) so Back, an expired session or a change of details never lose them.
      return state.step === 'terms' ? { ...state, acceptedTermIds: TERM_IDS.filter((id) => action.ids.includes(id)) } : state;
    case 'goto':
      // sign → terms keeps everything; terms → sign only while all five are still confirmed (the browser's Forward);
      // terms → login ends the verified session but keeps the ticks.
      if (action.step === 'terms' && state.step === 'sign') return { ...state, step: 'terms' };
      if (action.step === 'sign' && state.step === 'terms' && state.session && isAllFiveInOrder(state.acceptedTermIds)) return { ...state, step: 'sign' };
      if (action.step === 'login' && state.step === 'terms') return { ...state, step: 'login', session: null, loginNotice: 'changed' };
      return state;
    case 'documentStatus':
      return state.step === 'done' ? { ...state, document: action.status } : state;
    case 'sessionExpired':
      // Back to sign-in, keeping what the student already confirmed so the terms come back pre-ticked.
      return state.step === 'terms' || state.step === 'sign' ? { ...state, step: 'login', session: null, loginNotice: 'expired' } : state;
    case 'reset':
      return initialFlowState;
  }
}
