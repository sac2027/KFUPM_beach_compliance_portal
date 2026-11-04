# Break-UI stress report: University Beach portal

Method: the `break-ui` skill. The stress data enters through the same boundaries as real data: the staff-edited terms file
(`src/dev/worst-case-terms.json`, shown with `npm run dev` and `/?data=worst`, never shipped), the typed email and passport
number, and the generated reference number. Everything below was run in a real browser at 1280, 360 and 320 px, in English and
Arabic (`?lang=ar`), with text at 200%, in forced-colours mode, with JavaScript off, and in print.

## Values mapped

| Field | Source | Limit | Worst case used |
| --- | --- | --- | --- |
| Email | typed | 254 characters (form and server) | 64-character local part, three long labels, 254 characters in total |
| Passport number | typed | 5 to 20 letters and digits | 20 characters |
| Document title, scope, intro, closing | terms file | none (a launch warning above 110 characters for titles) | a 188-character document title and a three-times-repeated intro, in both languages |
| Term title and lead sentence | terms file | warns above 110 and 1,200 characters | a 119-character title; a first term of about 3,300 characters (English) with literal markup, a placeholder-like token and an unbroken 91-character word |
| Points | terms file | none | 12 points in the first term (with links in its lead); a one-line term with no points; the same count in both languages (enforced by the schema) |
| Links | terms file | URL warning above 500 characters | a 557-character URL and a long label |
| Reference number | generated | fixed format | 15 characters, never wraps |
| Counts | derived | five terms | exactly 0 to 5 confirmed |

## What broke, and what was fixed

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| 1 | Broken | Clicking Sign in right after typing an invalid passport did nothing: the field's error message appeared on blur, moved the button, and the click landed on empty space. Found by the browser tests, not by the stress data. | The button keeps the field focused on press (`onMouseDown` default prevented), so the error appears after the click. Test: `login.spec.ts`. |
| 2 | Broken | The printed declaration ran onto a second page with the new, longer terms. | Print type 9.5 pt, leading 1.34, tighter spacing; both languages are one A4 page. Tests: `receipt.spec.ts`, `rtl.spec.ts`. |
| 3 | Ugly | The page title wrapped to three lines at every width because of an old narrow measure. | Full sheet width; two lines from 390 px. Test: `shell.spec.ts`. |
| 4 | Fragile | Arabic had no stress coverage. | `worst-case.spec.ts` now runs the whole flow in Arabic with 200% text and checks that list markers stay inside the card on the right. |

## Held up (no change needed)

Unbroken words and long URLs wrap inside their cards; literal markup (`<script>`, `**`, `{n}`) is shown as text and never runs;
a 12-point term and a one-line term sit together without layout jumps; the reference number never overflows; forced colours,
no-JavaScript and 200% text still show state and fit; the stress document prints to at most six pages and the signature stays
with the closing statement.

## Decisions for the Deanship

1. **Term length.** The launch check warns above 1,200 characters per term. The real terms are well under it (the longest is 590 characters in English and 492 in Arabic).
2. **A 320 px phone** sets the title in three lines; from 390 px it is two. Accepted.
