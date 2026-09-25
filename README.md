# BiteFlow — Restaurant OS

A working prototype of the BiteFlow platform — an end-to-end restaurant operating
system with a public marketing site, tenant onboarding, a role-aware restaurant app,
customer-facing QR ordering, and a super-admin console for managing tenants, plans,
billing and audit.

Built as a single Vite + React 18 + TypeScript + Tailwind CSS v4 single-page app on
top of Supabase (Postgres + Auth + Realtime, with RLS enforcing tenant isolation).

---

## What BiteFlow is, in one breath

BiteFlow is a SaaS restaurant platform where each tenant (a restaurant or café) gets
a fully branded customer experience — menu, pricing, floor plan, orders, reservations
and billing — while the platform owner sees the whole business: tenants, subscriptions,
revenue, analytics and audit.

The same codebase renders every surface:

| Surface | Routes | Purpose |
| --- | --- | --- |
| Marketing site | `/`, `/features`, `/pricing`, `/demo`, `/about`, `/contact` | Position the product, book a demo |
| Auth | `/login`, `/signup` | Supabase email + password auth |
| Onboarding | `/onboarding/1` … `/onboarding/8` | Profile → branding → plan → menu → floor plan → launch |
| Restaurant app | `/app/dashboard`, `/app/orders`, `/app/kitchen`, `/app/tables`, `/app/tables/qr`, `/app/reservations`, `/app/menu`, `/app/inventory`, `/app/customers`, `/app/employees`, `/app/analytics`, `/app/billing`, `/app/branding`, `/app/settings` | Role-aware workspace (RBAC per `prd.md`) |
| Customer QR flow | `/r/:slug`, `/r/:slug/menu`, `/r/:slug/menu/:itemId`, `/r/:slug/cart`, `/r/:slug/orders`, `/r/:slug/order/:orderId`, `/r/:slug/bill`, `/r/:slug/profile` | Mobile-first, white-labelled per tenant |
| Super admin | `/admin`, `/admin/tenants`, `/admin/plans`, `/admin/subscriptions`, `/admin/analytics`, `/admin/audit` | Platform-wide tenants, pricing, revenue, audit |

Seeded demo tenants you can open right away:

- `/r/spice-route` — full restaurant
- `/r/urban-bean-cafe` — café
- `/r/the-green-bowl` — health bowl bar

---

## Why it matters

BiteFlow is a complete, opinionated answer to a real operational problem: a restaurant
should not need five separate tools to take a table, send a ticket to the kitchen,
capture a special request, run a reservation, invoice a table and brand its customer
menu. Every role inside the restaurant sees the same truth from a different angle:

- Guests scan a QR code, browse the white-labelled menu, order, pay and track their
  order — without waiting on a server.
- FOH sees live tables, orders in flight, reservations and kitchen load.
- Kitchen sees tickets and prep stages.
- Managers and owners see the dashboard, inventory, customers, employees, billing and
  branding.
- Platform admins see all tenants, plans, subscriptions, revenue and an append-only
  audit trail.

It is also built so the prototype runs without any backend setup — a bundled demo
dataset backs every screen — and then lifts into a real Supabase project with one SQL
file and two env vars.

---

## What's inside

- **Design system**: Hospitality Kinetic, documented in [`design.md`](./design.md).
- **API surface**: one abstraction in `src/data/api.ts` with two interchangeable
  backends — a fully offline demo backed by the bundled seed dataset, and a live
  Supabase backend using RLS and realtime.
- **Tenant isolation**: every tenant-scoped read/write is filtered by organization and
  enforced server-side by RLS in `supabase/schema.sql`.
- **Demo dataset**: full tenant, menu, floor plan, orders, reservations, inventory,
  customers, invoices, notifications and audit history, generated in
  `src/data/seed.ts` and mirrored in `supabase/seed.sql`.
- **Static deploy output**: `npm run build` emits a fully static `dist/` that runs on
  any static host, with SPA-fallback rewrites included for Vercel and Netlify.

---

## Quick start

```bash
npm install
cp .env.example .env      # optional — skip entirely for demo mode
npm run dev               # http://localhost:5173
```

That's enough to open the three seeded tenants and walk every customer QR flow. No
Supabase project is required for the demo.

---

## Two modes

`src/data/api.ts` exposes a single API surface behind two backends:

- **Demo (default)** — no credentials required. The bundled dataset in
  `src/data/seed.ts` backs every screen and persists to `localStorage`, so the
  golden-path demo works offline. Sign in with any email and password. State is
  synced **across browser tabs** — see [Demo mode on deploy](#demo-mode-on-deploy).
- **Live** — set the two Supabase variables below and every read/write goes to Postgres
  through RLS. Realtime subscribes to `orders`, `restaurant_tables`,
  `service_requests` and `notifications` (socket status is logged to the
  console, and a full snapshot is re-pulled on reconnect so events missed
  during an outage are not lost).

Force demo mode even when credentials are present by setting `VITE_DEMO_MODE=true`.

---

## Supabase setup

1. **Create a project** at [supabase.com](https://supabase.com). Pick a region close to
   your users (for India, `ap-south-1`).

2. **Apply the schema.** In *SQL Editor*, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql) and run it. That creates every table,
   the `is_org_member` / `is_super_admin` / `is_public_tenant` helpers, all RLS policies
   (including anon access for the QR menu), the profile trigger, the table-sync trigger
   and the realtime publication.

3. **Seed the demo tenant (optional but recommended).** Run
   [`supabase/seed.sql`](./supabase/seed.sql) the same way. It creates *Spice Route* with
   a full menu, floor plan, live and completed orders, reservations, inventory, customers,
   invoices, notifications and audit history.

4. **Grab your API keys.** *Project Settings → API* → copy:

   | Key | Goes into |
   | --- | --- |
   | Project URL | `VITE_SUPABASE_URL` |
   | `anon` `public` key | `VITE_SUPABASE_ANON_KEY` |

   Put them in `.env` at the project root:

   ```bash
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   VITE_PUBLIC_SITE_URL=http://localhost:5173   # used to build QR links
   ```

5. **Create your first account.** Sign up in the app (or *Authentication → Users → Add
   user*), then run this once so your login owns the demo tenant and can reach `/admin`:

   ```sql
   insert into public.memberships (organization_id, user_id, role, status, shift)
   select o.id, u.id, 'super_admin', 'active', 'Full day'
   from public.organizations o, auth.users u
   where o.slug = 'spice-route'
   on conflict do nothing;
   ```

   Swap `'super_admin'` for `'owner'`, `'manager'`, `'chef'`, `'waiter'` or `'cashier'`
   to preview a role-scoped workspace.

6. **Restart the dev server.** Vite only reads `.env` on boot.

### Notes

- `memberships.role` drives the sidebar and every write guard (`ROLE_CAPABILITIES` in
  `src/lib/types.ts`); RLS is the source of truth server-side.
- Guest ordering runs on the `anon` key: the QR flow reads the menu and inserts orders
  only while the tenant's `subscription_status` is `active` or `trialing`.
- `audit_logs` is append-only — there is no `UPDATE` / `DELETE` policy.

### Troubleshooting

| Error | Cause | Fix |
| --- | --- | --- |
| `42P01: relation public.memberships does not exist` while creating functions | An earlier revision of `schema.sql` declared SQL helpers before the tables they read — Postgres validates function bodies at create time. | Tables now come first and the script sets `check_function_bodies = off`. Re-run the current `schema.sql`. |
| `42P01: relation public.organizations does not exist` from the seed | `seed.sql` ran before `schema.sql`, or `schema.sql` aborted part-way. | Run `schema.sql` to completion first; the seed now aborts with a clear message instead. |
| `PGRST205: Could not find the table public.organizations` from the app | PostgREST has not picked up the new tables, or the schema was never applied. | Run `schema.sql`, then reload the API cache from *Project Settings → API → Reload schema*. |
| Login works but every screen is empty and the console shows RLS errors | Your user has no row in `memberships`. | Run the membership snippet in step 5 above. |

---

## Deploy

The `dist/` folder produced by `npm run build` is a fully static site. Drop it on
any static host. Two SPA-fallback configs are included so client-side routes don't
404 on refresh:

| Host | File |
| --- | --- |
| Vercel | `vercel.json` (rewrites all routes to `/index.html`) |
| Netlify | `public/_redirects` (same rewrite rule) |

### Vercel (recommended)

1. Push this repo to GitHub.
2. In the [Vercel dashboard](https://vercel.com) click **Add New → Project**,
   import the repo, and leave all defaults. Vercel picks up `vercel.json` and
   auto-deploys on every push to `main`.
3. Add your Supabase env vars under *Project Settings → Environment Variables*:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PUBLIC_SITE_URL`.
4. Redeploy once the vars are set (or set them as *Production* vars and the
   initial deploy will include them).

#### Quick deploy without the dashboard

If you prefer the CLI, install it once and run:

```bash
npm i -g vercel
vercel login              # browser flow — one time
vercel                    # preview deployment
vercel --prod             # production deployment
```

The preview URL is printed at the end of the deploy; use it to share a live
instance before merging.

### Netlify

```bash
npm run build
# drag the `dist/` folder onto Netlify Drop, or connect the repo and Netlify
# picks up public/_redirects automatically.
```

### Any static host (S3, Cloudflare Pages, GitHub Pages...)

Serve `dist/` as static files and configure the host to return `index.html` for
any route that doesn't match a file. The exact setting name differs by host:

| Host | Setting |
| --- | --- |
| Cloudflare Pages | *Functions → SPA fallback* or `_redirects` file in `dist/` |
| GitHub Pages | no config needed for single-page apps if you use a custom 404 page that redirects to `index.html` |
| S3 + CloudFront | *Error pages* → set `404.html` to `index.html` with a 200 response |

### Environment variables

Set these on the host's environment/UI. They are **build-time** variables, so set
them before building (or rebuild after changing them).

| Variable | Required? | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | no (demo mode without it) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | no (demo mode without it) | Supabase anon/public key |
| `VITE_PUBLIC_SITE_URL` | yes for live QR links | The public URL of the deployed site, e.g. `https://your-tenant.vercel.app` — used to build QR links |
| `VITE_DEMO_MODE` | no (defaults to `true` when no Supabase creds) | Set to `false` to force live mode when creds are present |

### Demo mode on deploy

The app runs **fully in demo mode** with no Supabase credentials — the bundled
seed dataset is served from `localStorage`. This is ideal for a preview deploy
that requires zero backend setup: users can sign in with any email, browse the
three seeded tenants (`spice-route`, `urban-bean-cafe`, `the-green-bowl`), and
every screen is populated.

#### Cross-tab sync

Demo state used to be per-tab: an order placed through the guest flow in one
window was invisible to a dashboard open in another until a full reload. It is
now synced — whenever a tab writes the dataset, session or impersonation state
to `localStorage`, every *other* tab receives the browser's `storage` event,
reloads its in-memory copy and re-renders. In practice: put the restaurant
dashboard and the guest menu in two side-by-side windows and orders appear on
the dashboard the moment they are placed.

Two boundaries worth knowing:

- Sync is per **browser profile**, because that is what `localStorage` scopes
  to — separate devices (or a normal vs. incognito window) do not see each
  other. Multi-device ordering needs live mode.
- A tab whose `localStorage` write raced another's can at worst hand a torn
  JSON blob to its peers; those keep their current copy rather than crashing
  (pinned by `src/test/cross-tab-sync.test.tsx`).

---

## Scripts

```bash
npm run dev         # dev server
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + production bundle
npm run preview     # serve the production build
npm test            # run smoke tests
npm run test:watch  # run tests in watch mode
```

#### Realtime probe

`scripts/realtime-probe.mjs` verifies the live-mode realtime path end to end
against a real project: it subscribes to `orders` exactly the way the dashboard
does, inserts an order through the anon REST path, and asserts the event
arrives (then deletes it). Run it after wiring up Supabase, or whenever the
dashboard seems to have stopped updating:

```bash
node scripts/realtime-probe.mjs <organization-uuid>   # creds come from .env.local
```

`VERDICT: realtime works` means the socket, publication and RLS read path are
all healthy; `no event within 8s` usually means the tables are missing from the
`supabase_realtime` publication (re-run the realtime block of
`supabase/schema.sql`) or the project is paused.

#### Live schema smoke test

`scripts/live-smoke.mjs` catches drift between the migrations this repo ships
and what actually exists on the hosted project — useful when the database can
be changed from several places (CLI, dashboard, MCP) and nothing records *why*
a policy disappeared. It asserts the contract the app depends on, not the
migration file names:
```bash
npm run smoke                                       # client checks only
SUPABASE_ACCESS_TOKEN=sbpat_xxx npm run smoke       # + SQL contract checks
```

Client checks (anon key only): every contract table is exposed over REST,
`order_number_counters` / `impersonation_sessions` are still blocked for anon
(the 003/004 boundary), auth answers, and a realtime channel subscribes.

SQL checks (need a personal access token from
[supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)):
tables exist with RLS on, the named policies from 001/003/004 are present, the
SECURITY DEFINER helper signatures match (`rollback_order_number` returning
`integer`, not the pre-003 `void`), grants match the guest/tenant boundary,
`supabase_realtime` still publishes all four tables, and the order-number
trigger is attached. Exit code is non-zero on any failure, so a deploy
pipeline can gate on it.

CI runs `npm ci`, `npm run typecheck`, `npm run test` and `npm run build` on Node 20 for
every push and pull request to `main` (`.github/workflows/ci.yml`).

---

## Project layout

```text
src/
  components/     UI kit, layout shells, QR + guest-menu preview
  data/           api.ts (demo ⇄ Supabase), seed.ts, metrics.ts
  lib/            types, plans, formatting, supabase client, hooks
  pages/          marketing · auth · onboarding · app · customer · admin
  store/          AppStore (session, tenant scope, derived metrics), cart, theme
supabase/
  schema.sql      tables, RLS, triggers, realtime
  seed.sql        demo tenant
scripts/
  realtime-probe.mjs  end-to-end realtime check against a live project
  live-smoke.mjs      hosted-schema contract check (drift detection)
```

Top-level config: `package.json`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`,
`.env.example`.

---

## License

This project is a prototype. Treat the code, schema and seed data as illustrative unless
otherwise licensed.

---

## Author

Maitreya20 — [github.com/Maitreya20/BiteFlow](https://github.com/Maitreya20/BiteFlow)
