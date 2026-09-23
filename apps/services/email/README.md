# email service

Transactional email for the whole platform: verification and reset codes, security alerts, shop-application
decisions and one-time operator credentials. Port 3012, schema `email`.

No other service holds a provider key or composes a page. A caller names a template and passes values;
this service renders, sends, records the delivery and keeps the suppression list.

## Sending

`email.send` over RPC — `{ to, template, variables, idempotencyKey, tags?, replyTo? }` →
`{ id, status, duplicate }`.

The key is the caller's and is also sent to SendByte as `Idempotency-Key`, so a retried RPC and a retried
HTTP call both collapse onto one message. A repeat returns the first message and sends nothing.

Before anything is sent the address is lowercased and checked against `email_suppressions`; a suppressed
address is refused with `CONFLICT` rather than damaging the sending domain.

## Templates

Templates live in `src/templates/`, not in the SendByte dashboard, so the wording is versioned, reviewed
and tested. Each exports `{ subject, html, text }` built from typed variables through one inline-styled
layout (`src/templates/layout.ts`); every value is HTML-escaped on the way in.

| Template | Used by | Secret variables |
| --- | --- | --- |
| `verification_code` | identity, at registration | `code` |
| `password_reset_code` | identity, at password reset | `code` |
| `notice` | identity, for security alerts and customer notices | — |
| `admin_credentials` | identity, when a super admin creates an admin | `temporaryPassword` |
| `shop_application_received` | identity, on submission | — |
| `shop_application_decided` | identity, on review | — |
| `shop_owner_credentials` | identity, on approval | `temporaryPassword`, `temporaryPin` |
| `cashier_credentials` | identity, when a cashier is created | `temporaryPassword`, `temporaryPin` |

**A secret variable is rendered and then dropped.** `email_messages.variables` holds what is left, so a
verification code, a temporary password or a PIN never reaches a row an operator can read, and the rendered
body is never stored at all. Logs carry a masked address and the template name, never the values.

## Delivery events

`POST /api/v1/email/webhook/sendbyte` is public at the gateway and forwarded byte for byte with the
`sendbyte-signature` header. The signature — HMAC-SHA256 over `"<t>.<raw body>"`, `t=<unix>,v1=<hex>` — is
verified against the raw bytes before anything is parsed (`verifyWebhookSignature` in `@betng/service-kit`),
with a 300-second tolerance and support for two secrets so a rotation is a deployment, not an outage. A
failed signature answers 401; everything else answers 200 so the provider stops retrying.

The event id is recorded in `email_events` (no payload is stored) and a repeat answers `duplicate`. A
message only ever moves forward — `QUEUED → SENT → DELIVERED | BOUNCED | COMPLAINED | FAILED` — enforced by
the `email_messages_guard` trigger as well as in code, so a late event cannot walk a delivered message back.

A permanent `email.bounced` and every `email.complained` add the address to `email_suppressions`, whether or
not the event can be tied to a message.

## Configuration

See the email block in the root `.env.example`.

| Variable | |
| --- | --- |
| `EMAIL_SERVICE_PROVIDER` | `sendbyte`, or `log` for development (refused in production) |
| `SENDBYTE_API_KEY` | `sk_live_…`; a `sk_test_…` key is refused in production |
| `SENDBYTE_WEBHOOK_SECRET` | `whsec_…`; comma-separate two during a rotation |
| `SENDBYTE_BASE_URL` | `https://api.sendbyte.africa`; https except on loopback outside production |
| `EMAIL_FROM`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO` | The sending domain must be verified with SendByte |
| `EMAIL_PROVIDER_TIMEOUT_MS`, `EMAIL_WEBHOOK_TOLERANCE_SECONDS` | Defaults 10000 and 300 |

The API key and each webhook secret are wrapped so they answer `[redacted]` to `toString`, `toJSON` and
Node's inspection; only `.reveal()` returns the value, and the adapter calls it once at construction. The
from-name is refused if it carries header punctuation, so it cannot forge an address.

## Tests

`pnpm exec vitest run --project unit apps/services/email`. They run against the `betng_test_email` database:

```
bash scripts/db-bootstrap.sh betng_test_email
EMAIL_DATABASE_URL=postgresql://betng_email:betng_email_local@localhost:55432/betng_test_email?schema=email \
  pnpm --filter @betng/email-service db:migrate
```

`tests/invariants.test.ts` runs against the live triggers with raw SQL, because Prisma reports a
`restrict_violation` as a foreign-key error and hides the trigger's own message.
