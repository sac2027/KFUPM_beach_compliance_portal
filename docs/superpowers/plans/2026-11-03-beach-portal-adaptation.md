# KFUPM University Beach Compliance Portal — Adaptation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the imported Pre-Arrival Compliance Portal into the bilingual (EN LTR / AR RTL) *University and University Beach Regulations & Procedures* portal: no database or bucket, client-side sign-in (full name, email, phone, passport), the signed declaration emailed through Resend as a PDF, the five beach terms, and a new "shoreline" ground in place of the Matrix.

**Architecture:** The same Vite + React + TypeScript SPA. Everything a student types stays in browser memory. Sign-in validates format only (`authService`). After signing, the browser renders the declaration to an A4 PDF (unchanged `src/lib/pdf.ts`) and posts it, with the student's name and email, to one stateless Pages Function, `POST /api/declarations`, which validates, throttles and sends it through Resend (`functions/lib/email.ts`, kept), copying a deanship mailbox. Nothing is stored server-side: the BCC mailbox is the record.

**Tech Stack:** Unchanged (Vite, React 19, TypeScript strict, valibot, react-hook-form, signature_pad, html-to-image + pdf-lib, Vitest, Playwright, Cloudflare Pages + Pages Functions, Resend). Removed: `jose`, D1, R2, wrangler migrations.

**Spec:** `docs/superpowers/specs/2026-11-03-beach-portal-design.md` (design decisions and the background concept). Source codebase: `sac2027/KFUPM-Pre-Arrival-Compliance-Portal` at `c6619bf`. Architecture map of that codebase: `docs/architecture/` (graphify, regenerated in Task 9).

## Global Constraints

Every task's requirements include these. The first block is carried over from the Pre-Arrival portal's rules (`CLAUDE.md`); the second is this project's brief.

- All policy text and external URLs live only in `src/data/compliance-terms.json`; no policy string or URL in a `.tsx` file (a test walks `src/`).
- UI talks to I/O only through `src/services/authService.ts` and `src/services/dbService.ts` (the IT hand-off seams; the file names stay even though no database remains).
- CSS logical properties only; no `left`/`right` in component CSS. Animate `transform`/`opacity` only; honour `prefers-reduced-motion`. No gradients, no resting shadows (house style, pinned by `tests/unit/shell.test.tsx`).
- PII (passport, phone, email, name, signature) is memory-only: never in URLs, storage, `console.*`, or server logs. The server never logs a request body.
- Brand: Full Stacked lockup unaltered (negative on turquoise, colour on light); Seal on the print view only; headlines KFUPM Display, body and all typed text IBM Plex Sans Arabic, fallback Segoe UI / system-ui; KFUPM Display is ASCII-only and never renders user text; green `#009767` is never body text; WCAG 4.5:1 wins over the brand chart. Brand colours verbatim: Turquoise `#115F66`, Green `#009767`, Beige `#ECE0C7`, Sand `#AA8C6D`, Gold `#F0BA45`, Blue `#71B8D4`, Gray `#ADACAD`.
- The FAST Matrix is **removed entirely** (files, CSS, print band, tests) and must not come back in any form.
- Bilingual: `lang`/`dir` switch EN↔AR, every UI string in both `en.json` and `ar.json` (identical key sets), every policy string in `{ en, ar }`. RTL is mirrored by logical CSS; directional icons are swapped, never transformed. Zero horizontal scroll from 320 px to 1920 px in both directions.
- Five terms exactly, in this order, with these ids: `dress-code`, `cleanliness`, `respect-privacy`, `beach-regulations`, `swimming-safety`. English wording is verbatim from the brief of 2026-11-03 (Task 6 pins every sentence in a test). Arabic is drafted by Claude with `meta.reviewStatus.ar = "needs-review"`; the Deanship's official Arabic replaces it when supplied.
- Title (exact): `University and University Beach Regulations & Procedures`. Document ref `KFUPM-UBR`. Reference numbers `UBR-YYYY-XXXXXX` (six characters from the alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`). PDF and attachment name `KFUPM-UBR-<reference>.pdf`.
- Sign-in collects exactly two fields, in this order: email address, passport number (decided by the user on 2026-11-04: "email and pass is enough"). No name, phone or nationality, no roster check. Any correctly formatted input signs in. The declaration identifies the student by email and the last four of the passport number; the email greeting is "Dear student".
- No D1, R2, KV, Durable Object or any other storage binding. `wrangler.jsonc` declares only `vars`; the only secret is `RESEND_API_KEY`. `EMAIL_MODE=log` means "send nothing, report `logged`", with no side effects.
- Resend stays as the email driver (`functions/lib/email.ts`); the email goes to the address typed at sign-in, carries the PDF, and BCCs `EMAIL_BCC` when set.
- `npm run verify` (typecheck + lint + unit tests + terms validation) green before every commit; one commit per task; `npm run test:e2e` green at Tasks 3, 5, 7, 8 and 9. Commit messages: `type(scope): imperative summary`, as in the source repository.

## Review Focus

Inputs the brief implies but no single task would otherwise test; each line has a pinning test in the task named.

1. **Anyone can call `POST /api/declarations` with any address** (there is no roster, so the endpoint is an open sender). Expected: strict field validation, a real `%PDF` ≤ 8 MB, at most 10 sends per IP per 15 minutes (11th → 429 with `retry-after`), and every send BCC'd to the deanship. Task 3 (`tests/functions/declarations.test.ts`). The hand-over doc adds a Cloudflare WAF rate-limiting rule as the second layer.
2. **Resend is down mid-send.** Expected: the receipt shows the failure with "Send the email again", retry re-posts the *same* in-memory PDF (no second render), and "Download PDF" works without the server. Task 3 (`tests/unit/receipt.test.tsx`).
3. **Arabic interface, Latin data.** Email, phone and passport typed while the page is RTL must not reverse; Arabic-Indic digits in phone/passport are normalised. Expected: those inputs carry `dir="ltr"`, the name `dir="auto"`, and `+٩٦٦ ٥٥` normalises to `+96655…`. Task 2 (`validators.test.ts`), Task 5 (`login.test.tsx` in RTL).
4. **The Arabic declaration with the five beach terms (some with bullet points) must still be one A4 page.** Expected: `validate:terms` warns over length; the e2e PDF check reports `Pages: 1` in both languages. Task 6 (`terms.test.ts`), Task 9 (`document.spec.ts`).
5. **The shoreline ground at 320 px, RTL, 200% text.** Expected: no horizontal scroll, the sheet still overlaps the waterline, nothing is transformed. Task 7 (`shell.spec.ts`), Task 8 (`worst-case.spec.ts`).

## File Structure (delta from the import)

```
DELETE
functions/api/verify.ts, functions/api/submissions/**        roster sign-in, records, stored PDF endpoints
functions/lib/{jwt,match,records,verify,throttle}.ts          (throttle is rewritten in memory, Task 3)
migrations/**, data/**, docs/setup/**                         D1 schema, roster CSVs, dashboard SQL
scripts/roster-import.ts, scripts/data-export.ts, scripts/lib/roster.ts
src/data/countries.ts, src/components/SelectField.tsx         nationality dropdown
src/services/authService.mock.ts                               sign-in is client-side; the real service is the mock
public/brand/matrix/**                                         the Matrix, both exports
tests/functions/{jwt,match,roster-import,throttle,verify}.test.ts
tests/e2e/{verify-api,submission-api,global-setup}.spec.ts|ts, tests/e2e/students.ts

CREATE
functions/api/declarations.ts        POST: validate + throttle + email the PDF
functions/lib/declaration.ts         parseDeclarationForm(), field rules
functions/lib/throttle.ts            in-memory fixed window per IP (rewritten)
src/lib/reference.ts                 generateReference(), REFERENCE_PATTERN, attachmentName()
src/i18n/ar.json, src/components/LanguageToggle.tsx           restored from the source repo's history (f8c3868^)
src/styles/shore.css                 the shoreline ground
tests/functions/declarations.test.ts, tests/functions/declaration-fields.test.ts
tests/e2e/fixtures.ts (replaces students.ts), tests/e2e/rtl-toggle.spec.ts, tests/e2e/declarations-api.spec.ts
docs/superpowers/specs/2026-11-03-beach-portal-design.md, docs/archive/pre-arrival/README.md

MODIFY (main ones)
src/services/{types,authService,dbService,dbService.mock,http}.ts   new contracts (Tasks 2–3)
src/features/login/LoginScreen.tsx, src/lib/validators.ts            phone in, nationality out
src/features/receipt/{ReceiptScreen,PrintSheet}.tsx, src/state/flow.ts, src/App.tsx
src/lib/{termsSchema,terms,format}.ts, scripts/validate-terms.ts, src/data/compliance-terms.json
src/i18n/{I18nProvider.tsx,en.json}, src/components/{Masthead,Icon}.tsx
src/styles/{tokens,shell,print,motion,forms,terms}.css
functions/lib/{env,email,validate,http,terms}.ts, functions/api/health.ts
wrangler.jsonc, package.json, .dev.vars.example, playwright.config.ts, index.html
docs/{HANDOFF,HANDOVER}.md, README.md, CLAUDE.md, docs/architecture/**, docs/qa/break-ui.md, docs/audit.md
```

---

### Task 0: Import the Pre-Arrival codebase (awaiting approval before this runs)

**Files:** every tracked file of `sac2027/KFUPM-Pre-Arrival-Compliance-Portal@c6619bf`, copied verbatim into the empty beach repository (branch `claude/keen-bohr-fnjd0n`, no commits yet).

**Interfaces:** Produces the baseline every later task modifies. `npm run verify` is green on it (confirmed on the source checkout before planning).

- [ ] **Step 1:** From the source checkout: `git archive c6619bf | tar -x -C /home/user/KFUPM_beach_compliance_portal` (tracked files only; `node_modules`, `graphify-out`, `.wrangler` are not tracked and do not travel).
- [ ] **Step 2:** `npm ci && npm run verify` in the beach repo → PASS.
- [ ] **Step 3: Commit** `chore: import Pre-Arrival Compliance Portal codebase (c6619bf)` and `git push -u origin claude/keen-bohr-fnjd0n`.

### Task 1: Plan, design spec, project rules

**Files:**
- Create: `docs/superpowers/plans/2026-11-03-beach-portal-adaptation.md` (this file), `docs/superpowers/specs/2026-11-03-beach-portal-design.md`, `docs/archive/pre-arrival/README.md`
- Move: `docs/superpowers/plans/2026-11-02-phase-2-verification-records-email.md`, `docs/superpowers/specs/2026-11-02-phase-2-verification-records-email-design.md`, `docs/design/phase-2-direction.md` → `docs/archive/pre-arrival/` (they describe the removed systems; kept for lineage)
- Modify: `CLAUDE.md` (rewrite for this project: the Global Constraints above, the skill map), `README.md` (first paragraph only; the rest in Task 9)

**Interfaces:** Produces the rules every later task consults.

- [ ] **Step 1:** Write the spec from the approved design conversation (intent, goals, non-goals, approaches considered for the background, the chosen "shoreline" concept, decisions, what is left to the builder).
- [ ] **Step 2:** Rewrite `CLAUDE.md`: project description, `npm run verify` rule, Hard rules = Global Constraints, skills by phase (Tasks 2–4 writing-plans/graphify; Tasks 5–7 frontend-design, design-taste-frontend, impeccable; Task 7 emil-design-eng/animate; Task 8 break-ui, web-design-guidelines; Task 9 playwright-skill).
- [ ] **Step 3:** `docs/archive/pre-arrival/README.md`: one paragraph saying these documents come from the Pre-Arrival portal and describe the roster, databases and bucket that this repository does not have.
- [ ] **Step 4:** `npm run verify` → PASS (docs only; the terms test walks `src/` only).
- [ ] **Step 5: Commit** `docs: adaptation plan, beach design spec and project rules`

### Task 2: Client-side sign-in with email and passport (revised 2026-11-04: no name or phone)

**Files:**
- Modify: `src/services/types.ts`, `src/services/authService.ts`, `src/lib/validators.ts`, `src/features/login/LoginScreen.tsx`, `src/i18n/en.json`, `src/state/flow.ts`, `src/App.tsx`, `src/features/terms/TermsStep.tsx` (copy only), `src/features/receipt/PrintSheet.tsx` (nationality row → email and phone rows), `src/features/signature/SignatureStep.tsx` (drop `onSessionExpired`), `src/services/dbService.mock.ts` (type only), `src/dev/worst-case-terms.json` (no change), `src/lib/format.ts` (add `maskEmail`)
- Delete: `src/services/authService.mock.ts`, `src/data/countries.ts`, `src/components/SelectField.tsx`
- Test: `tests/unit/validators.test.ts`, `tests/unit/login.test.tsx`, `tests/unit/services.test.ts`, `tests/unit/flow.test.ts`, `tests/unit/receipt.test.tsx` (session fixture), `tests/unit/signature-step.test.tsx` (session fixture), `tests/unit/terms-step.test.tsx` (session fixture), `tests/unit/i18n.test.tsx` (the "no phone keys" assertion inverts)

**Revision note (2026-11-04):** the phone and name fields below were dropped at the user's request. As built: `Credentials { email; passportNumber }`, `Student { email; passportLast4 }`, `Session { sessionId; student; issuedAt }`; `phoneSchema`, `nameSchema`, `maskEmail` (not needed yet) were not built; `countries.ts` stays until Task 4 because `functions/lib/validate.ts` imports it; `dbService.ts` no longer sends a token or nationality, so the old `/api/submissions` calls fail until Task 3 replaces them. Later tasks: read "fullName" and "phone" as removed; the email body greets "Dear student"; the print sheet shows Email, masked passport and Signed on.

**Interfaces (original, superseded where the note above says so):**
- Produces, in `types.ts`:
  - `interface Credentials { fullName: string; email: string; phoneNumber: string; passportNumber: string }`
  - `interface Student { fullName: string; email: string; phoneNumber: string; passportLast4: string }` (`email` is the real address: memory only, masked only for display)
  - `interface Session { sessionId: string; student: Student; issuedAt: string }` (no `token`, `expiresAt`, `nationality`)
  - `type ServiceErrorCode = 'invalid_credentials' | 'too_many_attempts' | 'invalid_submission' | 'network'` (no `session_expired`)
- Produces `phoneSchema` in `validators.ts`: strips spaces, dots, parentheses, hyphens and `(0)`, maps Arabic-Indic digits to ASCII, turns a leading `00` into `+`, then requires `/^\+\d{8,15}$/`; messages `error.required`, `error.phone.countryCode` (digits without `+`), `error.phone`. `loginSchema = v.object({ fullName, email, phoneNumber, passportNumber })` in that order.
- Produces `authService.login(c: Credentials): Promise<Session>`: parses `c` with `loginSchema`; on failure throws `ServiceError('invalid_credentials', …)`; otherwise returns `{ sessionId: crypto.randomUUID(), student: { fullName, email, phoneNumber, passportLast4: passportNumber.slice(-4) }, issuedAt: new Date().toISOString() }`. No network. Keeps the dev-only `shouldFailOnce('login')` hook.
- Produces `maskEmail(email: string): string` in `src/lib/format.ts` (`e•••@example.com`; `•••` when there is no `@`).
- `flow.ts` drops the `sessionExpired` action and `loginNotice: 'expired'`; everything else unchanged. `LoginScreen` props: `{ auth?: AuthService; onLoggedIn; notice?: MessageKey }` unchanged.

- [ ] **Step 1: Write the failing tests.** In `validators.test.ts`:

```ts
it.each([
  ['+966 55 123 4567', '+966551234567'],
  ['00966551234567', '+966551234567'],
  ['+٩٦٦ ٥٥ ١٢٣ ٤٥٦٧', '+966551234567'],
  ['+1 (415) 555-0132', '+14155550132'],
])('normalises %s to E.164', (input, out) => expect(v.parse(phoneSchema, input)).toBe(out));
it('rejects a number without a country code with error.phone.countryCode', () =>
  expect(v.safeParse(phoneSchema, '0551234567').issues?.[0]?.message).toBe('error.phone.countryCode'));
it('rejects too short, too long and letters with error.phone', () => { for (const bad of ['+96655', '+9665512345678901', '+966 abc']) expect(v.safeParse(phoneSchema, bad).success).toBe(false); });
it('orders the login fields name, email, phone, passport', () => expect(Object.keys(loginSchema.entries)).toEqual(['fullName', 'email', 'phoneNumber', 'passportNumber']));
```

In `login.test.tsx`: replace the nationality cases with a phone field (`getByLabelText(/phone number/i)`, `type="tel"`, `inputmode="tel"`, `autocomplete="tel"`, `dir="ltr"`); "shows four errors on an empty submit" expects 4 × `This field is required.`; the normalised call is `{ fullName: 'Mai Nguyễn', email: 'mai@example.com', phoneNumber: '+84901234567', passportNumber: 'A1234567' }`; field order `['Full name', 'Email address', 'Phone number', 'Passport number']`; the `session` fixture becomes `{ sessionId, student: { fullName, email: 'mai@example.com', phoneNumber: '+84901234567', passportLast4: '4567' }, issuedAt }`.
In `services.test.ts`: `authService.login(creds)` resolves to a session whose `student` equals the normalised credentials with `passportLast4`; `login({ ...creds, phoneNumber: '055' })` rejects with `invalid_credentials`; `login` never calls `fetch` (spy on `globalThis.fetch`); PII-hygiene test unchanged. In `flow.test.ts`: remove the `sessionExpired` cases.

- [ ] **Step 2:** `npx vitest run tests/unit/validators.test.ts tests/unit/login.test.tsx tests/unit/services.test.ts` → FAIL (`phoneSchema` undefined, no phone field).
- [ ] **Step 3:** Implement `phoneSchema` and the new `loginSchema`; delete `nationalitySchema` and `countries.ts`; rewrite `authService.ts` as above; update `types.ts`; in `LoginScreen.tsx` replace `SelectField` with `<Field id="phone" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" maxLength={25} …/>` between email and passport; `en.json`: add `login.phone` = `Phone number`, `login.phone.hint` = `With the country code, for example +966 55 123 4567.`, `error.phone` = `Enter a phone number with its country code, for example +966 55 123 4567.`, `error.phone.countryCode` = `Start with the country code, for example +966.`, `login.intro` = `Enter your details as they appear in your passport. Your signed declaration will be emailed to the address you give here.`, `terms.leaveWarn` = `Going back returns you to sign-in. The terms you have confirmed are kept.`, `print.email` = `Email`, `print.phone` = `Phone`; remove `login.nationality*`, `error.nationality`, `print.nationality`, `error.sessionExpired`. `PrintSheet` meta rows: Signed by, Email (`dir="ltr"`), Phone (`dir="ltr"`), Passport number (masked), Signed on. Receipt shows `maskEmail(session.student.email)`.
- [ ] **Step 4:** `npm run verify` → PASS.
- [ ] **Step 5: Commit** `feat(auth): client-side sign-in with name, email, phone and passport`

### Task 3: One stateless endpoint emails the signed declaration

**Files:**
- Create: `functions/api/declarations.ts`, `functions/lib/declaration.ts`, `functions/lib/throttle.ts` (replaces the D1 one), `src/lib/reference.ts`
- Modify: `functions/lib/email.ts`, `functions/lib/env.ts` (add nothing; `RECORDS` still declared until Task 4), `functions/lib/validate.ts` (keep `isPdf`, `MAX_PDF_BYTES` → here), `src/services/{types,dbService,dbService.mock,http}.ts`, `src/features/receipt/ReceiptScreen.tsx`, `src/App.tsx`, `src/lib/pdf.ts` (title and producer strings), `src/i18n/en.json` (receipt copy), `tests/e2e/helpers.ts`, `tests/e2e/document.spec.ts`, `tests/e2e/receipt.spec.ts`, `tests/e2e/worst-case-failures.spec.ts`, `tests/e2e/edge-cases.spec.ts`, `tests/e2e/login.spec.ts`, `tests/e2e/terms.spec.ts`
- Delete: `tests/e2e/students.ts` (→ `tests/e2e/fixtures.ts`)
- Test: `tests/functions/declarations.test.ts`, `tests/functions/declaration-fields.test.ts`, `tests/functions/throttle.test.ts` (rewritten), `tests/functions/email.test.ts`, `tests/unit/services.test.ts`, `tests/unit/receipt.test.tsx`, `tests/e2e/declarations-api.spec.ts`

**Interfaces:**
- Consumes `Session`, `Student`, `maskEmail` from Task 2.
- Produces `src/lib/reference.ts`: `generateReference(now = new Date()): string` → `UBR-${now.getUTCFullYear()}-${6 chars}`; `REFERENCE_PATTERN = /^UBR-\d{4}-[A-Z0-9]{6}$/`; `attachmentName(reference: string): string` → `KFUPM-UBR-${reference}.pdf`. (`randomCode` moves here from `mockUtils.ts`.)
- Produces in `types.ts`: `SubmissionPayload { session: Session; locale: Locale; documentRef: 'KFUPM-UBR'; acceptedTermIds: TermId[]; signature: Signature; submittedAt: string }`; `DbService { submitCompliance(payload): Promise<SubmissionReceipt>; sendDocument(payload: SubmissionPayload, receipt: SubmissionReceipt, pdf: Blob): Promise<DocumentStatus> }` (no `uploadDocument`, `resendEmail`, `downloadDocument`).
- Produces `dbService.submitCompliance`: validates the five ids in order and the PNG/JPEG data URL (the `assertValid` now in `dbService.mock.ts` moves to a shared `src/lib/submission.ts` `assertValidSubmission(payload)`), then returns `{ id: crypto.randomUUID(), referenceNumber: generateReference(), receivedAt: new Date().toISOString() }` with no network. `dbService.sendDocument` posts `multipart/form-data` to `/api/declarations` with fields `fullName`, `email`, `locale`, `referenceNumber`, `submittedAt` (= `receipt.receivedAt`) and the file `pdf` (name `attachmentName(ref)`), returning `{ state: r.emailStatus, emailTo: r.emailTo }`. `http.api()` must not set `content-type` for a `FormData` body.
- Produces `functions/lib/declaration.ts`: `interface DeclarationFields { fullName: string; email: string; locale: 'en' | 'ar'; referenceNumber: string; submittedAt: string; pdf: File }`; `parseDeclarationForm(form: FormData, now = Date.now()): { ok: true; value: DeclarationFields } | { ok: false; message: string }` with rules: name NFKC, spaces collapsed, 2–100 chars, at least two letters; email lower-cased, `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, ≤ 254; locale in `['en','ar']`; reference matches `REFERENCE_PATTERN`; `submittedAt` parses and lies within 24 h of `now`; `pdf` is a `File`, 1 byte to 8 MB. (`maskEmail` imported from `src/lib/format.ts`.)
- Produces `functions/lib/throttle.ts`: `allow(key: string, limit: number, windowSeconds: number, now = Math.floor(Date.now() / 1000)): { allowed: boolean; retryAfter?: number }` counting every call in a fixed window held in a module-level `Map` (pruned when it exceeds 10 000 keys); `resetThrottle(): void` for tests. Best effort per isolate; documented as such.
- Produces `functions/api/declarations.ts` `onRequestPost`: 429 `too_many_attempts` when `allow('ip:' + cf-connecting-ip, 10, 900)` refuses (header `retry-after`); 413 `too_large` when `content-length` > 9 MB; 400 `bad_form` when `request.formData()` throws; 400 `invalid_submission` with the parser's message; 413 when the PDF exceeds 8 MB; 400 `invalid_document` unless `isPdf(bytes)`; otherwise `sendDeclarationEmail(env, { to, fullName, locale, referenceNumber, submittedAt, pdf })` → 200 `{ emailStatus, emailTo: maskEmail(email) }`.
- `email.ts`: `DeclarationEmail { to; fullName; locale: 'en' | 'ar'; referenceNumber; submittedAt; pdf }` (no `submissionId`); `COPY` has `en` and `ar`; English subject `Your signed University Beach Regulations & Procedures declaration (${ref})`; body names the University Beach, the reference, the Riyadh time, says the PDF is attached and to keep it, signs off `Deanship of Student Affairs` / `King Fahd University of Petroleum & Minerals`; Arabic equivalent. Log mode returns `{ status: 'logged' }` and does nothing else. `attachmentName` imported from `src/lib/reference.ts`.
- `ReceiptScreen`: builds `payload` from props + `locale`; the first effect renders the PDF once and calls `db.sendDocument(payload, receipt, pdf)`; `retry` calls `sendDocument` again with the cached blob (rendering again only if the cache is empty); `download` saves `pdfRef.current` (rendering if needed) as `attachmentName(receipt.referenceNumber)` without any request. `SignatureStep` loses `onSessionExpired`.

- [ ] **Step 1: Write the failing tests.** `tests/functions/declaration-fields.test.ts` (node environment): a valid form parses to the normalised fields; each of 9 bad inputs (missing name, one-letter name, email without `@`, 255-char email, locale `fr`, reference `PACF-2026-ABCDEF`, `submittedAt` 2 days old, no file, empty file) returns `ok: false` with a message naming the field. `tests/functions/throttle.test.ts`: 10 calls allowed, the 11th refused with `retryAfter` ≤ 900, allowed again once `now` passes the window; keys independent; `resetThrottle()` clears. `tests/functions/declarations.test.ts`: builds a `Request` with `FormData` and a 20-byte `%PDF-1.7…` file, env `EMAIL_MODE: 'log'`, calls `onRequestPost({ request, env, params: {} } as never)`: 200 `{ emailStatus: 'logged', emailTo: 'm•••@example.com' }`; a non-PDF file → 400 `invalid_document`; `EMAIL_MODE: 'resend'` with a `fetch` stub answering 200 `{ id: 'x' }` → `emailStatus: 'sent'` and the stub's body contains the base64 PDF and `bcc: ['records@example.org']` when `EMAIL_BCC` is set; 11 requests from one IP → the last is 429 with `retry-after`; responses carry `cache-control: no-store`. `tests/functions/email.test.ts`: subject and attachment name as above for `en`, Arabic subject contains `شاطئ الجامعة` for `ar`, log mode returns `logged` and calls nothing (no `prepare`, no `fetch`). `tests/unit/services.test.ts`: `submitCompliance` returns `UBR-\d{4}-[A-Z0-9]{6}` and never calls `fetch`; `sendDocument` posts `FormData` to `/api/declarations` with the six parts (spy `fetch`, inspect `body instanceof FormData`, `body.get('pdf')` is a `File` named `KFUPM-UBR-….pdf`) and maps `{ emailStatus: 'sent', emailTo }` to `{ state: 'sent', emailTo }`; a 429 maps to `too_many_attempts`. `tests/unit/receipt.test.tsx`: "renders once, sends once" (`db.sendDocument` called with the payload, receipt and blob); "a failed send shows retry; retry re-sends the same blob without rendering again" (`renderPdf` called once, `sendDocument` twice with the same `Blob` instance); "download never calls the service" (`sendDocument` count unchanged, anchor `download` attribute `KFUPM-UBR-UBR-2026-K7M2QX.pdf`).
- [ ] **Step 2:** `npx vitest run tests/functions tests/unit/services.test.ts tests/unit/receipt.test.tsx` → FAIL (modules missing).
- [ ] **Step 3:** Implement the files listed in Interfaces. `pdf.ts`: `setTitle('KFUPM University Beach Regulations & Procedures')`, `setProducer('KFUPM Beach Compliance Portal')`. `en.json`: `receipt.email.failed` → `We could not email your copy to {email}. Download it below, or try sending again.`; `receipt.lead` → `We received your signed declaration and are emailing you a copy. Keep this reference number.`
- [ ] **Step 4:** `npm run verify` → PASS.
- [ ] **Step 5: Update the e2e suite to the new flow.** `tests/e2e/fixtures.ts`: `PEOPLE = { mai: { name: 'Mai Nguyễn', email: 'mai@example.com', phone: '+84 90 123 4567', passport: 'E2E00001' }, mohammed: { name: 'محمد عبدالله الغامدي', email: 'mohammed@example.com', phone: '+966 55 123 4567', passport: 'N1234567' }, long: { name: 'Abdulrahman Mohammed Abdullah Alghamdi Alharbi', email: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com', phone: '+1 415 555 0132', passport: 'A1B2C3D4E5F6G7H8I9J0' } }`; `fillLogin` fills the phone. `document.spec.ts`: after sign-in → done, assert the status line shows the masked email, then the download: filename `KFUPM-UBR-<ref>.pdf`, `%PDF` magic, `pdfinfo` Pages = 1, ink above the signature line (helpers unchanged). `declarations-api.spec.ts` (desktop only): a direct `request.post('/api/declarations', { multipart: … })` with a valid tiny PDF → 200 `logged`; an HTML file named `.pdf` → 400 `invalid_document`; 11 posts → 429. Remove `signIn` roster-refusal cases from `login.spec.ts` (keep format errors, one-request-in-flight, focus). `receipt.spec.ts`/`worst-case-failures.spec.ts`: `?fail=document` → failure line → retry → sent.
- [ ] **Step 6:** `npm run test:e2e` → PASS (the local Pages dev server still has the old bindings; nothing calls them).
- [ ] **Step 7: Commit** `feat(api): email the signed declaration through one stateless endpoint`

### Task 4: Remove the roster, databases, bucket and migrations

**As built (2026-11-04):** the server-code removals, `wrangler.jsonc`, `package.json` (`jose` and the db scripts), the e2e `global-setup`, the new health shape and `.dev.vars.example` moved into Task 3 because the new email contract broke the old endpoints. Task 4 therefore removed `migrations/`, `data/`, `docs/setup/` and added the no-storage guard test. Also in Task 3: `functions/lib/ratelimit.ts` (not `throttle.ts`), an optional `DECLARATIONS_PER_WINDOW` setting, the attachment name `KFUPM-<reference>.pdf`, and `DbService.sendDocument(request, pdf)`.

**Files:**
- Delete: everything under DELETE in File Structure that Tasks 2–3 have not already removed: `functions/api/verify.ts`, `functions/api/submissions/**`, `functions/lib/{jwt,match,records,verify}.ts`, `migrations/**`, `data/**`, `docs/setup/**`, `scripts/roster-import.ts`, `scripts/data-export.ts`, `scripts/lib/roster.ts`, `tests/functions/{jwt,match,roster-import,verify}.test.ts`, `tests/e2e/{verify-api,submission-api}.spec.ts`, `tests/e2e/global-setup.ts`
- Modify: `functions/lib/env.ts`, `functions/api/health.ts`, `functions/lib/validate.ts` (only `isPdf`, `MAX_PDF_BYTES` remain), `wrangler.jsonc`, `package.json`, `package-lock.json` (via `npm uninstall jose`), `.dev.vars.example`, `playwright.config.ts`, `.github/workflows/ci.yml` (drop nothing; `cp .dev.vars.example .dev.vars` stays), `.gitignore` (unchanged)
- Test: `tests/functions/validate.test.ts` (only the PDF cases), `tests/e2e/health.spec.ts`

**Interfaces:**
- Produces `Env { EMAIL_MODE: 'log' | 'resend'; EMAIL_FROM: string; EMAIL_REPLY_TO: string; EMAIL_BCC?: string; RESEND_API_KEY?: string }`.
- Produces `GET /api/health` → `{ ok: boolean; email: 'log' | 'resend'; configured: boolean }` where `configured = EMAIL_MODE !== 'resend' || Boolean(RESEND_API_KEY)`; status 200 when configured, 503 otherwise. No other data.
- `wrangler.jsonc`: `name: "kfupm-beach-compliance-portal"`, `pages_build_output_dir`, `compatibility_date`, `compatibility_flags`, `vars` only. `.dev.vars.example` contains just `EMAIL_MODE=log`.
- `package.json`: `name: "kfupm-beach-compliance-portal"`; scripts `db:*`, `roster:import`, `data:export` removed; `serve:test` = `npm run build && npm run dev:api`; `jose` removed from dependencies.

- [ ] **Step 1: Write the failing tests.** `health.spec.ts`: `GET /api/health` → 200 `{ ok: true, email: 'log', configured: true }`. `tests/unit/headers.test.ts` gains: `wrangler.jsonc` has no `d1_databases`, `r2_buckets`, `kv_namespaces` or `durable_objects` key and `package.json` has no `jose` and no `db:` script. `tests/functions/validate.test.ts` keeps only the `isPdf` cases.
- [ ] **Step 2:** `npx vitest run tests/unit/headers.test.ts` → FAIL.
- [ ] **Step 3:** Delete and modify as listed; `npm uninstall jose`; `grep -rn "ROSTER\|RECORDS\|DOCUMENTS\|D1Database\|R2Bucket\|roster" src functions scripts tests` returns nothing.
- [ ] **Step 4:** `npm run verify && npm run build && npx wrangler pages dev --help >/dev/null` → PASS; `npm run test:e2e -- tests/e2e/health.spec.ts tests/e2e/document.spec.ts` → PASS.
- [ ] **Step 5: Commit** `chore: remove the roster, records database, bucket and migrations`

### Task 5: Restore Arabic with full RTL mirroring

**Files:**
- Create: `src/i18n/ar.json`, `src/components/LanguageToggle.tsx` (both from `git show f8c3868^:…` in the source repo, then edited), `tests/e2e/rtl-toggle.spec.ts` (from history, edited)
- Modify: `src/i18n/I18nProvider.tsx` (restore the bilingual version from `f8c3868^`; `STORAGE_KEY = 'beach.locale'`), `src/components/{Masthead,Icon}.tsx`, `src/lib/{termsSchema,format}.ts`, `src/data/compliance-terms.json` and `src/dev/worst-case-terms.json` (Arabic fields restored from `f8c3868^` for the *old* terms; replaced in Task 6), `scripts/validate-terms.ts` (both locales), `src/features/signature/SignatureStep.tsx` (`Tabs.Root dir={dir}`), `src/features/receipt/PrintSheet.tsx` (`lang={locale} dir={dir}` on the article), `src/lib/pdf.ts` (title per locale via a `title` option), `src/App.tsx` (locale into the payload; it is already read from `useI18n`), `src/styles/{tokens,motion,forms,shell}.css`, `index.html` (bilingual `<noscript>`), `src/i18n/en.json` (`lang.other` = `العربية`)
- Test: `tests/unit/i18n.test.tsx` (restore the bilingual version from `f8c3868^`, storage key `beach.locale`), `tests/unit/shell.test.tsx` (Masthead has the toggle; no `masthead__title`), `tests/unit/login.test.tsx` (in RTL: email/phone/passport inputs `dir="ltr"`, name `dir="auto"`), `tests/unit/terms.test.ts` (every string non-empty in both locales), `tests/e2e/a11y.spec.ts` (every step in both languages), `tests/e2e/shell.spec.ts` (toggle present; `masthead__title` test removed)

**Interfaces:**
- Produces `useI18n(): { locale: 'en' | 'ar'; dir: 'ltr' | 'rtl'; t; setLocale }`, `detectLocale`, `localeFromSearch` (`?lang=ar`), `Locale = 'en' | 'ar'` in `termsSchema.ts` (`bilingual = v.object({ en: text, ar: text })`, `body` and `reviewStatus` in both).
- `Icon` swaps `forward`↔`back` when `dir === 'rtl'` (restored); `motion.css` restores `[dir='rtl'] .step { --dir: -1; }`; `forms.css` restores `[dir='rtl'] .field__input[dir='ltr'] { text-align: end; }`.
- Masthead = lockup at inline-start + `LanguageToggle` at inline-end; the `masthead__title` element and its key are removed (the sheet carries the title).
- **Assumption to confirm against the brand guide (Task 1 spec):** `--font-display: 'KFUPM', 'IBM Plex Sans Arabic', 'Segoe UI', system-ui, sans-serif`, so Arabic headings fall through to Plex Arabic (KFUPM Display has no Arabic glyphs). If the guide names a different Arabic display face that KFUPM supplies, that face replaces Plex in this stack.

- [ ] **Step 1: Write the failing tests** (restore `tests/unit/i18n.test.tsx` from history with the new storage key; add the RTL login assertions; `shell.test.tsx` expects `getByRole('button', { name: 'العربية' })` in the Masthead; `terms.test.ts` loops `['en', 'ar']`).
- [ ] **Step 2:** `npx vitest run tests/unit/i18n.test.tsx tests/unit/shell.test.tsx tests/unit/terms.test.ts` → FAIL.
- [ ] **Step 3:** Restore and edit the files listed. `ar.json` must have exactly `en.json`'s keys: reuse the old Arabic for keys that still exist, translate the new ones (`login.phone*`, `error.phone*`, `print.email`, `print.phone`, `receipt.email.*`, `receipt.download`, `terms.changeDetails`, `terms.leave*`, `login.again`, `print.ref`, `print.scope` is Task 6).
- [ ] **Step 4:** `npm run verify` → PASS; `npm run test:e2e -- tests/e2e/rtl-toggle.spec.ts tests/e2e/a11y.spec.ts tests/e2e/shell.spec.ts` → PASS.
- [ ] **Step 5: Commit** `feat(i18n): restore Arabic with full RTL mirroring`

### Task 6: University Beach content, bilingual, with points

**Files:**
- Modify: `src/data/compliance-terms.json` (rewritten), `src/lib/termsSchema.ts`, `scripts/validate-terms.ts`, `functions/lib/terms.ts`, `src/features/terms/TermCard.tsx`, `src/features/receipt/PrintSheet.tsx`, `src/styles/{terms,print}.css`, `src/i18n/{en,ar}.json` (`app.title`, `brand.logoAlt`, `print.scope`, `receipt.*` wording), `index.html` (`<title>`), `src/dev/worst-case-terms.json`
- Test: `tests/unit/terms.test.ts` (rewritten), `tests/unit/terms-step.test.tsx` (points render as list items inside the card's description), `tests/unit/receipt.test.tsx` (print sheet lists points), `tests/unit/worst-case.test.ts`, `tests/e2e/terms.spec.ts`

**Interfaces:**
- Produces `TERM_IDS = ['dress-code', 'cleanliness', 'respect-privacy', 'beach-regulations', 'swimming-safety'] as const` in both `src/lib/termsSchema.ts` and `functions/lib/terms.ts`.
- Schema change: `document.stage` → `document.scope` (bilingual; `{ en: 'University Beach', ar: 'شاطئ الجامعة' }`); each term gains optional `points: { en: Segment[][]; ar: Segment[][] }` (same length in both locales; each point ≥ 1 segment); `termText(term, locale, links)` returns the body text followed by each point's text, joined with single spaces. `links` may be `{}`.
- `TermCard` renders `points` as `<ul className="term__points">` inside the `term__body` paragraph's sibling, all within the element referenced by `aria-describedby`; `PrintSheet` renders the same list. `validate-terms.ts` measures body + points against `MAX_BODY`.
- Content (English verbatim; the lead sentence is `body`, the rest are `points`):
  - `dress-code` — title `Dress Code and Public Decency`; body `Adherence to the morals, values, and customs observed in the Kingdom of Saudi Arabia, avoiding anything inconsistent with Saudi traditions.`; points: `Maintaining a decent appearance within the University campus and adhering to modest attire.` / `Avoiding clothing that violates public decency, such as pajamas, shorts, overly short, transparent, or tight clothing, or attire bearing inappropriate images or phrases.` / `Female students are required to wear an abaya, or equivalent modest attire, with full head covering.` / `Appropriate beachwear that aligns with our community values and traditions is required.`
  - `cleanliness` — `Cleanliness and University Property`; body `Maintaining public property and keeping all beach facilities clean.`; points: `To maintain general cleanliness and avoid consuming food or drinks in prohibited areas.` / `Spitting or littering outside designated areas is prohibited.`
  - `respect-privacy` — `Respecting Others and Privacy`; body `Comply with Islamic ethics and respect the privacy of others.`; points: `To treat all University members, guests, and service providers with due respect, preserving their dignity and refraining from any form of insult, abuse, or inappropriate behavior.` / `Playing loud music or causing disturbance with excessive noise is prohibited.` / `To respect the privacy of all University members, including refraining from photography, collecting personal information without prior authorization, or publishing such material by any means.` / `It is forbidden to cross from the Singles area to the Families' area.`
  - `beach-regulations` — `University Beach Regulations`; body (two sentences, no points) `Advance reservation is required to enter the beach, and attendance is based on the reservation time. The person who makes the reservation (the host) must be present with his visitors entering the beach, and he is the first to be held liable for any subsequent damages and breaches of the beach's rules and regulations.`
  - `swimming-safety` — `Swimming Safety Guidelines`; body `Ensure lifeguards are present and follow their instructions.`; points: `Do not exceed the designated swimming area.` / `Swim parallel to the shore.` / `Swimming after sunset is prohibited.` / `Diving is not allowed at any time.` / `Rough play, climbing on others' shoulders, diving, or pushing others into the water is not allowed.`
  - `document.title.en` = `University and University Beach Regulations & Procedures`; `document.ref` = `KFUPM-UBR`; `intro.en` and `closing.en` drafted for the beach in the voice of the old ones (first person, "By signing this form…" / "By signing below…") and flagged `needs-review`; `meta.source` records the brief of 2026-11-03 as the English source and that the point splits are layout only.
  - Arabic for every field drafted by Claude; `meta.reviewStatus = { en: 'needs-review', ar: 'needs-review' }` (the English wording is verbatim but still awaits the Deanship's formal sign-off).
- `en.json`: `app.title` = the full title; `print.scope` = `Applies to`; `brand.logoAlt` unchanged. `index.html` title `University and University Beach Regulations & Procedures | KFUPM Student Affairs`.

- [ ] **Step 1: Write the failing tests.** `terms.test.ts`: ids in order; `document.title.en` and `document.ref` exact; for each of the five terms `termText(term, 'en', links)` equals the brief's paragraph verbatim (the five strings from Interfaces, points joined by spaces); every `points.ar` has the same length as `points.en`; both locales non-empty everywhere; `links` entries (if any) are https; no `https?://` or any sentence of the five terms in a `.tsx` file; the schema rejects `points` of unequal length and names the path. `terms-step.test.tsx`: the first card's description (`aria-describedby` target) contains 4 `listitem`s and the text `Appropriate beachwear`. `receipt.test.tsx` (print part): the sheet shows `Applies to` / `University Beach` and the swimming points as list items.
- [ ] **Step 2:** `npx vitest run tests/unit/terms.test.ts tests/unit/terms-step.test.tsx` → FAIL.
- [ ] **Step 3:** Rewrite the JSON, schema, validator, card, print sheet and CSS (`.term__points { margin: 0.5rem 0 0; padding-inline-start: 1.25rem; }` plus the print equivalent in mm; list markers are the browser's own, so RTL puts them on the correct side).
- [ ] **Step 4:** `npm run verify` → PASS (expect warnings: `needs-review` in both locales); `npm run validate:terms` prints 5 terms, 0 links.
- [ ] **Step 5: Commit** `feat(content): University Beach regulations and procedures, bilingual`

### Task 7: Shoreline ground replaces the Matrix

**Files:**
- Delete: `public/brand/matrix/matrix-beige-sand.svg`, `public/brand/matrix/matrix-turquoise-green.svg`
- Create: `src/styles/shore.css`
- Modify: `src/App.tsx` (`<div className="page-matrix">` → `<div className="shore" aria-hidden="true">`), `src/main.tsx` (import order: after `shell.css`), `src/styles/{tokens,shell,print}.css`, `public/brand/README.md`, `src/features/receipt/PrintSheet.tsx` (band markup unchanged; CSS only), `docs/superpowers/specs/2026-11-03-beach-portal-design.md` (screenshots and the critique round appended)
- Test: `tests/unit/shell.test.tsx`, `tests/e2e/shell.spec.ts`, `tests/e2e/responsive.spec.ts`, `tests/unit/contrast.test.ts` (no new text pairings; the fields are decorative)

**Interfaces:**
- Produces tokens in `tokens.css`: `--sea: var(--turquoise); --shallows: var(--blue); --sand-ground: var(--beige); --sea-h: clamp(10rem, 28vh, 16rem); --shallows-h: 0.5rem;` and, from 48rem, `--sea-h: clamp(14rem, 34vh, 22rem); --shallows-h: 0.75rem;`.
- Produces `.shore` in `shore.css`: `position: absolute; inset-block-start: 0; inset-inline: 0; block-size: var(--sea-h); background: var(--sea); z-index: 0; pointer-events: none;` with `::after` (`position: absolute; inset-block-end: 0; inset-inline: 0; block-size: var(--shallows-h); background: var(--shallows)`). `body { position: relative; background: var(--sand-ground); }`. The masthead keeps its turquoise background (so it merges with the sea), `.page` keeps `z-index: 1` and its top padding, so the white sheet starts inside the sea and crosses the shallows line. Nothing animates. `@media print { .shore { display: none } }`. Forced colours: nothing to restate (the fields carry no meaning).
- Print band (`.print-sheet__band`): `block-size: 6mm; background: var(--turquoise);` with `::after` 1.2 mm of `var(--blue)` at its base and `::before` 0.6 mm of `var(--beige)` below that (the same three fields, as the document's mark). No image.
- Tests: `shell.test.tsx` asserts no stylesheet mentions `matrix`, `public/brand/matrix` does not exist, `shore.css` uses only logical properties and no `gradient(`/`box-shadow`; `shell.spec.ts` asserts `.shore` has `transform: none`, its background is `rgb(17, 95, 102)`, its `::after` is `rgb(113, 184, 212)`, the sheet's top edge lies above the shore's bottom edge at every project viewport, and `.page-matrix` has count 0; `responsive.spec.ts` keeps the zero-overflow check at 320/360/768/1280/1920 for both `?lang=en` and `?lang=ar`.

- [ ] **Step 1: Write the failing tests** as listed.
- [ ] **Step 2:** `npx vitest run tests/unit/shell.test.tsx` → FAIL.
- [ ] **Step 3:** Implement; then run the design-taste gate on the built app in app-screen mode (`node <skill>/scripts/lint.mjs src` and `inspect.mjs --app` at 1440/768/390 on `vite preview`), screenshot login, terms, sign and receipt at 1280 and 360 in both languages, critique once with `references/critique.md`, fix the top three findings, record the round in the spec.
- [ ] **Step 4:** `npm run verify` → PASS; `npm run test:e2e -- tests/e2e/shell.spec.ts tests/e2e/responsive.spec.ts tests/e2e/document.spec.ts` → PASS (the print band is in the PDF).
- [ ] **Step 5: Commit** `feat(design): shoreline ground replaces the Matrix`

### Task 8: Worst-case data, RTL and accessibility audit

**Files:**
- Modify: `src/dev/worst-case-terms.json` (beach shape: 110-char titles in both scripts, a 12-point term, a 1 200-char body, an Arabic point with a long unbreakable Latin URL-like token), `src/dev/WorstCaseToggle.tsx` (unchanged), `docs/qa/break-ui.md` (rewritten report), `docs/audit.md` (rewritten: Web Interface Guidelines fetched fresh + WCAG 2.2 AA, both languages), plus whatever the findings require in `src/`
- Test: `tests/unit/worst-case.test.ts`, `tests/e2e/worst-case.spec.ts`, `tests/e2e/worst-case-document.spec.ts`, `tests/e2e/edge-cases.spec.ts`, `tests/e2e/a11y.spec.ts`

**Interfaces:** Consumes the toggle states `Demo data / Worst case` (`?data=worst`) and `?fail=login|submit|document`; produces the two reports and the regression tests for every fix.

- [ ] **Step 1 (break-ui, Phases 1–4):** map every rendered value (login fields, the five cards with points, receipt reference, print sheet, email status line) with its limit; build the fixture; view it at 1280/360/320 in EN and AR, at 200% zoom, in forced colours, and in print; list breaks with severity and fix.
- [ ] **Step 2:** Write failing e2e assertions for each break found (zero overflow, nothing clipped, list markers inside the card in RTL, the long name wrapping in the print sheet) → run → FAIL.
- [ ] **Step 3:** Fix in `src/`; re-run every toggle state.
- [ ] **Step 4 (web-design-guidelines):** fetch `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`, review `src/**/*.tsx` and `src/styles/*.css`, fix, and record the findings in `docs/audit.md`; axe (`a11y.spec.ts`) 0 violations on every step in both languages.
- [ ] **Step 5:** `npm run verify && npm run test:e2e` → PASS.
- [ ] **Step 6: Commit** `test: worst-case data, RTL and accessibility audit for the beach portal`

### Task 9: Hand-off docs, Cloudflare and Resend setup, architecture map

**Files:**
- Modify: `docs/HANDOFF.md`, `docs/HANDOVER.md`, `README.md`, `CLAUDE.md` (final skill map), `docs/architecture/{README.md,GRAPH_REPORT.md,graph.html}` (regenerated with graphify on the finished repo), `public/brand/README.md`
- Test: `npm run release:check` (strict wording gate expected red until the Deanship marks both locales `approved`; report it as such), `npm run test:e2e`

**Interfaces:** Produces the documents a staff member, IT and the next maintainer read.

- [ ] **Step 1:** `docs/HANDOVER.md`: Pages project (Git build, `npm run build`, `dist`), `wrangler.jsonc` vars (`EMAIL_MODE`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_BCC` — **required in production: with no database, the BCC mailbox is the only record**), the one secret `RESEND_API_KEY`, Resend domain verification, the WAF rate-limiting rule on `/api/declarations` (10 requests per IP per 15 minutes; free plan has one such rule), local development (`cp .dev.vars.example .dev.vars`, `npm run build && npm run dev:api`), what `/api/health` reports.
- [ ] **Step 2:** `docs/HANDOFF.md`: editing the JSON (the `points` shape, both locales, `validate:terms`), the two seams, the API (one endpoint), tests, brand assets, before-launch checklist (approve both locales, official Arabic, seal artwork, Resend domain, BCC mailbox, WAF rule, repository private).
- [ ] **Step 3:** Regenerate the architecture map: run graphify on the repo, label communities, copy `GRAPH_REPORT.md` and `graph.html` into `docs/architecture/` with the README updated.
- [ ] **Step 4:** `npm run verify && npm run test:e2e && npm run build` → PASS; `npm run release:check` → report its result.
- [ ] **Step 5: Commit** `docs: hand-off, Cloudflare and Resend setup, architecture map` and push.

---

## Self-review notes

- Spec coverage: Phase 1 (strip D1/R2, keep Resend, client auth) = Tasks 2–4; Phase 2 (title, five bilingual terms, RTL) = Tasks 5–6; Phase 3 (brand colours kept, Matrix removed, new background) = Task 7; the user's required RTL/LTR and zero-horizontal-scroll checks = Tasks 5, 7, 8.
- Type consistency: `Session`/`Student` (Task 2) are what Task 3's `SubmissionPayload`, Task 5's print sheet and every test fixture use; `DbService.sendDocument` (Task 3) is the only method the receipt calls; `TERM_IDS` changes once, in Task 6, in both mirrors.
- Ordering keeps a working app after every commit: Task 2 stops calling `/api/verify`, Task 3 switches the receipt to the new endpoint before Task 4 deletes the old ones; Task 5 restores `ar` before Task 6 fills it.
