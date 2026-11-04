# Hand-over walkthrough: Cloudflare Pages and Resend

The portal has no database and no file storage. It is a static site plus one small server function that emails the signed
PDF. Setup is one Pages project and one email key. Budget: about 15 minutes. Nothing here was run by the build team, so do each
step in order and tell them if a step says something different from what you see.

## 1. Who owns it

A Cloudflare **account** owns the Pages project. To hand it over, add the Deanship or IT person as **Super Administrator**
(Manage Account, Members, Invite). They can remove you afterwards. Move billing to a university card before you leave.
Resend has its own account; make the Deanship an owner there too.

## 2. Create the Pages project

1. Workers & Pages, Create, Pages, connect the GitHub repository `sac2027/KFUPM_beach_compliance_portal`.
2. Build command `npm run build`, output directory `dist`, Node 22 (the repository's `.nvmrc`).
3. Keep the repository private (the KFUPM Display font licence forbids public redistribution).

## 3. Settings in `wrangler.jsonc`

Because the repository has a `wrangler.jsonc`, Cloudflare treats it as the source of truth for plain settings (the dashboard
greys them out). Edit the `vars` block, commit and push:

| Name | Value |
| --- | --- |
| `EMAIL_MODE` | `"resend"`. Anything else sends nothing and reports "logged". |
| `EMAIL_FROM` | `"KFUPM Student Affairs <onboarding@resend.dev>"` for the first test; the verified address later (step 5). |
| `EMAIL_REPLY_TO` | The Deanship mailbox students can reply to. |
| `EMAIL_BCC` | **Set this in production.** There is no database, so this mailbox receives a copy of every signed declaration and is the only record of who signed. |

Optional: `DECLARATIONS_PER_WINDOW` (default 10) is how many declarations one IP address may send per 15 minutes.

## 4. The one secret

In the Pages project: Settings, Variables and secrets, Add, type **Secret**, environment **Production** (and Preview if used):

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | The API key from step 5. |

Then redeploy (push a commit, or Deployments, Retry). Open `https://<your-site>/api/health`. It must show
`{"ok":true,"email":"resend","configured":true}`. If `configured` is false, the key is missing.

## 5. Email (Resend)

1. Create an account at resend.com, then API Keys, Create, and put the key in `RESEND_API_KEY`.
2. Until a domain is verified, Resend only delivers to the address that owns the Resend account, and only from
   `onboarding@resend.dev`. For the first test, sign in with that address as the student email.
3. To send to anyone, from the Deanship address: Domains, Add domain `kfupm.edu.sa` (or a subdomain IT prefers). Resend shows
   three DNS records; KFUPM IT adds them. When Resend says "Verified", set `EMAIL_FROM` to
   `KFUPM Student Affairs <student-affairs@kfupm.edu.sa>` (any mailbox name on the verified domain).
4. Microsoft 365 Graph `sendMail` is the natural institutional alternative. The sender is isolated in
   `functions/lib/email.ts`; a Graph driver is a small addition.

Where to look when an email did not arrive: Resend's Emails log, and the BCC mailbox. The student's receipt screen says "could
not email" and offers "Send the email again" and "Download PDF", so a student is never stuck.

## 6. Protect the email endpoint

Anyone can reach `POST /api/declarations`, because there is no roster. The function validates every field, accepts only a real
PDF up to 8 MB, and limits each IP address to 10 sends per 15 minutes, but that limit is per server instance. Add the
second layer in Cloudflare: Security, WAF, Rate limiting rules, Create rule:

- If: URI Path equals `/api/declarations` and Method equals POST.
- Same characteristics: IP. Requests: 10 per 10 minutes (the free plan's period). Action: Block for 10 minutes.

## 7. Local development

```bash
npm ci
cp .dev.vars.example .dev.vars     # email in log mode: nothing is sent
npm run build && npm run dev:api   # http://127.0.0.1:8788 with the API
npm run dev                        # http://localhost:5173, hot reload, API proxied to 8788
```

In log mode the receipt reports the email as sent, but nothing leaves your machine.
