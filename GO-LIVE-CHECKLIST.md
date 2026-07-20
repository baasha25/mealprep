# PrepFlow — Go-Live Checklist (Demo/Test → Production)

**The good news:** going live needs **no code changes.** Every integration is gated on
environment variables — the app automatically runs in "off/test" mode until real keys
are present. Going live = swapping keys & config in each vendor's dashboard + Netlify,
then redeploying. Work top to bottom.

> **Where values live:** the local `.env` (dev/test) is NOT what production uses.
> Production reads from **Netlify → Site settings → Environment variables**.
> After changing any Netlify env var you MUST **trigger a redeploy** for it to take effect.

Legend: 🔴 = must change before charging real money · 🟡 = should do · 🟢 = already prod-ready, just confirm

---

## 1. 🔴 Stripe — payments (the big one)

Currently **TEST mode** (`sk_test` / `pk_test`), and the **webhook is not wired**.

- [ ] In Stripe, **toggle off "Test mode"** (top-right) — do all the steps below in **live mode**.
- [ ] **API keys → copy the live keys** and set in Netlify:
  - [ ] `STRIPE_SECRET_KEY` = `sk_live_…`
  - [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_…`
- [ ] **Enable Connect in live mode** (Stripe → Connect). Complete the platform profile / business verification if prompted.
- [ ] **Create the webhook** (live mode): Developers → Webhooks → Add endpoint
  - URL: `https://<your-domain>/api/stripe/webhook`
  - Events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
  - [ ] Copy the signing secret → set `STRIPE_WEBHOOK_SECRET` = `whsec_…` in Netlify
  - ⚠️ Without this, recurring **receipt** emails, **failed-payment dunning**, and Stripe→app lifecycle sync do NOT fire. (The one-time "you're subscribed" email works without it.)
- [ ] **Each kitchen re-connects their bank in live mode** (dashboard → Payouts → Connect). Test-mode Connect accounts do not carry over.
- [ ] Confirm the platform fee is set correctly per kitchen (Settings → plan; drives `platformFeeBps`).
- [ ] *(Optional but recommended)* verify the `on_behalf_of` behavior so kitchens bear Stripe fees — already in code; only applies once a kitchen is Connect-onboarded.

## 2. 🔴 Clerk — authentication

Currently a **development instance** (`pk_test` / `sk_test`, `*.clerk.accounts.dev`).
Clerk **dev instances are not for production** (rate-limited, shared domain, test emails).

- [ ] In Clerk, **create/switch to a Production instance**.
- [ ] Set up the **production domain** in Clerk (adds a `clerk.yourdomain.com` CNAME — do the DNS).
- [ ] Copy the **production keys** → set in Netlify:
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_…`
  - [ ] `CLERK_SECRET_KEY` = `sk_live_…`
- [ ] Re-set the sign-in/up + redirect URL env vars for the prod domain if they differ.
- [ ] Test a real sign-up/sign-in on the live domain.

## 3. 🟡 Database — Neon (Postgres)

- [ ] **Switch `DATABASE_URL` to Neon's POOLED connection string** (host contains `-pooler`) — important for serverless. (Migrations still run on the direct URL.)
- [ ] Consider **Neon paid tier** (no scale-to-zero) to kill cold-start latency on the storefront.
- [ ] Confirm **automated backups** are on.
- [ ] Run any pending migrations against prod: `DATABASE_URL=<neon> npx prisma migrate deploy`.

## 4. 🟡 Domain & app URL

- [ ] Point your real domain (e.g. `prepflow.ca`) at **Netlify**; confirm SSL is issued.
- [ ] Set `NEXT_PUBLIC_APP_URL` = `https://<your-domain>` in Netlify (used in emails, account links, checkout redirects, and the cron function).

## 5. 🟢 Email — Resend

Domain `send.prepflow.ca` is verified; `RESEND_API_KEY` + `EMAIL_FROM` are set.

- [ ] Confirm `RESEND_API_KEY` and `EMAIL_FROM` are set in **Netlify** (not just local).
- [ ] Confirm the sending domain is still **verified** in Resend.
- [ ] Check your Resend plan/limits are adequate for expected volume.

## 6. 🟢 AI — Anthropic (invoice OCR, Pro feature)

`ANTHROPIC_API_KEY` (live key — Anthropic has no test mode).

- [ ] Confirm `ANTHROPIC_API_KEY` is set in **Netlify**.
- [ ] Ensure the Anthropic account has **billing/credits** (usage ~$0.03–0.06 per invoice scan).

## 7. 🟢 Scheduled jobs — customer reminders

Netlify Scheduled Function (`daily-notifications`) → `/api/cron/notifications`.

- [ ] Confirm `CRON_SECRET` is set in **Netlify** (a strong random string, NOT the dev value).
- [ ] After deploy, confirm the function appears under Netlify → Functions and check its logs after the first run.

## 8. 🟡 Demo data cleanup

The current production Greenleaf kitchen holds **demo content** (bulk demo customers tagged
`@demofill.greenleaf`, demo orders, test subscriptions) loaded for the sales/demo videos.

- [ ] Decide: keep a demo kitchen separate, OR strip the demo data before real customers use it.
- [ ] If stripping: remove `@demofill.greenleaf` customers (+ their orders/subs) and any test subscriptions. (Ask Claude for a scoped cleanup script — it's reversible and tagged.)
- [ ] Real kitchens onboard fresh via `/onboarding`, so their data starts clean regardless.

## 9. 🟡 Legal & compliance

- [ ] Add **Terms of Service** and **Privacy Policy** pages, linked from the storefront/checkout.
- [ ] Have **pricing, platform-fee terms, and payment compliance** reviewed by a professional before charging real money (per the build brief).
- [ ] PCI: you're fine — Stripe Elements handles cards; no raw card data touches the app.

## 10. ✅ Final end-to-end verification (in live mode)

- [ ] Place ONE real order + subscription with a real card (small amount), then **refund it**.
- [ ] Confirm: money lands in the kitchen's bank, your platform fee shows as the application fee, the **webhook returns 200**, and the customer gets the confirmation + receipt emails.
- [ ] Confirm a real sign-up works on the live Clerk instance.
- [ ] Confirm the daily reminder cron fires (check Netlify function logs).

---

### One-glance summary of what changes

| Item | Now | Go-live action |
|---|---|---|
| Stripe keys | `sk_test`/`pk_test` | → live keys (Netlify) |
| Stripe webhook | not set | → create live endpoint + `STRIPE_WEBHOOK_SECRET` |
| Stripe Connect | test | → enable live, kitchens re-onboard |
| Clerk | dev instance | → production instance + keys + domain |
| Neon `DATABASE_URL` | direct | → pooled `-pooler` string |
| App URL | — | → real domain |
| Resend / Anthropic / CRON | set | → confirm present in Netlify |

*No code changes required — this is all keys, dashboards, and Netlify config.*
