# Nightingale Academic Press — Publisher Platform

A nursing/medical-education publisher website built against `Publisher_Product_Requirements_Document_PRD.docx`, `Publisher_System_Architecture_Document.docx`, and `Phase_2_Development_Plan_Publisher_Website.md`.

- **`nightingale-press/`** — React + Vite + TypeScript frontend (public site, customer account, checkout, admin panel).
- **`server/`** — Node.js + Express + TypeScript API, PostgreSQL via Prisma, Razorpay integration.

## What's implemented

**Phase 1 (public/catalogue):** Home, Books (search/filter/sort), Book detail, Authors (+ manuscript submission), Bulk Orders, About, Contact, Support hub, FAQs, Shipping, Returns, Legal hub, Privacy, Terms, Cookies — all now served from the live API rather than mock data.

**Phase 2 (accounts, commerce, admin):**
- Registration/login/logout, forgot/reset password, JWT access tokens + httpOnly refresh cookie, rate-limited auth endpoints, bcrypt password hashing.
- Customer dashboard: profile edit, change password, saved addresses (CRUD + default shipping), order history/detail with a status timeline, wishlist (add/remove/move to cart).
- Cart (client-side, persisted) → real checkout: server-recalculated pricing, address selection, promotion codes, Razorpay order creation, payment verification, order confirmation email (console-logged in dev).
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
npm run prisma:migrate    # first time only — also available: prisma:deploy
npm run prisma:seed
npm run dev                # http://localhost:4000
```

**Frontend:**
```bash
cd nightingale-press
npm install
npm run dev                # http://localhost:5173, reads VITE_API_URL from .env.development
```

**Full stack via Docker** (Postgres + API + static frontend behind Nginx):
```bash
cd server
docker compose up --build   # web on :8080, api on :4000, postgres on :5432
```

### Demo accounts (from `npm run prisma:seed`)
| Role | Email | Password |
|---|---|---|
| Admin | `admin@nightingalepress.example` | `Admin123!` |
| Staff | `staff@nightingalepress.example` | `Staff123!` |
| Customer | `demo@nightingalepress.example` | `Demo1234!` |

### Payments without a Razorpay account
Leave `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` blank in `server/.env` (the default). Checkout then runs in **dev-simulated mode**: the backend issues a fake Razorpay order and the frontend checkout page shows a "Dev payment simulator" panel to simulate success/failure, exercising the full order lifecycle (stock reservation → payment verification → confirmation email) without a real payment gateway. Add real test/live keys to switch to the actual Razorpay Checkout modal — no code changes needed.

## Testing

Tests run against a **separate, isolated database** — never against `server/.env`'s development database.

```bash
cd server
# One-time setup: create a second database in the same Postgres instance, then point
# .env.test at it. Skip the createdb step if nightingale_test already exists.
docker exec <your-postgres-container> createdb -U nightingale nightingale_test
cp .env.test.example .env.test

npm test        # runs `pretest` (migrate + seed the test DB) automatically, then vitest + supertest
```

`npm test`'s `pretest` script refuses to run if `DATABASE_URL` in `.env.test` doesn't look like a test database, so it can't accidentally wipe/seed-over development data.

## Documentation

- `server/API.md` — full endpoint reference, request/response shapes, auth requirements, and known gaps.
- `Phase_2_Development_Plan_Publisher_Website.md` — the plan this build implements.

## Known gaps (see `server/API.md` §"Known gaps" and the Phase 2 doc §8 for the business decisions behind them)

- Shipping is a flat-rate placeholder; tax is 0 (books are commonly nil-rated). Both need publisher/finance sign-off before launch.
- No live carrier tracking API — tracking is staff-entered.
- Email delivery logs to the console without SMTP credentials configured.
- No cloud deployment (AWS) has been provisioned — Docker images and `docker-compose.yml` are ready for that step.
- No automated stock-release sweep for abandoned `PENDING_PAYMENT` orders (manual/staff cancel restores stock).
- Book cover images are stored on local disk (see `server/API.md` §"Book cover images"); fine for a single instance or Docker volume, but needs an S3/GCS adapter before running multiple API replicas.
- The admin CMS page editor (static pages) is now wired to all six public pages (About, Shipping, Returns, Privacy, Terms, Cookies): each page loads its `ContentPage` row at render time and shows it only when published, falling back silently to its own built-in default copy if there's no published row (see `server/API.md` §"Static page publishing"). FAQs remain fully wired as before.
- There's no admin UI for the `AuditEvent` log yet (query it directly via `npx prisma studio`).
