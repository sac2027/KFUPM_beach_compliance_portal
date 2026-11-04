# Phase 2 design: verified sign-in, records, email, and the redesign

## Intent

Phase 1 is a polished form with mock services. Phase 2 makes it a real system: a student is admitted only if their
details match KFUPM's roster, every signed declaration is kept as a record with its PDF, the student receives the PDF by
email, and the look is raised from "good form" to the standard of a top-tier university's official portal. The whole
system stays on Cloudflare (the user's choice, approach A), so that handing it to the Deanship or IT is a matter of
account membership, not migration.

## Goals

1. Sign-in requires **passport number, phone number, full name and email** and succeeds only when all four match one
   roster record. Mismatches get one generic message and are rate-limited.
2. A **roster database** (D1) stands in for KFUPM's student system, with a CSV import script staff can run.
3. A **records database** (D1) plus a **documents bucket** (R2) hold every submission: the verified student's details,
   the accepted terms, the signature image, the generated PDF, timestamps, and the email delivery status.
4. On completion the student gets an **email with the PDF attached** from the deanship address (for now
   `eyadsalem139@gmail.com` via Resend; the KFUPM domain later, when IT authorises it).
5. **Ownership can be handed over**: the Cloudflare account is the unit of ownership. Runbook: add the Deanship/IT user
   as a Super Administrator, later remove yourself; plus an export script (`d1 export` + R2 copy) for a full data move.
6. UI changes: remove the ref/stage/requirement block; the title becomes a real, centred title and the location line goes;
   the Matrix leaves the masthead; the page background gets one large faint Matrix composition; Back on every step except
   Done (and the browser Back button works); icons on actions; a full anti-template design pass.

## Non-goals

Real SSO (sign-in stays a verification form against the roster); an admin web UI (the Cloudflare dashboard's D1 and R2
browsers, plus CSV export, are the admin tools for now); SMS; multiple signatures; editing a submitted declaration.

## Anti-goals

Any student data in URLs, browser storage or logs. Email that can be spoofed from the browser (the server decides the
recipient from the roster record, never from the request). A roster endpoint that lets someone enumerate students.
Decoration for its own sake: the redesign must read as an official document, not a landing page.

## Constraints

- Cloudflare Pages (already deployed by the user) with **Pages Functions** for the API; D1 for both databases; R2 for
  files; Resend for email. Everything runs locally with `wrangler pages dev` (Miniflare), so tests need no Cloudflare
  account.
- Resend without a verified domain sends only from `onboarding@resend.dev` to the Resend account's own address. Local
  and test runs use `EMAIL_MODE=log`, which writes the email (including the attachment's size and hash) to an `outbox`
  table instead of sending, so end-to-end tests can assert on it.
- The PDF is generated **in the browser** from the exact declaration the student sees (so Arabic shapes correctly), as a
  raster A4 PDF (`html-to-image` → `pdf-lib`), after the server has issued the reference number, and uploaded as a
  second step. The structured record is the source of truth; the PDF is the student's copy. Upgrade path recorded:
  Cloudflare Browser Rendering can produce a vector PDF server-side on the Workers paid plan.
- All phase-1 rules stand (CSS logical properties, brand assets unaltered, fonts, WCAG AA, no PII in storage).

## Approaches considered

- **A. All Cloudflare (chosen):** Pages Functions + D1 + R2 + Resend. One vendor, one account to hand over, free at this
  scale, local emulation for tests. Weakness: no built-in "transfer project"; handled by account membership and an export
  runbook.
- **B. Supabase + Cloudflare:** built-in project transfer and a staff-friendly table editor, but a second vendor and a
  second set of credentials to hand over. Not chosen by the user.
- **C. Google Sheets + Apps Script:** trivially transferable, but not a credible institutional record store.

## How it works

### Data

`roster` (D1 `pacf-roster`): `students(passport_number PK, full_name, phone_e164, email, nationality, program,
intake_term, status, created_at)`. KFUPM has no student ID or university email for a student before arrival, so the
passport number is the key and `email` is the student's own address, which is where the PDF is sent. Import: `npm run roster:import -- path.csv` (validates, normalises passport to
upper-case alphanumerics, phone to E.164, email to lower-case; upserts by passport). A test roster of four students is
checked in (`data/roster.sample.csv`), using the four addresses the user supplied, so test emails reach real inboxes.

`records` (D1 `pacf-records`): `submissions(id PK, reference_number UNIQUE, full_name, passport_last4,
email, phone_e164, locale, accepted_term_ids JSON, signature_method, signature_key, pdf_key, pdf_sha256, submitted_at,
document_received_at, email_status ('pending'|'sent'|'failed'|'logged'), email_message_id, email_error, user_agent)`,
`sessions(sid PK, passport_number, issued_at, expires_at, used_at)`, `verify_attempts(key, window_start, count)`, `outbox`
(log-mode emails). Full passport numbers are never stored in `records`: the roster has them; the record keeps the last four.

`documents` (R2 `pacf-documents`): `submissions/<id>/declaration.pdf`, `submissions/<id>/signature.png`.

### API (Pages Functions under `functions/api/`)

- `POST /api/verify` `{passportNumber, phoneNumber, fullName, email}` → 200 `{session: {sessionId, student: {fullName,
  email(masked), passportLast4}, issuedAt, expiresAt}, token}` or 401 `{code: 'no_match'}` (same message for
  every kind of mismatch) or 429. Matching: passport exact after normalisation (the key); email and phone exact after
  normalisation; name compared after NFKC, case-folding and whitespace collapsing. Throttle: 5 failures per passport and
  20 per IP hash per 15 minutes. The token is an HS256 JWT (WebCrypto, `SESSION_SECRET`), 30 minutes, bound to the sid (the sid, not the passport, is in the token).
- `POST /api/submissions` (Bearer token) `{locale, acceptedTermIds, signature: {method, dataUrl}}` → validates (five ids in
  order, PNG/JPEG magic bytes, ≤ 2 MB), stores the signature in R2, inserts the record with `email_status='pending'`,
  marks the session used → 201 `{id, referenceNumber, submittedAt}`. A second call with the same session is rejected.
- `PUT /api/submissions/:id/document` (Bearer token, `application/pdf` body ≤ 8 MB, `%PDF` magic) → stores the PDF,
  sends the email (or logs it), updates `email_status` → 200 `{emailStatus, emailTo(masked)}`.
- `POST /api/submissions/:id/resend-email` (Bearer token) → retries a failed send once.
- Every response carries the phase-1 security headers; CSP `connect-src 'self'` is enough because the API is same-origin.

### Email

`functions/lib/email.ts` exposes `sendDeclarationEmail({to, locale, student, referenceNumber, pdf})` with two drivers:
`resend` (HTTP API, attachment base64) and `log` (outbox table). Subject and body in the student's language; from
`EMAIL_FROM` (`eyadsalem139@gmail.com` cannot be the sender until a domain is verified in Resend, so the default is
`onboarding@resend.dev` with `reply_to = EMAIL_REPLY_TO`); BCC `EMAIL_BCC` if set (a deanship mailbox). Upgrade path:
Microsoft Graph `sendMail` from a deanship mailbox once IT grants an app registration.

### Front end

- Login gains Email (validated, lower-cased, `autocomplete="email"`, `dir="ltr"`). The session's canonical name from
  the roster is what the declaration and PDF show (not what was typed).
- Flow: `login → terms → sign → done`. Back: terms → login ("Change my details", ends the session), sign → terms. The
  URL hash carries the step name only (`#terms`); `popstate` moves back when allowed and is a no-op on Done. Reload
  returns to login (nothing is persisted, by design, and the leave-warning stays).
- Submission: `dbService.submitCompliance` → POST; then the print sheet is rendered to a PDF in the browser
  (`html-to-image` at 2×, sliced into A4 pages with `pdf-lib`) and PUT; the receipt shows the reference, the email status
  ("Sent to e•••@gmail.com", or a retry button), **Download PDF** (the same file) and **Print**.
- Icons: `lucide-react`, 20 px, 1.75 stroke, on primary and secondary actions only (sign in, continue, sign and submit,
  download, print, back, clear, undo, upload, language). Directional icons flip in RTL via CSS; brand artwork never does.

### Redesign direction

Operate-mode surface (the student is doing a task), so restraint is the expression. The page is a document on a desk:
beige ground with **one** large Matrix composition (beige/sand export, cropped, low contrast) anchored to the
bottom-inline-end corner of the viewport and fixed, the white sheet over it with generous margins and a single turquoise
rule under a centred KFUPM Display title; the masthead is a thin bar (lockup, language switch); steps are a quiet
numbered progress line; the receipt reads like a stamped acknowledgement. The taste skill's app-screen run deals the
exact type scale and spacing; the Emil skill governs every interaction's timing. Each round is judged from screenshots.

## Decided by the user

Approach A; the user runs the Cloudflare setup from a written walkthrough (no credentials shared with the builder);
the test roster uses the user's four addresses; icons on actions; remove the ref/stage block and the
location line; Back where it makes sense; a top-tier official look.

## Decisions I made (say so if any is wrong)

- Roster match is all four fields; name compared loosely, the other three exactly after normalisation.
- Email is sent to the **roster** email, never to the typed one (the typed one is only a verification factor).
- PDF generated client-side as described; raster, A4, ≤ 8 MB.
- Sessions expire after 30 minutes and are single-use.
- `lucide-react` for icons; Radix Tabs stays; no other UI library.
- Rate limits and sizes as stated above.

## Answers to the builder check

1. **Pages, not a Worker.** The user deployed through Cloudflare Pages (Git integration, build `npm run build`, output
   `dist`). The repo's Workers-assets config is replaced by a Pages config (`pages_build_output_dir`), the API lives in
   `functions/`, local dev and tests use `wrangler pages dev`, and `_headers` keeps working (Pages honours it).
2. **Who deploys** is the one open question for the user (below). The plan is written so that everything is green under
   local emulation and a runbook creates the databases, bucket and secrets; if the user supplies a scoped Cloudflare API
   token and a Resend key, the builder runs the runbook and sends one real test email.
3. **Phone must include the country code.** International students have numbers from many countries, so no default
   region is safe. The form requires a leading `+` (or `00`, converted) and shows an example; the importer rejects roster
   rows without one. Both sides are stored as E.164.
4. **Name is a required factor, compared loosely.** The roster holds the name as printed in the passport (Latin, as on the
   MRZ), the form already says "as written in your passport". Comparison: NFKC, case-fold, strip Latin diacritics,
   collapse spaces, then every token of the shorter name must appear in the longer one (order-free, so "Mai Nguyễn" and
   "NGUYEN THI MAI" match). A student whose other three factors match but whose name does not still gets the generic
   message; the message tells them to type the name exactly as in the passport.
5. **Mocks stay for unit tests; the API is the real seam.** `authService` and `dbService` become thin HTTP clients
   (same interfaces); `createMock*` remain for component tests. Playwright runs against `wrangler pages dev` with local
   D1/R2, seeded from the sample roster. The dev-only `?data=worst` and `?fail=` hooks keep working in the HTTP clients.
6. **Print stays vector; Download is the stored file.** Print uses `window.print()` and the print stylesheet (vector,
   text-extractable, what the PDF test checks). Download returns the raster PDF that was stored and emailed, so the student,
   the record and the email hold the identical file. Two renderings of one declaration, both from the same print sheet.

## Left to the builder

Exact copy of the email, column widths, SQL indexes, how the CSV importer reports bad rows, the look of the receipt's
email-status line, the exact crop of the background Matrix.
