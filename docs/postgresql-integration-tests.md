# Integración Real con PostgreSQL

La suite de integración valida el checkout contra una instancia PostgreSQL real. Se
ejecuta de forma separada de las pruebas unitarias para mantener `npm test` rápido y sin
dependencias externas.

## Qué comprueba

El escenario exitoso ejecuta `CheckoutSubscriptionUseCase` con implementaciones reales
de Prisma y verifica estas escrituras:

```text
checkout
  -> subscriptions
  -> user_access
  -> payment_logs
  -> payment_notifications
  -> idempotency_keys
```

El escenario de error prepara un `transaction_id` duplicado. PostgreSQL rechaza el
registro de pago y la transacción revierte la actualización de suscripción, acceso y
outbox. Después del rollback, el caso de uso marca la operación idempotente como
`FAILED` en una escritura independiente para permitir un reintento controlado.

## Ejecución

Requisitos:

- Docker Desktop o un daemon Docker compatible.
- Node.js 22 y dependencias instaladas.
- Puerto local `55432` disponible.

Ejecuta:

```bash
npm run test:integration
```

El comando:

1. Levanta `postgres:16-alpine` usando `compose.integration.yaml`.
2. Espera a que PostgreSQL esté saludable.
3. Aplica `prisma/schema.prisma` con `prisma db push`.
4. Ejecuta únicamente `tests/integration`.
5. Elimina el contenedor y su almacenamiento temporal.

La base utiliza exclusivamente datos generados por la prueba. No lee `DATABASE_URL` ni
modifica la base local o el proyecto Supabase configurado en `.env`.

## Base externa opcional

El runner acepta `TEST_DATABASE_URL` para cambiar la conexión:

```powershell
$env:TEST_DATABASE_URL = "postgresql://user:password@localhost:5432/test_database"
npm run test:integration
```

Aunque se proporcione otra URL, el runner sigue administrando el contenedor definido en
`compose.integration.yaml`. Para ejecutar Jest manualmente contra una base ya preparada:

```powershell
$env:TEST_DATABASE_URL = "postgresql://user:password@localhost:5432/test_database"
$env:DIRECT_URL = $env:TEST_DATABASE_URL
npx prisma db push --skip-generate --accept-data-loss
npx jest --config jest.integration.config.ts --runInBand
```

Usa siempre una base desechable: la suite elimina los datos de las tablas del sistema
antes y después de las pruebas.
