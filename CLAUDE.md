# CLAUDE.md — PrepFlow Build Brief

> **How to use this file:** Place it in the repo root. In Claude Code, say: *"Read CLAUDE.md and begin Phase 0. Propose a task plan before writing code, then build incrementally."* This file is the source of truth for what to build and in what order.

---

## 1. What we're building

PrepFlow is an **all-in-one SaaS for independent meal-prep businesses** — storefront, meal-plan subscriptions, payments, kitchen operations (production, trim-aware purchasing, labels, packing), delivery, marketing, and staff scheduling — in one platform.

**The wedge (don't lose this):** we win small/independent kitchens by being *simpler and more modern* than Sprwt and *better value* than GoPrep, and by being unambiguously best at **two money features**:
1. **Margin/waste protection** — a trim-aware purchasing engine that shows the owner real dollars of over-buying to cut.
2. **Frictionless migration** — import a kitchen's menu, customers, and active subscriptions fast.

Match everything else to "good enough to not be disqualified." Do **not** chase feature parity with competitors.

**Existing assets in this conversation/repo to reuse:**
- A working front-end **demo** (`prepflow-demo/`, Vite + React + Tailwind) — use it as the **design system and component reference**. Reuse its layout, color tokens (pine/paper/clay palette, Inter + Fraunces), and component structure. Do not redesign.
- Strategy docs: `PrepFlow-Positioning.md` and `PrepFlow-MVP-and-Pricing.md` — the product/commercial decisions. Follow them.

---

## 2. Recommended stack

These are decisions so you don't have to guess. The owner may override — confirm if they have preferences before scaffolding.

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Full-stack: UI, API routes, SSR, one deploy |
| Styling | **Tailwind CSS** | Already used in the demo; port tokens over |
| DB | **PostgreSQL** (Neon or Supabase) | Relational data (orders, subs) needs SQL |
| ORM | **Prisma** | Type-safe schema + migrations |
| Auth | **Clerk** (or Auth.js if avoiding vendors) | Owner + staff accounts fast |
| Payments | **Stripe — with Stripe Connect** | See §5; required for the platform pricing model |
| Email | **Resend** (or Postmark) | Transactional + marketing email |
| Background jobs | **Inngest** (or Vercel Cron) | Billing retries, cut-off processing, scheduled charges |
| Hosting | **Vercel** + managed Postgres | Matches Next.js; simple CI/CD |

**Multi-tenancy:** every business is a tenant. Scope all data by `businessId` (row-level). Enforce tenant isolation in every query — never trust the client for `businessId`.

---

## 3. Architecture

- Next.js app with two surfaces sharing components:
  - **Owner dashboard** (authenticated) — the workspace from the demo (Dashboard, Storefront mgmt, Customer mgmt, POS, Orders, Kitchen OS, Routes, Marketing, Staff, Settings).
  - **Customer storefront** (public + customer login) — ordering, subscriptions, account.
- API via Next.js route handlers / server actions. All mutations server-side, validated (use **Zod**).
- Webhooks endpoint for Stripe (and later couriers) → update DB → reflect in UI.
- Keep all secrets in env vars (see §8). Never commit secrets.

---

## 4. Data model (core entities)

Implement in Prisma. Snapshot prices on orders (don't rely on live meal price for historical orders).

- **Business** — id, name, branding (color), settings (fees, taxRate, cutoff, deliveryDays, fulfillment, minOrder), stripeAccountId
- **User** — id, businessId, email, role (`owner` | `staff`), authProviderId
- **Customer** — id, businessId, name, email, phone, addresses[], dietaryPrefs, allergens, loyaltyPoints, stripeCustomerId
- **Meal** — id, businessId, name, desc, diet, price, macros{cal,protein,carbs,fat}, allergens[], active
- **Ingredient** — id, businessId, name, unit, defaultTrimPct
- **MealIngredient** — mealId, ingredientId, qty, unit, trimPct
- **Plan** — id, businessId, name, mealsPerWeek, perMealPrice
- **Subscription** — id, customerId, planId, status (`active`|`paused`|`canceled`), frequency, nextDeliveryDate, stripeSubscriptionId
- **SubscriptionSelection** — subscriptionId, deliveryDate, items[{mealId, qty}]
- **Order** — id, businessId, customerId, type (`subscription`|`one_time`|`pos`), status, fulfillment (`delivery`|`pickup`), address, zone, deliveryDate, subtotal, tax, fees, total, stripePaymentIntentId
- **OrderItem** — orderId, mealId, qty, unitPriceSnapshot, nameSnapshot
- **GiftCard** — id, businessId, code, amount, balance, recipientEmail
- **Coupon** — id, businessId, code, type (`percent`|`flat`), value, active
- **Delivery** (P2) — orderId, provider, externalId, status, eta, trackingUrl, proofUrl
- **Payment** — id, orderId, stripeIds, amount, status, refundedAmount

---

## 5. Payments (read before building billing)

Use **Stripe Connect** so each kitchen connects its own Stripe account, customer payments go to the kitchen, and PrepFlow takes a **platform application fee** (this is how the §7 pricing model works — we earn a cut of orders).

- Onboarding: Stripe Connect (Express) flow per business → store `stripeAccountId`.
- One-time orders: PaymentIntent with `application_fee_amount`, `transfer_data.destination = business`.
- Subscriptions: Stripe Subscriptions/Invoices on the connected account; apply platform fee.
- Handle webhooks: `payment_intent.succeeded`, `invoice.paid`, `invoice.payment_failed` (dunning), `charge.refunded`.
- Never store raw card data — Stripe Elements only. Stay out of PCI scope.

> The owner should confirm pricing/terms and payment compliance with a professional before going live. Build the mechanism; don't hardcode final fee numbers — make the platform fee a config value.

---

## 6. Build phases (build in this order)

### Phase 0 — Pilot-ready (one real kitchen can take real orders)
Goal: a single kitchen runs live. Acceptance: a customer can subscribe and pay; the owner sees the order and can run production.
- [ ] Project scaffold, DB, auth (owner login)
- [ ] Business + Settings (fees, tax, cut-off, delivery days)
- [ ] Meal CRUD (port the demo's menu manager)
- [ ] Public storefront: browse, cart, checkout
- [ ] Customer accounts + login
- [ ] Meal-plan subscriptions (weekly/biweekly; skip/pause/swap before cut-off)
- [ ] **Stripe Connect + payments + recurring billing**
- [ ] Orders list (owner) + order status
- [ ] Production report
- [ ] Transactional email (order confirmation, receipt)
- [ ] Deploy to Vercel + Postgres; backups on

### Phase 1 — Sellable (can charge and onboard switchers)
- [ ] **Trim-aware shopping list + margin/waste dashboard** ("$X over-bought") ← switch-driver
- [ ] **Migration importer** (CSV/API: menu, customers, subscriptions) ← switch-driver
- [ ] Labels (macros/allergens/expiry), packing slips
- [ ] Loyalty + referrals ← switch-driver
- [ ] Failed-payment dunning, refunds, order edits, coupons
- [ ] Delivery zones, pickup locations, basic routing
- [ ] Sales & retention analytics

### Phase 2 — Fast-follow
- [ ] Kitchen Display System, production-by-station
- [ ] **Courier integration** — start with ONE aggregator (Uber Direct / DoorDash Drive / Nash / Cartwheel): push delivery, read status via webhooks, show live status + ETA + proof-of-delivery in PrepFlow (so owner never logs into the courier portal)
- [ ] SMS marketing, abandoned-cart, win-back flows
- [ ] Gift card redemption at checkout, build-your-own meal, per-item tax, white-label domain

### Explicitly skip until a paying customer is blocked
Multi-location enterprise tooling, full payroll, AI insights, auto-rotating menus, native mobile apps.

---

## 7. Pricing model to implement (configurable, not hardcoded)
Flat monthly tiers gated by order volume + a usage-based option. Make platform fee % and tier limits **config**, not literals. (Full detail in `PrepFlow-MVP-and-Pricing.md`.) Payment processing passed through at cost.

---

## 8. Environment & secrets (create `.env.example`, never commit real values)
`DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID`, `CLERK_*` (or `AUTH_*`), `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`, `INNGEST_*`.

---

## 9. Conventions & guardrails for Claude Code
- **Propose a plan before coding** each phase; build in small, reviewable commits — not one giant scaffold.
- TypeScript everywhere; validate all inputs with Zod; type DB access via Prisma.
- Enforce tenant isolation (`businessId`) on every query.
- Write tests for billing, subscription state changes, and money math — these must not break.
- Keep money in integer cents; never floats for currency.
- Reuse the demo's UI/components and design tokens; don't redesign.
- Don't add a dependency without a clear reason; prefer the chosen stack.
- Ask before: changing the stack, schema-breaking migrations, or anything touching live payments.
- Secrets only in env. No secrets in code or commits.

---

## 10. Definition of done for the pilot (Phase 0)
A real customer can: visit the storefront → choose a subscription → enter card → get charged on a recurring schedule → receive a confirmation email. The owner can: log in → see the order → view a production report for the week → and the kitchen actually runs on it for one delivery cycle without manual workarounds.

---

## 11. First session — start here
1. Confirm stack choices in §2 with the owner (or proceed with defaults).
2. Scaffold Next.js + TypeScript + Tailwind + Prisma; set up Postgres and `.env.example`.
3. Implement the Prisma schema from §4 and run the first migration.
4. Stand up owner auth + a Business record + the Settings page.
5. Port the demo's Meal manager to real CRUD against the DB.
Then pause and demo before moving deeper into Phase 0.
