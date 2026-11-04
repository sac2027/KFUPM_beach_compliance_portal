# Architecture map

A snapshot (2026-11-04, beach portal) of how `src/`, `functions/` and `scripts/` fit together, built with graphify from the
code itself: 542 symbols and files, 1,270 relationships, 99% read directly from the source and 1% inferred (8 links), in 20
clusters. The previous Pre-Arrival version of this map is in `docs/archive/pre-arrival/` history.

- Open **`graph.html`** in a browser for the interactive map (no server needed).
- **`GRAPH_REPORT.md`** is the generated report: clusters, the most-connected symbols and suggested questions.

## How to read it

| Cluster | What it is |
| --- | --- |
| App shell and UI components | `App`, the masthead, language toggle, buttons and icons |
| Login form, validation and dev hooks | the sign-in screen, `src/lib/validators.ts`, the dev-only stress hooks |
| Step flow, history and panel | the step state machine, browser Back and Forward, the animated panel |
| Language provider (en/ar) and tests | the provider, both dictionaries, locale detection |
| Terms schema, print sheet and checker | `compliance-terms.json`, its schema, the term cards, the printable declaration, `validate-terms` |
| Email endpoint (functions) | `functions/api/declarations.ts`, field checks, the rate limit and the Resend driver |
| PDF rendering | the browser-side PDF made from the print sheet |
| Signature image checks | drawn and uploaded signature validation |
| Colour palette and contrast | the single source of colour and the contrast test |
| Playwright suite | the real-browser tests |

## What it tells us

The browser holds everything: the only edge that leaves it is the PDF post to `/api/declarations`. There is no database
cluster any more, which is the point of this version. The most-connected symbols are the language hook, the test helpers and
the shell, so a change to strings or the shell touches many tests; run `npm run verify` after either.
