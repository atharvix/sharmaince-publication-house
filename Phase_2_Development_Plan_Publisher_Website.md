# Phase 2 Development Plan: Publisher Website

**Version:** 1.0 — Draft for stakeholder review  
**Date:** 20 October 2026  
**Product:** Publisher Website — Phase 2  
**Purpose:** Define the scope, technical approach, components, deliverables, acceptance criteria, and next steps for Phase 2.

---

## 1. Introduction & Goal

This document outlines the development plan for Phase 2 of the Publisher Website project. The primary goal is to implement core interactive user functionalities and administrative capabilities, enabling secure user engagement, a complete e-commerce checkout flow, and comprehensive content and order management for the publisher.

### 1.1 Phase 1 context

The existing Phase 1 frontend is a React + TypeScript + Vite public-facing website for Nightingale Academic Press. The provided implementation summary describes 16 pages, a catalogue and book-detail experience, author and bulk-order forms, support and policy pages, and a frontend-only cart persisted in `localStorage`.

The cart currently presents **“Checkout — Coming Soon”**. The summary explicitly states that no backend/API, database, real authentication, or payment processing is implemented. Phase 2 therefore connects these existing interfaces to real backend services rather than treating the current mock data as production data.

### 1.2 Outcomes

- Secure registration, login, password recovery, and session handling.
- A personalized user dashboard for profile, addresses, orders, and wishlist.
- A complete server-validated checkout using Razorpay.
- Order status and order-detail visibility for customers.
- An administrative interface for books, authors, users, orders, pages, promotions, and basic reporting.
- Updated database, documented APIs, deployment configuration, tests, and internal test reports.

---

## 2. Scope of Phase 2

Phase 2 will focus on building the essential components that transform the public-facing website into a fully functional e-commerce and content management platform.

| Workstream | Included scope | Primary outcome |
|---|---|---|
| Authentication | Register, login, password reset, secure sessions/tokens, password hashing, brute-force protection, and HTTPS | Users can securely access their accounts |
| User dashboard | Profile, password change, order history/details, wishlist, and saved shipping/billing addresses | Customers can manage their account and activity |
| Checkout | Cart review, quantity updates, address selection/entry, applicable shipping method, Razorpay payment, error states, and confirmation email | Customers can place and pay for orders |
| Order tracking | Order status, details, and payment status; carrier tracking links/API integration if feasible | Customers can follow their purchase |
| Admin panel | Dashboard overview; book, author, user, order, and content management; promotions; basic sales analytics | Staff can operate the website without direct database edits |
| Platform foundation | PostgreSQL schema changes, API documentation, deployment scripts/configuration, testing, and bug fixing | A maintainable and deployable Phase 2 release |

### 2.1 Scope boundaries and dependencies

- Phase 2 extends the existing Phase 1 public website and must preserve its current navigation and responsive visual design.
- The current cart is frontend-only. Cart and checkout data must be validated and persisted server-side for real purchases.
- Carrier API integration and shipping-label generation are conditional on feasibility and provider access.
- Email verification is optional in the supplied scope but recommended; it should be confirmed during detailed design.
- Tax, shipping rates, delivery methods, cancellation/refund policy, email provider, and carrier integrations require publisher decisions where not already defined.
- The Phase 2 plan reconfirms AWS infrastructure. Final AWS service selection and deployment topology must be decided during technical design.

---

## 3. Detailed Component Breakdown

### 3.1 User Authentication — Login & Register

**Objective:** Enable secure user account creation and access.

- **Registration**
  - User-friendly registration form collecting email, password, and basic profile information.
  - Password strength validation.
  - Email verification is optional but recommended for security.
- **Login**
  - Secure login form accepting email/username and password.
  - “Forgot Password” functionality with email-based reset.
  - Session management and secure token handling, for example JWT, with expiry and revocation considerations.
- **Security**
  - Password hashing and salting using a modern password-hashing approach; never store plaintext passwords.
  - Protection against brute-force attacks through rate limits/throttling.
  - HTTPS enforcement for all authentication endpoints.

### 3.2 User Panel / Dashboard

**Objective:** Provide a personalized hub for logged-in users.

| Feature | Required behaviour |
|---|---|
| Profile management | View and edit permitted personal details, including name, address, and contact information |
| Password | Allow a logged-in user to change their password securely |
| Order history | List all past orders with current status and provide a detailed view for each order |
| Wishlist | View and manage saved books; allow a wishlist item to be moved to the cart |
| Saved addresses | Create, edit, select, and remove multiple shipping and billing addresses |

### 3.3 E-commerce Checkout Process

**Objective:** Provide a secure and intuitive process for purchasing books.

1. **Shopping cart review:** Show each item, quantity, and subtotal; support quantity updates and removal.
2. **Shipping information:** Select a saved address or enter a new shipping address; offer shipping-method selection where applicable.
3. **Server-side order preparation:** Validate book availability and recalculate prices, discounts, shipping, and applicable totals on the backend.
4. **Razorpay integration:** Create a payment order through the backend and launch the approved checkout flow on the frontend.
5. **Payment outcomes:** Handle success, failure, cancellation, and pending states with clear user feedback and a safe retry path.
6. **Order confirmation:** Show a final order summary before placement, then display a confirmation page after verified successful payment.
7. **Email:** Send an order-confirmation email to the customer after the payment/order state is verified.

**Payment security note:** The browser redirect alone must not be treated as proof of payment. The backend must verify the payment signature and process trusted webhook events idempotently. Store provider references and transaction state, not raw card numbers or CVC.

### 3.4 Order Tracking

**Objective:** Allow users to monitor the status and progress of their placed orders.

- Show current order status, including **Pending, Processing, Shipped, Delivered, and Cancelled**.
- Provide a detailed order view with items, quantities, prices, shipping address, and payment status.
- Where feasible in this phase, integrate shipping carrier APIs and provide real-time tracking links.
- Allow authorized staff to update order statuses; customer views must reflect those updates.

### 3.5 Admin Panel

**Objective:** Provide publisher staff with comprehensive tools for managing the website’s content, users, and operations.

| Admin module | Capabilities |
|---|---|
| Dashboard overview | Summary of recent orders, new users, and pending author applications |
| Book management | Add, edit, and delete books; manage title, author, ISBN, description, images, pricing, categories, and inventory; upload/manage covers and other media |
| Author management | View, approve, or reject author applications; manage author profiles and associated books |
| User management | View/manage registered users; update roles or deactivate accounts, subject to permissions |
| Order management | View all orders with filtering/search; update statuses; generate shipping labels if integrated; process refunds and cancellations |
| Content management | Manage static pages such as About Us, Contact Us, FAQs, and Privacy Policy; create/manage promotions and discount codes |
| Basic sales reporting & analytics | Generate basic reports on sales, popular books, and user activity |

### 3.6 Shared Platform Components

- **Backend API:** Centralizes validation, authorization, and business rules for the frontend and admin interface.
- **PostgreSQL data layer:** Stores accounts, catalogue, addresses, orders, payments, inventory, author applications, content, and promotions.
- **Media storage:** Stores book covers and other uploaded assets; access rules must distinguish public images from restricted files.
- **Notification service:** Sends password-reset messages, optional verification messages, and order confirmations.
- **Audit trail:** Records sensitive administrative actions, order status changes, refunds/cancellations, and author decisions.
- **Operational monitoring:** Captures application errors, payment/webhook failures, and service health.

---

## 4. Technology Stack (Reconfirmation)

| Layer | Technology | Planned use |
|---|---|---|
| Frontend | React + Vite, HTML5, CSS3 | Extend the current responsive website with account, checkout, tracking, and admin interfaces |
| Backend | Node.js | API endpoints, authentication, business logic, order lifecycle, payment verification, and admin operations |
| Database | PostgreSQL | Persistent records and transactional data for users, books, addresses, orders, payments, and content |
| Payment gateway | Razorpay | Secure payment initiation, payment verification, and payment-state updates |
| Cloud infrastructure | AWS (EC2, S3, RDS, CloudFront, etc.) | Compute, media/object storage, managed relational database, and content delivery as selected in detailed design |
| Deployment | Docker; AWS ECS/Kubernetes | Containerized packaging and deployment. Select ECS or Kubernetes during technical design; do not assume both are required |

### 4.1 Proposed Interaction Model

**Customer/staff browser → React + Vite frontend → Node.js API → PostgreSQL**

For checkout, the Node.js API creates the Razorpay order; the browser completes the payment interaction; the backend verifies the result and processes trusted webhooks. The API then updates the order/payment state and triggers the confirmation email. Book images and other media can be stored in S3 and delivered through CloudFront, subject to the final AWS design.

### 4.2 Architecture and Implementation Principles

- All authorization decisions and price/inventory validation happen on the server.
- Use database transactions and constraints for order/payment/inventory consistency.
- Make payment and webhook processing idempotent to prevent duplicate order effects.
- Keep secrets out of source control and client-side bundles; configure them securely in deployment environments.
- Use role-based access control for administrative actions and protect sensitive operations.
- Use database migrations and document environment variables and deployment steps.
- The exact authentication strategy, API framework, queue/cache, carrier provider, and AWS topology remain detailed-design decisions.

---

## 5. Deliverables

| # | Deliverable | Evidence / expected handoff |
|---:|---|---|
| 1 | Implemented and tested User Authentication module | Registration/login, reset flow, secure session/token handling, and test results |
| 2 | Implemented and tested User Panel/Dashboard | Profile, order history/details, wishlist, and saved addresses |
| 3 | Implemented and tested full E-commerce Checkout flow | Cart review, address/shipping step, Razorpay flow, error handling, and confirmation |
| 4 | Implemented and tested Order Tracking functionality | Status display, order details, and tracking link/API if feasible |
| 5 | Implemented and tested Admin Panel with specified modules | Book, author, user, order, content, promotion, and basic reporting modules |
| 6 | Updated database schema, if necessary | Reviewed migrations and schema changes supporting Phase 2 features |
| 7 | API documentation for new backend endpoints | Endpoint purpose, request/response shapes, authentication requirements, errors, and examples |
| 8 | Deployment scripts/configurations | Docker and selected AWS deployment configuration for Phase 2 components |
| 9 | Internal testing reports and bug fixes | Test coverage/results, known issues, and resolved defects |

---

## 6. High-Level Acceptance Criteria

- [ ] Users can successfully register and log in to the website.
- [ ] Logged-in users can view and update their profile and order history.
- [ ] Users can add items to a cart, proceed through a secure checkout, and complete a purchase via Razorpay.
- [ ] Users can track the status of their orders.
- [ ] Admin users can perform all specified content, user, and order management tasks through the Admin Panel.
- [ ] All new features are responsive across various devices.
- [ ] Authentication and payment-processing security measures are robust and tested.

### 6.1 Suggested Verification Checklist

| Area | Verification examples |
|---|---|
| Authentication | Registration and login success/failure; password strength; reset expiry; rate limiting; authorization boundaries |
| User dashboard | Profile and address CRUD; order ownership checks; wishlist add/remove/move-to-cart |
| Checkout | Quantity changes; server-recalculated totals; insufficient stock; Razorpay success/failure/cancel; duplicate/delayed webhook handling |
| Order tracking | Correct state shown to the correct customer; staff status updates; carrier link shown only when available |
| Admin | Role-based permissions; catalogue edits; user deactivation; order search/status; refunds/cancellations; content/promotions; report filters |
| Responsive/security | Mobile/tablet/desktop layouts; keyboard focus; input validation; HTTPS; secret handling; safe error messages |
| Deployment/data | Migration on a clean environment; environment configuration; backup/restore approach and smoke tests |

---

## 7. Next Steps

1. **Detailed technical design:** Define each component, including authentication/session approach, order state transitions, payment/webhook lifecycle, and data model.
2. **API specifications:** Create and review specifications for new backend endpoints, including authorization, validation, error responses, and examples.
3. **Frontend wireframes and UI designs:** Design registration/login, account dashboard, addresses, checkout, order details/tracking, and admin modules.
4. **Sprint planning and task breakdown:** Define dependencies, owners, estimates, and testing tasks.
5. **Continued integration with Phase 1:** Preserve the existing public navigation, design system, and catalogue experience while connecting interfaces to backend services.

### 7.1 Suggested Implementation Sequence

| Sequence | Focus | Dependency / exit checkpoint |
|---:|---|---|
| 1 | Foundation and API contract | Approve data model, API conventions, environments, and AWS deployment approach |
| 2 | Authentication and authorization | Secure registration/login/reset and role boundaries tested |
| 3 | Dashboard, addresses, and wishlist | Account data and ownership checks work against persistent database records |
| 4 | Order and payment foundation | Order model, inventory rules, Razorpay sandbox, and webhook verification are tested |
| 5 | Checkout, confirmation, and tracking | Verified payment drives order state; customer sees order details/status |
| 6 | Admin modules | Staff workflows for catalogue, authors, users, orders, content, promotions, and reports pass UAT |
| 7 | Hardening and release | Responsive QA, security checks, bug fixes, deployment validation, and handover documentation complete |

---

## 8. Risks, Assumptions & Decisions to Confirm

| Topic | Plan / decision needed |
|---|---|
| AWS deployment | Choose the appropriate compute/container option (EC2, ECS, or Kubernetes), RDS configuration, S3 access model, and CloudFront distribution during detailed design |
| Email delivery | Confirm transactional email provider, sender domain, and templates for password reset, verification, and order confirmation |
| Shipping | Confirm supported regions, rates, methods, and whether carrier tracking/label APIs are available within this phase |
| Refunds and cancellations | Define staff permissions, eligibility, status transitions, and Razorpay refund handling |
| Inventory | Define when stock is reserved and how it is released after failed, abandoned, or cancelled payment |
| Author review | Confirm whether applicants receive email-only updates or require a logged-in submission-status view |
| Reporting | Confirm required date ranges and definitions for sales, popular books, and user activity |
| Legal/policy content | Publisher must approve final Privacy Policy, Terms, returns, shipping, and related customer-facing wording |

---

## 9. Completion Definition

Phase 2 is ready for acceptance when the listed modules and deliverables are implemented, the high-level acceptance criteria pass in the agreed test environment, payment outcomes are verified server-side, administrative access is restricted by role, responsive checks are complete, blocking defects are resolved, and API/deployment/testing documentation is handed over.

Any conditional integration or deferred item must be explicitly recorded and approved by the project stakeholders.
