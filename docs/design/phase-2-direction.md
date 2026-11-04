# Phase 2 design direction (Task 8)

Mode: **Operate** (the student is completing a task), so expression is restraint and precision. The reference is an
official document on a desk, not a landing page. The design-taste app-screen chapter's numbers are used where they fit a
form; its dashboard kinds (KPIs, charts, sidebars) do not apply, so no direction was dealt.

## What changes

| Element | Before | After | Why |
| --- | --- | --- | --- |
| Masthead | Turquoise band + portal name + "Dhahran…" + 56–72 px Matrix strip | One quiet 64 px turquoise bar: negative lockup at the inline-start, language switch at the inline-end. Nothing else. | The user: the Matrix "looks very bad in the heading"; the location line is noise; the lockup already names the institution. |
| Matrix | In the masthead | **Once**, as the page's ground: the beige/sand generator export, full colour (approved pairing), fixed to the bottom-inline-end of the viewport at about 60 vw, cropped by the viewport, the white sheet overlapping it. In RTL it sits at the bottom-inline-end too (moved, never mirrored). | Brand guide: used selectively, as a crop, never altered; the user asked for something better than "plain colour". |
| Document head | Ref / Stage / Requirement block beside a start-aligned title | Centred title in KFUPM Display (28 px desktop / 22 px phone), a 3 px × 48 px turquoise rule centred under it, then the intro paragraph start-aligned. No meta block. | The user: remove the block; the title "is not centered and doesn't look like a title". Centred title + start-aligned body is how formal documents are set. |
| Stepper | Four segments with "1 Sign in" labels | Same four segments, labels 13 px, current in ink, the rest turquoise at 500; the phone keeps the current-step row | It works; make it quieter. |
| Sheet | Padding 2.5 rem | Padding 3 rem desktop, max width 52 rem (65 ch body), 1.25 rem phone | Reading measure for legal text. |
| Controls | 48 px inputs/buttons, square | Keep: one height (3 rem), square corners, one filled primary per screen (turquoise), quiet secondary as text | Chapter §8.3: one filled primary; §8.1: one control height. |
| Icons | None | `lucide-react`, 18 px, stroke 1.75, 10 px from the label; on sign in, continue, back, sign and submit, download, print, clear, undo, upload, language, email sent/failed. Directional ones flip in RTL. | The user asked for icons; outline icons, never in a tinted disc (§9.4). |
| Type scale | 14 / 16 / 17 / 20 / 28 | 12 / 14 / 16 / 20 / 28 (title 28, step headings 20, body 16, labels 14/500, meta 12). Weights 400 / 500 / 700; 700 only for the title and the reference number. | §9.1: 4–6 sizes, one weight at 700 per screen. |
| Colour | Turquoise text on beige page, gold hover on the toggle | Unchanged palette; accent (turquoise) on the primary action, progress and links only; gold stays off the screen (print band only). | §9.2: one accent family, on actions. |
| Motion | Step slide + checkbox reveal + press scale | Unchanged (already within the Emil rules); nothing new animates on load. | |

## What stays deliberately

Square corners (decided in phase 1); the tactile term cards; the sticky progress meter on tall screens; sentence case;
no cards-with-icons, no eyebrows, no gradients, no shadows at rest, no tracked caps.

## Checks before the task is done

`lint.mjs` 0 FAIL; `inspect.mjs --app` 0 FAIL at 1440 / 768 / 390 (the masthead colour warning is defended: brand
bar); axe 0; screenshots of login, terms, sign and receipt at 1280 and 360 in both languages, critiqued once and fixed.
