# KFUPM Pre-Arrival Compliance Portal

The English form international students complete before arriving at KFUPM: they sign in with
the name, email and passport number KFUPM holds for them (and choose their nationality), confirm five terms, sign, and receive their signed declaration by email as a PDF.
It replaces the legacy Google Sites form and runs on Cloudflare Pages with D1 and R2.

- **Staff editing the wording, IT, deploying:** read [`docs/HANDOFF.md`](docs/HANDOFF.md); the Cloudflare setup and
  account hand-over walkthrough is [`docs/HANDOVER.md`](docs/HANDOVER.md).
- Design decisions: [`docs/superpowers/specs`](docs/superpowers/specs). Plan: [`docs/superpowers/plans`](docs/superpowers/plans).
- Stress-test and accessibility findings: [`docs/qa/break-ui.md`](docs/qa/break-ui.md), [`docs/audit.md`](docs/audit.md).

```bash
npm ci
cp .dev.vars.example .dev.vars && npm run db:migrate:local && npm run db:seed:local
npm run build && npm run dev:api   # http://127.0.0.1:8788 with the API and local databases
npm run dev          # http://localhost:5173, hot reload, API proxied to 8788
npm run verify       # types, lint, unit tests, terms-file check
npm run test:e2e     # real-browser tests (needs Chromium and poppler-utils)
npm run release:check  # everything above, plus the strict launch gate, plus a production build
```
