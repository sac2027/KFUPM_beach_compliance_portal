import raw from '../data/compliance-terms.json';
import worst from '../dev/worst-case-terms.json'; // dev only: dropped from the production bundle
import { isWorstCase } from '../dev/worstCase';
import { parseTerms } from './termsSchema';
import type { ComplianceTerms } from './termsSchema';

/** The validated, typed policy content. The only place the app reads compliance-terms.json. */
export function loadTerms(): ComplianceTerms {
  return parseTerms(import.meta.env.DEV && isWorstCase() ? worst : raw);
}
