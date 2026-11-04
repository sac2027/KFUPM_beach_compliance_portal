# Architecture map

A snapshot (2026-11-02, phase 2) of how `src/`, `functions/` and `scripts/` fit together, built with graphify from
the code itself: 341 symbols, 820 relationships, every one read directly from the source (none inferred by a model),
12 clusters.

- Open **`graph.html`** in a browser for the interactive map (no server needed).
- **`GRAPH_REPORT.md`** is the generated report: clusters, the most-connected symbols, and the questions the graph suggests.

## How to read it

| Cluster | What it is |
| --- | --- |
| App shell and step flow | `App`, the masthead, language toggle, `StepPanel`, and the step state machine |
| Login form and input validation | the login screen and `src/lib/validators.ts` |
| Policy terms | `compliance-terms.json`, its loader and schema, and the term cards |
| Signature step | draw pad, upload zone, tabs, and the shared `Button` |
| Receipt and printable declaration | the receipt screen, the print sheet, date formatting |
| Browser API clients | `authService.ts`, `dbService.ts`, `http.ts`: thin clients for the API |
| Sign-in verification (API) | `functions/api/verify.ts` with matching, throttling and session tokens |
| Documents and email (API) | the submission endpoints, R2 storage, the email drivers |
| Language and i18n | the provider, the dictionaries, locale detection |
| Roster import and export scripts | `scripts/roster-import.ts`, `scripts/data-export.ts` |

## What it tells us

- **No import cycles.** Dependencies run one way: screens → components and libraries → data and services; the API
  (`functions/`) shares nothing with the browser code except the pure `match.ts` rules (used by the roster importer too).
- **The core abstractions are the right ones.** `useI18n()` (31 links) is the most connected symbol, then `Icon`,
  `Shell`, `Button`, the API's `error()` helper and `ServiceError`: language, the one icon vocabulary, the page frame, the
  one shared control, and the two error paths.
- **The weak "cohesion" scores and "should this be split?" suggestions are mostly an artifact of those shared hubs.** Every
  screen uses `useI18n` and `Button`, which makes clusters look loosely coupled to each other. They are not candidates for
  splitting.
- **One coupling to know about:** the browser clients and `src/lib/terms.ts` import small dev-only helpers
  (`src/dev/worstCase.ts`) for the stress and failure-injection modes. All of it is guarded by `import.meta.env.DEV` and
  removed from the production bundle (a test proves it).

## Regenerating

The map is a snapshot and will drift as the code changes. To rebuild it: `pip install graphifyy`, then run graphify's
pipeline on `src/`, `functions/` and `scripts/` (code only, so no AI extraction is needed).
