# Hand-off guide

For Student Affairs staff (wording), KFUPM IT (systems and deployment), and whoever maintains this next.
For the Cloudflare and Resend setup, see `docs/HANDOVER.md`.

## What this is

A static single-page app (Vite, React, TypeScript) in English and Arabic, served by Cloudflare Pages, plus one function. A
student goes through four steps: **sign in** (email and passport number) then **confirm five terms** then **sign** (draw, or
upload an image) then **receipt** (reference number, a PDF by email, and a printable signed declaration). Everything the
student types stays in the browser's memory; nothing is written to storage, URLs or logs. Nothing is stored on a server.

## 1. For Student Affairs staff: editing the wording

All policy wording and the document title live in **one file**: `src/data/compliance-terms.json`. You never need to touch the screens.

```jsonc
{
  "meta":     { "reviewStatus": { "en": "needs-review", "ar": "needs-review" } },   // "approved" once signed off
  "document": { "ref": "KFUPM-UBR", "scope": {...}, "title": {...}, "intro": {...}, "closing": {...} },
  "links":    {},                               // optional external links, each defined once: { url, label: {en, ar}, status }
  "terms": [                                    // exactly five, in this order: dress-code, cleanliness,
    { "id": "dress-code",                       //   respect-privacy, beach-regulations, swimming-safety
      "title":  { "en": "…", "ar": "…" },
      "body":   { "en": [ { "text": "…" } ], "ar": [ { "text": "…" } ] },     // the lead sentence
      "points": { "en": [ [ { "text": "…" } ] ], "ar": [ [ { "text": "…" } ] ] } }  // optional bullet points
  ]
}
```

- A piece of text is a list of segments: plain `text`, `strong` (bold) and `linkId` (a link defined under `links`).
- `points` is optional. English and Arabic must have the same number of points; the checker rejects a file that does not.
- After editing, run `npm run validate:terms`. It rejects a broken file with the exact path of the problem and warns about
  anything to resolve before launch (wording not yet `approved`, unverified links, very long text).
- Never type a URL or policy sentence anywhere else: a test fails if one appears in the screens' code.
- The English terms are word for word from the brief of 2026-11-03; a test pins each one. If the Deanship approves new wording,
  change the JSON **and** the matching strings in `tests/unit/terms.test.ts` in the same change.
- The Arabic text, and the English intro and closing sentences, were drafted by Claude and are marked `needs-review`.
- Changes go live when merged and deployed (section 4).

## 2. User-interface text (not policy)

Labels, buttons and error messages are in `src/i18n/en.json` and `src/i18n/ar.json`. They must have identical keys (a test checks).
`{n}` style placeholders are filled in by the code.

## 3. For IT: the two replaceable files and the one endpoint

| Piece | Where | What it does |
| --- | --- | --- |
| Sign-in | `src/services/authService.ts` | Accepts any well-formed email and passport number, in the browser. To use KFUPM SSO later, replace its `login` and keep the `Session` shape. |
| Declarations | `src/services/dbService.ts` | Checks the declaration and issues the reference number in the browser, then posts the PDF to `/api/declarations`. The file name stays for lineage; nothing is stored. |
| Endpoint | `functions/api/declarations.ts` | Validates the form, limits requests per IP, and emails the PDF through Resend, copying `EMAIL_BCC`. |
| Email | `functions/lib/email.ts` | Resend (HTTP API) when `EMAIL_MODE=resend`; otherwise sends nothing. |
| Health | `functions/api/health.ts` | Reports whether email is configured. |

Because the student chooses the address and no roster exists, the endpoint is open to anyone: see `docs/HANDOVER.md` section 6.
The PDF is rendered in the student's browser from the declaration they see (so Arabic shapes correctly) and is the same file
that is emailed and downloaded.

## 4. Deploying

The Pages project builds from Git on every push (build `npm run build`, output `dist`). Settings come from `wrangler.jsonc`;
the one secret is set in the Pages project (see `docs/HANDOVER.md`). Before the first real deployment run
`npm run release:check`; it stays red until the wording is approved.

## 5. Tests

| Command | What it covers |
| --- | --- |
| `npm run verify` | Types, lint, about 215 unit tests, terms-file schema; includes a test that builds the production bundle and proves none of the stress-test tooling ships |
| `npm run test:e2e` | About 245 real-browser tests against the local API: English and Arabic, 320 to 1920 px, keyboard only, accessibility (axe), failure and retry of every network step, the emailed PDF, the printed page, the security policy |
| `npm run release:check` | Both of the above, the strict wording gate, and a production build |

The browser tests need Chromium (`npx playwright install chromium`), `poppler-utils` (they read the generated PDF) and a
`.dev.vars` file (`cp .dev.vars.example .dev.vars`). To see the stress data run `npm run dev` with `npm run dev:api` in another
terminal and open `/?data=worst`; `?fail=login|submit|document` makes the next such call fail once.

## 6. Brand assets and fonts

- `public/brand/`: Full Stacked lockup (unaltered) and the seal. **The seal in the repo is the old one and must be replaced with
  the official Primary or Secondary seal (Brand Guidelines section 4.2).** It appears only on the printed declaration.
- The page ground (`src/styles/shore.css`) is drawn in CSS from the brand's turquoise, blue and beige. The FAST Matrix is not used.
- `public/fonts/`: KFUPM Display (served exactly as supplied; its licence forbids modification or reproduction, so **keep this
  repository private**) and IBM Plex Sans Arabic (open licence), which also sets Arabic headings.
- Rules baked into tests: the lockup is never altered or mirrored, and the display font never renders text a student typed.

## 7. Before launch

- [ ] KFUPM reviews the English and Arabic wording (including the intro and closing sentences); set both `meta.reviewStatus` values to `approved`.
- [ ] Replace the seal with the official artwork.
- [ ] Follow `docs/HANDOVER.md`: set `EMAIL_BCC`, the `RESEND_API_KEY` secret and the WAF rate-limiting rule.
- [ ] Verify the KFUPM domain in Resend so messages come from the Deanship address and reach everyone.
- [ ] `npm run release:check` passes.
- [ ] Confirm the repository is private; attach the domain and deploy.

## 8. Where things are

```
src/data/compliance-terms.json   all policy wording                 src/features/   one folder per step
src/i18n/                        interface text (English, Arabic)   src/services/   the two replaceable files
src/lib/                         validation, formatting, signatures src/styles/     tokens, shell, shore, forms, print
functions/                       the email endpoint                 docs/           plan, design, audits, architecture
public/_headers                  security headers and caching
```
