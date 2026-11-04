# Graph Report - KFUPM_beach_compliance_portal  (2026-11-04)

## Corpus Check
- 130 files · ~85,625 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: .css 11, (none) 4, .woff2 4)

## Summary
- 542 nodes · 1270 edges · 20 communities (19 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Playwright suite
- App shell and UI components
- Login form, validation and dev hooks
- Email endpoint (functions)
- Language provider (en/ar) and tests
- Terms schema, print sheet and checker
- Dev dependencies
- Step flow, history and panel
- Signature image checks
- App tsconfig
- CI workflow
- Entry point and stylesheets
- Functions tsconfig
- npm scripts
- Colour palette and contrast
- Runtime dependencies
- PDF rendering
- ESLint config
- Vitest and header tests
- Test setup

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 32 edges
2. `vitest` - 27 edges
3. `@playwright/test` - 24 edges
4. `I18nProvider()` - 22 edges
5. `fillLogin()` - 20 edges
6. `Icon()` - 18 edges
7. `compilerOptions` - 17 edges
8. `STUDENTS` - 16 edges
9. `react` - 15 edges
10. `Shell()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `call()` --calls--> `onRequestPost`  [EXTRACTED]
  tests/functions/declarations.test.ts → functions/api/declarations.ts
- `setup()` --calls--> `LoginScreen()`  [EXTRACTED]
  tests/unit/login.test.tsx → src/features/login/LoginScreen.tsx
- `setup()` --calls--> `ReceiptScreen()`  [EXTRACTED]
  tests/unit/receipt.test.tsx → src/features/receipt/ReceiptScreen.tsx
- `setup()` --calls--> `SignatureStep()`  [EXTRACTED]
  tests/unit/signature-step.test.tsx → src/features/signature/SignatureStep.tsx
- `setup()` --calls--> `TermsStep()`  [EXTRACTED]
  tests/unit/terms-step.test.tsx → src/features/terms/TermsStep.tsx

## Import Cycles
- None detected.

## Communities (20 total, 1 thin omitted)

### Community 0 - "Playwright suite"
Cohesion: 0.07
Nodes (30): launchOptions, sizes, @axe-core/playwright, @playwright/test, TAGS, CSP, HEADERS, ar() (+22 more)

### Community 1 - "App shell and UI components"
Cohesion: 0.10
Nodes (45): react, App(), Shell(), TERMS, Button(), DIRECTIONAL, Icon(), IconName (+37 more)

### Community 2 - "Login form, validation and dev hooks"
Cohesion: 0.07
Nodes (36): valibot, Field(), FieldProps, failed, shouldFailOnce(), resolver(), asciiDigits(), normaliseDigits() (+28 more)

### Community 3 - "Email endpoint (functions)"
Cohesion: 0.07
Nodes (40): onRequestPost, onRequestGet, DeclarationFields, isPdf(), maskEmail(), MAX_PDF_BYTES, parseDeclarationForm(), ParseResult (+32 more)

### Community 4 - "Language provider (en/ar) and tests"
Cohesion: 0.07
Nodes (27): @testing-library/react@^16.3.3, @testing-library/user-event@^14.6.8, @testing-library/react, @testing-library/user-event, detectLocale(), format(), I18nProvider(), localeFromSearch() (+19 more)

### Community 5 - "Terms schema, print sheet and checker"
Cohesion: 0.09
Nodes (24): file, strict, warnings, isWorstCase(), WorstCaseToggle(), loadTerms(), bilingual, body (+16 more)

### Community 6 - "Dev dependencies"
Cohesion: 0.10
Nodes (27): devDependencies, @axe-core/playwright@^4.14.0, @cloudflare/workers-types@^5.20261101.1, eslint@^10.14.0, jsdom@^30.1.3, @playwright/test@^1.63.0, @types/node@^26.6.6, @types/react@^19.3.0 (+19 more)

### Community 7 - "Step flow, history and panel"
Cohesion: 0.15
Nodes (15): StepPanel(), currentHashStep(), onStepNavigation(), recordStep(), stepFromHash(), FlowAction, flowReducer(), initialFlowState (+7 more)

### Community 8 - "Signature image checks"
Cohesion: 0.13
Nodes (18): assessImage(), ImageVerdict, inkRatio(), MAX_SIGNATURE_BYTES, MAX_UPLOAD_HEIGHT, MAX_UPLOAD_WIDTH, MIN_INK_RATIO, MIN_STROKE_LENGTH (+10 more)

### Community 9 - "App tsconfig"
Cohesion: 0.10
Nodes (19): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 10 - "CI workflow"
Cohesion: 0.12
Nodes (16): WRANGLER_SEND_METRICS, jobs, verify, name, on, pull_request, push, env (+8 more)

### Community 11 - "Entry point and stylesheets"
Cohesion: 0.12
Nodes (3): react-dom@^19.3.1, react-dom, root

### Community 12 - "Functions tsconfig"
Cohesion: 0.13
Nodes (14): compilerOptions, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, noUnusedLocals, noUnusedParameters (+6 more)

### Community 13 - "npm scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, dev:api, lint, preview, release:check, serve:test (+5 more)

### Community 14 - "Colour palette and contrast"
Cohesion: 0.24
Nodes (9): contrastRatio(), luminance(), ColorName, Pairing, PAIRINGS, PALETTE, THRESHOLD, Use (+1 more)

### Community 15 - "Runtime dependencies"
Cohesion: 0.18
Nodes (11): dependencies, lucide-react@^1.66.0, @radix-ui/react-tabs@^1.2.1, react@^19.3.1, react-hook-form@^7.91.0, signature_pad@^5.1.4, valibot@^1.5.0, lucide-react (+3 more)

### Community 16 - "PDF rendering"
Cohesion: 0.24
Nodes (10): html-to-image@^1.11.13, pdf-lib@^1.17.1, html-to-image, pdf-lib, lazyRenderPdf(), hasInk(), imagesReady(), MAX_PDF_BYTES (+2 more)

### Community 17 - "ESLint config"
Cohesion: 0.22
Nodes (8): @eslint/js@^10.0.1, eslint-plugin-react-hooks@^7.1.1, globals@^17.14.0, typescript-eslint@^8.72.1, @eslint/js, eslint-plugin-react-hooks, globals, typescript-eslint

### Community 18 - "Vitest and header tests"
Cohesion: 0.22
Nodes (6): @vitejs/plugin-react@^6.1.2, vitest@^5.0.5, @vitejs/plugin-react, vitest, csp, rules

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Vitest and header tests` to `App shell and UI components`, `Login form, validation and dev hooks`, `Email endpoint (functions)`, `Language provider (en/ar) and tests`, `Terms schema, print sheet and checker`, `Dev dependencies`, `Step flow, history and panel`, `Signature image checks`, `Colour palette and contrast`?**
  _High betweenness centrality (0.253) - this node is a cross-community bridge._
- **Should `Playwright suite` be split into smaller, more focused modules?**
  _Cohesion score 0.0721120984278879 - nodes in this community are weakly interconnected._
- **Why does `@playwright/test` connect `Playwright suite` to `Dev dependencies`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Should `App shell and UI components` be split into smaller, more focused modules?**
  _Cohesion score 0.09903846153846153 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App shell and UI components` to `Login form, validation and dev hooks`, `Dev dependencies`, `Step flow, history and panel`, `Entry point and stylesheets`, `Runtime dependencies`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Should `Login form, validation and dev hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.0672316384180791 - nodes in this community are weakly interconnected._
- **Should `Email endpoint (functions)` be split into smaller, more focused modules?**
  _Cohesion score 0.07256894049346879 - nodes in this community are weakly interconnected._