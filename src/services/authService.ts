/**
 * Sign-in is client-side: any correctly formatted email and passport number is accepted, and nothing is looked up or sent.
 * The email is kept in memory so the signed declaration can be mailed to it. Nothing typed is logged, stored or put in a URL.
 */
import * as v from 'valibot';
import { shouldFailOnce } from '../dev/worstCase';
import { loginSchema } from '../lib/validators';
import { ServiceError } from './types';
import type { AuthService, Credentials, Session } from './types';

export const authService: AuthService = {
  async login(credentials: Credentials): Promise<Session> {
    if (import.meta.env.DEV && shouldFailOnce('login')) throw new ServiceError('network', 'dev: simulated outage');
    const parsed = v.safeParse(loginSchema, credentials);
    if (!parsed.success) throw new ServiceError('invalid_credentials', 'Enter a valid email address and passport number.');
    const { email, passportNumber } = parsed.output;
    return { sessionId: crypto.randomUUID(), student: { email, passportLast4: passportNumber.slice(-4) }, issuedAt: new Date().toISOString() };
  },
  async logout(): Promise<void> {
    // Nothing is held outside the browser's memory.
  },
};
