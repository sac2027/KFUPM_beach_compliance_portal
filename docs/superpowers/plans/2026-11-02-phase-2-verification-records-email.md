# Phase 2 Implementation Plan: verified sign-in, records, email, redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students are admitted only when four details match the roster; every signed declaration is recorded with its PDF and emailed to the student; the portal looks like a top-tier university's official document.

**Architecture:** Cloudflare Pages serves the Vite app; Pages Functions under `functions/api/` are the API; two D1 databases (`pacf-roster`, `pacf-records`), one R2 bucket (`pacf-documents`), Resend for email with a `log` driver for local and test runs. The browser renders the declaration to a PDF after the server issues the reference, then uploads it. Everything runs locally under `wrangler pages dev` (Miniflare), which is what Playwright drives.

**Tech Stack (added):** Cloudflare Pages Functions, D1, R2, Resend HTTP API, `jose` (JWT, WebCrypto), `html-to-image`, `pdf-lib`, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-11-02-phase-2-verification-records-email-design.md`

## Global Constraints

- Phase 1 Global Constraints still apply (`docs/superpowers/plans/2026-11-01-kfupm-pre-arrival-portal.md`).
- Nothing from the request body decides where email goes or what name is printed: the roster record does.
- `records` never stores a full passport number; `passport_last4` only. Full numbers stay in `roster`.
- The generic failure for sign-in is one message for every cause (`no_match`); 429 for throttling.
- Sessions: HS256 JWT, 30 minutes, single use; secret from `SESSION_SECRET` (local dev value in `.dev.vars`, never committed).
- Phone numbers are E.164 on both sides; the form requires `+` or `00`.
- Email driver in tests and local dev is `log`; the `resend` driver is exercised by a unit test with a mocked `fetch`.
- One commit per task; `npm run verify` green before each; the full Playwright suite green before Tasks 8 and 10 are committed.

## Review Focus

1. A student who types their phone as `0501234567` → the field explains the country code is needed, before any request is made (Task 4).
2. A roster row whose email differs only in case or whitespace from what the student types → match succeeds (Task 2, Task 3).
3. The same session used twice, or a token after 30 minutes → 401 with a clear message and the student returns to sign-in without losing the terms they ticked (Task 5).
4. The PDF upload fails after the record is created → the receipt shows the reference, says the email was not sent, and offers Retry, which succeeds without a second record (Task 6).
5. `email_status = failed` (Resend error) → visible on the receipt, retryable, and recorded (Task 6).
6. Browser Back on Done → stays on Done; Back on Terms → asks to confirm leaving, since it ends the verified session (Task 7).
7. Two students with the same name in the roster → unaffected: passport is the key (Task 3).

## File Structure

```
wrangler.jsonc                       Pages config: pages_build_output_dir, d1_databases, r2_buckets, vars
.dev.vars.example                    SESSION_SECRET, EMAIL_MODE=log, EMAIL_FROM, EMAIL_REPLY_TO
functions/api/health.ts
functions/api/verify.ts
functions/api/submissions/index.ts   POST
functions/api/submissions/[id]/document.ts   PUT
functions/api/submissions/[id]/resend-email.ts   POST
functions/api/submissions/[id]/document.pdf.ts   GET (Bearer; the student's own file)
functions/lib/{env.ts,http.ts,jwt.ts,match.ts,throttle.ts,records.ts,email.ts,validate.ts}
migrations/roster/0001_students.sql
migrations/records/0001_records.sql
scripts/roster-import.ts             CSV → SQL upsert (local or remote)
scripts/data-export.ts               d1 export + R2 copy runbook helper
data/roster.sample.csv               four test students (the user's four addresses)
src/services/{authService.ts,dbService.ts}   HTTP clients (same interfaces); mocks kept in *.mock.ts
src/lib/pdf.ts                       print sheet → A4 raster PDF
src/lib/history.ts                   step ↔ location.hash, popstate
src/components/Icon.tsx              lucide wrapper (size, stroke, RTL flip for directional)
tests/functions/*.test.ts            pure-module unit tests (match, throttle, jwt, validate, email payload)
tests/e2e/*                          now against wrangler pages dev; seed via global-setup
docs/HANDOVER.md                     account membership, secrets, export runbook, Resend domain, Graph upgrade
```

---

### Task 0: Design doc and plan

- [ ] Commit `docs: phase 2 design and plan`.

### Task 1: Pages config, Functions scaffold, local emulation in tests

**Files:** `wrangler.jsonc`, `.dev.vars.example`, `.gitignore` (+`.dev.vars`, `.wrangler`), `functions/api/health.ts`, `functions/lib/env.ts`, `functions/lib/http.ts`, `playwright.config.ts`, `package.json` scripts, `.github/workflows/ci.yml`, `tests/e2e/health.spec.ts`.

**Interfaces:** `Env { ROSTER: D1Database; RECORDS: D1Database; DOCUMENTS: R2Bucket; SESSION_SECRET: string; EMAIL_MODE: 'log'|'resend'; EMAIL_FROM; EMAIL_REPLY_TO; EMAIL_BCC?; RESEND_API_KEY? }`; `json(status, body)`, `error(status, code, message)` helpers that also set the security headers.

- [ ] Write failing e2e: `GET /api/health` → 200 `{ok:true, roster:true, records:true, documents:true}` (each binding answered).
- [ ] Convert `wrangler.jsonc` to a Pages config with the three bindings (`database_id` placeholders for remote; local ids auto). Scripts: `dev:api = wrangler pages dev dist --port 8788`, `db:migrate:local`, `db:migrate:remote`, `db:seed:local`. Playwright `webServer` becomes `npm run build && npm run db:migrate:local && npm run db:seed:local && npm run dev:api`; the dev-server project keeps using Vite for `?data=worst` tests, with Vite proxying `/api` to 8788.
- [ ] CI: install wrangler, run the same.
- [ ] Verify: `npx wrangler pages dev` serves the app and `/api/health`; e2e passes; `npm run verify` green. Commit `chore: cloudflare pages functions scaffold with local D1/R2 emulation`.

### Task 2: Roster schema, normalisation, CSV import

**Files:** `migrations/roster/0001_students.sql`, `functions/lib/match.ts`, `scripts/roster-import.ts`, `data/roster.sample.csv`, `tests/functions/match.test.ts`, `tests/functions/roster-import.test.ts`.

**Interfaces (functions/lib/match.ts, pure):** `normalisePassport(s): string` (upper, alnum only), `normalisePhone(s): string|null` (`+`/`00` → E.164, else null), `normaliseEmail(s): string`, `nameKey(s): string[]` (NFKC, casefold, strip Latin diacritics, tokens), `namesMatch(a, b): boolean` (every token of the shorter appears in the longer; at least one token), `StudentRow` type.

- [ ] Failing tests: `normalisePhone('0501234567')` → null; `'00966501234567'` → `'+966501234567'`; `namesMatch('Mai Nguyễn','NGUYEN THI MAI')` true; `namesMatch('Mai Nguyen','Mai Tran')` false; importer rejects a row without `+`, duplicate passports, bad email; upsert SQL is parameterised.
- [ ] Implement; the test roster: four students with the user's four addresses, passports `TEST0001`–`TEST0004`, phones `+96650000000N`.
- [ ] Verify, commit `feat(roster): students schema, normalisation rules and CSV importer`.

### Task 3: `POST /api/verify` with throttle and session token

> As built: only *failed* attempts are counted (5 per passport, 100 per IP, 15-minute window); a success clears the passport's counter. The first version counted successes and locked out the whole test suite (and would have locked out any shared campus IP) after twenty sign-ins.

**Files:** `functions/api/verify.ts`, `functions/lib/{jwt.ts,throttle.ts,validate.ts}`, `migrations/records/0001_records.sql` (sessions, verify_attempts, outbox, submissions), `tests/functions/{jwt,throttle,verify}.test.ts`, `tests/e2e/verify-api.spec.ts`.

**Interfaces:** `signSession({sid}, secret, ttlSeconds): Promise<string>`, `verifySession(token, secret): Promise<{sid}|null>`; `checkAndCount(db, key, limit, windowSeconds): Promise<{allowed: boolean; retryAfter?: number}>`; response shape per spec.

- [ ] Failing tests: full match → 200 with masked email `e•••@gmail.com`, `passportLast4`, canonical `fullName`; each single-field mismatch → 401 `no_match`; 6th failure for one passport in 15 min → 429 with `Retry-After`; token round-trips and expires; malformed body → 400.
- [ ] Implement (IP hashed with the secret before storage; constant-time compare not needed for non-secret factors but the code path must not leak which field failed).
- [ ] Verify, commit `feat(api): verify sign-in against the roster with throttling and a session token`.

### Task 4: Email field and real `authService`

**Files:** `src/lib/validators.ts` (+`emailSchema`; phone requires `+`/`00`), `src/features/login/LoginScreen.tsx`, `src/services/authService.ts` (HTTP), `src/services/authService.mock.ts`, `src/services/types.ts` (`Credentials.email`, `expiresAt`, `token`), i18n strings, tests updated, `tests/e2e/login.spec.ts` (against real API with the seeded roster).

- [ ] Failing tests: four fields; `0501234567` → `error.phone.countryCode`; `Mai@Example.com ` normalises; a mismatch shows the one generic message with the "exactly as in your passport" hint; a match shows the roster's canonical name on the terms step; `no_match` never says which field.
- [ ] Implement; `?fail=login` keeps working through the client in DEV.
- [ ] Verify, commit `feat(login): email as a fourth factor; sign-in verifies against the roster`.

### Task 5: `POST /api/submissions` and real `dbService`

**Files:** `functions/api/submissions/index.ts`, `functions/lib/records.ts`, `src/services/dbService.ts` (HTTP), `src/services/dbService.mock.ts`, tests.

**Interfaces:** `createSubmission(env, session, payload): Promise<{id, referenceNumber, submittedAt}>`; reference `PACF-YYYY-XXXXXX` unique in D1 (retry on collision); signature stored at `submissions/<id>/signature.png` after magic-byte check and 2 MB cap; session marked used.

- [ ] Failing tests: missing/expired token → 401 `session_expired`; second use → 409; four ids → 400; SVG as signature → 400; happy path inserts a row with `passport_last4`, no full passport anywhere in `records`; R2 object exists.
- [ ] Front end: on 401 `session_expired` return to login with a message, keeping `acceptedTermIds` in memory so the terms are pre-ticked after re-verification (Review Focus 3).
- [ ] Verify, commit `feat(api): record submissions with the signature in R2`.

### Task 6: PDF in the browser, document upload, email, receipt status

> As built: the PDF libraries load lazily on the receipt (separate 430 kB chunk); the capture stage is marked `data-capture-stage`; CSP `base-uri` is `'self'` because html-to-image sets a same-origin `<base>` while embedding fonts; `?fail=document` exercises the retry path on the dev server.

**Files:** `src/lib/pdf.ts`, `functions/api/submissions/[id]/{document.ts,resend-email.ts,document.pdf.ts}`, `functions/lib/email.ts`, `src/features/receipt/ReceiptScreen.tsx`, `src/features/signature/SignatureStep.tsx` (orchestrates the two steps), i18n, `tests/functions/email.test.ts`, `tests/e2e/submission.spec.ts`.

**Interfaces:** `renderDeclarationPdf(sheet: HTMLElement): Promise<Blob>` (A4, 2× raster, sliced pages, ≤ 8 MB); `sendDeclarationEmail(env, {to, locale, student, referenceNumber, pdf: Uint8Array}): Promise<{status: 'sent'|'logged'|'failed', messageId?, error?}>`; `GET …/document.pdf` streams the student's own file (Bearer).

- [ ] Failing tests: `log` driver writes an outbox row with subject in the student's language, recipient = roster email, attachment name `KFUPM-PACF-<ref>.pdf`, sha256 and size; `resend` driver posts the right JSON (mocked `fetch`) and maps a 4xx to `failed`; PUT with a non-PDF → 400; PUT after a successful send → 409; e2e: receipt shows "Sent to e•••@gmail.com", Download gives a file whose sha256 equals the outbox row's; print still produces the vector PDF (existing test); with `?fail=document` the receipt shows the failure and Retry succeeds, one record only.
- [ ] Implement; receipt actions: Download PDF, Print, Finish (with the existing confirm), plus Retry when needed.
- [ ] Verify, commit `feat(submit): browser-rendered PDF stored in R2 and emailed to the student`.

### Task 7: Back navigation and browser history

**Files:** `src/lib/history.ts`, `src/state/flow.ts` (+`goto` with allowed transitions), `src/App.tsx`, step components (Back buttons), tests.

- [ ] Failing tests: hash reflects the step and nothing else; browser Back from sign → terms keeps ticks and ink; Back from terms → confirm dialog ("This ends your verified session"), confirming returns to login with fields cleared; Back on done → stays; forward after back works; deep-linking `#sign` without a session → login.
- [ ] Implement with `pushState({step})` on forward moves, `replaceState` on done, `popstate` → `goto` if allowed else re-push.
- [ ] Verify, commit `feat(ui): back navigation with browser history`.

### Task 8: Redesign

**Files:** `src/styles/*`, `src/components/{Masthead,Stepper,Icon,Button}.tsx`, `src/App.tsx`, `public/brand/matrix/*` (existing exports only), tests (shell, a11y, responsive updated).

- [ ] Run `design-taste-frontend` `draw.mjs --app --kind form --keep palette,type` and record the dealt sheet in `docs/design/phase-2-direction.md`.
- [ ] Remove the ref/stage/requirement block and the location line; centred KFUPM Display title with one turquoise rule; masthead = thin bar (lockup, language switch; no Matrix); background = one fixed, low-contrast beige/sand Matrix composition at the bottom-inline-end of the viewport (repositioned in RTL, never mirrored); sheet with wider margins; quiet progress line; icons via `Icon` (20 px, stroke 1.75; directional icons flip in RTL) on: sign in, continue, back, sign and submit, download, print, clear, undo, upload, language.
- [ ] Emil pass: press, hover (fine pointers only), focus, loading, success timings as in phase 1; no new motion on load.
- [ ] Gate: `inspect.mjs --app` 0 FAIL; axe 0; screenshots at 1280/768/390 in both languages reviewed and critiqued (three rounds max) per `references/critique.md`; the "AI slop" checklist: no eyebrows, no cards-with-icons, no gradients, no tracked caps, one accent.
- [ ] Verify, full e2e, commit `feat(design): official document look, icons, background Matrix`.

### Task 9: Hand-over, runbooks, docs

**Files:** `docs/HANDOVER.md`, `docs/HANDOFF.md` (rewrite §3–4), `scripts/data-export.ts`, `README.md`.

- [ ] Document: creating `pacf-roster`, `pacf-records`, `pacf-documents`; applying migrations remotely; setting `SESSION_SECRET`, `RESEND_API_KEY`, `EMAIL_*` in the Pages project; importing the roster; **ownership**: add the Deanship/IT user as Super Administrator on the Cloudflare account, transfer billing, remove yourself; export runbook (`wrangler d1 export` both DBs, R2 copy via `wrangler r2 object get` loop or rclone); Resend: verify `kfupm.edu.sa` (IT adds DNS) to send from the deanship address; Microsoft Graph alternative.
- [ ] Commit `docs: hand-over runbook for databases, bucket, secrets and account ownership`.

### Task 10: Final gate

- [ ] `break-ui` spot pass on the email field and the receipt's email line (long addresses, plus-addressing, IDN domains display).
- [ ] `npm run release:check`; full Playwright; update `docs/audit.md` and `docs/qa/break-ui.md` with phase-2 findings.
- [ ] The user runs `docs/HANDOVER.md` (option 2); the builder stays available to debug the first real send.

## Self-review

- Spec coverage: goals 1→T3/T4, 2→T2, 3→T5/T6, 4→T6, 5→T9, 6→T7/T8; constraints→T1; answers to the builder check→T1, T2, T4, T5, T6.
- Types: `Session` gains `token`, `expiresAt`, `student.passportLast4`, `student.email` (masked) in T4 and is used unchanged by T5–T7.
- Review Focus lines each name a task whose tests pin them.
