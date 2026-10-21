# B.md — Nightingale Academic Press: Backend Repair, Database Setup, and End-to-End Verification

> **Purpose:** Give Claude Code a strict, repository-aware task plan to diagnose and repair the existing Nightingale Academic Press backend, establish a reliable database, connect the frontend to real API behavior, and test the full application without replacing working features or inventing data.
>
> **Runtime context:** TypeScript/Node.js Express API, started with `tsx watch src/index.ts`. Package: `nightingale-press-api@0.1.0`. The server has logged `Nightingale Press API listening on http://localhost:4000`.
>
> Browser request to `http://localhost:4000/` currently returns:
>
> ```json
> {"error":{"code":"NOT_FOUND","message":"No route for GET /"}}
> ```
>
> This does not by itself prove that the API is broken; it means `GET /` has no handler. Logs also show repeated `GET / 404`, `GET /favicon.ico 404`, and `POST /api/auth/refresh 401`. The frontend displays loading states or error panels for catalogue books, featured books, authors, and FAQs even though several API calls return `200`. Diagnose response bodies, schemas, database rows, frontend parsing, and request lifecycle before deciding on fixes.
>
> Observed successful requests include:
>
> - `GET /api/catalogue/books?sort=relevance&pageSize=48` → `200`
> - `GET /api/catalogue/books?format=PAPERBACK&sort=relevance&pageSize=48` → `200`
> - `GET /api/catalogue/books?format=HARDBOUND&sort=relevance&pageSize=48` → `200`
> - `GET /api/catalogue/books?format=EBOOK&sort=relevance&pageSize=48` → `200`
> - `GET /api/catalogue/books?format=EBOOK&sort=price-asc&pageSize=48` → `200`
> - `GET /api/catalogue/authors` → `200`
> - `GET /api/catalogue/categories` → `200`
> - `GET /api/auth/me` → `200`
> - `POST /api/auth/refresh` → `401`
>
> **Important:** A `200` status does not guarantee the UI can consume the body. Inspect JSON shape, `Content-Type`, actual data, and frontend parsing.

---

## 1. Rules of engagement

1. Audit before changing. Inspect package scripts, route registration, middleware, database config/schema/migrations, seed scripts, frontend API client, environment variables, and tests.
2. Preserve the existing stack and architecture where practical. Do not rewrite the app unnecessarily.
3. Use persistent database storage for real functionality. Do not replace the API with hard-coded arrays or mock responses.
4. Do not invent production facts. Books, authors, ISBNs, prices, publication claims, institutional figures, shipping promises, and policies must come from existing approved data. Fictional development seed records must be clearly identified as demo data.
5. Do not hide errors. Use appropriate status codes and safe structured responses; keep stack traces and secrets server-side.
6. Keep credentials in environment variables. Maintain `.env.example` with placeholders and verify `.env` is ignored by Git.
7. Never run destructive resets or drops against an unknown/existing database. Inspect the target and obtain explicit confirmation before a destructive operation.
8. Report only tests actually run. Include commands and results.
9. This file covers backend, database, API integration, and functional verification. A separate instruction file will handle visual redesign.
10. Work in small, reviewable changes and avoid unrelated refactors.

## 2. Phase A — Diagnose the repository and runtime

Inspect at minimum:

- `package.json` and lockfile
- `src/index.ts`
- route registration and route modules
- middleware: CORS, JSON parsing, cookies, authentication, validation, error handling, not-found handling
- database client/configuration, schema, migrations, and seed scripts
- frontend API base URL and environment variables
- frontend API client, catalogue hooks/services, auth refresh logic, and loading/error components
- existing tests, lint, typecheck, and build scripts

Establish and report:

- actual runtime/framework versions
- database engine, connection status, migration status, and whether records exist
- source of truth for API base URL
- whether frontend requests target the correct host, port, and path
- real routes and their response contracts
- why catalogue/authors/categories show errors or endless loading despite successful HTTP statuses
- whether refresh `401` is expected for anonymous visitors or indicates a broken token flow
- whether `/` and `/favicon.ico` are intended routes

Then continue into implementation; do not stop after diagnosis.

### Port 4000

The port was previously occupied by PID `30704`. Do not blindly kill processes. Check the process first:

```powershell
netstat -ano | findstr :4000
Get-Process -Id <PID>
```

If it is an old instance of this project and the developer intends to restart it, terminate that specific process. Otherwise reuse the running server or configure a different port. Read `PORT` from environment with a local default such as `4000`.

Handle `EADDRINUSE` with a clear startup message instead of an opaque unhandled error. Do not silently select another port unless the project explicitly supports that behavior.

## 3. Phase B — Database setup and integrity

### 3.1 Discover before selecting

Use the repository's current database and ORM/query layer if present. Do not introduce a second database or ORM without a compelling, documented reason.

Determine:

- database engine and supported version
- connection-string/environment variable name
- migration tool
- migration status
- connection-pool behavior and transaction support
- separation between development, test, and production configuration

If database configuration is missing or unusable, choose the smallest compatible solution and explain the decision. Update setup documentation and `.env.example`.

### 3.2 Required persistence areas

Map these requirements to the existing schema. Reuse existing models; do not duplicate them just to match this list.

- **Books/catalogue:** title, slug or stable ID, author relationship, description, ISBN where applicable, format, category/subject, price and currency where relevant, cover-image reference, publication status, stock/availability if supported, timestamps.
- **Authors:** name, biography, portrait reference if supported, publication status, timestamps.
- **Categories/subjects:** stable ID, display name, slug, optional description.
- **Accounts/authentication:** user ID, normalized unique email, password hash (never plaintext), role/status, timestamps, and refresh-token/session representation if the existing design uses one.
- **Cart/orders/payments:** repair or implement only if these features exist in the repository. Keep payment-provider boundaries, verify payment state server-side, validate webhook signatures, and never store raw card data.
- **Bulk-order inquiries:** organization/contact details, requested titles/quantities, notes, status, timestamps, if this form exists.
- **Manuscript submissions/contact/newsletter/FAQs/shipping and returns:** persist these if the current product requires dynamic administration. Do not create a CMS if the product intentionally uses static content; document the decision.
- **Audit/security data:** store only what the app needs and define retention appropriately.

### 3.3 Schema and migration standards

- Add or repair versioned migrations using the existing tool.
- Define foreign keys, uniqueness, indexes, nullability, and deletion behavior intentionally.
- Index common catalogue filters/sorts, relationships, email lookups, and order/status lookups where useful.
- Use transactions for multi-step writes.
- Validate and normalize input before persistence.
- Prevent duplicates where the business rules require uniqueness.
- Use decimal-safe handling for prices; do not use binary floating-point arithmetic for money.
- Use consistent timestamps and document timezone conventions.
- Do not store passwords in plaintext. If refresh tokens are persisted, follow the existing security design and use secure hashing/rotation where appropriate.
- Make migrations repeatable in a clean environment and safe for an existing database.
- Provide an idempotent development seed command if the catalogue is empty. Seed data must be clearly marked as fictional/demo data and must not duplicate on repeated runs.
- Keep test fixtures separate from development seed data.

### 3.4 Database verification

Run and record:

1. Database connection check.
2. Migration status.
3. Migrations against a clean test database.
4. Seed command against a clean development/test database.
5. Idempotency check by running the seed twice.
6. Referential-integrity checks.
7. Read/write/read-back tests for key entities.
8. Transaction/rollback test where supported.
9. Catalogue filter and sort query checks.
10. Confirmation that no production or unknown database was reset.

If required credentials or a database service are unavailable, report the exact missing prerequisite and run every safe check that can still be performed.

## 4. Phase C — API contracts and route correctness

Create or update a concise API contract from routes that actually exist. Do not invent endpoint names and then silently change the frontend to match them. Preserve established paths unless a verified mismatch requires a documented correction.

Inspect and test at least:

- `GET /api/catalogue/books`
- `GET /api/catalogue/authors`
- `GET /api/catalogue/categories`
- `GET /api/auth/me`
- `POST /api/auth/refresh`

Inventory other existing routes for book details, login/logout/registration, cart/checkout, orders/payment verification/webhooks, bulk orders, manuscript submissions, contact forms, FAQs, shipping/returns, newsletter, and health/readiness.

### Catalogue requirements

- Support documented query parameters. Based on observed requests, inspect `format`, `sort`, and `pageSize`. Preserve or add search, category, author, pagination, and availability filters only if intended by the product.
- Validate and bound `pageSize`.
- Validate enum values such as `PAPERBACK`, `HARDBOUND`, and `EBOOK` against the actual schema. Resolve frontend/backend casing mismatches in one documented place.
- Implement supported sorts such as `relevance` and `price-asc` consistently. Never interpolate raw user input into SQL/order-by clauses.
- Return stable, documented JSON shapes for success and errors.
- Return an empty list with valid pagination metadata when nothing matches, not a fake error.
- Ensure book fields match what the frontend actually reads, or add a typed adapter.
- Ensure author/category responses match expected shapes, including empty states.
- Never return `200` with a hidden internal error or unexpected response structure.

### Root and health routes

- Add `GET /health` or preserve the project's equivalent liveness endpoint.
- If useful, add a separate readiness endpoint that checks the database without exposing connection details.
- Decide whether `GET /` should return a small API identification document or deliberately return `404`. The current `NOT_FOUND` response alone is not a reason to build a frontend at the API root.
- A missing favicon is usually harmless for an API. Do not add arbitrary assets just to eliminate the log line.

### Error handling

Use the established API convention if one exists. Otherwise use a consistent structure such as:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields",
    "details": []
  }
}
```

Ensure:

- unknown routes → 404
- malformed JSON → 400
- validation errors → consistent 400 or 422
- unauthenticated → 401
- authenticated but unauthorized → 403
- conflicts/duplicates → 409 where appropriate
- unexpected errors → safe 500
- async errors reach centralized error middleware
- logs include method, path, status, and duration but exclude passwords, tokens, payment secrets, and sensitive form content

## 5. Phase D — Authentication and refresh-token repair

The log shows `POST /api/auth/refresh` returning `401`. Determine expected behavior before changing it.

Test:

- anonymous `GET /api/auth/me`
- login with valid credentials, if implemented
- login with invalid credentials
- refresh with no token
- refresh with invalid/expired token
- refresh with a valid token
- logout/revocation, if implemented
- protected endpoints without credentials
- role/permission enforcement, if roles exist

Requirements:

- An anonymous session must not cause an endless refresh loop.
- The frontend must distinguish “not signed in” from a service failure.
- If refresh is only valid when a refresh cookie/token exists, do not call it unnecessarily for every anonymous visitor.
- For cookie auth, verify `HttpOnly`, `Secure` in HTTPS deployments, `SameSite`, cookie path/domain, CORS origin, and frontend credentials settings.
- Do not weaken token validation just to remove `401`.
- Do not move tokens into unsafe persistent browser storage if the design is cookie-based.
- Keep refresh rotation/revocation coherent and tested.
- Use the existing secure password hash implementation, such as Argon2id or bcrypt; never store plaintext passwords.
- Apply appropriate rate limits to login and refresh.
- Do not add a hard-coded default admin password. If admin bootstrap is needed, use a documented secure one-time process.

## 6. Phase E — Diagnose frontend/API integration

The provided screenshots show the site shell rendering, but sections such as “Browse by Subject,” “Featured,” catalogue search, and authors display error panels or indefinite loading. Since some requests return `200`, inspect both the server and the client.

For each affected view:

1. Inspect the browser Network response body, not only its status.
2. Compare actual JSON shape with TypeScript interfaces and runtime parsing.
3. Check whether the UI expects `data`, `items`, `results`, or another wrapper.
4. Check whether a valid empty array is incorrectly treated as an error.
5. Check for errors thrown after fetch during JSON parsing or field mapping.
6. Check `Content-Type`.
7. Verify the frontend API base URL and consistency of relative/absolute URLs.
8. Inspect CORS/credentials only if browser evidence points there.
9. Look for endless refetches, unhandled cancellation, and loading states that are never reset.
10. Check render-time exceptions, undefined field access, and React key warnings.
11. Ensure `Try again` performs a real request retry.
12. Verify filters build correct query parameters and reset pagination when appropriate.

Use one typed shared API client or preserve the existing shared client. Avoid duplicated fetch code with inconsistent assumptions.

Each data-driven view must handle:

- initial loading
- success with data
- success with no data
- request/parse error with a meaningful retry action

Never leave a spinner running indefinitely or show an error for a valid empty response.

## 7. Phase F — Security and reliability

Inspect and repair relevant items:

- CORS: allow known frontend origins; do not combine wildcard origins with credentialed cookies.
- Validate query, path, JSON, and multipart input.
- Protect admin and write endpoints with authentication/authorization.
- Use secure password hashing and generic auth failure messages.
- Rate-limit login, refresh, newsletter, contact, manuscript, and other abuse-prone public endpoints as appropriate.
- Limit request sizes and validate uploads if uploads exist.
- Use parameterized queries/ORM-safe operations.
- Avoid unsafe rendering of user-submitted HTML.
- Add CSRF protections where relevant to cookie-based auth.
- Use security headers and production-safe errors.
- Keep secrets out of source, logs, fixtures, and committed env files.
- For payments, validate amounts server-side, verify callbacks/webhooks, ensure idempotency, and never store raw card data.
- For email, configure through environment variables and never report delivery success if the provider failed.
- Close HTTP/database resources on graceful shutdown.
- Fail startup clearly when required configuration is missing.
- Review package audit results and distinguish production vulnerabilities from development-only findings; avoid blind dependency upgrades.

Maintain `.env.example` with placeholder values only. Never print real secret values in the report.

## 8. Phase G — Automated testing

Use the existing test framework if practical. If none exists, introduce the smallest compatible setup and document it. Tests must use an isolated test configuration/database and must not mutate developer or production data.

### Required categories

**Unit tests**
- query validation and enum parsing
- sorting/pagination
- input validation
- service/business logic
- error mapping

**Integration tests**
- database repository reads/writes
- catalogue response shape
- filters and sorting
- authors/categories endpoints
- unknown route and malformed request handling
- auth/me and refresh behavior
- protected routes
- form persistence where implemented
- payment webhook verification/idempotency if present

**Frontend/API contract tests**
- successful JSON parsing
- empty results
- malformed response shape
- network failure
- anonymous 401 without infinite refresh loops
- retry behavior
- loading state termination

**Smoke tests**
- server starts
- health endpoint works
- readiness endpoint works if configured
- catalogue endpoints return expected schemas
- frontend can consume the API

### Suggested PowerShell smoke checks

Adjust only after confirming actual routes:

```powershell
Invoke-RestMethod http://localhost:4000/health
Invoke-RestMethod "http://localhost:4000/api/catalogue/books?sort=relevance&pageSize=48"
Invoke-RestMethod http://localhost:4000/api/catalogue/authors
Invoke-RestMethod http://localhost:4000/api/catalogue/categories
```

If `/health` does not exist, implement it or use the documented equivalent. Do not treat a browser visit to `/` as the only server test.

Check actual responses for the observed filters:

```powershell
Invoke-RestMethod "http://localhost:4000/api/catalogue/books?format=PAPERBACK&sort=relevance&pageSize=48"
Invoke-RestMethod "http://localhost:4000/api/catalogue/books?format=HARDBOUND&sort=relevance&pageSize=48"
Invoke-RestMethod "http://localhost:4000/api/catalogue/books?format=EBOOK&sort=price-asc&pageSize=48"
```

Add negative tests for invalid formats, invalid sorts, and unreasonable page sizes based on the documented validation contract.

### Quality gates

Run the equivalents actually available in `package.json`:

- typecheck
- lint
- unit tests
- integration tests
- production build
- migration verification
- API smoke tests

Do not assume script names. If a check fails, fix and rerun it when in scope. If blocked by missing services, dependencies, or credentials, report the exact blocker.

## 9. Phase H — Data quality and UI-facing content

- Confirm catalogue counts and featured/subject sections come from actual persisted records.
- Ensure categories have stable IDs and meaningful display labels.
- Align book-format values across database, API, and frontend.
- Ensure author relationships resolve correctly.
- Provide intentional cover fallbacks instead of broken image icons.
- Make valid zero-results responses render as empty states.
- If the database is empty, seed a small set of clearly labelled fictional development records instead of hard-coding fake results into application code.
- Remove unsupported hard-coded metrics such as “120+ titles,” “85+ partner institutions,” and “40+ authors” unless verified and approved. These numbers appear in the screenshots but are not verified facts.
- Do not fabricate author biographies, ISBNs, publication claims, testimonials, company history, or policy commitments.
- Do not use emojis to compensate for missing data or missing icons.

## 10. Required deliverables

1. Root-cause report: symptom, proven cause, changed files, and fix.
2. Database setup guide: engine/version, environment variable names, migrations, seed, test DB setup, reset warnings.
3. `.env.example` with placeholders only.
4. Versioned schema/migrations, non-destructive by default.
5. Idempotent development seed script.
6. API contract listing real routes, methods, parameters, auth, response shape, and errors.
7. Unit/integration/contract/smoke tests appropriate to the repository.
8. Test report with actual commands, results, and blocked checks.
9. Exact local run instructions for dependencies, database, migrations, seeding, backend, frontend, and tests.
10. Remaining issues and risks.

Do not merely write a plan. Implement and verify the repairs.

## 11. Definition of done

- [ ] Backend starts without an unhandled error.
- [ ] Port conflicts are explained clearly and do not cause a crash loop.
- [ ] Database connection and migrations work in documented local setup.
- [ ] Seed data is repeatable without duplicate rows.
- [ ] Catalogue, authors, and categories return valid documented JSON.
- [ ] Format filters and sort options work against persisted data.
- [ ] Empty catalogue data is handled intentionally.
- [ ] Auth refresh is correct for anonymous, invalid, and valid sessions.
- [ ] Anonymous visitors do not cause endless refresh requests.
- [ ] Valid successful API responses no longer produce frontend errors.
- [ ] Loading states terminate on success and failure.
- [ ] Retry controls genuinely retry requests.
- [ ] Unknown routes and malformed inputs return safe, consistent errors.
- [ ] Sensitive endpoints are validated and protected.
- [ ] Tests, typecheck/lint where available, and production build have been run.
- [ ] No secrets or real credentials appear in source or report.
- [ ] Documentation describes the actual implementation.

## 12. Required final response from Claude Code

Summarize in this order:

1. Root causes found
2. Changes made, file by file
3. Database engine/schema/migrations/seed process (no credentials)
4. API verification: endpoint, status, and response validation
5. Test results: actual commands and outcomes
6. Exact local run commands
7. Remaining blockers and risks

Be direct and evidence-based. Never claim a test passed if it was not executed.
