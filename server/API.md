# Nightingale Press API — Reference

Base URL (dev): `http://localhost:4000/api`

All request/response bodies are JSON. Authenticated requests send `Authorization: Bearer <accessToken>`. The refresh token lives in an `httpOnly` cookie (`refresh_token`, scoped to `/api/auth`) set by `/auth/login`, `/auth/register` and `/auth/refresh`.

Errors always have the shape:
```json
{ "error": { "code": "BAD_REQUEST", "message": "...", "details": {} } }
```

## Health & readiness (public)

| Method | Path | Notes |
|---|---|---|
| GET | `/` | API identification document (this is a JSON API, no server-rendered UI). |
| GET | `/health` and `/api/health` | Liveness — process is up. Always `{ "status": "ok" }`. |
| GET | `/api/ready` | Readiness — liveness plus a real database round-trip. `503` if the database is unreachable. |

## Auth — `/api/auth`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/register` | — | `{ name, email, password }` | Password must be 8+ chars with upper/lower/number. Rate-limited. |
| POST | `/login` | — | `{ email, password }` | Rate-limited. |
| POST | `/refresh` | refresh cookie | — | Issues a new access token. |
| POST | `/logout` | — | — | Clears the refresh cookie. |
| GET | `/me` | Bearer | — | Current user. |
| POST | `/forgot-password` | — | `{ email }` | Always 202; never reveals whether the email exists. Dev mode logs the reset link to the console instead of sending email. |
| POST | `/reset-password` | — | `{ token, password }` | Token expires in 1 hour; also revokes existing sessions. |

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
| POST | `/change-password` | `{ currentPassword, newPassword }` |
| GET / POST | `/addresses` | |
| PATCH / DELETE | `/addresses/:id` | Ownership enforced |
| GET / POST | `/wishlist` | POST body `{ bookId }` |
| DELETE | `/wishlist/:bookId` | |
| GET | `/orders` | Own orders only |
| GET | `/orders/:id` | 404 if not the owner |

## Checkout — `/api/checkout` (Bearer required)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/quote` | `{ items: [{bookId, quantity}], promotionCode? }` | Server-authoritative pricing preview |
| POST | `/orders` | `{ items, promotionCode?, shippingAddressId \| shippingAddress }` | Re-validates price/stock, reserves stock, creates a Razorpay order |
| POST | `/verify` | `{ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }` | Verifies signature; marks order PAID; sends confirmation email |
| POST | `/orders/:id/cancel` | — | Only while `PENDING_PAYMENT`; restores reserved stock |

**Dev-simulated payments:** when `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are unset, `POST /orders` returns a simulated Razorpay order (`order_dev_...`, `simulated: true`). The matching "signature" for `/verify` in that mode is `simulated.<razorpayOrderId>.<razorpayPaymentId>` — this format is never accepted once real keys are configured, so it cannot leak into production.

## Payments — `/api/payments`

| Method | Path | Notes |
|---|---|---|
| POST | `/webhook` | Razorpay webhook receiver. Requires `RAZORPAY_WEBHOOK_SECRET`; verifies `x-razorpay-signature` against the raw body and is idempotent per event. Always configure this for any real deployment — `/checkout/verify` alone is a browser-redirect signal, not authoritative. |

## Bulk orders — `/api/bulk-orders`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | — | Public institutional inquiry form |
| GET | `/admin` | Staff/Admin | List all |
| PATCH | `/admin/:id` | Staff/Admin | `{ status?, assignedToUserId? }` |

## Author applications — `/api/author-applications`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | — | Public manuscript-proposal form |
| GET | `/admin` | Staff/Admin | List all, with notes |
| PATCH | `/admin/:id/status` | Staff/Admin | |
| POST | `/admin/:id/notes` | Staff/Admin | Internal review note |

## Contact — `/api/contact`

| Method | Path | Auth |
|---|---|---|
| POST | `/` | — |
| GET | `/admin` | Staff/Admin |

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
- `POST /admin/books/:id/cover` — multipart upload, field name `cover`; JPEG/PNG/WebP only, 5MB max; replaces and deletes any previous file. `DELETE /admin/books/:id/cover` removes it (falls back to `coverPalette`).
- `GET/POST /admin/books/meta/categories`, `GET/POST/PATCH /admin/books/meta/authors`
- `GET /admin/users?q=&role=&page=`, `PATCH /admin/users/:id` (`{ role?, isActive? }`) — Admin-only
- `GET /admin/orders?status=&q=&page=`, `GET /admin/orders/:id`
- `PATCH /admin/orders/:id/status` — enforces the explicit transition map (`PENDING_PAYMENT → PAID/CANCELLED`, `PAID → PROCESSING/CANCELLED/REFUNDED`, `PROCESSING → SHIPPED/CANCELLED/REFUNDED`, `SHIPPED → DELIVERED/REFUNDED`, `DELIVERED → REFUNDED`); restores stock on cancel/refund past `PENDING_PAYMENT`
- `PATCH /admin/orders/:id/tracking` — `{ trackingCarrier, trackingNumber, trackingUrl? }`
- `GET/POST/PATCH/DELETE /admin/promotions(/:id)` (delete = deactivate) — Admin-only
- `GET /admin/reports/dashboard` — recent orders, pending author applications/bulk orders for both roles; `newUsersCount`/`totalRevenue` are `null` for Staff, numbers for Admin
- `GET /admin/reports/sales?from=&to=` — order counts/gross sales/discounts by status, plus top sellers by units — Admin-only

### Book cover images

Uploaded covers are served statically from `GET /uploads/covers/<file>` (public, no auth — same as any other storefront image). Storage is local disk under `server/uploads/` today, behind a single-file adapter (`src/lib/storage.ts`) so swapping in S3/GCS later only touches that one module, not the route handlers. In Docker, `uploads/` is a named volume (`uploads_data`) so files survive container recreation.

## Auditing

Every admin mutation (status changes, role changes, content edits, refunds, catalogue edits) writes an `AuditEvent` row (`actorUserId`, `action`, `entityType`, `entityId`, `metadata`, `createdAt`). There is no read endpoint yet — query the table directly via Prisma Studio (`npx prisma studio`) until an admin audit-log view is prioritized.

## Known gaps / deferred (see `Phase_2_Development_Plan_Publisher_Website.md` §8)

- Shipping is a flat-rate placeholder (free ≥ ₹1,000, else ₹60) pending real carrier/rate decisions.
- Tax is set to 0 (books are commonly nil-rated); revisit if the catalogue expands beyond books.
- No carrier tracking **API** integration — tracking fields are staff-entered text/URL.
- Webhook signature verification requires a real `RAZORPAY_WEBHOOK_SECRET`; there is intentionally no dev-simulated webhook path (only `/checkout/verify` is simulated), since the webhook is meant to be the production-grade authoritative path.
- Email sending falls back to console logging without SMTP credentials — fine for dev/demo, not for production.
- No automated sweep releases stock reserved by abandoned `PENDING_PAYMENT` orders — only an explicit cancel currently restores it.
- `@prisma/config` (a transitive dev-only dependency of the `prisma` CLI, not of the `@prisma/client` runtime that ships to production) has an unpatched high-severity advisory via `deepmerge-ts` as of Prisma 6.19. No non-breaking fix is available yet (`npm audit fix` confirms); tracked for the next Prisma major-version upgrade rather than applied blindly.
