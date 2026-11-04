/** JSON responses with the same hardening headers the static pages get, so API responses never fall back to defaults. */
const SECURITY_HEADERS: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
};

export function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...SECURITY_HEADERS, ...extra } });
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function error(status: number, code: string, message: string, extra: Record<string, string> = {}): Response {
  return json(status, { code, message }, extra);
}

/** Wraps a handler so thrown HttpErrors become responses and anything else is a 500 without details. */
export function handle<E>(fn: PagesFunction<E>): PagesFunction<E> {
  return async (ctx) => {
    try {
      return await fn(ctx);
    } catch (err) {
      if (err instanceof HttpError) return error(err.status, err.code, err.message, err.extra);
      console.error('unhandled', err instanceof Error ? err.message : String(err)); // message only, never a request body
      return error(500, 'internal', 'Something went wrong on our side. Please try again.');
    }
  };
}

export async function readJson<T>(request: Request, maxBytes = 64 * 1024): Promise<T> {
  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new HttpError(413, 'too_large', 'Request too large.');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large', 'Request too large.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'bad_json', 'Request body must be JSON.');
  }
}
