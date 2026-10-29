# Nightingale Academic Press — Publisher Platform

A nursing/medical-education publisher website built against `Publisher_Product_Requirements_Document_PRD.docx`, `Publisher_System_Architecture_Document.docx`, and `Phase_2_Development_Plan_Publisher_Website.md`.

- **`nightingale-press/`** — React + Vite + TypeScript frontend (public site, customer account, checkout, admin panel).
- **`server/`** — Node.js + Express + TypeScript API, PostgreSQL via Prisma, Razorpay integration.

## What's implemented

**Phase 1 (public/catalogue):** Home, Books (search/filter/sort), Book detail, Authors (+ manuscript submission), Bulk Orders, About, Contact, Support hub, FAQs, Shipping, Returns, Legal hub, Privacy, Terms, Cookies — all now served from the live API rather than mock data.

**Phase 2 (accounts, commerce, admin):**
- Registration/login/logout, forgot/reset password, short-lived JWT access tokens + rotating httpOnly refresh cookie backed by server-side sessions (logout, password change and deactivation revoke them), rate-limited auth endpoints, bcrypt password hashing.
- Customer dashboard: profile edit, change password, saved addresses (CRUD + default shipping), order history/detail with a status timeline, wishlist (add/remove/move to cart).
- Cart (client-side, persisted) → real checkout: server-calculated totals shown before paying, address selection, promotion codes, Razorpay order creation, payment verification (browser callback and webhook, whichever lands first), retry without double-reserving stock, automatic expiry of unpaid orders, automatic refund of payments that arrive after an order expired, order confirmation email (logged in dev).
- Order tracking: status timeline (Pending → Paid → Processing → Shipped → Delivered, or Cancelled/Refunded), staff-entered carrier/tracking number/link.
- Admin/Staff workspace (`/admin`): dashboard, books CRUD (+ categories/authors, drag-and-drop cover image upload), author-application review with internal notes, bulk-order request management, CMS (static pages + FAQs). **Admin-only**: users (role/active toggle), promotions, detailed sales reports — staff get a 403 from the API and never see these in the nav, since they expose PII, revenue, or privilege escalation. A logout button and a role-aware "Admin Workspace" / "Staff Workspace" label are always visible in the sidebar.
- Three switchable admin themes (Forest & Brass / Midnight Ink / Ivory & Burgundy), persisted per-browser via `localStorage`.
- Full audit trail (`AuditEvent`) for admin mutations, status changes, and payment events.

## Running it locally

**Backend** (needs Docker for Postgres, or point `DATABASE_URL` at your own instance):
```bash
cd server
cp .env.example .env      # already done once; edit if needed
docker compose up -d postgres
npm install
npm run prisma:deploy     # apply migrations (use prisma:migrate when authoring a new one)
npm run prisma:seed       # catalogue + demo accounts (demo accounts are skipped in production)
npm run dev                # http://localhost:4000
```

**Frontend:**
```bash
cd nightingale-press
npm install
npm run dev                # http://localhost:5173, reads VITE_API_URL from .env.development
```

If port 5432 is already taken on your machine, set `POSTGRES_PORT=5434` (any free port) in `server/.env` and use that port in `DATABASE_URL`.

**Full stack via Docker** (Postgres + one-off migration + API + static frontend behind Nginx):
```bash
cd server
docker compose up --build   # site on http://localhost:8080; nginx proxies /api to the API container
```

## Deploying to production

Step-by-step guide for a single Ubuntu server with free HTTPS via Tailscale Funnel: **[DEPLOY.md](DEPLOY.md)**.


- `NODE_ENV=production` makes the API refuse to start unless Razorpay keys, the webhook secret and SMTP are configured, the JWT secrets are 32+ characters and distinct, and `PUBLIC_WEB_URL` is https. There is no way to boot production into simulated payments or console email.
- Run migrations as a release step (`npm run prisma:deploy`, or the compose `migrate` service), not on container start.
- Create the first administrator without seeding demo accounts: `ADMIN_EMAIL=… ADMIN_NAME=… ADMIN_PASSWORD=… npm run create-admin`.
- Set `TRUST_PROXY` to the number of proxies in front of the API (1 behind the bundled nginx) so rate limiting sees real client IPs.
- Point Razorpay's webhook at `https://<your-domain>/api/payments/webhook` for `payment.captured` and `payment.failed`.
- Run **one** API instance until uploads move to object storage and rate limits to a shared store (see Known gaps).
- Logs are structured JSON on stdout (pino); each request has an `X-Request-Id`.

### Demo accounts (from `npm run prisma:seed`, development only)
| Role | Email | Password |
|---|---|---|
| Admin | `admin@nightingalepress.example` | `Admin123!` |
| Staff | `staff@nightingalepress.example` | `Staff123!` |
| Customer | `demo@nightingalepress.example` | `Demo1234!` |

### Payments without a Razorpay account
Leave `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` blank in `server/.env` (the default, development only). Checkout then runs in **dev-simulated mode**: the backend issues a fake Razorpay order and the frontend checkout page shows a "Dev payment simulator" panel to simulate success/failure, exercising the full order lifecycle (stock reservation → payment verification → confirmation email) without a real payment gateway. Add real test/live keys to switch to the actual Razorpay Checkout modal — no code changes needed.

## Testing

Tests run against a **separate, isolated database** — never against `server/.env`'s development database.

```bash
cd server
# One-time setup: create a second database in the same Postgres instance, then point
# .env.test at it. Skip the createdb step if nightingale_test already exists.
docker exec <your-postgres-container> createdb -U nightingale nightingale_test
cp .env.test.example .env.test   # adjust the port if your Postgres isn't on 5432

npm test        # runs `pretest` (migrate + seed the test DB) automatically, then vitest + supertest
```

`vitest.config.ts` loads `.env.test` before any test code and refuses to run unless `DATABASE_URL` names a `*_test` database, and the Prisma client always takes its URL from the validated config — so the suite cannot touch development data. Test files run one at a time because they share that database.

CI (`.github/workflows/ci.yml`) runs typecheck, the test suite against a Postgres service, and builds both apps on every push and pull request.

## Documentation

- `server/API.md` — full endpoint reference, request/response shapes, auth requirements, and known gaps.
- `Phase_2_Development_Plan_Publisher_Website.md` — the plan this build implements.

## Known gaps (see `server/API.md` §"Known gaps" and the Phase 2 doc §8 for the business decisions behind them)

- Shipping is a flat-rate placeholder; tax is 0. Printed books are GST-exempt, but **e-books are taxed at 18%** — this must be fixed before selling EBOOK titles. Both need publisher/finance sign-off before launch.
- The Privacy and Terms pages contain placeholder copy and say so on the page; they need legal review before launch.
- There is no newsletter: the old footer sign-up showed "You're subscribed" without storing anything and has been replaced by a contact link.
- No live carrier tracking API — tracking is staff-entered.
- No cloud deployment (AWS) has been provisioned — Docker images and `docker-compose.yml` are ready for that step.
- Book cover images are stored on local disk and rate-limit counters in process memory; both are fine for a single API instance but need object storage / a shared store (e.g. Redis) before running multiple replicas.
- The admin CMS page editor (static pages) is now wired to all six public pages (About, Shipping, Returns, Privacy, Terms, Cookies): each page loads its `ContentPage` row at render time and shows it only when published, falling back silently to its own built-in default copy if there's no published row (see `server/API.md` §"Static page publishing"). FAQs remain fully wired as before.
- There's no admin UI for the `AuditEvent` log yet (query it directly via `npx prisma studio`).
