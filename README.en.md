# Subscription System

[Versión en español](README.md)

Subscription System is the backend foundation for a company launching a premium
subscription service. Its objective is to support a service and customer portal where
users can subscribe to a plan, manage renewals and cancellations, review their current
subscription, and obtain or lose access to premium features according to their
entitlements.

The system is designed to eventually coordinate payment processing, subscription
lifecycle management, premium access, payment auditing and asynchronous notifications.
Administrators will also be able to review subscription and payment information across
all users.

This repository is currently an architectural scaffold. It defines the API contracts,
domain models, database setup and integration boundaries, but intentionally contains no
business logic. Subscription and payment operations currently return
`501 Not Implemented`.

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
- **Swagger UI and OpenAPI:** Document the HTTP contract and make placeholder endpoints
  discoverable.
- **Docker:** Provides a reproducible runtime image and a foundation for deployment.

## Clean Architecture

```text
src/
|-- domain/          Enterprise entities and domain errors
|-- application/     Use-case placeholders, DTOs and ports
|-- infrastructure/  Prisma, configuration, Kafka and Resend adapters
|-- presentation/    Express controllers, middleware and routes
|-- app.ts            HTTP application composition
`-- main.ts           Process entry point
```

Dependencies point inward: presentation and infrastructure depend on application and
domain contracts. The domain layer does not import Express, Prisma or external services.

## Setup

Requirements: Node.js 22 and npm.

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

The Supabase project is not required for the application scaffold to start. Once it is
created, replace `DATABASE_URL` and `DIRECT_URL` in `.env`.

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

The SQL creates the public tables, enums, indexes, profile synchronization trigger,
read-only RLS policies and these plans:

| Plan            | Price | Currency | Billing period |
| --------------- | ----: | -------- | -------------- |
| Gratis          |     0 | MXN      | `NULL`         |
| Premium mensual |    99 | MXN      | `MONTHLY`      |
| Premium anual   |   999 | MXN      | `YEARLY`       |

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
Supabase and stores the verified user in `response.locals.authUser`. Placeholder routes
do not use this middleware yet.

Invalid credentials or invalid JWTs return only status `401` with an empty body. Login
rate limiting is recorded as technical debt and must be implemented before production.

## Commands

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

## Placeholder Endpoints

| Method | Path                             | Purpose                   |
| ------ | -------------------------------- | ------------------------- |
| POST   | `/api/v1/auth/login`             | Authenticate and get JWT  |
| POST   | `/api/v1/subscriptions/checkout` | Activate subscription     |
| PATCH  | `/api/v1/subscriptions/cancel`   | Cancel subscription       |
| PATCH  | `/api/v1/subscriptions/renew`    | Renew subscription        |
| GET    | `/api/v1/subscriptions`          | List/get own subscription |
| GET    | `/api/v1/subscriptions/:userId`  | Get subscription by user  |
| GET    | `/api/v1/payments`               | Get payment logs          |

Authentication, authorization, validation, transactions, idempotency, retries, Kafka
publishing and Resend delivery are intentionally not implemented.

## Prisma and Supabase

The Prisma schema mirrors the tables created by `supabase/setup.sql`. The `users.id`
column references the corresponding Supabase Auth user, and `billing_period` is nullable
for the free plan. Paid plans use the `BillingPeriod` enum with `MONTHLY` and `YEARLY`.
Each new Auth user receives an active free subscription, while checkout request
idempotency is stored separately in `idempotency_keys`.

## Deployment and Scalability Roadmap

The repository includes an initial multi-stage `Dockerfile` and `compose.yaml`. These
files provide a reproducible application image, but the production deployment strategy
will be finalized as business logic and external integrations are implemented.

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
rollback, database migration and release policies will be updated once the payment,
queue and notification workflows are operational.

## Deferred Integrations

Kafka and Resend adapters are present only as commented `implement later` placeholders.
No clients for those services are installed or initialized.
