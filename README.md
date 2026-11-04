# KFUPM University Beach Compliance Portal

The bilingual (English and Arabic) form students complete before using the University Beach: they sign in with their
email and passport number, confirm five terms of the University and University Beach Regulations &
Procedures, sign, and receive the signed declaration by email as a PDF. Nothing is stored on a server.

- **Staff editing the wording, IT, deploying:** read [`docs/HANDOFF.md`](docs/HANDOFF.md); the Cloudflare setup and
  account hand-over walkthrough is [`docs/HANDOVER.md`](docs/HANDOVER.md).
- Design decisions: [`docs/superpowers/specs`](docs/superpowers/specs). Plan: [`docs/superpowers/plans`](docs/superpowers/plans).
- Stress-test and accessibility findings: [`docs/qa/break-ui.md`](docs/qa/break-ui.md), [`docs/audit.md`](docs/audit.md).

```bash
npm ci
cp .dev.vars.example .dev.vars     # email in log mode: nothing is sent
npm run build && npm run dev:api   # http://127.0.0.1:8788 with the API
npm run dev          # http://localhost:5173, hot reload, API proxied to 8788
npm run verify       # types, lint, unit tests, terms-file check
npm run test:e2e     # real-browser tests (needs Chromium and poppler-utils)
npm run release:check  # everything above, plus the strict launch gate, plus a production build
```
