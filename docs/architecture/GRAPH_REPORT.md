# Graph Report - KFUPM-Pre-Arrival-Compliance-Portal  (2026-11-01)

## Corpus Check
- Corpus is ~14,261 words - fits in a single context window. You may not need a graph.

## Summary
- 341 nodes · 820 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Receipt, PDF and print
- Signature step
- Documents and email (API)
- App shell, flow and history
- Policy terms
- Sign-in verification (API)
- Other: signature.ts, assessImage(), ImageVerdict
- Login form and validation
- Other: tsconfig.json, compilerOptions, lib
- Other: functions/lib/terms.ts, TERM_IDS, TermId
- Colour and contrast
- Colour and contrast

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 31 edges
2. `Icon()` - 18 edges
3. `Shell()` - 15 edges
4. `Button()` - 15 edges
5. `error()` - 13 edges
6. `compilerOptions` - 13 edges
7. `ServiceError` - 12 edges
8. `onRequestPost` - 12 edges
9. `json()` - 12 edges
10. `requireSession()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `parseRosterCsv()` --calls--> `normalisePassport()`  [EXTRACTED]
  scripts/lib/roster.ts → functions/lib/match.ts
- `parseRosterCsv()` --calls--> `normalisePhone()`  [EXTRACTED]
  scripts/lib/roster.ts → functions/lib/match.ts
- `parseRosterCsv()` --calls--> `normaliseEmail()`  [EXTRACTED]
  scripts/lib/roster.ts → functions/lib/match.ts
- `Shell()` --calls--> `Masthead()`  [EXTRACTED]
  src/App.tsx → src/components/Masthead.tsx
- `Shell()` --calls--> `LoginScreen()`  [EXTRACTED]
  src/App.tsx → src/features/login/LoginScreen.tsx

## Import Cycles
- None detected.

## Communities (12 total, 1 thin omitted)

### Community 0 - "Receipt, PDF and print"
Cohesion: 0.07
Nodes (42): failed, shouldFailOnce(), Plain(), PrintSheet(), TERMS, lazyRenderPdf(), formatDate(), formatDateTime() (+34 more)

### Community 1 - "Signature step"
Cohesion: 0.10
Nodes (35): Button(), Field(), FieldProps, DIRECTIONAL, Icon(), IconName, ICONS, LanguageToggle() (+27 more)

### Community 2 - "Documents and email (API)"
Cohesion: 0.14
Nodes (32): onRequestGet, onRequestPut, ownRecord(), onRequestGet, onRequestPost, onRequestPost, RosterRow, attachmentName() (+24 more)

### Community 3 - "App shell, flow and history"
Cohesion: 0.09
Nodes (18): App(), Shell(), TERMS, StepPanel(), Stepper(), isWorstCase(), WorstCaseToggle(), currentHashStep() (+10 more)

### Community 4 - "Policy terms"
Cohesion: 0.07
Nodes (23): env, list, local, raw, [file, ...flags], remote, { rows, errors }, file (+15 more)

### Community 5 - "Sign-in verification (API)"
Cohesion: 0.13
Nodes (28): RFC-4180, NO_MATCH, onRequestPost, enc, signSession(), asciiDigits(), nameKey(), namesMatch() (+20 more)

### Community 6 - "Other: signature.ts, assessImage(), ImageVerdict"
Cohesion: 0.13
Nodes (18): assessImage(), ImageVerdict, inkRatio(), MAX_SIGNATURE_BYTES, MAX_UPLOAD_HEIGHT, MAX_UPLOAD_WIDTH, MIN_INK_RATIO, MIN_STROKE_LENGTH (+10 more)

### Community 7 - "Login form and validation"
Cohesion: 0.22
Nodes (13): asciiDigits(), normaliseDigits(), stripAllInvisible(), stripInvisible(), trimJoiners(), emailSchema, LoginInput, LoginOutput (+5 more)

### Community 8 - "Other: tsconfig.json, compilerOptions, lib"
Cohesion: 0.13
Nodes (14): compilerOptions, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess, noUnusedLocals, noUnusedParameters (+6 more)

### Community 9 - "Other: functions/lib/terms.ts, TERM_IDS, TermId"
Cohesion: 0.31
Nodes (8): TERM_IDS, TermId, decodeDataUrl(), MAX_SIGNATURE_BYTES, parseSubmissionBody(), sniffImage(), SubmissionInput, ValidationResult

### Community 10 - "Colour and contrast"
Cohesion: 0.29
Nodes (6): ColorName, Pairing, PAIRINGS, PALETTE, THRESHOLD, Use

## Knowledge Gaps
- **1 isolated node(s):** `RFC-4180`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 121 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `parseRosterCsv()` connect `Sign-in verification (API)` to `Policy terms`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **What connects `RFC-4180` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `Receipt, PDF and print` be split into smaller, more focused modules?**
  _Cohesion score 0.0662004662004662 - nodes in this community are weakly interconnected._
- **Should `Signature step` be split into smaller, more focused modules?**
  _Cohesion score 0.09993011879804332 - nodes in this community are weakly interconnected._
- **Should `Documents and email (API)` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `App shell, flow and history` be split into smaller, more focused modules?**
  _Cohesion score 0.08708708708708708 - nodes in this community are weakly interconnected._
- **Should `Policy terms` be split into smaller, more focused modules?**
  _Cohesion score 0.06984126984126984 - nodes in this community are weakly interconnected._