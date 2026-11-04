/** Bindings and settings available to every Pages Function (declared in wrangler.jsonc; secrets in .dev.vars / the dashboard). */
export interface Env {
  ROSTER: D1Database;
  RECORDS: D1Database;
  DOCUMENTS: R2Bucket;
  SESSION_SECRET: string;
  EMAIL_MODE: 'log' | 'resend';
  EMAIL_FROM: string;
  EMAIL_REPLY_TO: string;
  EMAIL_BCC?: string;
  RESEND_API_KEY?: string;
}

export type Handler = PagesFunction<Env>;
