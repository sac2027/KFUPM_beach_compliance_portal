# Design-guideline and accessibility audit

Reviewed against Vercel's Web Interface Guidelines (fetched fresh; the fetch returned a category summary, which covers
accessibility, focus, forms, animation, typography, content, images, performance, navigation, touch, safe areas, dark
mode, i18n, hover and copy) plus WCAG 2.2 AA. Method: a mechanical sweep of `src/` for the checkable rules, a read of
each component for the judgement-based ones, then automated checks in a real browser: axe-core on every step in both
languages (`tests/e2e/a11y.spec.ts`), and a keyboard-only walk of the whole flow with a visible-focus check at every stop.

## Fixed

| Area | Finding | Fix |
| --- | --- | --- |
| Destructive action | "Finish and clear my details" deleted the only copy of the printable declaration in one click | Two steps: an inline warning with "Yes, clear my details" / "Keep my declaration"; focus moves to the decision and back |
| Forms | Leaving the tab mid-form loses progress silently | `beforeunload` confirmation on the terms and signature steps only (`src/lib/useLeaveWarning.ts`) |
| Focus | Bare `outline: none` on the step heading | Ring on `:focus-visible` so keyboard users see where they landed; none for mouse |
| Focus | Skip link target (`main`) not reliably focusable | `tabIndex={-1}` on `main` |
| Touch | No `touch-action: manipulation` (300 ms double-tap delay) | Set on links, buttons, labels, inputs, tabs; the signature canvas keeps `none` |
| Hover | Four hover states fired on tap | Gated with `(hover: hover) and (pointer: fine)` |
| Safe areas | `viewport-fit=cover` with no `env(safe-area-inset-*)` handling | Removed; the browser insets content itself |
| Typography | Straight apostrophes in five error strings | Curly (`couldn’t`, `can’t`, `that’s`) |
| i18n | Names, reference numbers and document refs could be machine-translated | `translate="no"` on them (browser translation of the rest stays available to students who speak neither English nor Arabic) |
| Navigation | No way to link to the Arabic form | `?lang=ar` / `?lang=en`, taking priority over a stored choice |
| Images | Masthead logo not prioritised | `fetchPriority="high"` |

## Checked and passing

- axe-core (WCAG 2.0/2.1/2.2 A and AA, best practice): **0 violations** on login (empty and with errors), terms, signature
  (draw, and upload with an error), receipt, and the clear-confirmation, in English and Arabic. The scanner was
  confirmed to flag known-bad markup in this same setup.
- Keyboard only: skip link, language switch, three fields, submit with Enter, five checkboxes with Space, tabs with arrow
  keys, file input, submit, and the two-step clear all work, in a sensible order, with a ≥ 2 px visible focus indicator
  at every stop (the visually hidden checkbox and file input show their ring on the proxy element).
- Headings: one `h1`, `h2` per step, `h3` per term. Landmarks: header, main, footer. Labels for every control; errors tied
  with `aria-describedby`; live regions for progress (`polite`) and failures (`alert`).
- Animation: `prefers-reduced-motion` honoured; only `transform`, `opacity`, `clip-path` and colour transitions; no
  `transition: all`. Pinch-zoom is allowed. Dark-mode meta (`color-scheme: light`, `theme-color`) set.
- Content: no truncation anywhere; every grid/flex child can shrink; worst-case data fits (see `docs/qa/break-ui.md`).
- Forms: `autocomplete` (`off` for passport, `tel`, `name`), `inputmode`, `type="tel"`, paste is never blocked, labels are
  clickable. Numbers use `Intl` and tabular figures; ellipses are `…`.

## Deliberately not applied

- **Title Case headings and buttons.** The guideline prefers it; this portal uses sentence case, which reads as plainer
  and matches the legacy form's own tone. Say so if KFUPM's style guide requires Title Case.
- **Non-breaking space in "2 MB".** Low value, and it would add an invisible character to the translation files.
- **Image dimensions on the uploaded-signature preview.** Its size is only known after decoding; the reserved layout
  space is the capped height (8 rem), so there is no layout shift to prevent.
- **URL reflecting the step.** The step is not in the URL on purpose: nothing about a student's progress should be in a
  link or history entry (see the open decision about Back in `docs/qa/break-ui.md`).

## Phase 2 (2026-11-02)

Re-audited after the redesign and the real services: axe-core 0 violations on every step in both languages, including
the new email field, the change-details and clear-details confirmations, the email-status line and its retry; the
keyboard-only walk now covers four fields and the two confirmations. The design linter reports 0 FAIL / 0 WARN; the
inspector 0 FAIL at 1440 / 768 / 390 (its one warning, the centred sheet leaving the sides free, is the design).

Fixed in this phase: the masthead lost the Matrix strip and the location line (the user's request and the brand guide's
"use selectively"); the title is a centred, ruled title; icons accompany every action with a text label (never alone);
directional icons are chosen per writing direction instead of mirrored; the lockup's optical margin no longer leaves the
screen on phones; large-text layouts no longer squeeze the term titles (see `docs/qa/break-ui.md` #11).

Deliberately kept: sentence case; square corners; the brand's turquoise bar (an institutional bar, not an app sidebar).
