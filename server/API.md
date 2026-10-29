# Nightingale Press API — Reference

Base URL: `/api` on the site's own origin in production (nginx proxies it); `http://localhost:4000/api` in local development.

Every response carries an `X-Request-Id` header (an incoming `X-Request-Id` is honoured). Quote it when reporting a problem — it ties the request to its server log lines.

All request/response bodies are JSON. Authenticated requests send `Authorization: Bearer <accessToken>`. The refresh token lives in an `httpOnly` cookie (`refresh_token`, scoped to `/api/auth`) set by `/auth/login`, `/auth/register` and `/auth/refresh`.

Errors always have the shape:
```json
{ "error": { "code": "BAD_REQUEST", "message": "...", "details": {} } }
```

## Health & readiness (public)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Liveness — process is up. Always `{ "status": "ok" }`. |
| GET | `/api/ready` | Readiness — liveness plus a real database round-trip. `503` if the database is unreachable. |

## Auth — `/api/auth`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/register` | — | `{ name, email, password }` | Password 8–72 chars with upper/lower/number. Emails are case-insensitive (stored lower-cased). Rate-limited. |
| POST | `/login` | — | `{ email, password }` | Rate-limited. |
| POST | `/refresh` | refresh cookie | — | Issues a new access token **and rotates the refresh cookie**. Replaying an already-rotated token more than 30 s later revokes the whole session family (treated as theft). |
| POST | `/logout` | refresh cookie | — | Revokes the session server-side and clears the cookie. |
| GET | `/me` | Bearer | — | Current user. |
| POST | `/forgot-password` | — | `{ email }` | Always 202; never reveals whether the email exists. Dev mode logs the reset link to the console instead of sending email. |
| POST | `/reset-password` | — | `{ token, password }` | Token expires in 1 hour and works once; only its SHA-256 is stored. Revokes all existing sessions. |

Access tokens carry only the user id. Role and active status are read from the database on every request, so deactivating or demoting a user takes effect immediately.

## Catalogue — `/api/catalogue` (public)

| Method | Path | Notes |
|---|---|---|
| GET | `/books?q=&category=&format=&sort=&page=&pageSize=` | `sort`: relevance / price-asc / price-desc / title-asc |
| GET | `/books/:slug` | Returns `{ book, related }` |
| GET | `/categories` | |
| GET | `/authors` | |
| GET | `/authors/:slug` | |

## Account — `/api/me` (Bearer required)

| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/profile` | |
| POST | `/change-password` | `{ currentPassword, newPassword }` — signs out every session, including the current one |
| GET / POST | `/addresses` | |
| PATCH / DELETE | `/addresses/:id` | Ownership enforced |
| GET / POST | `/wishlist` | POST body `{ bookId }` |
| DELETE | `/wishlist/:bookId` | |
| GET | `/orders?page=&pageSize=` | Own orders only, paginated (default 50) |
| GET | `/orders/:id` | 404 if not the owner |

## Checkout — `/api/checkout` (Bearer required)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/quote` | `{ items: [{bookId, quantity}], promotionCode? }` | Server-authoritative pricing preview |
| POST | `/orders` | `{ items, promotionCode?, shippingAddressId \| shippingAddress }` | Re-prices, then in one transaction reserves stock, claims the promotion use and records the order + payment |
| POST | `/verify` | `{ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }` | Verifies the signature and marks the order PAID (idempotent). `409 ORDER_EXPIRED` if the order was cancelled/expired before payment landed — the payment is refunded automatically |
| POST | `/orders/:id/cancel` | — | Only while `PENDING_PAYMENT`; releases reserved stock and the promotion use |

Unpaid orders are cancelled automatically after `PENDING_ORDER_TTL_MINUTES` (default 30), releasing their stock. The sweep runs every minute in each API process and is safe to run on several at once.

**Dev-simulated payments:** when `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are unset **and `NODE_ENV` is not `production`**, `POST /orders` returns a simulated Razorpay order (`order_dev_...`, `simulated: true`) and `/verify` accepts the signature `simulated.<razorpayOrderId>.<razorpayPaymentId>`. Production refuses to start without Razorpay keys, so this path cannot exist there.

## Payments — `/api/payments`

| Method | Path | Notes |
|---|---|---|
| POST | `/webhook` | Razorpay webhook receiver (`payment.captured`, `payment.failed`). Verifies `x-razorpay-signature` against the raw body, checks the captured amount against the order, and is idempotent per `x-razorpay-event-id`. An event is only recorded once its effects have been applied, so a failure returns 500 and Razorpay's retry succeeds later. Required in production. |

## Bulk orders — `/api/bulk-orders`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | — | Public institutional inquiry form |
| GET | `/admin?page=&pageSize=` | Staff/Admin | Paginated (default 50) |
| PATCH | `/admin/:id` | Staff/Admin | `{ status?, assignedToUserId? }` — assignee must be active staff |

## Author applications — `/api/author-applications`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | — | Public manuscript-proposal form |
| GET | `/admin?page=&pageSize=` | Staff/Admin | Paginated (default 50), with notes |
| PATCH | `/admin/:id/status` | Staff/Admin | |
| POST | `/admin/:id/notes` | Staff/Admin | Internal review note |

## Contact — `/api/contact`

| Method | Path | Auth |
|---|---|---|
| POST | `/` | — |
| GET | `/admin?page=&pageSize=` | Staff/Admin (paginated, default 50) |

## Content (CMS) — `/api/content` (public reads) & `/api/admin/content` (Staff/Admin writes)

| Method | Path | Notes |
|---|---|---|
| GET | `/content/pages/:slug` | Public, published only — `404` for an unpublished or nonexistent slug (indistinguishable, so drafts can't be probed for) |
| GET | `/content/faqs` | Public, published only |
| GET | `/admin/content/pages` | All pages, published or not |
| PUT | `/admin/content/pages/:slug` | Upsert `{ title, intro?, sections: [{heading, body}], isPublished? }` (`isPublished` defaults to `true`) |
| GET/POST/PATCH/DELETE | `/admin/content/faqs(/:id)` | |

### Static page publishing

The six public static pages (About, Shipping, Returns, Privacy, Terms, Cookies) are React components with their
own reviewed default copy built in. Each one calls `GET /content/pages/:slug` on mount and, if a **published**
`ContentPage` row exists for that slug, renders the CMS copy instead; otherwise (no row, unpublished, or the
request fails) it silently keeps its default copy — there is no error state shown to visitors for this, since
falling back to the shipped copy *is* the safe behavior. Saving a page as a draft (`isPublished: false`) in
`/admin/content` lets staff edit copy without it going live; publishing is the same `PUT` with the checkbox
checked. Admin edits take effect on next page load/refresh — there is no caching layer in front of `/content/pages/:slug`.

## Admin — books, users, orders, promotions, reports

All under `/api/admin/*`, authenticated. Permission boundary between the two staff-capable roles:

| Area | Staff | Admin |
|---|---|---|
| Books, authors, categories (CRUD + cover images) | ✅ | ✅ |
| Orders (status, tracking), bulk orders, author applications | ✅ | ✅ |
| Content (static pages, FAQs) | ✅ | ✅ |
| Dashboard overview (`/admin/reports/dashboard`) | ✅ (revenue/new-user figures hidden) | ✅ (full) |
| Users (`/admin/users`) | ❌ 403 | ✅ |
| Promotions (`/admin/promotions`) | ❌ 403 | ✅ |
| Detailed sales report (`/admin/reports/sales`) | ❌ 403 | ✅ |
| Changing a user's role | ❌ 403 | ✅ |

- `GET/POST /admin/books`, `PATCH/DELETE /admin/books/:id` (delete = archive, never hard-deleted — order history references stay valid)
- Book `isbn` must be a valid 10- or 13-digit ISBN; it is stored without hyphens or spaces. Slugs are lower-case letters, numbers and hyphens.
- `POST /admin/books/:id/cover` — multipart upload, field name `cover`; JPEG/PNG/WebP only (detected from the file's bytes, not its claimed type), 5MB max; replaces and deletes any previous file. `DELETE /admin/books/:id/cover` removes it (falls back to `coverPalette`).
- `GET/POST /admin/books/meta/categories`, `GET/POST/PATCH /admin/books/meta/authors`
- `GET /admin/users?q=&role=&page=`, `PATCH /admin/users/:id` (`{ role?, isActive? }`) — Admin-only
- `GET /admin/orders?status=&q=&page=`, `GET /admin/orders/:id`
- `PATCH /admin/orders/:id/status` — `{ status, reason? }`. Allowed: `PENDING_PAYMENT → CANCELLED`, `PAID → PROCESSING/CANCELLED`, `PROCESSING → SHIPPED/CANCELLED`, `SHIPPED → DELIVERED/REFUNDED`, `DELIVERED → REFUNDED`. Staff can never mark an order paid — only the gateway can. Cancelling a paid order or refunding one **issues a Razorpay refund first** and only then changes the status. Cancelling restocks; refunding after shipment does not (restock when the return arrives). `409` if the order changed concurrently.
- `PATCH /admin/orders/:id/tracking` — `{ trackingCarrier, trackingNumber, trackingUrl? }`
- `GET/POST/PATCH/DELETE /admin/promotions(/:id)` (delete = deactivate) — Admin-only. Money is in rupees: `discountValue` is whole percent (1–100) for `PERCENT` and rupees for `FLAT`; `minSpend` is rupees. `maxRedemptions` is enforced atomically, and a use is returned when its order is cancelled.
- `GET /admin/reports/dashboard` — recent orders, pending author applications/bulk orders for both roles; `newUsersCount`/`totalRevenue` are `null` for Staff, numbers for Admin
- `GET /admin/reports/sales?from=&to=` — order counts/gross sales/discounts by status, plus top sellers by units — Admin-only

### Book cover images

Uploaded covers are served statically from `GET /uploads/covers/<file>` (public, no auth — same as any other storefront image). Storage is local disk (`UPLOADS_DIR`, default `uploads/`) behind a single-file adapter (`src/lib/storage.ts`). This ties uploads to one host: run one API instance, or implement an object-storage adapter there before scaling out. In Docker, `uploads/` is a named volume (`uploads_data`) so files survive container recreation.

## Auditing

Every admin mutation (status changes, role changes, content edits, refunds, catalogue edits) writes an `AuditEvent` row (`actorUserId`, `action`, `entityType`, `entityId`, `metadata`, `createdAt`). There is no read endpoint yet — query the table directly via Prisma Studio (`npx prisma studio`) until an admin audit-log view is prioritized.

## Known gaps / deferred (see `Phase_2_Development_Plan_Publisher_Website.md` §8)

- Shipping is a flat-rate placeholder (free ≥ ₹1,000, else ₹60) pending real carrier/rate decisions.
- Tax is set to 0 (books are commonly nil-rated); revisit if the catalogue expands beyond books.
- No carrier tracking **API** integration — tracking fields are staff-entered text/URL.
- Tax: printed books are GST-exempt, but **e-books carry 18% GST**. Checkout charges 0 for every format — resolve before selling `EBOOK` titles.
- Rate-limit counters live in process memory (per instance). Add a shared store (e.g. Redis) before running more than one API instance.
- Refunds are full-amount only; partial refunds and return/restock workflows are manual.
- `@prisma/config` (a transitive dev-only dependency of the `prisma` CLI, not of the `@prisma/client` runtime that ships to production) has an unpatched high-severity advisory via `deepmerge-ts` as of Prisma 6.19. No non-breaking fix is available yet (`npm audit fix` confirms); tracked for the next Prisma major-version upgrade rather than applied blindly.
