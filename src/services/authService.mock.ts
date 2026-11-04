/** Mock used by component tests: accepts any complete credentials and issues a client-side session. */
import { DEFAULT_LATENCY_MS, simulate } from './mockUtils';
import type { MockOptions } from './mockUtils';
import { ServiceError } from './types';
import type { AuthService, Credentials, Session } from './types';

export function createMockAuthService(opts: MockOptions = {}): AuthService {
  return {
    login(credentials: Credentials): Promise<Session> {
      return simulate(opts, () => {
        const blank = Object.values(credentials).some((v) => v.trim() === '');
        if (blank) throw new ServiceError('invalid_credentials', 'All fields are required.');
        const issuedAt = new Date();
        return {
          sessionId: crypto.randomUUID(),
          student: {
            fullName: credentials.fullName,
            email: credentials.email.replace(/^(.)[^@]*/, '$1•••'),
            passportLast4: credentials.passportNumber.slice(-4),
          },
          issuedAt: issuedAt.toISOString(),
          expiresAt: new Date(issuedAt.getTime() + 30 * 60 * 1000).toISOString(),
          nationality: credentials.nationality,
          token: 'mock-token',
        };
      });
    },
    logout(): Promise<void> {
      return simulate({ ...opts, failWith: undefined }, () => undefined);
    },
  };
}

export const mockAuthService: AuthService = createMockAuthService({ latencyMs: DEFAULT_LATENCY_MS });
