# Hand-off guide

For Student Affairs staff (wording), KFUPM IT (systems and deployment), and whoever maintains this next.
For the step-by-step Cloudflare setup and account hand-over, see `docs/HANDOVER.md`.

## What this is

A static single-page app (Vite, React, TypeScript) served by Cloudflare. A student goes through four steps:
**sign in** (full name, email, nationality, passport number) → **confirm five terms** → **sign** (draw, or upload an image)
→ **receipt** (reference number, and a printable signed declaration). Everything the student types stays in the
browser's memory; nothing is written to storage, URLs or logs. The two places that talk to the outside world are
deliberately small and replaceable (section 3), and are mocks today.

## 1. For Student Affairs staff: editing the wording

All policy wording, the three external links, and the document title live in **one file**:
`src/data/compliance-terms.json`. You never need to touch the screens.

```jsonc
{
  "meta":     { "reviewStatus": { "en": "needs-review" } },  // set to "approved" once signed off
  "document": { "ref": "KFUPM-INTL-PACF", "stage": {...}, "title": {...}, "intro": {...}, "closing": {...} },
  "links": {                                  // every external URL is defined once, here
    "pdr-pdf": { "url": "https://…", "label": { "en": "…" }, "status": "unverified" }  // → "verified" when checked
  },
  "terms": [                                  // exactly five, in this order: saudi-laws, cultural-norms,
    { "id": "saudi-laws",                     //   university-policies, representation, reporting
      "title": { "en": "…" },
      "body":  { "en": [ { "text": "…" }, { "strong": "bold words" }, { "linkId": "pdr-pdf" } ] } }
  ]
}
```

- A body is a list of pieces: plain `text`, `strong` (bold) and `linkId` (a link defined under `links`). The portal is English
  only; the `{ "en": … }` shape is kept so another language can be added back later.
- After editing, run `npm run validate:terms`. It rejects a broken file with the exact path of the problem, and warns about
  anything that should be resolved before launch (unverified links, wording not yet marked `approved`, very long text).
- Never type a URL or policy sentence anywhere else: a test fails if one appears in the screens' code.
- The English intro and terms 1–2 match the legacy Google Site word for word (a test pins this). If KFUPM approves new
  wording, change the JSON **and** the matching strings in `tests/unit/terms.test.ts` in the same change.
- The Arabic version was removed at the Deanship's request; nothing in the repository depends on it.
- Changes go live when they are merged and deployed (section 4).

## 2. User-interface text (not policy)

Labels, buttons and error messages are in `src/i18n/en.json`. `{n}` style placeholders are filled in by the code.

## 3. For IT: the systems behind the form

Phase 2 replaced the mocks with real services, all on Cloudflare. `docs/HANDOVER.md` is the step-by-step walkthrough
for creating them and handing the account over; this section is the map.

| Piece | Where | What it holds |
| --- | --- | --- |
| Roster | D1 `pacf-roster`, table `students` | Who may sign in: passport number (key), name as in the passport, the student's own email, programme. Imported from CSV with `npm run roster:import`. |
| Records | D1 `pacf-records`, table `submissions` | One row per signed declaration: name, **last four of the passport only**, email, nationality, the five term ids, signature and PDF keys, timestamps, email status. Also `sessions`, `verify_attempts` and the `outbox` (log-mode email). |
| Documents | R2 `pacf-documents` | `submissions/<id>/declaration.pdf` and `signature.png`. |
| API | `functions/api/` (Pages Functions) | `POST /verify`, `POST /submissions`, `PUT /submissions/:id/document`, `POST …/resend-email`, `GET …/document.pdf`, `GET /health`. |
| Email | `functions/lib/email.ts` | Resend (HTTP API) when `EMAIL_MODE=resend`; otherwise the outbox table. Microsoft Graph is the natural institutional replacement: one driver function. |

Rules the API enforces regardless of the browser: all four sign-in factors must match an active roster row (one generic
refusal, failures throttled per passport and per IP); a session lasts 30 minutes and records one submission; exactly the
five term ids in order; the signature must be a real PNG/JPEG ≤ 2 MB; the document a real PDF ≤ 8 MB; the email goes to
the roster address, never to one typed in the browser.

To swap the sign-in for KFUPM SSO later: keep `POST /api/verify`'s response shape (a `Session` with a Bearer token) and
replace its body; nothing in the browser changes.

## 4. Deploying

The Pages project builds from Git on every push (build `npm run build`, output `dist`). Bindings come from
`wrangler.jsonc`; secrets are set in the Pages project (see `docs/HANDOVER.md` §5). Before the first real deployment run
`npm run release:check` locally; it stays red until the wording and links in section 1 are resolved.

## 5. Tests

| Command | What it covers |
| --- | --- |
| `npm run verify` | Types, lint, ~200 unit tests, terms-file schema; includes a test that builds the production bundle and proves none of the stress-test tooling ships |
| `npm run test:e2e` | ~280 real-browser tests against the local API and databases (`wrangler pages dev`): English, 320 / 360 / 768 / 1280 / 1920 px, keyboard only, accessibility (axe), sign-in refusals and throttling, failure and retry of every network step, the stored and emailed PDF (byte-identical to the download), the printed PDF, the security policy |
| `npm run release:check` | Both of the above, the strict wording gate, and a production build |

The browser tests need Chromium (`npx playwright install chromium`), `poppler-utils` (they read the generated PDF) and a
`.dev.vars` file (`cp .dev.vars.example .dev.vars`). To see the stress data, run `npm run dev` with `npm run dev:api`
in another terminal and open `/?data=worst`; `?fail=login|submit|document` makes the next such call fail once.

## 6. Brand assets and fonts

- `public/brand/`: Full Stacked lockup (unaltered), two FAST Matrix exports, and the seal. **The seal in the repo is the old
  one and must be replaced with the official Primary or Secondary seal (Brand Guidelines §4.2).** It appears only on the
  printed declaration.
- `public/fonts/`: KFUPM Display (served exactly as supplied; its licence forbids modification or reproduction, so **keep
  this repository private**) and IBM Plex Sans Arabic (open licence).
- Rules baked into tests: the lockup and Matrix are never altered, the Matrix is never mirrored, and the display
  font never renders text a student typed.

## 7. Before launch

- [ ] KFUPM reviews the English wording; set `meta.reviewStatus` to `approved`.
- [ ] Verify the three links open the right documents; set each `status` to `verified`. The docx notes the Ministry of
      Interior link as not working; the alternative URL is recorded in the `note` field.
- [ ] Replace the seal with the official artwork.
- [ ] Follow `docs/HANDOVER.md`: create the databases and bucket, set the secrets, import the real roster (the four test
      students are the only ones who can sign in until then).
- [ ] Email: verify the KFUPM domain in Resend (IT adds three DNS records) so messages come from the deanship address and
      reach everyone; until then only the Resend account's own address receives mail.
- [ ] Decide the open questions in `docs/qa/break-ui.md` (Back button and reload behaviour, and the others listed there).
- [ ] `npm run release:check` passes (the strict wording gate stays red until the items above are done).
- [ ] Confirm the repository is private.
- [ ] Attach the domain and deploy.

## 8. Where things are

```
src/data/compliance-terms.json   all policy wording and links          src/features/   one folder per step
src/i18n/                        interface text (English)              src/services/   the two replaceable files
src/lib/                         validation, formatting, signatures    src/styles/     tokens, shell, forms, print
public/_headers                  security headers and caching          docs/           plan, design, audits
```
