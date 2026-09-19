# BiteFlow — Restaurant OS prototype

A working prototype of the BiteFlow platform described in [`prd.md`](./prd.md) and
[`design.md`](./design.md), built on the **Hospitality Kinetic** design system in
[`hospitality_kinetic/DESIGN.md`](./hospitality_kinetic/DESIGN.md).

Vite + React + TypeScript + Tailwind v4 + Supabase.

---

## What's in here

| Surface | Routes | Notes |
| --- | --- | --- |
| Marketing site | `/`, `/features`, `/pricing`, `/demo`, `/about`, `/contact` | Position the product, book a demo |
| Auth | `/login`, `/signup` | Supabase email + password |
| Onboarding | `/onboarding/1` … `/onboarding/8` | Profile → branding → plan → menu → floor plan → launch |
| Restaurant app | `/app/dashboard`, `/app/orders`, `/app/kitchen`, `/app/tables`, `/app/tables/qr`, `/app/reservations`, `/app/menu`, `/app/inventory`, `/app/customers`, `/app/employees`, `/app/analytics`, `/app/billing`, `/app/branding`, `/app/settings` | Role-aware nav (RBAC per `prd.md` §19) |
| Customer QR flow | `/r/:slug`, `/r/:slug/menu`, `/r/:slug/menu/:itemId`, `/r/:slug/cart`, `/r/:slug/orders`, `/r/:slug/order/:orderId`, `/r/:slug/bill`, `/r/:slug/profile` | Mobile-first, white-labelled per tenant |
| Super admin | `/admin`, `/admin/tenants`, `/admin/plans`, `/admin/subscriptions`, `/admin/analytics`, `/admin/audit` | Platform-wide tenants, pricing, revenue and audit |

Try it with the seeded tenants: **`/r/spice-route`** (restaurant), **`/r/urban-bean-cafe`**
(café) and **`/r/the-green-bowl`** (health bowl bar).

---

## Run it

```bash
npm install
cp .env.example .env     # optional — skip for demo mode
npm run dev              # http://localhost:5173
```

### Two modes

`src/data/api.ts` exposes a single API surface with two interchangeable backends:

* **demo** (default) — no credentials required. The bundled dataset in
  `src/data/seed.ts` backs every screen and persists to `localStorage`, so the
  golden-path demo works offline. Sign in with any email + password.
* **live** — set the two Supabase variables below and every read/write goes to
  Postgres through RLS. Realtime subscribes to `orders`, `restaurant_tables`,
  `service_requests` and `notifications`.

Force demo mode even with credentials present by setting `VITE_DEMO_MODE=true`.

---

## Supabase setup

1. **Create a project** at [supabase.com](https://supabase.com) (choose a region
   close to your users — `ap-south-1` for India).

2. **Apply the schema.** Open *SQL Editor* → *New query*, paste the contents of
   [`supabase/schema.sql`](./supabase/schema.sql) and run it. That creates every
   table, the `is_org_member` / `is_super_admin` / `is_public_tenant` helpers,
   all RLS policies (including anon access for the QR menu), the profile trigger,
   the table-sync trigger and the realtime publication.

3. **Seed the demo tenant** (optional but recommended). Run
   [`supabase/seed.sql`](./supabase/seed.sql) the same way. It creates *Spice
   Route* with a full menu, floor plan, live and completed orders, reservations,
   inventory, customers, invoices, notifications and audit history.

4. **Grab your API keys.** *Project Settings* → *API* → copy:

   | Key | Goes into |
   | --- | --- |
   | Project URL | `VITE_SUPABASE_URL` |
   | `anon` `public` key | `VITE_SUPABASE_ANON_KEY` |

   Put them in `.env` in the project root:

   ```bash
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   VITE_PUBLIC_SITE_URL=http://localhost:5173   # used to build QR links
   ```

5. **Create your account.** Sign up in the app (or *Authentication* → *Users* →
   *Add user*), then run this once so your login owns the demo tenant and can
   reach `/admin`:

   ```sql
   insert into public.memberships (organization_id, user_id, role, status, shift)
   select o.id, u.id, 'super_admin', 'active', 'Full day'
   from public.organizations o, auth.users u
   where o.slug = 'spice-route'
   on conflict do nothing;
   ```

   Swap `'super_admin'` for `'owner'` (or `'manager'`, `'chef'`, `'waiter'`,
   `'cashier'`) to preview a role-scoped workspace.

6. **Restart the dev server** — Vite only reads `.env` on boot.

### Notes

* `memberships.role` drives the sidebar and every write guard (`ROLE_CAPABILITIES`
  in `src/lib/types.ts`); RLS is the source of truth server-side.
* Guest ordering runs on the `anon` key: the QR flow can read the menu and insert
  orders only while the tenant's `subscription_status` is `active` or `trialing`.
* `audit_logs` is append-only — no `UPDATE`/`DELETE` policy is created.

### Troubleshooting

| Error | Cause | Fix |
| --- | --- | --- |
| `42P01: relation public.memberships does not exist` while creating functions | An earlier revision of `schema.sql` declared the SQL helper functions *before* the tables they read — Postgres validates SQL function bodies at create time, so the whole file rolled back. | Fixed: tables now come first and the script sets `check_function_bodies = off`. Re-run the current `schema.sql`. |
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

---

## Scripts

```bash
npm run dev         # dev server
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + production bundle
npm run preview     # serve the production build
npm test            # run smoke tests
```

## Layout

```
src/
  components/     UI kit, layout shells, QR + guest-menu preview
  data/           api.ts (demo ⇄ Supabase), seed.ts, metrics.ts
  lib/            types, plans, formatting, supabase client, hooks
  pages/          marketing · auth · onboarding · app · customer · admin
  store/          AppStore (session, tenant scope, derived metrics), cart, theme
supabase/
  schema.sql      tables, RLS, triggers, realtime
  seed.sql        demo tenant
```
