# Pizza Station

Next.js 15 App Router frontend and Supabase-backed backend for Pizza Station.
The server APIs are in `src/app/api`; database schema, Row Level Security (RLS),
and transactional functions are in `supabase/migrations`.

## Local setup

Requirements: Node.js 20.9+, npm, and a Supabase project.

1. Install packages: `npm install`.
2. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`: the Supabase project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the project's publishable/anon key. This
     is intended for browser-visible use and is restricted by RLS.
   - `NEXT_PUBLIC_SITE_URL`: canonical site origin, used for password-reset
     redirects (for example `http://localhost:3000`).
   - `RESEND_API_KEY` and `RESEND_FROM_EMAIL`: optional; configure both to send
     order confirmation and status emails. Without them, in-app notifications
     are still recorded.
3. Apply all six migrations in order using the Supabase CLI. Run
   `supabase init` if this workspace has not been initialized, then `supabase link`
   and `supabase db push`. Alternatively, run
   `supabase/migrations/202611140001_initial_schema.sql` followed by
   `supabase/migrations/202611140002_normalized_database.sql` and
   `supabase/migrations/202611140003_secure_table_qr_ordering.sql` and
   `supabase/migrations/202611140004_admin_dashboard_roles.sql` and
   `supabase/migrations/202611140005_pizza_station_1800_menu.sql` and
   `supabase/migrations/202611140006_qr_dine_in_experience.sql` in the
   Supabase SQL Editor. The project needs Supabase Auth and Storage enabled.
   The migrations use `pgcrypto`, create the `product-images` public bucket,
   tables, triggers, RLS policies, and transactional order/table-session RPCs.
4. In Supabase Auth settings, set the site URL and allow-list
   `http://localhost:3000/auth/callback` and your deployed callback URL.
   Enable email confirmation if desired.
5. Register the trusted owner at `/account/register`, then promote that account
   to admin (the owner role) directly in the Supabase SQL Editor (never expose this operation
   publicly):
   `update public.profiles set role = 'admin' where email = 'owner@example.com';`
   Sign in at `/admin/login` after the role change.
6. Run `npm run dev`. Validate with `npm test`, `npx tsc --noEmit`, and
   `npm run build`. After migrations are applied to a disposable/staging
   database, run `supabase/tests/table_qr_ordering.sql` in a transaction-capable
   SQL client; it checks valid/invalid QR sessions, idempotent order creation,
   and scoped guest status, then rolls back its fixtures. Run
   `supabase/tests/pizza_station_1800_menu.sql` after migration 005 to check
   menu counts, sample prices, options, and restaurant contact data.

No Supabase service-role key is used by this app. Do not add one to a
`NEXT_PUBLIC_*` variable or expose it to clients. User role assignment is not
part of registration; only an existing admin can promote accounts to staff.
Cashiers/managers/delivery users can be assigned only after those accounts have
registered.

### Development database data

Migration 005 seeds 123 Pizza Station 1800 menu items across 23 categories
using idempotent, prefixed product slugs, prices in BDT, and size/extra options.
`supabase/seed.sql` supplies the restaurant name, phone, currency, and map
coordinates for local development. For a local Supabase stack,
`supabase db reset` applies migrations and seed data, but resets the local
database; do not use that command against production. `supabase db push` applies
migrations and does not apply the local seed. The schema relationship guide is
in `supabase/ERD.md`.

### Database dependencies and migration effects

The database depends on Supabase Auth (`auth.users`, `auth.uid()` and the
`anon`/`authenticated` database roles), Supabase Storage for product images,
and PostgreSQL's `pgcrypto` extension. Migration 002 also expects the legacy
tables created by migration 001. The application needs only the public Supabase
URL and anon key; database migration commands use the Supabase CLI's linked
project credentials. No service-role key belongs in application environment
variables.

Migrations 002–006 are additive and intended to preserve existing tables
and rows. Migration 002 adds normalized entities, RLS, indexes, triggers, and
compatibility bridges; it backfills address/order/payment/inventory/menu
history where source data exists;
and replaces the payment-method check constraint while retaining the legacy
`cash_on_delivery` and `cash_at_restaurant` values for historical rows. New
orders store `payment_method = 'cash'` and separately store whether cash is due
at `restaurant` or on `delivery`. It does not drop the older API-facing tables.
Editing or adding these files does not apply them to a Supabase project. Check
the project's migration history and take a verified backup before applying
them to production; although they avoid table/row deletion, schema changes,
trigger enforcement, data backfills, and RLS changes can affect existing
clients and permissions. Migration 003 adds a unique SHA-256 QR-token hash to
each existing restaurant table and replaces public table-row reads with
staff-only metadata reads. Existing table tokens cannot be recovered in
plaintext; rotate each existing table QR from `/admin/tables` before printing.
The migration also validates dine-in orders against the current active table
session and locks both table and session during order insertion. It detects the
installed `pgcrypto` schema and creates restricted compatibility wrappers
when legacy functions expect the extension in `public`. Migration 005 inserts
the supplied restaurant menu, pizza sizes, extra-cheese add-ons, BDT setting,
phone and map coordinates. It does not delete catalog rows; prefixed slugs make
the new products distinct. It deactivates only the four known development
sample products from the previous seed so they do not appear beside the
restaurant's real menu. Their rows and historical order snapshots remain.
Migration 006 extends the existing status checks to include `served`, adds
token-scoped guest status lookup, exposes active-but-unavailable products so
the table menu can label them accurately, and adds `public.orders` to the
Supabase Realtime publication. It does not create or delete domain tables or
delete order data. It requires the Supabase `supabase_realtime` publication.
It also aligns database authorization with staff workflows: kitchen permission
can move confirmed orders into preparation and mark them ready, while
acceptance, rejection, serving, and completion require order-management access.

## Backend API

All request bodies are parsed with Zod. Auth is backed by Supabase Auth and
httpOnly session cookies; authorization checks the server-side `profiles.role`.
Database access uses the caller's Supabase session, while PostgreSQL RPCs run
the operations that need atomicity.

| Area | Routes |
| --- | --- |
| Auth | `POST /api/auth/register`, `/login`, `/logout`, `/password-reset`, `PATCH /api/auth/password`; `GET /auth/callback` |
| Account | `GET|PATCH /api/account/profile` (authenticated user's own profile only) |
| Admin dashboard | `GET /api/admin/session`, `/summary`, `/orders`, `/customers`, `/staff`, `/inventory`, `/payments`, `/permissions`, `/reports`, `/settings`, `/categories`, `/coupons`, `/zones`; writes require server-verified roles and scoped staff permissions |
| Catalog | `GET /api/categories`, `/api/delivery-zones`, `GET /api/products` (optional `category` UUID and `featured=true` filters), `GET /api/products/:id` |
| Table QR | `POST /api/tables/resolve` (returns the table label only for a valid QR and open session); `GET /api/table-orders/:id` (requires the QR token in `x-table-token`) |
| Product admin | `POST /api/products`, `PATCH|DELETE /api/products/:id`, `POST /api/admin/product-images` |
| Orders | `POST /api/orders`, `GET /api/orders`, `GET|PATCH /api/orders/:id`, `POST /api/orders/:id/payment`, `PATCH /api/orders/:id/delivery` |
| Table admin | `GET|POST /api/admin/tables`, `PATCH /api/admin/tables/:id`, `GET /api/admin/tables/:id/sessions` |
| Admin | `GET|POST /api/admin/:resource`, `PATCH|DELETE /api/admin/:resource/:id`; supported resources include categories, coupons, zones, customers, staff, inventory, settings, orders, reports (some are read-only or use RPC-specific operations) |

`POST /api/orders` accepts product/variant/add-on IDs and quantities, never
prices or totals. `create_order` locks inventory and coupons, verifies
availability, delivery zone/minimum and table QR/session state, calculates all
amounts, records immutable item snapshots, writes the order and confirmation
notification, and honors a UUID `idempotency_key` in one PostgreSQL transaction. Table QR
links open the standalone `/table-menu#TOKEN` interface; the raw token stays in
the URL fragment and is revalidated by the order transaction. The QR cart uses
separate browser storage from the public website cart. Guest order-status
lookups return only that table's receipt/status fields after verifying the
token-to-order relationship; they do not grant general order reads.
The API accepts cash on delivery and cash at restaurant; normalized rows store
`payment_method = 'cash'` and `cash_collection_point` separately. Authorized
admins/managers and cashiers with the `payments.confirm` permission record cash
payment/refund events through `confirm_cash_payment`; each event stores the
staff ID and timestamp.

Product image uploads accept JPEG, PNG, and WebP files up to 5 MB. The `/admin`
workspace includes live orders, a Realtime-updated `/admin/dine-in` queue
(with a 15-second refresh fallback), kitchen tickets, table QR/session management,
catalog and image editing, inventory, customer order histories, promotions,
delivery zones/assignments, cash payment records, staff permissions, reports,
and restaurant settings. Order and kitchen queues refresh every 15 seconds.
Sales reports are aggregated in PostgreSQL over the selected period rather than
being calculated from a limited client-side order sample.

## Security and operations

- RLS is enabled on application tables; public catalog reads are limited to
  active products/categories/options and active delivery zones. Active products
  are returned with availability flags so the QR menu can disable unavailable
  items without accepting orders for them.
- The database enforces customer role defaults, prevents self-service role
  changes, and applies server-side authorization in security-definer RPCs.
- Customers can read only their own addresses, orders, order snapshots, status
  history, payments, and coupon redemptions. Staff-only tables and administrative
  changes use role checks or explicit permission grants.
- Order totals and option prices come only from the database. Cash receipt
  amounts must match the order total.
- Create and manage physical tables at `/admin/tables`. The server generates
  256-bit QR tokens and only stores their SHA-256 hashes. QR links put the token
  in the URL fragment; the browser sends it to the server for validation and
  receives the table label only after validation. Public roles cannot select
  table rows, token hashes, or table sessions.
- Staff with `tables.manage` open and close sessions. The `open_table_session`
  and `close_table_session` RPCs enforce staff permissions; the order RPC
  revalidates the QR and locks the table/session before attaching their real
  database IDs. Closing or expiring a session prevents new orders; a session
  may contain multiple orders.
- `/table-menu` hides the regular site navigation and supports dine-in only.
  Cash is collected physically; there is no online payment form or gateway.
  Order status updates are polled with a table-token-scoped endpoint, while
  authenticated staff receive order changes through Supabase Realtime and
  server-authorized APIs. `confirmed` is shown as “Accepted”; dine-in orders
  move from `ready` to `served` before `completed`.
  The menu displays real catalog `image_url` values; products without an
  uploaded image show a neutral placeholder rather than an invented food photo.
- Authorized staff receive a raw QR token only once during table creation or
  rotation. Download and print the QR immediately; rotating invalidates the
  previous code. Existing token hashes cannot be converted back to QR codes.
- Product and customer snapshots are preserved on orders after catalog changes.
- API failures are logged server-side and return structured error responses.

Cashiers and delivery staff need explicit permissions in addition to their
profile role. The `admin` role is the owner role; managers receive operational
access. Migration 004 adds the `kitchen` role. Grant `kitchen.manage` to kitchen
staff and `payments.confirm` to cashiers after their account exists, for example:

```sql
insert into public.staff_permissions (profile_id, permission_key, granted_by)
values ('<staff-profile-uuid>', 'payments.confirm', '<admin-profile-uuid>');
```

Supported permission keys include `payments.confirm`, `inventory.manage`,
`kitchen.manage`, `orders.manage`, and `tables.manage`. Delivery staff can see
and update only their assigned deliveries. Admins and managers bypass granular
permissions where the database policy allows it.

The menu and checkout load products and delivery zones from the API. Browser
cart entries retain product/variant/add-on IDs and display prices only as
estimates; checkout sends those IDs to `POST /api/orders`, where all prices,
availability, fees, discounts, and totals are recomputed. Cart items saved by an
older preview without product IDs must be cleared and re-added from the live
menu before they can be ordered.
