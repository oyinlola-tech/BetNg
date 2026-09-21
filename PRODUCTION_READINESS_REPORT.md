# BetNG Production Readiness Report

> Generated: 2026-09-21 | Purpose: Transform BetNG from play-money simulation to real-money production platform

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Security Issues](#2-security-issues)
3. [Bugs & Code Issues](#3-bugs--code-issues)
4. [Production Gaps](#4-production-gaps)
5. [Complete API Specification for Production](#5-complete-api-specification-for-production)
6. [Frontend Improvements](#6-frontend-improvements)
7. [Mock Data → Real Implementation Map](#7-mock-data--real-implementation-map)
8. [Infrastructure & DevOps](#8-infrastructure--devops)
9. [Compliance & Legal](#9-compliance--legal)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Executive Summary

BetNG is an exceptionally well-built virtual football platform simulation. The architecture follows production-grade patterns (CQRS, idempotency, least-privilege DB access, constant-time comparisons). However, transitioning to **real-money operation** requires addressing security gaps, replacing all mock systems with real implementations, adding payment processing, KYC/AML compliance, and hardening the infrastructure.

**Current State:** Portfolio simulation with play money, mock data, and simulated services.

**Target State:** Production platform handling real NGN (Nigerian Naira) with payment gateway integration, KYC verification, regulatory compliance, and full operational tooling.

---

## 2. Security Issues

### 2.1 Critical (Must Fix Before Launch)

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| SEC-01 | **No payment gateway webhook verification** | `apps/services/wallet/` | Attackers can fake payment confirmations, crediting accounts without paying |
| SEC-02 | **Session token stored in sessionStorage** | `apps/*/src/services/runtime.ts` | XSS can exfiltrate tokens; httpOnly cookies required for real money |
| SEC-03 | **No CSRF protection for cookie-based auth** | Gateway middleware | If switching to cookie auth, CSRF tokens required |
| SEC-04 | **Realtime endpoint has no authentication** | `apps/services/event/` | Any user can subscribe to private channels without auth |
| SEC-05 | **No Content-Security-Policy on frontend HTML** | All `index.html` files | XSS attacks unmitigated if CSP not set at CDN/web server |
| SEC-06 | **No Strict-Transport-Security header** | `securityHeaders.middleware.ts` | HTTPS not enforced; downgrade attacks possible |
| SEC-07 | **Internal service token in .env file** | `.env` line 48 | If repo is public, token is exposed (currently gitignored but risk exists) |

### 2.2 High

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| SEC-08 | **Rate limiting only on auth endpoints** | `gateway.table.ts` lines 26-33 | Bet placement, deposits, withdrawals have no rate limit; abuse possible |
| SEC-09 | **No global rate limiting at gateway** | `apps/gateway/src/app.ts` | Any public endpoint can be flooded |
| SEC-10 | **No unhandled promise rejection handler** | `serviceRunner.core.ts` | Process crashes on unhandled rejections; no graceful recovery |
| SEC-11 | **Session cache not invalidated on revocation** | `actor.resolver.ts` lines 54-65 | 10-second window where revoked sessions still work |
| SEC-12 | **No 2FA for customer accounts** | Identity service | Only email verification exists; TOTP/SMS 2FA needed for real money |
| SEC-13 | **No IP-based blocking beyond login throttles** | Gateway | No mechanism to block malicious IPs |
| SEC-14 | **No request body size limit at gateway** | Gateway proxy | Large payloads can reach backend services before rejection |
| SEC-15 | **Event service port exposed to host** | `docker-compose.yml` line 179 | Unnecessary attack surface in production |

### 2.3 Medium

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| SEC-16 | **No Permissions-Policy header** | `securityHeaders.middleware.ts` | Browser features (camera, mic) not restricted |
| SEC-17 | **Rate limiter fails open when Redis down** | `rateLimiter.redis.ts` lines 28-36 | No rate limiting during Redis outage |
| SEC-18 | **Stack traces in logs could leak via aggregation** | `errorEnvelope.handler.ts` line 37 | Internal code paths exposed in log systems |
| SEC-19 | **No device fingerprinting for fraud detection** | Frontend | Cannot detect account sharing or bot activity |
| SEC-20 | **No password breach checking** | Identity service | Users can use compromised passwords |
| SEC-21 | **No session timeout warning** | Frontend | Sessions expire silently; users lose work |
| SEC-22 | **OPAQUE_ERROR_MESSAGE duplicated between TS and Python** | `errorEnvelope.builder.ts` + `errors.py` | Inconsistent error messages across services |

### 2.4 Security Architecture Strengths (Already Implemented)

- Gateway strips all inbound `x-betng-*` headers and rebuilds from session
- Internal token comparison uses `timingSafeEqual`
- Password comparison uses `verifyAgainstNothing` for timing equalization
- All SQL uses parameterized queries (Prisma tagged templates)
- No `dangerouslySetInnerHTML` anywhere
- Bearer tokens validated against strict regex
- CORS never allows `*`
- Database triggers enforce append-only on financial tables
- Idempotency keys on all financial operations

---

## 3. Bugs & Code Issues

### 3.1 Bugs

| ID | Issue | Location | Severity |
|----|-------|----------|----------|
| BUG-01 | **Stale package-lock.json alongside pnpm-lock.yaml** | Root + `packages/contracts/` | Low-Medium |
| BUG-02 | **settlement queue Map not cleaned on process crash** | `match.settler.ts` lines 99-122 | Low |
| BUG-03 | **stakePlan empty userId fallback for SHOP channel** | `placeBet.handler.ts` line 537 | Low (unreachable) |
| BUG-04 | **No tests for rate limiting behavior** | `gateway.test.ts` (limit set to 0) | Medium |
| BUG-05 | **No tests for event service (WebSocket/realtime)** | `apps/services/event/` | Medium |
| BUG-06 | **No mobile app device tests** | `apps/mobile/` | Medium |
| BUG-07 | **No tests for security headers on API responses** | `gateway.test.ts` | Low-Medium |

### 3.2 Code Quality Issues

| ID | Issue | Location | Severity |
|----|-------|----------|----------|
| CQ-01 | **Frontend unit tests missing for web/shop** | `apps/web/tests/`, `apps/shop/tests/` | Medium |
| CQ-02 | **No type-level tests (tsd/expect-type)** | Project-wide | Low |
| CQ-03 | **settlements table uses TEXT instead of enums** | `settlement init migration` | Low |
| CQ-04 | **No `read_only: true` on container filesystems** | `docker-compose.yml` | Low |
| CQ-05 | **No CI/CD pipeline (GitHub Actions)** | `.github/workflows/` | High |

---

## 4. Production Gaps

### 4.1 Critical Gaps

| ID | Gap | Impact | Effort |
|----|-----|--------|--------|
| GAP-01 | **No real payment processing** | Cannot accept real money deposits/withdrawals | HIGH |
| GAP-02 | **No KYC/AML verification** | Cannot verify user identity; regulatory non-compliance | HIGH |
| GAP-03 | **No email delivery service** | Cannot send verification codes, password resets, receipts | HIGH |
| GAP-04 | **No SMS service** | Cannot send OTPs, transaction alerts | HIGH |
| GAP-05 | **No push notifications** | Cannot send mobile/browser push notifications | MEDIUM |
| GAP-06 | **No responsible gambling tools** | No deposit limits, loss limits, self-exclusion | HIGH (regulatory) |
| GAP-07 | **No account deletion/GDPR compliance** | Cannot fulfill data deletion requests | HIGH (regulatory) |

### 4.2 Infrastructure Gaps

| ID | Gap | Impact | Effort |
|----|-----|--------|--------|
| GAP-08 | **No TLS/HTTPS configuration** | All traffic in plaintext | HIGH |
| GAP-09 | **No container health checks on app services** | Docker cannot detect crashed services | MEDIUM |
| GAP-10 | **No container resource limits** | Runaway processes starve siblings | MEDIUM |
| GAP-11 | **No multi-stage Docker build** | Production image includes devDependencies, full source | MEDIUM |
| GAP-12 | **No observability stack (Prometheus, Grafana, tracing)** | Cannot monitor system health in production | HIGH |
| GAP-13 | **No circuit breaker for inter-service calls** | Single service outage blocks all operations | MEDIUM |
| GAP-14 | **No graceful shutdown timeout** | In-flight transactions may be interrupted | MEDIUM |
| GAP-15 | **No database connection pool monitoring** | Cannot detect connection leaks or exhaustion | MEDIUM |
| GAP-16 | **No container image scanning** | Vulnerable base images undetected | MEDIUM |

### 4.3 Operational Gaps

| ID | Gap | Impact | Effort |
|----|-----|--------|--------|
| GAP-17 | **No API documentation (OpenAPI/Swagger)** | Developers cannot integrate without reading source | MEDIUM |
| GAP-18 | **No webhook system for external integrations** | Cannot notify payment providers, KYC services | HIGH |
| GAP-19 | **No cron job for scheduled tasks** | No automated report generation, data cleanup | MEDIUM |
| GAP-20 | **No backup/restore strategy** | Data loss on failure | HIGH |
| GAP-21 | **No log aggregation** | Cannot search/analyze production logs | MEDIUM |
| GAP-22 | **No error tracking (Sentry, Bugsnag)** | Production errors not captured | MEDIUM |
| GAP-23 | **No audit log export** | Cannot export audit trails for compliance | LOW |

---

## 5. Complete API Specification for Production

### 5.1 Payment Processing APIs (NEW - Must Build)

#### Payment Gateway Integration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/payments/deposit/initiate` | CUSTOMER | Initiate a deposit via Paystack/Flutterwave. Returns payment URL/reference. |
| `POST` | `/api/v1/payments/deposit/verify` | CUSTOMER | Verify a deposit by reference. Polls gateway for confirmation. |
| `POST` | `/api/v1/payments/webhook/paystack` | PUBLIC (webhook signature) | Paystack webhook for payment confirmation |
| `POST` | `/api/v1/payments/webhook/flutterwave` | PUBLIC (webhook signature) | Flutterwave webhook for payment confirmation |
| `POST` | `/api/v1/payments/withdraw/request` | CUSTOMER | Request a withdrawal. Returns pending status. |
| `GET` | `/api/v1/payments/withdraw/status/:reference` | CUSTOMER | Check withdrawal processing status |
| `GET` | `/api/v1/payments/history` | CUSTOMER | List all payment transactions (deposits + withdrawals) |
| `GET` | `/api/v1/payments/banks` | CUSTOMER | List supported banks for transfers |
| `POST` | `/api/v1/payments/bank-accounts/verify` | CUSTOMER | Verify a bank account number (name enquiry) |
| `POST` | `/api/v1/payments/bank-accounts` | CUSTOMER | Save a bank account for withdrawals |
| `GET` | `/api/v1/payments/bank-accounts` | CUSTOMER | List saved bank accounts |

#### Payment Webhook Payloads

```typescript
// Paystack Webhook
interface PaystackWebhook {
  event: 'charge.success' | 'charge.failed' | 'transfer.success' | 'transfer.failed';
  data: {
    reference: string;
    amount: number; // in kobo
    status: string;
    customer: { email: string; customer_code: string };
    metadata: { betng_user_id: string; betng_idempotency_key: string };
  };
}

// Flutterwave Webhook
interface FlutterwaveWebhook {
  event: 'charge.completed' | 'transfer.completed' | 'transfer.failed';
  data: {
    id: number;
    tx_ref: string;
    amount: number;
    currency: 'NGN';
    status: 'successful' | 'failed';
    customer: { id: number; email: string };
    meta: { betng_user_id: string; betng_idempotency_key: string };
  };
}
```

### 5.2 KYC/Identity Verification APIs (NEW - Must Build)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/kyc/documents` | CUSTOMER | Upload a KYC document (ID card, passport, driver's license) |
| `GET` | `/api/v1/kyc/documents` | CUSTOMER | List uploaded documents and their verification status |
| `GET` | `/api/v1/kyc/status` | CUSTOMER | Get KYC verification status (PENDING, VERIFIED, REJECTED) |
| `POST` | `/api/v1/kyc/verify/bvn` | CUSTOMER | Verify BVN (Bank Verification Number) |
| `POST` | `/api/v1/kyc/verify/nin` | CUSTOMER | Verify NIN (National Identification Number) |
| `POST` | `/api/v1/admin/kyc/review/:documentId` | ADMIN + `kyc:write` | Approve/reject a KYC document |
| `GET` | `/api/v1/admin/kyc/pending` | ADMIN + `kyc:read` | List pending KYC reviews |

### 5.3 Notification APIs (NEW - Must Build)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/notifications/push/register` | CUSTOMER | Register device token for push notifications (FCM/APNs) |
| `DELETE` | `/api/v1/notifications/push/unregister` | CUSTOMER | Unregister device token |
| `PUT` | `/api/v1/notifications/preferences` | CUSTOMER | Update notification preferences (email, SMS, push) |
| `GET` | `/api/v1/notifications/preferences` | CUSTOMER | Get notification preferences |
| `POST` | `/api/v1/notifications/sms/send-otp` | PUBLIC | Send OTP via SMS for verification |
| `POST` | `/api/v1/notifications/sms/verify-otp` | PUBLIC | Verify SMS OTP |

### 5.4 Responsible Gambling APIs (NEW - Must Build)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/limits/deposit` | CUSTOMER | Set daily/weekly/monthly deposit limit |
| `GET` | `/api/v1/limits/deposit` | CUSTOMER | Get current deposit limits |
| `POST` | `/api/v1/limits/loss` | CUSTOMER | Set loss limit |
| `GET` | `/api/v1/limits/loss` | CUSTOMER | Get current loss limits |
| `POST` | `/api/v1/limits/session` | CUSTOMER | Set session time limit |
| `POST` | `/api/v1/limits/self-exclude` | CUSTOMER | Self-exclude (24h, 7d, 30d, permanent) |
| `DELETE` | `/api/v1/limits/self-exclude` | CUSTOMER | Cancel self-exclusion (after cooldown) |
| `GET` | `/api/v1/limits/summary` | CUSTOMER | Get all active limits and status |

### 5.5 Account Management APIs (NEW - Must Build)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/account/statement` | CUSTOMER | Download account statement (PDF/CSV) |
| `GET` | `/api/v1/account/activity` | CUSTOMER | List login history and active sessions |
| `DELETE` | `/api/v1/account` | CUSTOMER | Request account deletion (GDPR) |
| `POST` | `/api/v1/account/2fa/enable` | CUSTOMER | Enable TOTP 2FA |
| `POST` | `/api/v1/account/2fa/disable` | CUSTOMER | Disable TOTP 2FA (requires current code) |
| `GET` | `/api/v1/account/2fa/backup-codes` | CUSTOMER | Generate backup codes |
| `PUT` | `/api/v1/account/email` | CUSTOMER | Change email (requires verification) |
| `PUT` | `/api/v1/account/phone` | CUSTOMER | Change phone (requires OTP) |

### 5.6 Existing APIs That Need Modifications

#### Betting Service

| Current | Change Needed |
|---------|---------------|
| `POST /bets` | Add rate limiting (per-user and global) |
| `GET /bets` | Add pagination (`offset`/`page`, `sortBy`, `sortOrder`) |
| `GET /bets/:id` | Add cancellation endpoint: `POST /bets/:id/cancel` |

#### Wallet Service

| Current | Change Needed |
|---------|---------------|
| `POST /wallets/deposit` | **Replace simulated deposit with real payment gateway integration** |
| `POST /wallets/withdraw` | **Replace simulated withdrawal with real bank transfer integration** |
| `GET /wallets/:userId/transactions` | Add CSV export endpoint |
| `GET /wallets/:userId` | Add pending balance (deposits in progress, withdrawals processing) |

#### Identity Service

| Current | Change Needed |
|---------|---------------|
| `POST /auth/register` | Add phone number as required field for SMS OTP |
| `POST /auth/login` | Add 2FA challenge step |
| `POST /auth/password/forgot` | Send real email instead of logging code |
| `POST /auth/verify` | Send real email with verification code |
| `POST /admin/auth/login` | Make TOTP mandatory (not optional) |

#### Match Service

| Current | Change Needed |
|---------|---------------|
| `GET /matches` | Add pagination, filtering by date range, competition |
| `GET /leagues` | Add pagination |
| `GET /teams` | Add pagination, search |
| `GET /search` | Add pagination, relevance scoring |

#### Gateway

| Current | Change Needed |
|---------|---------------|
| `GET /admin/health/services` | Add authentication, rate limiting |
| All routes | Add global rate limiter middleware |
| All routes | Add request ID generation for tracing |
| All routes | Add request body size limits |

### 5.7 APIs That Are Complete and Production-Ready

These APIs are well-implemented and need no changes beyond rate limiting:

- `POST /auth/register` (with email delivery)
- `POST /auth/login` (with 2FA)
- `POST /auth/verify` (with email delivery)
- `POST /bets` (idempotent, risk-evaluated)
- `POST /shop/tickets` (idempotent, float-managed)
- `POST /shop/tickets/:code/payout` (PIN-verified)
- `POST /admin/matches/:id/actions` (lifecycle-safe)
- `PUT /admin/settings` (versioned)
- All RPC procedures (internal trust model is solid)
- All admin CRUD operations (audit-logged, permission-gated)

---

## 6. Frontend Improvements

### 6.1 Web App (`apps/web`)

#### Must Have for Real Money

| Priority | Improvement | Details |
|----------|-------------|---------|
| HIGH | **2FA setup flow** | Add TOTP enrollment page in account settings |
| HIGH | **Responsible gambling dashboard** | Deposit limits, loss limits, session limits, self-exclusion UI |
| HIGH | **Payment integration UI** | Deposit via card/bank transfer, withdrawal to saved bank account |
| HIGH | **KYC verification flow** | Document upload, BVN/NIN verification, status tracking |
| HIGH | **Session timeout warning** | Modal before session expires with "Stay logged in" option |
| HIGH | **Account statement download** | PDF/CSV export of transaction history |
| HIGH | **Email/SMS verification delivery** | Real email with verification codes (not logged to console) |
| HIGH | **Terms of Service & Privacy Policy** | Legal pages required for real-money operation |
| MEDIUM | **CSP meta tag** | Add Content-Security-Policy to index.html |
| MEDIUM | **Password strength meter** | Visual indicator during registration |
| MEDIUM | **Rate limit retry countdown** | Show retry-after on 429 errors |
| MEDIUM | **Device management** | View/revoke active sessions |
| MEDIUM | **Notification preferences** | Email, SMS, push notification toggles |
| MEDIUM | **Deposit history with status** | Show pending, confirmed, failed deposits |
| LOW | **Cookie consent management** | GDPR cookie consent banner |
| LOW | **Responsible gambling info links** | Links to gambling help organizations |

#### UI/UX Improvements

| Priority | Improvement | Details |
|----------|-------------|---------|
| HIGH | **Bet confirmation animation** | Clear visual feedback when bet is placed |
| HIGH | **Real-time balance updates** | Wallet balance updates without page refresh |
| HIGH | **Deposit success/failure flows** | Clear status pages for payment operations |
| MEDIUM | **Loading skeleton improvements** | More specific skeletons for payment flows |
| MEDIUM | **Empty state illustrations** | Custom illustrations for empty wallet, no bets, etc. |
| MEDIUM | **Improved mobile bet slip** | Better touch targets, swipe to remove selections |
| LOW | **Keyboard shortcuts help** | Modal showing available shortcuts |
| LOW | **Match notification opt-in** | Per-match notification toggle on match cards |

### 6.2 Admin App (`apps/admin`)

#### Must Have for Real Money

| Priority | Improvement | Details |
|----------|-------------|---------|
| HIGH | **KYC review queue** | UI for reviewing and approving KYC documents |
| HIGH | **Payment monitoring dashboard** | Real-time deposit/withdrawal status, failed payments |
| HIGH | **Compliance reports** | AML reports, suspicious activity flags, large transaction reports |
| HIGH | **Responsible gambling management** | View self-excluded users, limit breach alerts |
| HIGH | **Mandatory 2FA setup** | Force all admin users to enable TOTP |
| HIGH | **Bulk operations** | Bulk fixture creation, bulk team import |
| MEDIUM | **CSV/Excel export on all reports** | Wire existing `csv.ts` to all report pages |
| MEDIUM | **Real-time risk alerts** | WebSocket for risk threshold breaches |
| MEDIUM | **Audit log advanced filtering** | Structured filtering by date range, actor type, action type |
| LOW | **Admin user management** | CRUD for admin users (currently only seeded) |
| LOW | **Scheduled report generation** | Daily/weekly email reports |

### 6.3 Shop App (`apps/shop`)

#### Must Have for Real Money

| Priority | Improvement | Details |
|----------|-------------|---------|
| HIGH | **Thermal printer integration** | Test with actual receipt printers (Epson, Star) |
| HIGH | **Offline-first support** | Cache open tickets for poor connectivity areas |
| HIGH | **Shift management** | Start/end shift with cash reconciliation |
| HIGH | **Cash drawer tracking** | Opening float, closing balance, discrepancy detection |
| HIGH | **Daily reconciliation flow** | End-of-day settlement with PDF receipt |
| MEDIUM | **Barcode scanner support** | Scan ticket codes instead of manual entry |
| MEDIUM | **Multi-terminal support** | Multiple cashiers in same shop |
| LOW | **Receipt customization** | Shop logo, custom footer on receipts |

### 6.4 TV App (`apps/tv`)

| Priority | Improvement | Details |
|----------|-------------|---------|
| MEDIUM | **CEC/IR remote support** | Beyond keyboard navigation |
| MEDIUM | **Scheduled programming** | Auto-switch between live, results, upcoming |
| LOW | **Audio descriptions** | Accessibility for visually impaired viewers |
| LOW | **Subtitle support** | Event descriptions as subtitles |

### 6.5 Mobile App (`apps/mobile`)

#### Must Have for Real Money

| Priority | Improvement | Details |
|----------|-------------|---------|
| HIGH | **Device testing** | Test on real iOS and Android devices |
| HIGH | **Push notification integration** | FCM (Android) + APNs (iOS) |
| HIGH | **Biometric authentication** | Face ID / Touch ID |
| HIGH | **Deep linking** | Universal links for bet sharing, payment redirects |
| HIGH | **App store submission** | Build configs, metadata, screenshots for App Store & Play Store |
| MEDIUM | **Offline caching** | Cache fixtures, standings for offline viewing |
| MEDIUM | **Crash reporting** | Sentry or Firebase Crashlytics |
| MEDIUM | **In-app updates** | Prompt users to update when new version available |
| LOW | **Widget support** | iOS/Android widgets for live scores |
| LOW | **Apple Watch / Wear OS** | Score notifications on wearable |

### 6.6 Shared Packages

| Package | Improvement |
|---------|-------------|
| `packages/ui-core` | Add `formatCurrency` for NGN formatting with proper kobo display |
| `packages/ui-core` | Add `useInterval` hook for real-time balance updates |
| `packages/ui-web` | Add `PaymentStatusCard` component for deposit/withdrawal status |
| `packages/ui-web` | Add `KYCStatusBadge` component |
| `packages/ui-web` | Add `ResponsibleGamblingBanner` component |
| `packages/client-sdk` | Add `PaymentClient` for payment API calls |
| `packages/client-sdk` | Add `KYCClient` for KYC API calls |
| `packages/client-sdk` | Add `NotificationClient` for push notification registration |

---

## 7. Mock Data → Real Implementation Map

### 7.1 Critical Mock Replacements (Must Build)

#### 7.1.1 Payment Processing

| Mock | Real Implementation |
|------|---------------------|
| `engine.ts` deposit method (instant ledger entry) | **Paystack/Flutterwave integration** with webhook verification |
| `engine.ts` withdraw method (5s fake delay) | **Bank transfer API** (Paystack Transfer, Flutterwave Transfer) |
| No payment reference tracking | **Payment reference table** with status lifecycle: PENDING → PROCESSING → COMPLETED/FAILED |
| No webhook handling | **Webhook endpoints** with signature verification, idempotency, retry handling |
| No payment receipts | **PDF receipt generation** with transaction details |

**Implementation Details:**

```typescript
// New wallet service endpoints needed
interface PaymentService {
  // Deposit
  initiateDeposit(userId: string, amount: number, method: 'card' | 'bank_transfer' | 'ussd'): Promise<PaymentInitiation>;
  verifyDeposit(reference: string): Promise<PaymentVerification>;
  handlePaystackWebhook(payload: PaystackWebhook, signature: string): Promise<void>;
  handleFlutterwaveWebhook(payload: FlutterwaveWebhook, signature: string): Promise<void>;

  // Withdrawal
  requestWithdrawal(userId: string, amount: number, bankAccountId: string): Promise<WithdrawalRequest>;
  checkWithdrawalStatus(reference: string): Promise<WithdrawalStatus>;
  processWithdrawal(reference: string): Promise<void>; // Background job

  // Bank accounts
  verifyBankAccount(accountNumber: string, bankCode: string): Promise<BankAccountVerification>;
  saveBankAccount(userId: string, accountNumber: string, bankCode: string): Promise<SavedBankAccount>;
}
```

#### 7.1.2 Email/SMS Delivery

| Mock | Real Implementation |
|------|---------------------|
| `verificationIssuer.service.ts` logs code to console | **SendGrid/SES** for transactional emails |
| No SMS service | **Termii/MessageBird** for SMS OTPs |
| No email templates | **MJML/React Email** templates for verification, password reset, receipts |

**Required Email Templates:**
1. Email verification (6-digit code)
2. Password reset (magic link or code)
3. Bet placed confirmation
4. Bet settled notification (win/loss)
5. Deposit confirmation
6. Withdrawal initiated / completed / failed
7. KYC document received
8. KYC verification approved/rejected
9. Account security alert (new login, password change)
10. Responsible gambling limit reached warning

**Required SMS Templates:**
1. Login OTP
2. Withdrawal confirmation
3. Large transaction alert

#### 7.1.3 Match Simulation → Real Data

| Mock | Real Implementation |
|------|---------------------|
| `simulate.ts` (Poisson-based virtual matches) | **Option A:** Keep virtual matches (common in African betting) |
| `markets.ts` (deterministic odds) | **Option B:** Real sports data feed (Opta, Sportradar) |
| `timing.ts` (accelerated clock) | **Option A:** Keep virtual timing (2s = 1 match minute) |

**If keeping virtual matches (recommended for African market):**
- The current simulation engine is excellent and production-ready
- Odds service needs real-time pricing instead of deterministic drift
- Risk service needs real-time liability monitoring

**If switching to real matches:**
- Need sports data provider integration (Opta, Sportradar, Genius Sports)
- Match schedule API for real fixtures
- Live score feed for real-time events
- Historical data for odds models

#### 7.1.4 Notification Delivery

| Mock | Real Implementation |
|------|---------------------|
| `engine.ts` in-memory notification array | **Firebase Cloud Messaging (FCM)** for Android/web push |
| No push notifications | **Apple Push Notification Service (APNs)** for iOS |
| No WebSocket in production | **Socket.IO or native WebSocket** for real-time updates |
| No email notifications | **SendGrid** for email delivery |

#### 7.1.5 Search

| Mock | Real Implementation |
|------|---------------------|
| `mockDataSource.ts` in-memory search | **Elasticsearch or Typesense** for full-text search |
| Accent-folding in mock | **Elasticsearch analyzers** for proper tokenization |
| Fuzzy matching in mock | **Elasticsearch fuzzy queries** or **trigram similarity** |

### 7.2 High-Priority Mock Replacements

#### 7.2.1 Analytics Service

| Mock | Real Implementation |
|------|---------------------|
| `admin/insight.ts` deterministic RNG data | **Real OLAP queries** on production data |
| Synthetic breakdowns | **Materialized views** for common aggregations |
| Commission from synthetic data | **Real commission calculation** on actual settlements |

#### 7.2.2 Risk Management

| Mock | Real Implementation |
|------|---------------------|
| `admin/derive.ts` exposure from mock stakes | **Real-time exposure tracking** via database queries |
| Configurable limits only | **Automatic market suspension** when limits breached |
| No real-time monitoring | **Background job** for continuous risk evaluation |

#### 7.2.3 Shop Reports

| Mock | Real Implementation |
|------|---------------------|
| `shop/directory.ts` seeded ticket history | **Real database queries** on actual ticket data |
| `shop/history.ts` synthetic distributions | **Real aggregation** on settlement and betting tables |

### 7.3 Medium-Priority Mock Replacements

#### 7.3.1 Lineups & Head-to-Head

| Mock | Real Implementation |
|------|---------------------|
| `lineups.ts` generated formations | **Sports data provider** API (if using real matches) |
| Synthetic H2H from simulated meetings | **Historical database** of past match results |

#### 7.3.2 Team Crest & Branding

| Mock | Real Implementation |
|------|---------------------|
| Generated crest colors from `brand/crest` | **Real team logos** from data provider or manual upload |
| Fallback SVG generation | **CDN-hosted images** with fallback |

### 7.4 What Stays the Same (Virtual Product)

These mock implementations are actually the **product itself** for virtual football:

| Component | Why It Stays |
|-----------|-------------|
| Virtual match timing (2s = 1 minute) | This IS the virtual product |
| Poisson-based match simulation | Core product logic |
| Round-robin fixture generation | Scheduling algorithm for virtual leagues |
| Deterministic odds drift | Virtual market pricing model |
| Team strength ratings | Virtual team differentiation |

### 7.5 Complete Mock Source → Platform Adapter Map

| Mock Source | Platform Adapter | Interface |
|-------------|------------------|-----------|
| `createMockDataSource()` | `createPlatformDataSource()` | `BetNgDataSource` |
| `createMockAuthSource()` | `createPlatformAuthSource()` | `AuthDataSource` |
| `createMockShopSource()` | `createPlatformShopSource()` | `ShopDataSource` |
| `createMockAdminSource()` | `createPlatformAdminSource()` | `AdminDataSource` |
| `MockPlatform` (engine) | Multiple real services | Decomposed into wallet, betting, settlement, event |

---

## 8. Infrastructure & DevOps

### 8.1 Docker & Deployment

| Task | Details |
|------|---------|
| **Multi-stage Docker builds** | Separate build stage from runtime; exclude devDependencies |
| **Container resource limits** | Set CPU/memory limits on all containers |
| **Health checks on all services** | Add health check endpoints to all 12 services |
| **TLS termination** | Add nginx/Traefik reverse proxy with Let's Encrypt |
| **Read-only containers** | Set `read_only: true` where possible |
| **Container image scanning** | Add Trivy/Snyk to CI pipeline |
| **Remove event service port exposure** | Event service should be internal only |

### 8.2 CI/CD Pipeline (GitHub Actions)

```yaml
# Required workflows:
1. **Lint & Typecheck** - On every push
2. **Unit Tests** - On every push
3. **Integration Tests** - On every push to main
4. **E2E Tests** - On every push to main
5. **Build Docker Images** - On tag/release
6. **Security Scan** - On every push (Trivy, npm audit, pnpm audit)
7. **Deploy to Staging** - On push to main
8. **Deploy to Production** - On tag/release with approval gate
```

### 8.3 Monitoring & Observability

| Tool | Purpose |
|------|---------|
| **Prometheus** | Metrics collection (request rates, latencies, error rates) |
| **Grafana** | Metrics dashboards |
| **OpenTelemetry** | Distributed tracing across services |
| **Sentry** | Error tracking (backend + frontend) |
| **ELK/Loki** | Log aggregation and search |
| **Uptime Robot** | External uptime monitoring |

### 8.4 Database

| Task | Details |
|------|---------|
| **Connection pooling** | Configure Prisma connection pool size per service |
| **Read replicas** | Add read replicas for analytics queries |
| **Backup strategy** | Daily automated backups with point-in-time recovery |
| **Migration workflow** | `migrate deploy` in CI, not `migrate dev` |
| **Data retention** | Define retention policies for logs, audit, sessions |

---

## 9. Compliance & Legal

### 9.1 Nigerian Regulatory Requirements

| Requirement | Implementation |
|-------------|----------------|
| **NLRC License** | Obtain National Lottery Regulatory Commission license |
| **KYC Verification** | BVN verification, NIN verification, ID document upload |
| **AML Monitoring** | Suspicious transaction reporting, large transaction alerts |
| **Responsible Gambling** | Deposit limits, loss limits, self-exclusion, reality checks |
| **Age Verification** | Minimum age 18 enforced at registration |
| **Data Protection** | NDPR (Nigeria Data Protection Regulation) compliance |
| **Tax Reporting** | withholding tax on winnings, annual reports to FIRS |
| **Financial Records** | Maintain detailed financial records for audit |

### 9.2 Required Legal Pages

| Page | Content |
|------|---------|
| **Terms of Service** | Betting rules, account terms, liability limits, dispute resolution |
| **Privacy Policy** | Data collection, usage, storage, sharing, deletion rights |
| **Responsible Gambling Policy** | Self-exclusion, limits, help resources |
| **AML/KYC Policy** | Verification requirements, monitoring, reporting |
| **Cookie Policy** | Cookie types, purposes, opt-out |
| **Complaints Policy** | How to file complaints, escalation process |

### 9.3 Required Integrations

| Integration | Purpose |
|-------------|---------|
| **BVN Verification API** (NIBSS) | Verify bank verification numbers |
| **NIN Verification API** (NIMC) | Verify national identification numbers |
| **OFAC/Sanctions Screening** | Check against sanctions lists |
| **Transaction Monitoring System** | Flag suspicious patterns |
| **Regulatory Reporting API** | Submit reports to NLRC |

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Add TLS termination (nginx/Traefik)
- [ ] Add health checks to all services
- [ ] Add container resource limits
- [ ] Multi-stage Docker builds
- [ ] Add global rate limiting at gateway
- [ ] Add rate limiting to bet placement, deposits, withdrawals
- [ ] Fix stale package-lock.json files
- [ ] Add unhandled rejection handler

### Phase 2: Payment Processing (Weeks 5-8)

- [ ] Integrate Paystack for card payments
- [ ] Integrate Flutterwave as backup gateway
- [ ] Implement deposit flow with webhook verification
- [ ] Implement withdrawal flow with bank transfer
- [ ] Add payment reference tracking
- [ ] Add payment receipts (PDF generation)
- [ ] Add payment monitoring dashboard (admin)

### Phase 3: Identity & Compliance (Weeks 9-12)

- [ ] Integrate email delivery (SendGrid/SES)
- [ ] Integrate SMS delivery (Termii)
- [ ] Add 2FA for customers (TOTP)
- [ ] Add KYC document upload and verification
- [ ] Add BVN/NIN verification
- [ ] Add responsible gambling limits
- [ ] Add self-exclusion flow
- [ ] Add account deletion (GDPR)
- [ ] Create legal pages (ToS, Privacy Policy)

### Phase 4: Notifications & Real-time (Weeks 13-16)

- [ ] Set up Firebase Cloud Messaging (FCM)
- [ ] Set up Apple Push Notification Service (APNs)
- [ ] Implement push notification delivery
- [ ] Add WebSocket authentication
- [ ] Add real-time balance updates
- [ ] Add notification preferences UI

### Phase 5: Frontend Hardening (Weeks 17-20)

- [ ] Add CSP headers to frontend HTML
- [ ] Add HSTS header
- [ ] Add session timeout warnings
- [ ] Add password strength meter
- [ ] Add 2FA setup flow
- [ ] Add KYC verification flow
- [ ] Add deposit/withdrawal UI
- [ ] Add responsible gambling dashboard
- [ ] Add account statement download

### Phase 6: Testing & Launch (Weeks 21-24)

- [ ] Mobile app device testing
- [ ] Thermal printer integration testing
- [ ] Load testing (k6/artillery)
- [ ] Security audit (penetration testing)
- [ ] Compliance audit (NLRC requirements)
- [ ] Staging environment deployment
- [ ] Production deployment
- [ ] Post-launch monitoring

---

## Appendix A: Environment Variables for Production

```env
# Payment Gateways
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_WEBHOOK_SECRET=whsec_...
FLUTTERWAVE_SECRET_KEY=FLWSECK-...
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-...
FLUTTERWAVE_WEBHOOK_HASH=...

# Email
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@betng.com
SENDGRID_VERIFIED_SENDER=noreply@betng.com

# SMS
TERMII_API_KEY=TL...
TERMII_SENDER_ID=BetNG

# Push Notifications
FCM_SERVER_KEY=...
APNS_KEY_ID=...
APNS_TEAM_ID=...
APNS_BUNDLE_ID=com.betng.app

# KYC
NIBSS_BVN_API_KEY=...
NIMC_NIN_API_KEY=...

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
PROMETHEUS_ENABLED=true

# Production Security
NODE_ENV=production
INTERNAL_SERVICE_TOKEN=<random-64-char>
SIMULATION_SEED_SECRET=<random-64-char>
SESSION_SECRET=<random-64-char>

# CORS (production origins only)
CORS_ORIGINS=https://betng.com,https://admin.betng.com,https://shop.betng.com
```

## Appendix B: Database Tables to Add

```sql
-- Payment processing
CREATE TABLE wallet.payment_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reference TEXT UNIQUE NOT NULL,
  gateway TEXT NOT NULL, -- 'paystack' | 'flutterwave'
  type TEXT NOT NULL,    -- 'deposit' | 'withdrawal'
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'PENDING',
  gateway_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bank accounts
CREATE TABLE identity.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_number TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- KYC documents
CREATE TABLE identity.kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL, -- 'nin' | 'bvn' | 'id_card' | 'passport' | 'drivers_license'
  document_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Responsible gambling limits
CREATE TABLE identity.user_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  limit_type TEXT NOT NULL, -- 'deposit_daily' | 'deposit_weekly' | 'deposit_monthly' | 'loss_daily' | 'loss_weekly' | 'session_minutes' | 'self_exclude'
  value BIGINT NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Push notification devices
CREATE TABLE identity.push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  platform TEXT NOT NULL, -- 'ios' | 'android' | 'web'
  token TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Two-factor authentication
CREATE TABLE identity.user_2fa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  backup_codes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

*This report is a living document. Update it as items are completed.*
