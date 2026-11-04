export interface MockOptions {
  /** Simulated network latency. Default 700 ms. */
  latencyMs?: number;
  /** If set, every call rejects with this error after the latency (for testing UI error paths). */
  failWith?: Error;
}

export const DEFAULT_LATENCY_MS = 700;

export async function simulate<T>(opts: MockOptions, run: () => T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, opts.latencyMs ?? DEFAULT_LATENCY_MS));
  if (opts.failWith) throw opts.failWith;
  return run();
}

/** Unambiguous uppercase alphabet (no 0/O, 1/I) for human-readable reference numbers. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
