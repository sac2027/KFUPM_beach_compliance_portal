# KFUPM University Beach Compliance Portal

Bilingual (EN LTR / AR RTL) Vite + React + TypeScript app, adapted from the Pre-Arrival Compliance Portal. Deployed to Cloudflare Pages with one Pages Function and Resend email. No database or bucket. Plan: `docs/superpowers/plans/2026-11-03-beach-portal-adaptation.md` (its **Global Constraints** apply to every task). Design: `docs/superpowers/specs/2026-11-03-beach-portal-design.md`.

## Commands
`npm run verify` (typecheck + lint + unit tests + terms validation) must be green before every commit. `npm run test:e2e` runs Playwright. One atomic commit per plan task.

## Hard rules
- All policy text and external URLs live only in `src/data/compliance-terms.json`. No policy string or URL in `.tsx`.
- UI talks to I/O only through `src/services/authService.ts` and `dbService.ts`.
- CSS logical properties only; no `left`/`right` in component CSS. Animate `transform`/`opacity` only; honour `prefers-reduced-motion`. No gradients, no resting shadows.
- PII (passport, phone, email, name, signature) is memory-only: never in URLs, storage, `console.*` or server logs.
- Brand: Full Stacked lockup unaltered; Seal only on the print view. Headlines KFUPM Display, body and typed text IBM Plex Sans Arabic, fallback Segoe UI/system-ui. KFUPM Display never renders user text. Green `#009767` is never body text. WCAG 4.5:1 wins over the brand chart.
- The FAST Matrix is removed and must not return.
- Bilingual: every UI string in `en.json` and `ar.json` with identical keys; every policy string in `{ en, ar }`. Mirror with logical CSS; swap directional icons, never transform them.
- No D1, R2, KV or Durable Object bindings. Only secret: `RESEND_API_KEY`.

## Skills by phase (re-load after a context reset)
- Planning / architecture (Tasks 1-4): writing-plans, brainstorming, graphify
- Visual design (Tasks 5-7): frontend-design, design-taste-frontend, impeccable
- Motion (Task 7): emil-design-eng, animate
- Stress and audit (Task 8): break-ui, web-design-guidelines
- Tests (Task 9): playwright-skill
