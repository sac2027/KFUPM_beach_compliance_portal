import { ServiceError } from './types';
import type { ServiceErrorCode } from './types';

const KNOWN: Record<string, ServiceErrorCode> = {
  no_match: 'invalid_credentials',
  too_many_attempts: 'too_many_attempts',
  session_expired: 'session_expired',
  invalid_submission: 'invalid_submission',
};

/** JSON call to the same-origin API. Network failures and 5xx become `network`; known API codes map to ServiceError codes. */
export async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof Blob) && !(init.body instanceof ArrayBuffer)) headers.set('content-type', 'application/json');
  if (init.token) headers.set('authorization', `Bearer ${init.token}`);
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new ServiceError('network', 'offline');
  }
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  let code = 'unknown';
  let message = res.statusText;
  try {
    const body = (await res.json()) as { code?: string; message?: string };
    code = body.code ?? code;
    message = body.message ?? message;
  } catch {
    /* non-JSON error body */
  }
  if (res.status >= 500) throw new ServiceError('network', message);
  throw new ServiceError(KNOWN[code] ?? 'invalid_submission', message);
}
