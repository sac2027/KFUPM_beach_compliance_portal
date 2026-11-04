/**
 * Sign-in: the browser sends the name, email and passport number to POST /api/verify, which checks them against the
 * roster (functions/api/verify.ts) and answers with a session for the verified student or one generic refusal.
 * Nothing typed is logged, stored or put in a URL.
 */
import { shouldFailOnce } from '../dev/worstCase';
import { api } from './http';
import { ServiceError } from './types';
import type { AuthService, Credentials, Session } from './types';

export const authService: AuthService = {
  async login(credentials: Credentials): Promise<Session> {
    if (import.meta.env.DEV && shouldFailOnce('login')) throw new ServiceError('network', 'dev: simulated outage');
    const { nationality, ...checked } = credentials; // the nationality is not part of the check
    const { session, token } = await api<{ session: Omit<Session, 'token' | 'nationality'>; token: string }>('/api/verify', {
      method: 'POST',
      body: JSON.stringify(checked),
    });
    return { ...session, nationality, token };
  },
  async logout(): Promise<void> {
    // Sessions are single-use and expire on the server; there is nothing to revoke from the browser.
  },
};
