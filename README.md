# CodeVault — subscription bet code platform

A production-ready, subscription-based platform where clients pay (via **Paystack**) for tiered access to **bet codes** that administrators publish immediately or on a schedule. Access is enforced **on the server** for every request, and notifications go out in-app and over **WhatsApp**.

> Built with **Next.js 16 (App Router)**, **JavaScript only**, **Tailwind CSS v4** (CSS-first), **MongoDB + Mongoose 9**, **Paystack**, **WhatsApp Cloud API**, JWT in **HTTP-only cookies**, **bcryptjs**, **Zod**, **Lucide**, **Sonner**, **Framer Motion** and **Recharts**. Package manager: **Bun**. Deploys to **Vercel**.

---

## Contents

1. [Quick start](#quick-start)
2. [Environment variables](#environment-variables)
3. [How access control works](#how-access-control-works)
4. [Bet code scheduling](#bet-code-scheduling)
5. [Payments (Paystack)](#payments-paystack)
   - [Sign-up: terms & email verification](#sign-up-terms--email-verification)
   - [Winning tickets & discounts](#winning-tickets--discounts)
6. [WhatsApp notifications](#whatsapp-notifications)
7. [Background jobs & cron](#background-jobs--cron)
8. [Roles & permissions](#roles--permissions)
9. [Project structure](#project-structure)
10. [API reference](#api-reference)
11. [Security checklist](#security-checklist)
12. [Deploying to Vercel](#deploying-to-vercel)
13. [Testing](#testing)
14. [Troubleshooting](#troubleshooting)

---

## Quick start

Requirements: **Bun ≥ 1.2**, **Node.js ≥ 20.19** (Next.js 16 and Mongoose 9 need it), a **MongoDB** database (Atlas free tier works), and a **Paystack** account (test keys are fine).

```bash
bun install
cp .env.example .env.local        # then fill in the values (see below)
bun run seed                      # super admin, plans, categories, demo codes
bun dev                           # http://localhost:3000
```

Production build:

```bash
bun run build
bun start
```

Sign in at `/login` with `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD`. You'll land in the admin panel at `/admin`. Register a normal account in another browser to see the client dashboard.

The seed is idempotent. Plans and categories are only created if their slug doesn't exist, so prices you change later in the admin panel are never overwritten. Demo bet codes have titles starting with **`[DEMO]`** and codes starting with `DEMO-`; recreate them with `bun run seed:reset` and delete them from **Admin → Bet Codes** before launch.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string. |
| `JWT_SECRET` | ✅ | ≥ 32 random characters. Generate: `bun -e "console.log(crypto.randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | | Session lifetime (default `7d`). |
| `PAYSTACK_SECRET_KEY` | ✅ | `sk_test_…` / `sk_live_…`. Server-only. |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | | Only needed if you switch to Paystack Inline; the default redirect checkout doesn't use it. |
| `PAYSTACK_API_URL` | | Override the Paystack base URL (defaults to `https://api.paystack.co`). |
| `RESEND_API_KEY` | ✅ in prod | Resend API key for verification emails. Without it, emails are logged to the console in development. |
| `EMAIL_FROM` | ✅ in prod | Sender, e.g. `CodeVault <no-reply@yourdomain.com>`, on a domain verified in Resend. |
| `WHATSAPP_PROVIDER` | | `meta` (default) or `console` (log only). |
| `WHATSAPP_API_URL` | | e.g. `https://graph.facebook.com/v22.0` |
| `WHATSAPP_ACCESS_TOKEN` | | Meta permanent/system-user token. |
| `WHATSAPP_PHONE_NUMBER_ID` | | From Meta → WhatsApp → API setup. |
| `WHATSAPP_DEFAULT_COUNTRY_CODE` | | Used to normalise local numbers (default `234`, so `0801…` → `234801…`). |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public base URL, no trailing slash (Paystack callbacks and links in messages). |
| `CRON_SECRET` | ✅ in prod | Protects `/api/cron`. Vercel Cron sends it automatically as a Bearer token. |
| `SEED_SUPER_ADMIN_EMAIL` / `_PASSWORD` / `_NAME` / `_PHONE` | for seeding | Initial super admin. Password must be ≥ 12 characters with letters and numbers. Nothing is hardcoded. |

Only `NEXT_PUBLIC_*` values reach the browser. MongoDB, Paystack and WhatsApp secrets are only read in server code, and the server modules (auth, sessions, Paystack, WhatsApp, services) import `server-only`, so importing them into a client component fails the build.

---

## How access control works

Every plan has an **access level** (Basic = 1, Standard = 2, Premium = 3, VIP = 4, or anything you configure). Every bet code has a required access level (0 = free for any signed-in user).

```
User subscription: Premium (level 3)

Bet code Basic    (1) → ALLOW
Bet code Standard (2) → ALLOW
Bet code Premium  (3) → ALLOW
Bet code VIP      (4) → DENY
```

The rule is `userLevel >= requiredLevel` (`lib/access.js → canAccessLevel`). It is enforced on the server for every request:

1. **Authentication**: the JWT in the HTTP-only cookie is verified (`jose`, HS256, issuer and audience pinned).
2. **Live account check**: the user is re-loaded from MongoDB on each request. Status must be `ACTIVE`, and the token's `tokenVersion` must match. Password changes, role changes, bans and "sign out everywhere" revoke tokens instantly.
3. **Role / permission**: admin APIs call `requirePermission(...)` (`lib/auth.js`).
4. **Active subscription**: `status === ACTIVE && startDate <= now && endDate > now`. Anything else is treated as unsubscribed, even before the expiry job runs.
5. **Plan and required level**: the subscription stores a snapshot of the level the user paid for.
6. **Expiration**: checked in the database query itself.

**The database query only returns authorised codes.** `listBetCodesForUser` filters with `accessLevel: { $lte: userLevel }` in MongoDB. The optional "Available on higher plans" teasers come from a separate query that only selects title, category, level and time, so the `code`, `description`, `analysis` and odds fields are never read for them. Unreleased (scheduled) codes are never returned with their code, even to entitled users. Opening `/api/betcodes/<id>` for a higher-tier code returns `403` with a locked preview and no code. Changing localStorage, editing frontend JS or calling the API by hand cannot expose a restricted code.

Plans can also limit **history** (`historyDays`). For example, Basic subscribers only see the last 7 days.

Staff (Admin / Super Admin) can preview every level in the client dashboard.

Reusable helpers (`lib/auth.js`): `requireAuth()`, `requireRole(...roles)`, `requireStaff()`, `requirePermission(...perms)`, `requireSubscription(user?)`, `requireAccessLevel(level, user?)`, plus page variants `requireUserPage()`, `requireStaffPage(perm?)`.

---

## Bet code scheduling

In **Admin → Bet Codes**:

- **New bet code** offers **Publish now**, **Schedule** (date, time, timezone) or **Save as draft**, plus an optional **expiration** (none, after N hours, or a specific date and time).
- **Schedule a day** creates several releases at once, e.g. `10:00 → A, 13:00 → B, 16:00 → C, 20:00 → D`.
- Row actions: edit, publish now, unpublish, archive/restore, feature, set result (won/lost/void), delete.

Wall-clock times are converted from the chosen timezone to UTC on the server (`lib/timezone.js`, DST-aware).

**Availability is decided by the backend at request time**, not by browser timers. A code is visible when its status is `PUBLISHED`/`SCHEDULED`/`EXPIRED` and `publishAt <= now`. It counts as live when it also has no expiry or `expiresAt > now`. A scheduled code therefore appears at the right moment even if no job has run. The background job only tidies statuses and sends release notifications (see below).

Statuses: `DRAFT`, `SCHEDULED`, `PUBLISHED`, `EXPIRED`, `ARCHIVED`.

---

## Payments (Paystack)

Flow (`lib/services/payments.js`):

1. The user picks a plan. The client sends **only the plan id** to `/api/subscriptions/subscribe`, `/renew`, `/upgrade` or `/api/payments/initialize`.
2. The server loads the price from MongoDB, decides whether this is a NEW, RENEWAL, UPGRADE or SWITCH purchase, saves a `PENDING` payment with a **plan snapshot**, and initialises a Paystack transaction (amount in kobo, a unique reference, and metadata).
3. The user pays on Paystack's hosted checkout and is redirected to `/payments/callback`.
4. The callback page asks `/api/payments/verify`, which **verifies the reference directly with Paystack**. The redirect itself is never trusted.
5. The server checks that the **reference, amount, currency, user and payment id** all match. A mismatch is marked `FAILED` and written to the audit log.
6. The payment is **atomically claimed** (`PENDING → PROCESSING`), so the callback, the webhook and the reconciliation job can race safely and a payment is fulfilled **exactly once**.
7. The subscription is activated, the payment is marked `SUCCESS`, and in-app plus WhatsApp confirmations are sent.

Handled cases: success, failure, cancellation (via Paystack `cancel_action`), abandoned checkouts, duplicate or reused references, reuse of a still-pending checkout (no double charge), renewals (extend the end date), upgrades (unused value is converted into bonus days on the new plan), same-level plan switches, and one-time free trial plans (price 0).

**Webhook**: in Paystack Dashboard → Settings → API Keys & Webhooks, set the webhook URL to:

```
https://YOUR_DOMAIN/api/payments/webhook
```

Requests without a valid `x-paystack-signature` (HMAC-SHA512 of the raw body) are rejected with `401`. Valid events are still re-verified through the API. The job also re-checks pending payments older than 10 minutes, in case a webhook was missed.

Test cards: https://paystack.com/docs/payments/test-payments

---

## Sign-up: terms & email verification

- **Terms**: the sign-up page opens the terms automatically. "I agree" is only enabled after the reader scrolls to the end, and **Create account** stays disabled until they accept. The server still requires `acceptTerms: true`, and stores `termsAcceptedAt` and `termsVersion` (`TERMS_VERSION` in `lib/constants.js`; bump it when the terms change). The text lives in `components/legal/TermsContent.js` and is shared with `/terms`.
- **Email verification**: after sign-up the client lands on `/verify-email`. The email (sent with Resend) contains a **6-digit code** (valid 30 min, 5 attempts) and a **one-tap link** (valid 24 h, works in any browser). Codes are stored as HMAC hashes and links as SHA-256 hashes. Resend has a 60-second cooldown and is rate-limited.
- **Until verified** a client can't open the dashboard or call any API except verify/resend/logout (`requireAuth` returns `403 EMAIL_NOT_VERIFIED`, and the browser is sent to `/verify-email`). The WhatsApp/in-app welcome message is sent after verification.
- **Existing accounts are not affected**: only accounts created with `emailVerified: false` need to verify. Staff never do. A Super Admin/Admin with `users.manage` can click **Mark email verified** on a client's page if their email never arrives.
- If someone signs up with an address and never verifies it, a new sign-up with that address replaces the abandoned account, so nobody can squat on someone else's email.
- **Setup**: create a Resend account, verify your sending domain (DNS records), create an API key, then set `RESEND_API_KEY` and `EMAIL_FROM`. Until the domain is verified you can only send to your own Resend login email from `onboarding@resend.dev`.

## Winning tickets & discounts

Clients upload photos of winning betting slips from **Dashboard → Winning Tickets**. The **Super Admin** reviews them at **Admin → Winning Tickets** (permission `winningTickets.review`, which can't be delegated to Admins).

- **Upload**: the browser re-encodes the photo to JPEG (max 1600 px, under 2 MB), which also strips EXIF/GPS data. The server checks the file's magic bytes, rejects duplicate images (SHA-256) and duplicate bookmaker + ticket IDs, and rate-limits uploads to 10 per client per day. Images are stored in MongoDB (`WinningTicket.image.data`, never returned in list queries).
- **Review**: approve, reject with a reason (sent to the client in-app and on WhatsApp), or revoke an approval whose discount hasn't been used yet. Each action is audit-logged.
- **Monthly reward**: the Super Admin sets a **monthly target** (approved uploads) and a **discount %** (max 90%) on the same admin page. If a client's approved uploads in a calendar month (by upload date, platform timezone) reach the target, they get the discount on **one** subscription payment in the **following** month. Counts reset every month. The discount is computed on the server at checkout; `Payment.rewardMonth` records which month's target it used, and once a payment with that `rewardMonth` succeeds the reward is spent (failed/abandoned checkouts don't use it up).
- **Price shown vs charged**: clients see the discounted price on the plan cards; Paystack is charged exactly that amount, and `Payment.originalAmount` / `discountPercent` record the reward. Upgrade credit uses the plan's list price so a discount never inflates bonus days.
- **Homepage carousel**: approved tickets appear anonymously in the "Subscriber wins" carousel only if the client ticked consent **and** the Super Admin chose "Show on homepage". No names or IDs are sent to the browser; the image URL is public only for those tickets. The section hides itself when there's nothing to show, and can be switched off in the reward settings.

## WhatsApp notifications

`lib/whatsapp/` is a provider abstraction (`{ name, isConfigured, send({ to, text, template }) }`). Two providers are included:

- **meta**: WhatsApp Cloud API (`POST /{PHONE_NUMBER_ID}/messages`).
- **console**: logs messages. It is used automatically in development when no credentials are set, and never pretends to send in production.

To add Twilio or 360dialog, implement the same interface and register it in `lib/whatsapp/index.js`.

Messages are written to a **durable outbox** (`MessageOutbox`) and sent in priority order after the response (`after()`) and by the cron job, with retries and exponential backoff. Large broadcasts never block a request.

**Events**: registration, payment successful or failed, subscription activated, expiry reminder (N days before), subscription expired, bet code released, password reset, and admin broadcasts. Each event can be switched on or off in **Admin → System Settings**, and users can opt out per category from their profile.

**Release notifications only go to entitled users.** Audience = users whose *active* subscription level is ≥ the code's level. Higher tiers, and plans with **priority notifications**, are queued first. The WhatsApp message never includes the code itself:

```
New Bet Code Available

A new [Premium] bet code has been released.

Login to your account to view it.
```

> **Meta rules:** free-form text is only delivered within 24 hours of the user's last message to you. For business-initiated messages, create approved **templates** in Meta Business Manager and enter their names per event under **Admin → System Settings → WhatsApp → Message templates**. Body variables are filled in order (for example `{{1}}` = name, `{{2}}` = plan). Use **Send test** on the same page to check your credentials.

Password reset links are delivered over WhatsApp. If a client can't receive WhatsApp, an admin can generate a one-time reset link from **Admin → Users → ⋯ → Password reset link**. There is no email provider in this stack; add one in `lib/notifications.js` if you need it.

---

## Background jobs & cron

`GET /api/cron` (requires `Authorization: Bearer $CRON_SECRET`) runs `lib/jobs.js`:

- promote due `SCHEDULED` codes and send their release notifications (each code is claimed atomically, so it is never notified twice);
- mark `PUBLISHED` codes past expiry as `EXPIRED`;
- expire subscriptions past their end date and notify users;
- send expiry reminders;
- re-verify stale pending Paystack payments;
- flush the WhatsApp outbox.

Triggers:

- **Vercel Cron**: `vercel.json` is set to **once a day** (`0 6 * * *`) so it deploys on the Hobby plan. On **Pro**, change it to every 1–5 minutes (`*/5 * * * *`) for prompt release notifications.
- **Opportunistic**: when users load bet codes, the jobs also run after the response, at most once a minute across all instances.
- **Any external scheduler** (cron-job.org, GitHub Actions, or `bun run jobs` locally) can call the endpoint with the secret.

Access control never depends on the job: expiry and publish times are checked in every query. Release notifications for codes that became due more than 6 hours before a job ran are skipped rather than sent late.

---

## Roles & permissions

| Capability | Super Admin | Admin (default) | User |
|---|:-:|:-:|:-:|
| Manage users (suspend/ban/reactivate clients) | ✅ | ✅ | |
| View subscribers, subscriptions, payments | ✅ | ✅ | own only |
| Create / edit / publish / schedule / delete bet codes | ✅ | ✅ | |
| Send notifications & WhatsApp broadcasts | ✅ | ✅ | |
| Basic analytics | ✅ | ✅ | |
| Categories, full revenue analytics, audit logs | ✅ | grantable | |
| Plans & prices, manual subscription changes | ✅ | ❌ never | |
| Create/remove administrators, roles & permissions | ✅ | ❌ never | |
| System settings | ✅ | ❌ never | |

Super Admins can adjust which *grantable* permissions Admins have under **Roles & Permissions**. Super-admin-only permissions can't be delegated, even by editing the database (`getRolePermissions` filters them out). Admins can't see or modify staff accounts, nobody can change their own role, and the last active Super Admin can't be demoted or removed.

---

## Project structure

```
app/
  page.js                    Landing page (plans loaded from MongoDB)
  (auth)/login|register|forgot-password|reset-password
  dashboard/                 Client area: overview, betcodes, betcodes/[id],
                             subscription, payments, notifications, profile
  payments/callback/         Paystack return page (server-side verification)
  admin/                     Overview, users, users/[id], subscriptions, payments,
                             betcodes, categories, plans, notifications, analytics,
                             audit-logs, settings, administrators, roles
  api/
    auth/                    register, login, logout, me, forgot/reset/change-password,
                             profile, session-reset
    subscriptions/           plans, current, subscribe, renew, upgrade
    payments/                initialize, verify, webhook, (GET) history
    betcodes/                list, [id], [id]/view, [id]/favorite, stats
    notifications/           list, [id], read-all
    categories/              public list
    admin/…                  users, subscriptions, payments, betcodes (+batch, action),
                             categories, plans, notifications, analytics, audit-logs,
                             settings, administrators, roles, whatsapp/test
    cron/                    background jobs (CRON_SECRET)
components/
  ui/  layout/  landing/  auth/  dashboard/  betcodes/  subscriptions/  admin/
lib/
  access.js        pure access rules          auth.js         authz helpers
  permissions.js   RBAC matrix                session.js/jwt.js  cookies & JWT
  mongodb.js       cached connection          validation.js   Zod schemas + sanitising
  paystack.js      Paystack client            payment-validation.js  pure checks
  whatsapp/        provider abstraction       notifications.js  in-app + outbox
  settings.js      cached platform settings   audit.js        audit logging
  rate-limit.js    Mongo-backed limiter       jobs.js         background jobs
  timezone.js      DST-safe conversions       services/       subscriptions, payments,
                                                              betcodes, analytics
models/            User, SubscriptionPlan, Subscription, Payment, BetCode, Category,
                   Notification, AuditLog, Setting, RateLimit, MessageOutbox,
                   Favorite, BetCodeView, Broadcast
proxy.js           Next.js 16 proxy (formerly middleware): optimistic redirects only
scripts/           seed.js, run-jobs.js
tests/             bun test suite for access, RBAC, timezone and payment checks
```

Next.js 16 conventions used: `proxy.js` instead of `middleware.js`, async `params`/`searchParams`/`cookies()`/`headers()`, `after()` for post-response work, Server Components by default with `"use client"` only for interactive pieces. Tailwind v4 is configured entirely in `app/globals.css` (`@import "tailwindcss"` + `@theme`), with no `tailwind.config.js`.

---

## API reference

All responses use one shape:

```json
{ "success": true,  "message": "optional", "data": { } }
{ "success": false, "message": "Subscription required", "code": "SUBSCRIPTION_REQUIRED", "errors": { "field": "…" } }
```

Status codes: `401` unauthenticated or invalid session · `402` subscription required · `403` forbidden or upgrade required · `404` not found · `409` conflict · `422` validation · `429` rate limited · `502` payment gateway error · `500` generic (details are only logged on the server).

Mutating requests with a foreign `Origin` header are rejected (CSRF protection on top of `SameSite=Lax` cookies).

---

## Security checklist

- bcrypt (12 rounds) password hashing. Password hashes, reset tokens and token versions are `select: false` and stripped by serializers.
- Session cookies are HTTP-only, `Secure` in production, `SameSite=Lax`, and signed with HS256. Tokens expire and can be revoked through `tokenVersion`.
- Server-side authorization on every page and API route. `proxy.js` is only a convenience redirect.
- Zod validation on every body and query, HTML/control-character stripping, escaped regex search. Typed schemas block NoSQL operator injection.
- IDOR protection: user endpoints are always scoped to `user._id`, and payment verification checks ownership.
- Users can't write role, status, email, subscription or bet code fields. Role changes require `roles.manage`.
- Payment tampering is blocked: prices come from the database, the amount/currency/reference/user are verified with Paystack, webhooks are signature-checked, and fulfilment is idempotent.
- Rate limits on login (IP + account), registration, password reset/change, payment init/verify and broadcasts. They are stored in MongoDB so they hold across serverless instances.
- The audit log records bet code changes, price changes, user status and role changes, manual subscription edits, settings and permissions changes, broadcasts and payment mismatches.
- Security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production). The `X-Powered-By` header is disabled.
- Open-redirect-safe `?next=` handling, generic forgot-password responses, and constant-time login checks against email enumeration.

---

## Deploying to Vercel

1. Push the repo and import it in Vercel. The framework is detected automatically, and Vercel uses Bun when it finds `bun.lock`.
2. Add every variable from `.env.example` in **Project → Settings → Environment Variables**. Set `NEXT_PUBLIC_APP_URL` to your production URL.
3. In MongoDB Atlas, allow Vercel to connect (Network Access → `0.0.0.0/0`, or use the Vercel integration).
4. Deploy, then run the seed once from your machine against the production `MONGODB_URI`: `bun run seed`.
5. Set the Paystack webhook URL and switch to live keys when you're ready.
6. Optional: raise the cron frequency on Pro (see above).

---

## Testing

```bash
bun test
```

This covers the access rule (including the Premium/VIP example), expiry handling, upgrade credit, RBAC guarantees, DST-safe scheduling, and Paystack transaction matching.

Manual end-to-end check with Paystack test keys:

1. Register a user and buy Basic with a test card. You should see "Payment successful" and only Basic codes.
2. Call `GET /api/betcodes/<VIP code id>` with that user. It must return `403` with no `code` field.
3. Upgrade to Premium. You should get bonus days, and Basic, Standard and Premium codes become visible.
4. In the database, set the subscription's `endDate` to the past. Access is revoked immediately.

---

## Troubleshooting

- **"MONGODB_URI is not set"**: create `.env.local`, then restart `bun dev`.
- **Login returns 500**: `JWT_SECRET` is missing or shorter than 32 characters.
- **Payment stuck on "processing"**: check the webhook URL and `PAYSTACK_SECRET_KEY`. The cron job re-verifies pending payments after 10 minutes.
- **WhatsApp messages "SKIPPED"**: enable WhatsApp in System Settings, set the credentials, and use templates for business-initiated messages.
- **Scheduled codes appear but no notification arrived**: nothing has triggered the job yet. Increase the cron frequency or point an external scheduler at `/api/cron`.

---

**Responsible gambling:** the platform includes 18+ notices and a terms page template. Review the terms for your jurisdiction and confirm your business is licensed where required before launch.
