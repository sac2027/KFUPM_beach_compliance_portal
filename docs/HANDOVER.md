# Hand-over walkthrough: databases, bucket, secrets, email, ownership

Everything below is done in the Cloudflare dashboard or with `npx wrangler` from this repository, logged in to the
Cloudflare account that owns the Pages project. Budget: about 20 minutes the first time. Nothing here was run by the
build team, so do each step in order and tell them if a step says something different from what you see.

## 0. One-time tools

```bash
npm ci
npx wrangler login            # opens the browser; log in to the account that has the Pages project
npx wrangler whoami           # shows the account name and id
```

## 1. Decide who owns it (do this first, it is the whole point of "hand-over")

A Cloudflare **account** owns the Pages project, both databases and the bucket. Ownership changes by changing who is a
member of the account, not by moving things between accounts (Cloudflare has no "transfer project").

- If the account you deployed from is your personal one: in the dashboard, **Manage Account → Members → Invite**, add the
  Deanship/IT person as **Super Administrator**. When they have accepted, they can remove you later. Also move billing
  (Manage Account → Billing → Payment info) to a university card before you leave.
- Better, if KFUPM already has a Cloudflare account: ask IT to add *you* as a member there, and do steps 2–6 inside that
  account from the start. Then nothing ever needs moving.

Full data export, if a move between accounts is ever needed: `npm run data:export` writes both databases as SQL and
downloads every PDF and signature from the bucket into `./export/` (see section 8).

> **No terminal?** Everything in sections 2–4 can be done in the Cloudflare dashboard instead: create the databases and bucket
> there, then paste the ready-made SQL files in `docs/setup/` into each database's **Console** (see `docs/setup/README.md`).
> If your databases were created before the phone number was removed, run `4-update-roster-database.sql` and
> `5-update-records-database.sql` once.

## 2. Create the two databases and apply the schema

```bash
npx wrangler d1 create pacf-roster
npx wrangler d1 create pacf-records
```

Each command prints a `database_id`. Open `wrangler.jsonc` and replace the two placeholder ids
(`00000000-0000-0000-0000-00000000000{1,2}`) with the real ones, keeping the names. Commit that change. Then:

```bash
npm run db:migrate:remote
```

You should see `0001_students.sql ✅` and `0001_records.sql ✅`.

## 3. Create the documents bucket

```bash
npx wrangler r2 bucket create pacf-documents
```

(R2 needs to be enabled once in the dashboard: **R2 Object Storage → Get started**; the free tier is enough.)

## 4. Load the test roster

```bash
npm run roster:import -- data/roster.sample.csv --remote
```

This loads the four test students below. Only these four can sign in until a real roster is imported.

| Full name | Email | Passport number |
| --- | --- | --- |
| `Eyad Salem` | `s202368990@kfupm.edu.sa` | `TEST0001` |
| `Eyad Salem` | `eyadsalem139@gmail.com` | `TEST0002` |
| `Sara Ahmed Alqahtani` | `sac@kfupm.edu.sa` | `TEST0003` |
| `Anas Ammari` | `anas.ammari@kfupm.edu.sa` | `TEST0004` |

Name, email and passport number must match. The name may be typed in any order or case (`salem eyad` works); the email and
passport number must be exact (spaces and case are forgiven). The student also picks a **nationality** from a dropdown; it
is recorded with the declaration and is never checked against the roster. Phone numbers are not collected.

To add real students later, make a CSV with the same header as
`data/roster.sample.csv` and run the same command with your file. Re-running updates students by passport number.
`data/roster.e2e.csv` is for the automated tests only; do not import it to production.

## 5. Settings and secrets

Because the project has a `wrangler.jsonc`, Cloudflare treats that file as the source of truth for the plain settings
(the dashboard greys them out). So:

**a) Plain settings go in `wrangler.jsonc`, then commit and push.** In the `vars` block set:

| Name | Value |
| --- | --- |
| `EMAIL_MODE` | `"resend"` (anything else means "log only, send nothing") |
| `EMAIL_FROM` | see step 6 (`"KFUPM Student Affairs <onboarding@resend.dev>"` for the first test) |
| `EMAIL_REPLY_TO` | `"eyadsalem139@gmail.com"` for now, later the deanship mailbox |
| `EMAIL_BCC` | optional: a mailbox that should receive a copy of every declaration |

**b) The two secrets go in the dashboard**: **Workers & Pages → kfupm-pre-arrival-compliance-portal → Settings →
Variables and secrets → Add → type Secret**, environment **Production** (repeat for Preview if you use it):

| Name | Value |
| --- | --- |
| `SESSION_SECRET` | a long random string: run `openssl rand -base64 48` and paste the output |
| `RESEND_API_KEY` | from step 6 |

The three bindings (`ROSTER`, `RECORDS`, `DOCUMENTS`) come from `wrangler.jsonc` automatically on the next deployment. If
the dashboard's **Bindings** tab does not show them after deploying, add them there by hand with the same names.

Then trigger a deployment (push a commit, or **Deployments → Retry**). Open `https://<your-site>/api/health`: it must
show `{"ok":true,"roster":true,"records":true,"documents":true}`.

## 6. Email (Resend)

1. Create a free account at resend.com with `eyadsalem139@gmail.com`, then **API Keys → Create** and put the key in
   `RESEND_API_KEY`.
2. **Until a domain is verified, Resend only delivers to the address that owns the Resend account** (your Gmail), and only
   from `onboarding@resend.dev`. So for the first test set `EMAIL_FROM` to
   `KFUPM Student Affairs <onboarding@resend.dev>` and sign in as `TEST0002` (whose email is your Gmail). The other three
   test students will show "email could not be sent" until step 3 is done; their records and PDFs are still stored.
3. To send to anyone, from the deanship address: in Resend, **Domains → Add domain** `kfupm.edu.sa` (or a subdomain IT
   prefers, e.g. `mail.kfupm.edu.sa`). Resend shows three DNS records; KFUPM IT adds them. When Resend says "Verified",
   set `EMAIL_FROM` to `KFUPM Student Affairs <student-affairs@kfupm.edu.sa>` (any mailbox name on the verified domain).
4. Alternative IT may prefer: Microsoft 365 Graph API `sendMail` from a real deanship mailbox. The code isolates the
   sender in `functions/lib/email.ts`; a Graph driver is a small addition.

Where to look when an email did not arrive: the record's `email_status` and `email_error` columns
(**D1 → pacf-records → submissions**), and Resend's **Emails** log.

## 7. Where to see the records

- **D1 → pacf-records → submissions**: one row per signed declaration (name, email, last four of the passport, reference,
  time, email status). Export with the dashboard's **Export** button or `npx wrangler d1 export pacf-records --remote --output records.sql`.
- **R2 → pacf-documents → submissions/<id>/**: `declaration.pdf` and `signature.png`.
- **D1 → pacf-roster → students**: who may sign in.

## 8. Full export (for a move or an audit)

```bash
npm run data:export          # → ./export/roster.sql, ./export/records.sql, ./export/documents/…
```

Keep the export somewhere encrypted: it contains passport numbers and signatures.

## 9. Local development (for whoever maintains the code)

```bash
cp .dev.vars.example .dev.vars   # local secret; email in log mode
npm run db:migrate:local && npm run db:seed:local
npm run build && npm run dev:api  # http://127.0.0.1:8788 with the API and local databases
```

In log mode nothing is emailed; every message is written to the `outbox` table of the local records database.
