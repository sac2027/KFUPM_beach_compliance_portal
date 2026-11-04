# KFUPM Pre-Arrival Compliance Portal — Design

## Intent
International students must acknowledge five terms and sign before arrival. The legacy Google Sites form is replaced by an institutional-grade, bilingual portal that reads as an official legal document and that KFUPM staff and IT can maintain without touching UI code.

## Goals
- Five terms rendered from `compliance-terms.json`; staff edit copy and URLs there, validated by a schema script.
- Full EN LTR / AR RTL mirroring; Arabic drafted by Claude and flagged for KFUPM legal review.
- Mock login (passport, phone, full name) and mock submission behind swappable `authService` / `dbService` interfaces.
- Tactile checkboxes, direction-aware step transitions, draw or upload signature. Hand-built motion, no animation library.
- Zero horizontal scroll from 320 px; WCAG 2.2 AA.

## Non-goals
Real SSO or backend; Student ID field; server-side rendering; analytics.

## Anti-goals
Looking like a student project or a generic template. Altering the lockup or Matrix. Leaking PII to storage, URLs or logs.

## Approaches considered
1. **Vite + React SPA (chosen):** multi-step state, canvas and RTL are well served; trivial Cloudflare static deploy; IT can swap two service files.
2. Astro + islands: smaller JS, but nearly all of the page is interactive, so the savings are small.
3. Plain HTML/JS: no build step, but state, i18n and tests become hand-rolled.

## Decisions (by the user)
Arabic written by Claude and reviewed later. Not-working links shipped as placeholders. Login stays three fields; the date appears after sign-in. Fonts and brand assets supplied by KFUPM (Public Relations).

## Decisions (Claude's calls, to confirm)
- Per Brand Guidelines §7: headlines in KFUPM Display, body and all typed text in IBM Plex Sans Arabic (both scripts), fallback Segoe UI/system-ui. KFUPM Display is ASCII-only, so it never renders typed names.
- Seal on the printable signed declaration only (Brand Guidelines §4: formal documents). Matrix once per screen from generator exports.
- Form library react-hook-form + valibot; signature_pad for the canvas; Radix Tabs only.
- The date is Gregorian with Latin digits, read-only, stamped at submit.

## Left to the builder
Exact spacing, motion curves within the plan's constraints, copy for UI chrome (non-policy) strings.
