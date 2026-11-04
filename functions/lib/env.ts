/** Settings available to every Pages Function (declared in wrangler.jsonc; the secret in .dev.vars / the dashboard). */
export interface Env {
  EMAIL_MODE: 'log' | 'resend';
  EMAIL_FROM: string;
  EMAIL_REPLY_TO: string;
  EMAIL_BCC?: string;
  RESEND_API_KEY?: string;
  /** Sends allowed per IP per 15 minutes. Default 10; raised in .dev.vars so the browser tests are not throttled. */
  DECLARATIONS_PER_WINDOW?: string;
}

export type Handler = PagesFunction<Env>;
