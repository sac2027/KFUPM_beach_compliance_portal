# KFUPM University Beach Compliance Portal: Design

## Intent
Students must read and sign the University and University Beach Regulations & Procedures before using the beach. The
Pre-Arrival portal is adapted: no database or roster, sign-in that accepts any well-formed details, and a signed PDF
emailed to the address the student typed.

## Goals
- Five bilingual terms rendered from `src/data/compliance-terms.json`, edited by staff without touching screens.
- Sign-in with full name, email, phone (country code) and passport number, validated for format only.
- The signed declaration is rendered to a one-page A4 PDF in the browser and emailed through Resend, with a copy to a deanship mailbox.
- Full EN LTR / AR RTL mirroring; zero horizontal scroll from 320 px to 1920 px.
- A new background that is subtle and institutional, using official brand colours only.

## Non-goals
Real SSO, a roster check, any server-side storage, an admin UI, analytics.

## Anti-goals
Student data in URLs, storage or logs. A decorative background that competes with the text. The Matrix in any form.

## Approaches considered (background)
1. **Shoreline (chosen):** a turquoise sea band behind the masthead, a thin light-blue shallows line, beige sand below, the white sheet crossing the waterline. Three flat brand colours, no gradients, no motion.
2. Photographic beach header: needs licensed imagery and risks distraction and heavy pages.
3. Wave or ripple pattern: reads as generic decoration and is hard to keep calm in print and RTL.

## Decisions
- Arabic is restored from the old repo history and drafted by Claude, flagged for Deanship review.
- Arabic headings fall back to IBM Plex Sans Arabic (KFUPM Display has no Arabic glyphs); to confirm against the brand guide.
- With no database, the BCC mailbox is the only record, so it is required in production.
- The email endpoint is open (no roster), so it validates strictly, rate-limits per IP and is paired with a Cloudflare rate-limiting rule.
- The English term wording is verbatim from the brief; splitting terms into a lead sentence plus points is layout only. Intro and closing text are drafted for review.

## Left to the builder
Exact spacing, sea band height, Arabic phrasing of UI strings, email copy.

## Task 7 critique round (shoreline ground)

Checked with the design-taste lint (0 findings) and inspector in app mode at 1440, 768 and 390 px, plus screenshots of sign-in and terms at 1280 and 360 px in English and Arabic.

- **Worked:** the sea band runs into the masthead, so the lockup sits on the sea; the white sheet crosses the shallows line; both reading directions look the same because the ground spans the full width and nothing is mirrored.
- **Fixed:** the title wrapped to three lines (a narrow measure from the old design). It now takes the full sheet width and fits two lines from 390 px up.
- **Defended:** the inspector warns that 22% of the first screen is strongly coloured. That is the sea band, the one deliberate memorable element, in the brand's own turquoise. A 320 px phone still sets the title in three lines.
- **Pairings:** blue on turquoise and turquoise on beige, both on the brand's approved list (as recorded in the original portal plan).
