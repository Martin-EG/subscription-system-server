# Subscription System

[Versión en español](README.md)

Subscription System is the backend foundation for a company launching a premium
subscription service. Its objective is to support a service and customer portal where
users can subscribe to a plan, manage renewals and cancellations, review their current
subscription, and obtain or lose access to premium features according to their
entitlements.

The system currently supports Supabase authentication, plan and payment-log queries,
premium checkout and renewal, scheduled cancellation, and subscription queries.
Administrators can list subscriptions and retrieve the subscription for a specific user.
Checkout and renewal are idempotent and update the subscription, premium access, payment
log, and pending notification in one PostgreSQL transaction.

Independent workers publish simulated external notifications and revoke access from
expired subscriptions. The external integration uses the console, as allowed by the
exercise, and stays decoupled behind an application port so it can later be replaced by
Kafka or a webhook.

## Stack

- **Node.js 22 LTS and TypeScript:** Node.js is well suited to an API that coordinates
  database operations, payment providers, queues and notification services because these
  workloads are predominantly I/O-bound. TypeScript adds static contracts across the
  domain, use cases and infrastructure adapters.
- **Express:** Express provides a small and mature HTTP layer without imposing an
  application architecture. This allows Clean Architecture boundaries to remain explicit
  and keeps the framework isolated in the presentation layer.
- **Supabase and PostgreSQL:** Supabase provides managed PostgreSQL, authentication and
  Row Level Security, reducing the initial operational burden while retaining a standard
  relational database. PostgreSQL is a strong fit for transactional subscription,
  payment and idempotency data.
- **Prisma 7:** Provides a typed database client and keeps the application model aligned
  with the PostgreSQL schema.
- **Jest and Supertest:** Support unit and HTTP integration testing.
- **ESLint and Prettier:** Enforce consistent code quality and formatting.
- **Swagger UI and OpenAPI:** Document the HTTP contract and make available endpoints
  directly testable.
- **Docker:** Provides a reproducible runtime image and a foundation for deployment.

## Clean Architecture

```text
src/
|-- domain/          Enterprise entities and domain errors
|-- application/     Use cases, DTOs and ports
|-- infrastructure/  Prisma, configuration, worker and external adapters
|-- presentation/    Express controllers, middleware and routes
|-- app.ts            HTTP application composition
`-- main.ts           Process entry point
```

Dependencies point inward: presentation and infrastructure depend on application and
domain contracts. The domain layer does not import Express, Prisma or external services.

### Initial system design

For informational purposes, the initial design used during planning is available in
[Excalidraw](https://excalidraw.com/#json=3Uj6tuSIZeOs3OQXmOfwU,QVREd08aL3cz56ch40K-Og).
The code and documentation in this repository describe the current behavior whenever
they differ from that early sketch.

## Setup

Requirements: Node.js 22 and npm.

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Running the complete API requires a Supabase project and a valid PostgreSQL connection in
`DATABASE_URL`. Configure the Supabase Auth variables listed in `.env.example` as well.

## Supabase Database Setup

The setup is intentionally split into two idempotent steps. Supabase manages the
`auth` schema, so real Auth accounts are created through the official administrative
API instead of inserting rows directly into `auth.users`.

1. Open the Supabase SQL Editor and run [`supabase/setup.sql`](supabase/setup.sql).
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env`.
3. Create or reconcile the demo Auth users:

```bash
npm run supabase:seed-users
```

For a database previously created with the first schema version, run
[`supabase/migrations/20260612_subscription_history_and_idempotency.sql`](supabase/migrations/20260612_subscription_history_and_idempotency.sql)
once in the SQL Editor instead. It:

- Creates the dedicated `idempotency_keys` table.
- Migrates existing subscription idempotency values before removing the old column.
- Adds subscription lifecycle timestamps and cancellation fields.
- Renames the external subscription reference to `stripe_subscription_id`.
- Creates a free active subscription for every user without a current subscription.

Then run
[`supabase/migrations/20260613_replace_plan_ids_with_uuid_v4.sql`](supabase/migrations/20260613_replace_plan_ids_with_uuid_v4.sql).
It replaces the original plan IDs with valid UUID v4 values, reassigns existing
subscriptions and updates the trigger that grants the free plan to new users.

To enable the expiration worker on an existing database, also run
[`supabase/migrations/20260613_subscription_expiration_index.sql`](supabase/migrations/20260613_subscription_expiration_index.sql).
This migration adds the `(status, expires_at)` index used to claim expired subscriptions
in batches.

The SQL creates the public tables, enums, indexes, profile synchronization trigger,
read-only RLS policies and these plans:

| Plan            | ID                                     | Price | Currency | Billing period |
| --------------- | -------------------------------------- | ----: | -------- | -------------- |
| Gratis          | `f787d141-3c8e-420f-b367-a9edcc84a6df` |     0 | MXN      | `NULL`         |
| Premium mensual | `99902751-fb7d-4d2f-9716-6eca142b060e` |    99 | MXN      | `MONTHLY`      |
| Premium anual   | `768a6a3b-60f1-4d23-9d23-f9affc529aa8` |   999 | MXN      | `YEARLY`       |

The Auth seed creates confirmed demo accounts and can be safely run again:

| Role  | Name     | Email                        | Password  |
| ----- | -------- | ---------------------------- | --------- |
| ADMIN | John Doe | `admin.john@subsriptive.com` | `Demo123` |
| USER  | Jane Doe | `jane.doe@subsdemo.com`      | `Demo123` |

These credentials are for local/demo environments only. The service-role key grants
administrative access and must never be committed or exposed to a browser.

## Authentication

Login uses Supabase Auth with email and password:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "jane.doe@subsdemo.com",
  "password": "Demo123"
}
```

The application requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` to authenticate users. A
successful response includes `access_token`, `expires_in` and basic user information.
The same JWT is set in an `access_token` cookie with `HttpOnly`, `SameSite=Strict` and
`Secure` in production.

The `authenticate` middleware validates `Authorization: Bearer <token>` headers through
Supabase and stores the verified user in `response.locals.authUser`. Checkout and
subscription query routes require this middleware.

Invalid credentials or invalid JWTs return only status `401` with an empty body. Login
rate limiting is recorded as technical debt and must be implemented before production.

## Subscription Checkout

Checkout activates a premium plan for the authenticated user:

```http
POST /api/v1/subscriptions/checkout
Authorization: Bearer <access_token>
Idempotency-Key: <unique-key>
Content-Type: application/json

{
  "planId": "99902751-fb7d-4d2f-9716-6eca142b060e",
  "paymentMethod": "simulated-card"
}
```

Each logical operation must use a new idempotency key. Retrying the same request must
reuse that key. Reusing it with a different payload returns `409`.

A successful response returns:

```json
{
  "subscriptionId": "subscription-uuid",
  "status": "ACTIVE",
  "expiresAt": "2026-07-13T12:01:00.000Z"
}
```

The simulated processor accepts any non-empty payment method. Use
`simulated-declined` to test a declined payment and receive `402`.

Checkout atomically:

- Updates the user's subscription.
- Enables premium access.
- Creates the payment log.
- Creates a `PENDING` notification for the worker/outbox.
- Stores the idempotent response.

The worker claims notifications in batches with `FOR UPDATE SKIP LOCKED`, changes their
status to `PROCESSING`, and publishes a structured event through
`ConsoleEventPublisher`. Successful publications are marked `SENT`; failures use
exponential backoff and return to `PENDING`, or become `FAILED` after the retry limit.

## Expiration and Premium Access

A separate worker periodically finds `ACTIVE` or `PAST_DUE` subscriptions whose
`expires_at` date has passed:

- A regular subscription becomes `EXPIRED`.
- A subscription with `cancel_at_period_end=true` becomes `CANCELLED` and records
  `cancelled_at`.
- `user_access.has_premium_access` becomes `false` and `valid_until` becomes `NULL`.

Subscription and access updates run in one transaction. Rows are claimed with
`FOR UPDATE SKIP LOCKED`, allowing multiple replicas to run without processing the same
subscription concurrently. Access is revoked only when its own `valid_until` is also
expired, preventing a delayed worker from invalidating a recent renewal.

Configure the interval and batch size with
`SUBSCRIPTION_EXPIRATION_POLL_INTERVAL_MS` and
`SUBSCRIPTION_EXPIRATION_BATCH_SIZE`.

Relevant responses are `200`, `400`, `401`, `402`, `404`, `409`, `422` and `500`.

## Subscription Queries

Subscription queries require a valid JWT:

```http
Authorization: Bearer <access_token>
```

### Current user subscription or administrative list

```http
GET /api/v1/subscriptions?page=1&limit=20
```

The response depends on the role included in the JWT:

- A user with the `USER` role receives only their current subscription.
- A user with the `ADMIN` role receives all current subscriptions with pagination.
- Subscriptions with `ACTIVE` or `PAST_DUE` status are considered current.
- `page` defaults to `1`.
- `limit` defaults to `20` and cannot exceed `100`.

Individual response:

```json
{
  "subscriptionId": "subscription-uuid",
  "userId": "user-uuid",
  "userName": "Jane Doe",
  "userEmail": "jane.doe@subsdemo.com",
  "status": "ACTIVE",
  "plan": {
    "id": "plan-uuid",
    "name": "Premium mensual",
    "price": 99,
    "currency": "MXN",
    "billingPeriod": "MONTHLY"
  },
  "startedAt": "2026-06-12T00:00:00.000Z",
  "expiresAt": "2026-07-12T00:00:00.000Z",
  "cancelAtPeriodEnd": false
}
```

The administrative response contains `data`, `page`, `limit` and `total`.

### Query by user

```http
GET /api/v1/subscriptions/{userId}
Authorization: Bearer <admin_access_token>
```

This priority is complete. The endpoint:

- Is restricted to users with the `ADMIN` role.
- Validates that `userId` is a UUID; invalid values return `400 Bad Request`.
- Returns the user's subscription using the individual response format shown above.
- Returns `401 Unauthorized` without a valid JWT.
- Returns `403 Forbidden` for a regular user.
- Returns `404 Not Found` when the user has no subscription.

Example:

```http
GET /api/v1/subscriptions/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin_access_token>
```

## Commands

The [manual endpoint testing guide](docs/manual-endpoint-tests.md) provides a reproducible
PowerShell sequence for validating the main API flows.

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run prisma:validate
npm run supabase:seed-users
```

Swagger UI is available at `http://localhost:3000/docs` and health status at
`http://localhost:3000/health`.

## Endpoints

| Method | Path                             | Purpose                  |
| ------ | -------------------------------- | ------------------------ |
| POST   | `/api/v1/auth/login`             | Authenticate and get JWT |
| POST   | `/api/v1/subscriptions/checkout` | Activate subscription    |
| PATCH  | `/api/v1/subscriptions/cancel`   | Cancel subscription      |
| PATCH  | `/api/v1/subscriptions/renew`    | Renew subscription       |
| GET    | `/api/v1/subscriptions`          | Get own/list as admin    |
| GET    | `/api/v1/subscriptions/:userId`  | Admin query by user      |
| GET    | `/api/v1/payments`               | Get payment logs         |

Cancellation is scheduled at period end and premium access remains available until
`expiresAt`. Renewal reuses the current plan for scheduled cancellations, `CANCELLED`,
`PAST_DUE`, or `EXPIRED` subscriptions and requires `paymentMethod` and
`idempotencyKey`. Renewals that open a new period process the simulated payment and store
the subscription, access, payment log, notification event, and idempotent response in one
transaction. External publication is simulated through `ConsoleEventPublisher`.

## Prisma and Supabase

The Prisma schema mirrors the tables created by `supabase/setup.sql`. The `users.id`
column references the corresponding Supabase Auth user, and `billing_period` is nullable
for the free plan. Paid plans use the `BillingPeriod` enum with `MONTHLY` and `YEARLY`.
Each new Auth user receives an active free subscription, while checkout request
idempotency is stored separately in `idempotency_keys`.

Checkout uses a Prisma transaction to update `subscriptions` and `user_access`, create
rows in `payment_logs` and `payment_notifications`, and complete the idempotency record
without leaving partial writes.

## Deployment and Scalability Roadmap

The repository includes an initial multi-stage `Dockerfile` and `compose.yaml`. These
files provide a reproducible application image, but the production deployment strategy
will be finalized as the remaining operations and external integrations are implemented.

The intended deployment model is:

- Run the API as stateless Docker containers behind a load balancer.
- Scale API replicas horizontally without storing sessions or request state in memory.
- Use Supabase PostgreSQL connection pooling and enforce sensible per-instance pool
  limits.
- Move payment notifications and other non-blocking work to Kafka consumers so API and
  worker workloads can scale independently.
- Add health, readiness and graceful-shutdown handling for container orchestration.
- Store secrets in the deployment platform rather than Docker images or source control.
- Add structured logs, metrics, traces and alerts before production rollout.

The future CI/CD pipeline should:

1. Install dependencies with `npm ci`.
2. Run formatting checks, lint, type checking and tests with coverage.
3. Validate the Prisma schema and SQL migrations.
4. Build and scan the Docker image.
5. Publish immutable images tagged with the commit SHA.
6. Deploy first to a staging environment.
7. Run smoke and migration checks before a controlled production deployment.

This section is a placeholder architecture direction. Concrete hosting, orchestration,
rollback, database migration and release policies will be updated when the simulated
integration is replaced with production infrastructure.

## Simulated External Integration

The exercise allows the external service to be simulated with a webhook URL or console.
This implementation uses `ConsoleEventPublisher`: checkout inserts a
`payment_notifications` row in the same transaction, and the worker processes it outside
the synchronous request path.

`OUTBOX_POLL_INTERVAL_MS`, `OUTBOX_BATCH_SIZE`, `OUTBOX_MAX_RETRIES`, and
`PAYMENT_NOTIFICATION_TOPIC` configure the worker. Kafka and Resend remain production
alternatives; replacing the console adapter does not require changing checkout or the
application use case.
