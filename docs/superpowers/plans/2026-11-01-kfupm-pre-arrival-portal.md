# KFUPM Pre-Arrival Compliance Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Google Sites "Pre-Arrival Compliance Form" with a bilingual (EN LTR / AR RTL), institutional-grade web app on Cloudflare that collects a student's agreement to five terms plus a drawn or uploaded signature, with mock auth and mock persistence that KFUPM IT can swap for real services.

**Architecture:** Static Vite + React + TypeScript SPA. Policy content lives in `src/data/compliance-terms.json` (validated by a schema script); UI components only render it. All I/O is behind two interfaces (`authService`, `dbService`) with mock implementations. One linear flow: Login → Terms → Signature → Receipt, driven by a small step state machine. Motion is hand-written CSS/WAAPI (no animation library). Deployed as Cloudflare Workers static assets.

**Tech Stack:** Vite, React 19, TypeScript (strict), plain CSS with design tokens + logical properties, react-hook-form + valibot (validation), signature_pad (canvas), @radix-ui/react-tabs (tabs only), self-hosted brand fonts (KFUPM Display + IBM Plex Sans Arabic, both supplied), Vitest + Testing Library, Playwright, wrangler.

**Spec:** The user's brief (conversation of 2026-11-01), `International_Students_Declaration_Form_Dec_19_EDIT_suggestions.docx`, `Full_Page_Embed.pdf` (legacy page), and the brand pack zips (`OneDrive_2/4/5`). Design doc to be committed as `docs/superpowers/specs/2026-11-01-kfupm-portal-design.md` in Task 0.

## Global Constraints

- Five terms exactly, in this order: `saudi-laws`, `cultural-norms`, `university-policies`, `representation`, `reporting`. Term text, titles and every external URL come from `src/data/compliance-terms.json`; no policy string or URL may appear in a `.tsx` file.
- Policy wording source of truth: the legacy page (`Full_Page_Embed.pdf`), verbatim where it is visible (intro, terms 1–2); terms 3–5 and the closing from the docx with its tracked suggestions rejected. Wording changes go through KFUPM, not through us.
- Document ref `KFUPM-INTL-PACF`, stage `Pre-Arrival State`; byline "Deanship of Student Affairs • International Students Office".
- Fonts (supplied in `KFUPM_Fonts.zip`; rules from Brand Guidelines §7): **headlines = KFUPM Display** (Regular/Bold/Black), served as the unmodified TTFs (embedded licence: exclusive to KFUPM, no modification or reproduction → no subsetting or format conversion). **Body text, both scripts, and all user-entered text = IBM Plex Sans Arabic** (the brand's chosen body face; OFL; covers Latin and Arabic). Never use Plex for headlines. Fallback = Segoe UI, then `system-ui` (the brand's named fallback; in practice it also supplies glyphs Plex lacks, e.g. Vietnamese `ễ ị`). The KFUPM Display font covers ASCII only (measured: no `ü Ç Ł ễ`, no Persian/Urdu letters), so it never renders typed names. All self-hosted, never a third-party CDN. No `@fontsource` packages.
- Lockups: use only the supplied **Full Stacked** lockup (the guideline's *formal* lockup), colour on light surfaces and negative on Turquoise. Never recolour, crop, stretch, or rebuild it (Brand Architecture Guideline: "modifying or altering these lockups is strictly prohibited"). The Horizontal lockup is "informal" and is not used.
- The KFUPM FAST Matrix (diagonal stripe pattern) comes only from the official FAST Matrix Generator export (SVG), unaltered, never redrawn. Rules (§8): fixed 5° skew; no flipping, gradients, mixed patterns in one medium, or full overlap of photographs; only the approved colour pairings (p.78) — on Turquoise: Green, Beige, White, Yellow, Sand, Blue or Gray fill; on Beige: Turquoise, Green, Yellow, Sand, Blue or Gray fill; used selectively (once per screen). Flipping is a listed misuse, so in RTL the Matrix moves to the opposite side but is never mirrored (no `scaleX(-1)`/`rotateY`); a Task 6 test asserts this. The supplied exports are `public/brand/matrix/*.svg`, 1000×1000, used as CSS backgrounds with `background-size: cover` (a crop, which §8.4 allows).
- The KFUPM Seal is reserved for formal documents (certificates, contracts). It appears only on the printable signed declaration/receipt, never in the web UI chrome, and only from the official seal artwork.
- Colour-pair rule: any text/background pairing must be both on the brand's approved list (§6.2) and ≥ 4.5:1 (≥ 3:1 for large text/UI). Where the brand chart is looser than WCAG (white on Green 3.73:1, Yellow on Turquoise 4.14:1), WCAG wins: those pairs are large-text/UI only.
- Login collects exactly three fields (passport number, phone number, full name). There is no Student ID. After login the declaration shows the student's full name and today's date (read-only, Gregorian, Latin digits); the submission is stamped with the signing time.
- Brand colours (verbatim from the brand pack): Turquoise `#115F66`, Green `#009767`, Beige `#ECE0C7`, Sand `#AA8C6D`, Yellow/Gold `#F0BA45`, Gray `#ADACAD`, White `#FFFFFF`, Blue `#71B8D4`. (The guideline prints Yellow's hex as `F0BA4F` but its RGB is 240-186-69 and the artwork's pixels are `F0BA45`; the guideline's Sand RGB also disagrees with its hex. Hex values above are the artwork-verified ones.) Feedback palette (Brand Guidelines §6.7): Success `#2AA880`, Error `#DE5E5E`, Warning `#F2C56C`, Info `#89C4DB`. These are 3.0 / 3.58 / 1.7 / 1.9:1 on white, so they are borders, icons and fills only; text uses derived darker tokens (e.g. error text `#B42318`, 6.57:1 on white), each covered by the contrast test.
- WCAG 2.2 AA: 4.5:1 body text, 3:1 large text and UI boundaries. Green `#009767` is 3.73:1 on white → never used for body text; text green is the derived token `--green-700: #00704D` (6.13:1 on white). Gold on white is 1.78:1 → gold is only ever used as an accent on Turquoise, or as a non-text rule.
- Zero horizontal scroll from 320 px to 1920 px, both directions. All spacing uses CSS logical properties (`margin-inline-start`, `inset-inline-end`, …); no `left`/`right` in component CSS.
- Honour `prefers-reduced-motion`. Animations only `transform`/`opacity`; never `transition: all`.
- Passport number, phone, name and signature are PII: never in URLs, `localStorage`, `console.*`, or analytics. Held in memory only.
- Each task ends in a green `npm run verify` (typecheck + lint + unit tests + terms validation) and one commit.

## Review Focus

Inputs and conditions the brief implies but no single task would otherwise test; each has a pinning test in the task named.

1. Very long names (100+ chars, Arabic and Latin, no spaces) overflow the card on a 320 px viewport → wraps/truncates, no scroll (Task 7, Task 12).
2. Mixed-direction input: an English passport or phone typed while the UI is RTL renders reversed/jumbled → those fields force `dir="ltr"`, name uses `dir="auto"` (Task 7).
3. Arabic-Indic digits (٠١٢٣…) typed into phone/passport are rejected or silently mangled → normalise to ASCII before validating (Task 7).
4. Signature submitted blank, or a canvas "signature" that is a single accidental dot → submit blocked until a minimum stroke length is drawn (Task 10).
5. Uploaded signature that is a non-image, an SVG with scripts, a 40 MB photo, or a double-dropped file → rejected with a message; only PNG/JPEG ≤ 2 MB accepted (Task 10).
6. Double-click on Submit or a failing `dbService.submit` → exactly one request in flight; failure shows a retry state, not a lost form (Task 11).
7. A name containing glyphs the KFUPM font lacks (`Nguyễn`, `Müller`, `Łukasz`, Urdu `ٹ`) renders via the fallback stack with no tofu → input/value font stack excludes KFUPM Display (Task 3).
8. Language toggled mid-form → entered values, checked boxes and drawn signature survive; direction flips without remount flicker (Task 8, Task 14).

## File Structure

```
CLAUDE.md                          skill-per-phase map (survives context resets)
wrangler.jsonc                     Workers static assets, SPA fallback
public/_headers                    CSP + security headers
public/brand/                      optimised lockups, icon, stripe motif (SVG, hand-built)
scripts/validate-terms.ts          schema check for compliance-terms.json
src/data/compliance-terms.json     ALL policy copy + URLs, EN + AR (staff-editable)
src/lib/termsSchema.ts             valibot schema + loader (single import point for JSON)
src/lib/normalise.ts               digit/whitespace normalisation
src/lib/validators.ts              passport / phone / name schemas
src/i18n/{I18nProvider.tsx,en.json,ar.json}   UI chrome strings (NOT policy text)
src/services/{types.ts,authService.ts,dbService.ts}   IT hand-off seams
src/state/flow.ts                  step state machine (login|terms|sign|done)
src/styles/{tokens.css,base.css,motion.css}
src/components/{Masthead,Stepper,LanguageToggle,Field,Button}.tsx
src/features/login/LoginScreen.tsx
src/features/terms/{TermsStep.tsx,TermCard.tsx,TermCheckbox.tsx}
src/features/signature/{SignatureStep.tsx,DrawPad.tsx,UploadZone.tsx}
src/features/receipt/ReceiptScreen.tsx
src/dev/WorstCaseToggle.tsx        dev-only break-ui harness (tree-shaken from prod)
tests/unit/*.test.ts(x)            Vitest
tests/e2e/*.spec.ts                Playwright
docs/HANDOFF.md                    what IT replaces, what staff edit
```

---

### Task 0: Plan, design doc, CLAUDE.md

**Files:**
- Create: `docs/superpowers/plans/2026-11-01-kfupm-pre-arrival-portal.md` (this file), `docs/superpowers/specs/2026-11-01-kfupm-portal-design.md`, `CLAUDE.md`

**Interfaces:** Produces the skill-to-phase map every later task consults.

- [ ] **Step 1:** Write the design doc from the approved decisions (approaches considered, chosen stack, non-goals: no real SSO, no server, no photography).
- [ ] **Step 2:** Write `CLAUDE.md`: project rules (Global Constraints), `npm run verify`, and the skill map: Task 1–5 → writing-plans/graphify; Task 6–9 → frontend-design, design-taste-frontend, impeccable; Task 9–10, 12 → emil-design-eng, animate; Task 13–14 → break-ui, web-design-guidelines; Task 15 → playwright-skill.
- [ ] **Step 3: Commit** `docs: add implementation plan, design doc and CLAUDE.md`

### Task 1: Scaffold, tooling, Cloudflare config

**Files:** Create `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `wrangler.jsonc`, `playwright.config.ts`, `.gitignore`, `tests/unit/smoke.test.tsx`

**Interfaces:** Produces npm scripts `dev`, `build`, `typecheck`, `lint`, `test`, `validate:terms`, `verify`, `test:e2e`.

- [ ] **Step 1: Write failing test** `smoke.test.tsx`: renders `<App/>`, asserts `screen.getByRole('main')` exists.
- [ ] **Step 2:** Run `npx vitest run` → FAIL (no App).
- [ ] **Step 3:** Scaffold Vite React-TS (strict), Vitest + jsdom + Testing Library, ESLint, `wrangler.jsonc` with `assets.directory: "./dist"`, `not_found_handling: "single-page-application"`. Playwright config reuses preinstalled Chromium (`executablePath: '/opt/pw-browsers/chromium'`, `--no-sandbox`), projects: desktop 1280, mobile 360, small 320.
- [ ] **Step 4:** `npm run verify && npm run build` → PASS; `npx wrangler deploy --dry-run` → succeeds.
- [ ] **Step 5: Commit** `chore: scaffold vite react ts with vitest, playwright, wrangler`

### Task 2: Brand assets and design tokens

**Files:** Create `public/brand/*`, `src/styles/tokens.css`, `src/styles/base.css`, `tests/unit/contrast.test.ts`

**Interfaces:** Produces CSS custom properties `--turquoise --green --green-700 --beige --paper --sand --gold --gray --ink` and `--font-sans`, plus `contrastRatio(fg: string, bg: string): number` in `src/lib/contrast.ts`.

- [ ] **Step 1: Write failing test** `contrast.test.ts`: parse `tokens.css`, assert for each declared text/background pairing `contrastRatio` ≥ 4.5 (body), ≥ 3 (large/UI). Fixed expectations: `#115F66`/`#FFFFFF` ≈ 7.36; `#00704D`/`#FFFFFF` ≥ 4.5; `#F0BA45`/`#115F66` ≈ 4.14 and registered as **large-text/UI only**.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Copy `Full Stacked.png` and `Full Stacked - negative.png` unmodified into `public/brand/` (scaled copies for 1×/2× only, aspect ratio locked) and `__siteIcon__.png` as favicon. Place the user-exported FAST Matrix SVGs (Turquoise bg + Green fill for the masthead; Beige bg + Sand fill for the document page edge) unaltered in `public/brand/matrix/`, and the official Seal artwork in `public/brand/seal/` for the print view only. The Arabic lockup is a hard dependency: until it is supplied, Arabic mode uses the English lockup and the gap is tracked in `docs/HANDOFF.md`. Write `tokens.css` with brand values verbatim plus derived tokens, each annotated with its pairing + ratio.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(brand): add lockups, stripe motif, colour tokens and contrast test`

### Task 3: i18n core, fonts, RTL

**Files:** Create `src/i18n/{I18nProvider.tsx,en.json,ar.json}`, `src/components/LanguageToggle.tsx`, `tests/unit/i18n.test.tsx`

**Interfaces:** Produces `useI18n(): { locale: 'en'|'ar'; dir: 'ltr'|'rtl'; t(key: string): string; setLocale(l: 'en'|'ar'): void }`. Provider sets `document.documentElement.lang`/`dir`.

- [ ] **Step 1: Write failing tests:** (a) `setLocale('ar')` → `document.documentElement.dir === 'rtl'` and `lang === 'ar'`; (b) `en.json` and `ar.json` have identical key sets; (c) missing key throws in dev, returns key in prod.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement provider (locale persisted in `localStorage` inside try/catch; default from `navigator.language`). `@font-face` for the three KFUPM Display TTFs as supplied (unmodified); IBM Plex Sans Arabic (Regular/Medium/SemiBold/Bold) as lossless WOFF2 of the supplied TTFs (OFL permits; no subsetting; 67–72 KB each). `font-display: swap`. Stacks: headings `'KFUPM', 'Segoe UI', system-ui, sans-serif`; body and inputs `'IBM Plex Sans Arabic', 'Segoe UI', system-ui, sans-serif` (never KFUPM, never Plex for headings). Test: computed `font-family` of every `input` and the receipt name excludes `KFUPM` (pins Review Focus 7). If KFUPM Arabic headings fail a visual shaping check, Arabic headings fall back to Plex Arabic. The toggle is a plain `<button>` (not `aria-pressed`: it switches, it does not toggle state) showing the *other* language in its own script ("العربية" / "English") with a matching `lang` attribute.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(i18n): bidirectional provider, self-hosted Plex fonts, language toggle`

### Task 4: Terms JSON + schema validation

**Files:** Create `src/data/compliance-terms.json`, `src/lib/termsSchema.ts`, `scripts/validate-terms.ts`, `tests/unit/terms.test.ts`

**Interfaces:** Produces `loadTerms(): ComplianceTerms` where `Term = { id: TermId; title: Record<Locale,string>; body: Record<Locale, Segment[]> }`, `Segment = { text: string } | { linkId: string }`, and `links: Record<string, { url: string; label: Record<Locale,string>; status: 'verified'|'unverified'|'placeholder' }>`; `parseTerms(input: unknown): ComplianceTerms` lives in the pure `src/lib/termsSchema.ts` (runs under plain Node), `loadTerms()` in `src/lib/terms.ts` is the only reader of the JSON. Links are referenced from body by `linkId`, so staff edit URLs in one place.

- [ ] **Step 1: Write failing tests:** exactly 5 ids in the global order; every term has non-empty `en` and `ar`; every `linkId` resolves; every URL is `https:`; term 3 contains "appearance" (docx tracked change, typo "apperance" corrected); invalid fixture (missing `ar`) makes `loadTerms` throw with the offending path.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Author JSON from the docx (EN) with the three links from the legacy page: Official Public Decency Regulations PDF, Overview, Saudi Culture and Customs Guide, all `status: "placeholder"` until KFUPM supplies the working URLs. Arabic drafted by Claude at the user's request ("write the Arabic and we will review it") and flagged `"reviewStatus": "draft-needs-legal-review"` on every term; the three links are shipped now as the placeholder URLs per the user's instruction. `validate-terms.ts` prints a warning list (unverified/placeholder links, EN/AR `needs-review` in `meta.reviewStatus`) and exits non-zero on schema errors only. The three links use the legacy Google Site's URLs (the docx's Ministry of Interior URL, flagged "not working", is recorded in the `note`); none could be fetched from the build sandbox, so all are `unverified`.
- [ ] **Step 4:** Run tests + `npm run validate:terms` → PASS (with placeholder warnings).
- [ ] **Step 5: Commit** `feat(content): decouple policy terms and links into compliance-terms.json with validation`

### Task 5: Service layer (IT seams)

**Files:** Create `src/services/{types.ts,authService.ts,dbService.ts}`, `tests/unit/services.test.ts`

**Interfaces:**
- `interface Credentials { passportNumber: string; phoneNumber: string; fullName: string }`
- `interface Session { sessionId: string; student: Credentials; issuedAt: string }`
- `interface AuthService { login(c: Credentials): Promise<Session>; logout(): Promise<void> }`
- `interface SubmissionPayload { session: Session; locale: 'en'|'ar'; documentRef: 'KFUPM-INTL-PACF'; acceptedTermIds: TermId[]; signature: { method: 'draw'|'upload'; dataUrl: string }; submittedAt: string }`
- `interface SubmissionReceipt { referenceNumber: string; receivedAt: string }`
- `interface DbService { submitCompliance(p: SubmissionPayload): Promise<SubmissionReceipt> }`
- Exports `authService: AuthService`, `dbService: DbService` (mocks) and `createMockAuthService(opts?: { latencyMs?: number; failWith?: Error })`, `createMockDbService(opts?)`.

- [ ] **Step 1: Write failing tests:** mock login resolves a `Session` with a non-empty `sessionId`; `failWith` option rejects; `submitCompliance` resolves a receipt matching `/^PACF-\d{4}-[A-Z0-9]{6}$/`; submitting with fewer than 5 `acceptedTermIds` rejects (server-side rule the real backend must also enforce); no `console.*` call is made (spy).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement mocks with injectable latency (default 700 ms) and `// IT: replace this file's export` header comments. UI imports only the interfaces' exported singletons.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(services): mock authService and dbService behind swappable interfaces`

### Task 6: Shell — masthead, stepper, document frame

**Files:** Create `src/components/{Masthead,Stepper}.tsx`, update `src/App.tsx`, `src/state/flow.ts`, `tests/unit/flow.test.ts`

**Interfaces:** Produces `type Step = 'login'|'terms'|'sign'|'done'` and `flowReducer(state: FlowState, action: FlowAction): FlowState`; `<Stepper current={Step}/>`.

- [ ] **Step 1: Write failing tests:** reducer cannot reach `sign` without 5 accepted terms; cannot reach `terms` without a session; `back` from `sign` preserves accepted terms; stepper marks `aria-current="step"`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Load **frontend-design**, **design-taste-frontend**, **impeccable** now. Direction: Turquoise masthead carrying the negative lockup and gold rule; beige "paper" page; document card with `Document Ref` / `Stage` meta in tabular figures; the official Matrix used once, unaltered, as a quiet masthead edge. Photography is optional: KFUPM has confirmed it owns the supplied identity assets; use at most one portrait on the login screen if it earns its place.
- [ ] **Step 4:** Run → PASS; screenshot at 1280 and 360 px for review.
- [ ] **Step 5: Commit** `feat(ui): official masthead, stepper and flow state machine`

### Task 7: Login screen

**Files:** Create `src/lib/{normalise,validators}.ts`, `src/components/{Field,Button}.tsx`, `src/features/login/LoginScreen.tsx`, `tests/unit/validators.test.ts`, `tests/e2e/login.spec.ts`

**Interfaces:** `normaliseDigits(s: string): string` (Arabic-Indic and Persian digits → ASCII, trims, collapses whitespace); `passportSchema`, `phoneSchema`, `nameSchema` (valibot).

- [ ] **Step 1: Write failing tests:** passport accepts `A1234567`, `AB12345678`, `P<` rejected; 5–20 alphanumeric after normalisation and upper-casing; `٠٥٥١٢٣٤٥٦٧` normalises to `0551234567`; phone accepts `+966 55 123 4567` and `+44 7700 900123`, rejects `abc`, `123`; name accepts `محمد عبدالله الغامدي`, `Nguyễn Thị Mai`, `O'Brien-Smith`, rejects digits-only, 1 char, 101 chars (pins Review Focus 1–3).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Passport and phone inputs `dir="ltr"` with `autocomplete="off"`/`tel`, `inputMode`; name `dir="auto"`. Errors appear on blur then on change, announced via `aria-describedby` + `role="alert"` only for submit. Submit calls `authService.login`; pending state disables the button and keeps width stable.
- [ ] **Step 4:** Run unit + `npx playwright test login.spec.ts` (empty submit shows 3 errors; valid Arabic name proceeds; 320 px shows no horizontal scroll) → PASS.
- [ ] **Step 5: Commit** `feat(login): validated passport/phone/name screen wired to authService`

### Task 8: Step transitions and language-switch persistence

**Files:** Create `src/styles/motion.css`; modify `App.tsx`; Test `tests/e2e/flow.spec.ts`

- [ ] **Step 1: Write failing e2e:** after login the Terms heading is focused; toggling to Arabic on the Terms step keeps checked boxes and the entered name (pins Review Focus 8).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Load **animate** and **emil-design-eng**. Step transitions: a CSS transition from `@starting-style` (220 ms `cubic-bezier(0.23, 1, 0.32, 1)`, opacity + 12 px translate starting at the inline-end, so the offset flips in RTL, reversed when going back); **no exit animation** (new content is never delayed for a once-per-session action); focus moves to the new step heading; under `prefers-reduced-motion` the travel is dropped and a 160 ms fade stays ("gentler, not zero"). Nothing animates on first load. The Terms step ships a heading-only stub here; Task 9 fills it.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(ui): direction-aware step transitions and focus management`

### Task 9: Compliance checkpoints

**Files:** Create `src/features/terms/{TermsStep,TermCard,TermCheckbox}.tsx`; Test `tests/unit/terms-step.test.tsx`

**Interfaces:** `<TermCheckbox id: TermId, checked: boolean, onChange(checked: boolean): void, label: ReactNode/>` built on a native `<input type="checkbox">` (visually hidden) so Space/Enter, forms and screen readers work.

- [ ] **Step 1: Write failing tests:** the declaration header shows the student's full name and today's date (read-only) as soon as the step opens; five cards render in both locales from the JSON; "Continue" disabled until all five checked and announces "3 of 5 confirmed" via a polite live region; links open `target="_blank" rel="noopener noreferrer"` and show the placeholder status only in dev; `Select all` does **not** exist (each term is a deliberate act).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Tactile checkbox: press-down scale 0.94 at 80 ms, check-mark stroke draws in ~180 ms (SVG `stroke-dashoffset`), card border shifts to Turquoise and a gold inline-start rule grows on confirm; a "seal" progress meter fills 1/5 per term. Hit area ≥ 44×44 px, the whole card is the label.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(terms): five tactile compliance checkpoints rendered from JSON`

### Task 10: Signature (draw + upload)

**Files:** Create `src/features/signature/{SignatureStep,DrawPad,UploadZone}.tsx`, `src/lib/signature.ts`; Test `tests/unit/signature.test.ts`, `tests/e2e/signature.spec.ts`

**Interfaces:** `validateSignatureFile(f: File): { ok: true } | { ok: false; reason: 'type'|'size'|'empty' }`; `strokeLength(points: {x:number;y:number}[]): number`; `onChange(sig: { method: 'draw'|'upload'; dataUrl: string } | null)`.

- [ ] **Step 1: Write failing tests:** `image/png` 100 KB ok; `image/svg+xml` → `type`; `application/pdf` → `type`; 3 MB → `size`; 0 bytes → `empty`; a stroke shorter than 40 CSS px is not a signature (pins Review Focus 4–5).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Radix Tabs (`dir` from i18n). DrawPad wraps `signature_pad`, handles devicePixelRatio and resize without clearing, has Clear/Undo, a baseline guide line and `touch-action: none`; keyboard users are told the alternative is the Upload tab. UploadZone: drag-over state, click/Enter to browse, preview with remove, single file. Output normalised to PNG data URL; switching tabs keeps each tab's content, but only the active method is submitted.
- [ ] **Step 4:** Run unit + e2e (draw with mouse path enables Submit; upload fixture enables Submit; switching tabs keeps state) → PASS.
- [ ] **Step 5: Commit** `feat(signature): draw pad and drag-drop upload with strict validation`

### Task 11: Submission and receipt

**Files:** Create `src/features/receipt/ReceiptScreen.tsx`; modify `SignatureStep.tsx`; Test `tests/unit/submit.test.tsx`

- [ ] **Step 1: Write failing tests:** double-click on Submit calls `dbService.submitCompliance` once; rejection shows an error banner and keeps the signature and boxes; retry succeeds and shows the reference number (pins Review Focus 6); payload contains exactly the 5 ids and no extra PII.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. (Built across Tasks 10–11: the one-request-at-a-time guard, the failure banner with retry, and the `dbService` call live in `SignatureStep`, tested there; this task adds the receipt, the print view and the wipe.) Receipt shows reference number, timestamp, a "Print / Save as PDF" action with a print stylesheet that renders the signed declaration on a formal letterhead (Full Stacked lockup, official Seal, document ref), and a clear-session button that wipes memory.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(submit): mock submission, receipt and printable confirmation`

### Task 12: Break-UI stress pass

**Files:** Create `src/dev/WorstCaseToggle.tsx`; modify offending components; Test `tests/e2e/worst-case.spec.ts`

- [ ] **Step 0 (as built):** the break-ui skill's workflow ran against a dev-only `?data=worst` toggle; findings, fixes and open decisions are in `docs/qa/break-ui.md`. The worst-case Playwright projects run against the dev server (`worst-1280/360/320`).
- [ ] **Step 1: Write failing e2e:** with worst-case data (120-char Arabic name, 100-char unbroken Latin name, 20-char passport, `+` phone with 18 digits, 500-char term bodies, emoji) at 320 px: `document.documentElement.scrollWidth <= innerWidth` on every step, in both locales.
- [ ] **Step 2:** Run → FAIL (expected).
- [ ] **Step 3:** Load **break-ui**; fix with `overflow-wrap:anywhere`, `min-width:0` on flex/grid children, `text-wrap: balance/pretty`, container-width clamps. Toggle exists only when `import.meta.env.DEV`.
- [ ] **Step 4:** Run → PASS; confirm `dist/` contains no `WorstCaseToggle`.
- [ ] **Step 5: Commit** `fix(ui): harden layout against worst-case names, passports and long copy`

### Task 13: Design-guideline and contrast audit

- [ ] **Step 1:** Load **web-design-guidelines**; run its checklist against `src/` and write findings to `docs/audit.md`.
- [ ] **Step 2:** Add an e2e a11y check (axe-core via Playwright) per step and locale: zero serious/critical violations; keyboard-only run through the whole flow.
- [ ] **Step 3:** Fix findings (focus rings ≥ 3:1, label/for, `lang` on mixed-script spans, touch targets ≥ 44 px, no `outline: none`).
- [ ] **Step 4:** Run `npm run verify && npx playwright test` → PASS.
- [ ] **Step 5: Commit** `fix(a11y): resolve design-guideline and contrast audit findings`

### Task 14: Full Playwright suite

**Files:** `tests/e2e/{rtl-toggle,validation,submission,responsive}.spec.ts`

- [ ] **Step 0 (as built):** the skill's patterns were applied to the existing `@playwright/test` suite (role/label locators, web-first assertions, no fixed sleeps or `waitForSelector`); its ad-hoc `run.js` executor was not used because it would reinstall Playwright. Failure injection is dev-only (`?fail=login|submit`, projects `worst-*`); the width matrix is `tests/e2e/responsive.spec.ts`.
- [ ] **Step 1:** Load **playwright-skill**. Specs: RTL toggle flips `dir`, mirrors the stepper and back/forward arrows, keeps font families (Plex Arabic computed); validation states for all three fields in both locales; full happy-path submission with draw and with upload; submission failure + retry (inject a failing `dbService` through a test-only query-flag-free hook, e.g. `window.__PACF_TEST__` set in `main.tsx` only in test mode); no-horizontal-scroll matrix at 320/360/768/1280/1920.
- [ ] **Step 2:** Run `npx playwright test` → all PASS on desktop, 360 and 320 projects.
- [ ] **Step 3: Commit** `test(e2e): rtl toggle, validation, submission and responsive suites`

### Task 15: Cloudflare deploy and IT hand-off

**Files:** Create `public/_headers`, `docs/HANDOFF.md`; modify `wrangler.jsonc`

- [ ] **Step 1:** `public/_headers`: strict CSP (`default-src 'self'; img-src 'self' data: blob:; frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, long cache for hashed assets.
- [ ] **Step 2:** `docs/HANDOFF.md`: (a) how staff edit `compliance-terms.json` and run `npm run validate:terms`; (b) exactly which two files IT replaces (`authService.ts`, `dbService.ts`) and the contracts they must satisfy, including server-side enforcement of the 5-term rule and encrypting PII at rest; (c) `npx wrangler deploy` with `CLOUDFLARE_API_TOKEN` (deployment requires KFUPM's Cloudflare account — not performed from this environment).
- [ ] **Step 3:** `npm run build && npx wrangler deploy --dry-run` → PASS.
- [ ] **Step 4: Commit** `docs(deploy): security headers, Cloudflare config and IT hand-off guide`

---

## Self-Review

- **Spec coverage:** Phase 1 → Tasks 3, 4; Phase 2 → Tasks 5, 7; Phase 3 → Tasks 9, 10, 11; Phase 4 → Tasks 2, 6, 12, 13; skills map → Task 0; Playwright → Task 14; Cloudflare → Tasks 1, 15. No gaps.
- **Type consistency:** `TermId`, `Locale`, `Credentials`, `Session`, `SubmissionPayload` are defined once (Tasks 4–5) and reused by name afterwards.
- **Open items blocking exact copy:** see "Decisions needed" in the hand-off message (Arabic legal text, real URLs, Student ID).
