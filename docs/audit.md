# Design-guideline and accessibility audit: University Beach portal

Reviewed against Vercel's Web Interface Guidelines (fetched fresh on 2026-11-04; the fetch returned a category summary covering
accessibility, focus, forms, animation, typography, content, images, performance, navigation, touch, safe areas, dark mode,
i18n, hover and copy) and WCAG 2.2 AA. Method: a read of every component and stylesheet against each category, then automated
checks in a real browser: axe-core on every step in English (`a11y.spec.ts`) and Arabic (`rtl.spec.ts`), a keyboard-only walk
of the whole flow with a visible-focus check at every stop, and the design-taste lint (0 findings) and inspector.

## Result

Files reviewed: `src/**/*.tsx` and `src/styles/*.css`. No change was needed in this round beyond the fixes in `docs/qa/break-ui.md`.

- **Accessibility:** every control has a visible label or accessible name; icons are `aria-hidden` and always beside text; the language switch names the other language in its own script with a matching `lang`; one `h1`, `h2` per step, `h3` per term; skip link; live regions for progress, status and failures.
- **Focus:** `:focus-visible` rings everywhere, the visually hidden checkbox and file input show theirs on their proxy; focus moves to the new step's heading; the sticky progress bar only applies on tall screens.
- **Forms:** `autocomplete` (`email`, `off` for the passport), `inputmode`, `type="email"`, `spellcheck` off for codes, paste never blocked, errors inline with the first one focused, the submit stays available until the request starts, then shows "Signing in…".
- **Motion:** reduced motion honoured; only `transform`, `opacity` and colour transitions; no `transition: all`; the new shoreline ground does not move.
- **Typography and i18n:** curly apostrophes and real ellipses, tabular figures, `translate="no"` on emails and references, dates through `Intl`, Gregorian and Latin digits in both languages, `lang`/`dir` set on the root, the language chosen by `?lang=`, then the saved choice, then the browser.
- **Layout:** no horizontal scroll from 320 to 1920 px in either direction; images have dimensions; pinch zoom allowed; `color-scheme: light` with a matching theme colour.
- **Navigation and state:** the URL carries only the step name; browser Back and Forward work; destructive actions (leaving the terms, clearing the receipt) ask first.

## Left as is, on purpose

- Headings and buttons are in sentence case, not Title Case: the brand voice and the existing copy use sentence case.
- The inspector's "strongly coloured" warning on the first screen is the turquoise sea band, which is the design's one deliberate brand element.
