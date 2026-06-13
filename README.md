# Sistema de Suscripciones

[English version](README.en.md)

Sistema de Suscripciones es la base de backend para una empresa que lanzará un servicio de suscripciones premium. Su objetivo es soportar un servicio y un portal donde los usuarios puedan suscribirse a un plan, gestionar renovaciones y cancelaciones, consultar su suscripción actual y obtener o perder acceso a funcionalidades premium según sus permisos.

Actualmente, el sistema permite autenticarse con Supabase, consultar planes y pagos,
activar o renovar un plan premium, programar su cancelación y consultar suscripciones.
Los administradores pueden listar suscripciones y buscar la suscripción de un usuario
específico. Checkout y renovación son idempotentes y actualizan la suscripción, el acceso
premium, el registro de pago y la notificación pendiente dentro de una transacción
PostgreSQL.

Workers independientes publican las notificaciones externas simuladas y retiran el acceso
de las suscripciones vencidas. La integración externa se simula mediante consola, como
permite el ejercicio, y continúa desacoplada mediante un puerto de aplicación para poder
reemplazarla por Kafka o un webhook.

## Stack Tecnológico

- **Node.js 22 LTS y TypeScript:** Node.js es apropiado para una API que coordina
  operaciones de base de datos, proveedores de pago, colas y servicios de notificaciones, ya que estas cargas dependen principalmente de operaciones de entrada y salida.
  TypeScript agrega contratos estáticos entre el dominio, los casos de uso y los
  adaptadores de infraestructura.
- **Express:** proporciona una capa HTTP pequeña y madura sin imponer una arquitectura de aplicación. Esto permite mantener explícitos los límites de Clean Architecture y aislar el framework en la capa de presentación.
- **Supabase y PostgreSQL:** Supabase proporciona PostgreSQL administrado, autenticación y Row Level Security, reduciendo la carga operativa inicial sin abandonar una base de datos relacional estándar. PostgreSQL es adecuado para datos transaccionales de suscripciones, pagos e idempotencia.
- **Prisma 7:** proporciona un cliente de base de datos tipado y mantiene el modelo de la aplicación alineado con el esquema de PostgreSQL.
- **Jest y Supertest:** permiten crear pruebas unitarias y de integración HTTP.
- **ESLint y Prettier:** mantienen la calidad y el formato consistente del código.
- **Swagger UI y OpenAPI:** documentan el contrato HTTP y permiten probar los endpoints disponibles.
- **Docker:** proporciona una imagen de ejecución reproducible y una base para el
  despliegue.

## Clean Architecture

```text
src/
|-- domain/          Entidades y errores de dominio
|-- application/     Casos de uso, DTOs y puertos
|-- infrastructure/  Prisma, configuración, worker y adaptadores externos
|-- presentation/    Controladores, middleware y rutas de Express
|-- app.ts            Composición de la aplicación HTTP
`-- main.ts           Punto de entrada del proceso
```

Las dependencias apuntan hacia el interior: presentación e infraestructura dependen de
los contratos de aplicación y dominio. La capa de dominio no importa Express, Prisma ni
servicios externos.

### Diseño inicial del sistema

Como referencia informativa, el diseño inicial utilizado durante la planeación está
disponible en
[Excalidraw](https://excalidraw.com/#json=3Uj6tuSIZeOs3OQXmOfwU,QVREd08aL3cz56ch40K-Og).
El código y la documentación de este repositorio representan el comportamiento vigente
cuando exista alguna diferencia con ese bosquejo.

## Configuración Local

Requisitos: Node.js 22 y npm.

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

En PowerShell, utiliza `Copy-Item .env.example .env` en lugar de `cp`.

Para ejecutar la API completa se requiere un proyecto de Supabase y una conexión PostgreSQL válida en `DATABASE_URL`. Configura también las variables de Supabase Auth indicadas en `.env.example`.

## Configuración de Supabase

La configuración está dividida intencionalmente en dos pasos idempotentes. Supabase administra el esquema `auth`, por lo que las cuentas reales se crean mediante la API administrativa oficial en lugar de insertar filas directamente en `auth.users`.

1. Abre el SQL Editor de Supabase y ejecuta
   [`supabase/setup.sql`](supabase/setup.sql).
2. Agrega `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a `.env`.
3. Crea o actualiza los usuarios de demostración:

```bash
npm run supabase:seed-users
```

Para una base de datos creada previamente con la primera versión del esquema, ejecuta una vez en el SQL Editor:
[`supabase/migrations/20260612_subscription_history_and_idempotency.sql`](supabase/migrations/20260612_subscription_history_and_idempotency.sql)

- Crea la tabla dedicada `idempotency_keys`.
- Migra los valores de idempotencia existentes antes de eliminar la columna anterior.
- Agrega fechas del ciclo de vida y campos de cancelación a las suscripciones.
- Renombra la referencia externa de suscripción a `stripe_subscription_id`.
- Crea una suscripción gratuita activa para cada usuario sin suscripción vigente.

Después ejecuta:
[`supabase/migrations/20260613_replace_plan_ids_with_uuid_v4.sql`](supabase/migrations/20260613_replace_plan_ids_with_uuid_v4.sql)

Esta migración reemplaza los IDs iniciales de los planes por UUID v4 válidos, reasigna las suscripciones existentes y actualiza el trigger que entrega el plan gratuito a usuarios nuevos.

Para habilitar el worker de expiración en una base existente, ejecuta también:
[`supabase/migrations/20260613_subscription_expiration_index.sql`](supabase/migrations/20260613_subscription_expiration_index.sql)

La migración agrega el índice `(status, expires_at)` utilizado para reclamar suscripciones
vencidas por lotes.

El SQL crea las tablas públicas, enums, índices, el trigger de sincronización de perfiles, las políticas RLS de lectura y los siguientes planes:

| Plan            | ID                                     | Precio | Moneda | Periodo de cobro |
| --------------- | -------------------------------------- | -----: | ------ | ---------------- |
| Gratis          | `f787d141-3c8e-420f-b367-a9edcc84a6df` |      0 | MXN    | `NULL`           |
| Premium mensual | `99902751-fb7d-4d2f-9716-6eca142b060e` |     99 | MXN    | `MONTHLY`        |
| Premium anual   | `768a6a3b-60f1-4d23-9d23-f9affc529aa8` |    999 | MXN    | `YEARLY`         |

El seed de Auth crea cuentas de demostración confirmadas y puede ejecutarse nuevamente de forma segura:

| Rol   | Nombre   | Correo                       | Contraseña |
| ----- | -------- | ---------------------------- | ---------- |
| ADMIN | John Doe | `admin.john@subsriptive.com` | `Demo123`  |
| USER  | Jane Doe | `jane.doe@subsdemo.com`      | `Demo123`  |

Estas credenciales son únicamente para entornos locales o de demostración. La clave service-role otorga acceso administrativo y nunca debe incluirse en Git ni exponerse en un navegador.

## Autenticación

El login utiliza Supabase Auth con correo y contraseña:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "jane.doe@subsdemo.com",
  "password": "Demo123"
}
```

La aplicación requiere `SUPABASE_URL` y `SUPABASE_ANON_KEY` para autenticar usuarios. Una
respuesta exitosa incluye `access_token`, `expires_in` e información básica del usuario.
El mismo JWT se establece en una cookie `access_token` con `HttpOnly`,
`SameSite=Strict` y `Secure` en producción.

El middleware `authenticate` valida encabezados `Authorization: Bearer <token>` mediante
Supabase y guarda el usuario verificado en `response.locals.authUser`. Checkout y las
consultas de suscripciones requieren este middleware.

Las credenciales inválidas o los JWT no válidos responden únicamente con estado `401` y
sin cuerpo. El rate limiting del login queda registrado como deuda técnica y deberá
implementarse antes de producción.

## Checkout de Suscripción

El checkout activa un plan premium para el usuario autenticado:

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

Cada operación lógica debe usar una clave de idempotencia nueva. Si la misma solicitud se
reintenta, debe reutilizar la misma clave. Reutilizarla con otro payload responde `409`.

Una respuesta exitosa devuelve:

```json
{
  "subscriptionId": "subscription-uuid",
  "status": "ACTIVE",
  "expiresAt": "2026-07-13T12:01:00.000Z"
}
```

El procesador simulado acepta cualquier método no vacío. El valor
`simulated-declined` permite probar un pago rechazado y responde `402`.

El checkout realiza atómicamente:

- Actualización de la suscripción del usuario.
- Habilitación de acceso premium.
- Creación del registro de pago.
- Creación de una notificación `PENDING` para el worker/outbox.
- Persistencia de la respuesta idempotente.

El worker reclama notificaciones en lotes usando `FOR UPDATE SKIP LOCKED`, cambia su
estado a `PROCESSING` y publica un evento estructurado mediante
`ConsoleEventPublisher`. Si la publicación termina correctamente, marca la fila como
`SENT`; si falla, aplica backoff exponencial y la devuelve a `PENDING`, o la marca como
`FAILED` al alcanzar el máximo de intentos.

## Expiración y Acceso Premium

Un worker independiente revisa periódicamente suscripciones `ACTIVE` o `PAST_DUE` cuya
fecha `expires_at` ya pasó:

- Una suscripción normal pasa a `EXPIRED`.
- Una suscripción con `cancel_at_period_end=true` pasa a `CANCELLED` y registra
  `cancelled_at`.
- `user_access.has_premium_access` cambia a `false` y `valid_until` a `NULL`.

La suscripción y el acceso se actualizan en una sola transacción. Las filas se reclaman
con `FOR UPDATE SKIP LOCKED`, permitiendo ejecutar varias réplicas sin procesar la misma
suscripción simultáneamente. El acceso sólo se retira cuando su propio `valid_until`
también está vencido, evitando que un proceso atrasado invalide una renovación reciente.

El intervalo y tamaño de lote se configuran con
`SUBSCRIPTION_EXPIRATION_POLL_INTERVAL_MS` y
`SUBSCRIPTION_EXPIRATION_BATCH_SIZE`.

Respuestas relevantes: `200`, `400`, `401`, `402`, `404`, `409`, `422` y `500`.

## Consulta de Suscripciones

Las consultas de suscripciones requieren un JWT válido:

```http
Authorization: Bearer <access_token>
```

### Suscripción del usuario actual o listado administrativo

```http
GET /api/v1/subscriptions?page=1&limit=20
```

La respuesta depende del rol incluido en el JWT:

- Un usuario con rol `USER` recibe únicamente su suscripción actual.
- Un usuario con rol `ADMIN` recibe todas las suscripciones actuales con paginación.
- Se consideran actuales las suscripciones con estado `ACTIVE` o `PAST_DUE`.
- `page` tiene valor predeterminado `1`.
- `limit` tiene valor predeterminado `20` y un máximo de `100`.

Respuesta individual:

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

La respuesta administrativa contiene `data`, `page`, `limit` y `total`.

### Consulta por usuario

```http
GET /api/v1/subscriptions/{userId}
Authorization: Bearer <admin_access_token>
```

Esta prioridad está completada. El endpoint:

- Es exclusivo para usuarios con rol `ADMIN`.
- Valida que `userId` sea un UUID; un valor inválido responde `400 Bad Request`.
- Devuelve la suscripción del usuario con el mismo formato de la respuesta individual.
- Responde `401 Unauthorized` sin un JWT válido.
- Responde `403 Forbidden` para un usuario regular.
- Responde `404 Not Found` cuando el usuario no tiene una suscripción.

Ejemplo:

```http
GET /api/v1/subscriptions/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin_access_token>
```

## Comandos

La guía [Pruebas manuales de endpoints](docs/manual-endpoint-tests.md) contiene una
secuencia reproducible para validar los flujos principales con PowerShell.
La guía [Integración real con PostgreSQL](docs/postgresql-integration-tests.md) explica
la prueba transaccional de checkout y rollback ejecutada contra una base efímera.

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:coverage
npm run prisma:validate
npm run supabase:seed-users
```

Swagger UI está disponible en `http://localhost:3000/docs` y el estado de salud en
`http://localhost:3000/health`.

## Endpoints

| Método | Ruta                             | Propósito                           |
| ------ | -------------------------------- | ----------------------------------- |
| POST   | `/api/v1/auth/login`             | Autenticar y obtener un JWT         |
| POST   | `/api/v1/subscriptions/checkout` | Activar una suscripción             |
| PATCH  | `/api/v1/subscriptions/cancel`   | Cancelar una suscripción            |
| PATCH  | `/api/v1/subscriptions/renew`    | Renovar una suscripción             |
| GET    | `/api/v1/subscriptions`          | Consultar propia/listar como admin  |
| GET    | `/api/v1/subscriptions/:userId`  | Consulta administrativa por usuario |
| GET    | `/api/v1/payments`               | Consultar registros de pagos        |

La cancelación se programa al final del periodo y conserva el acceso premium hasta
`expiresAt`. La renovación reutiliza el plan actual para suscripciones `CANCELLED`,
`PAST_DUE`, `EXPIRED` o con cancelación programada, y requiere `paymentMethod` e
`idempotencyKey`. Las renovaciones que abren un nuevo periodo procesan el pago simulado y
guardan la suscripción, el acceso, el registro de pago, el evento de notificación y la
respuesta idempotente en una transacción. La publicación externa se simula mediante
`ConsoleEventPublisher`.

## Prisma y Supabase

El esquema de Prisma refleja las tablas creadas por `supabase/setup.sql`. La columna `users.id` referencia al usuario correspondiente de Supabase Auth y `billing_period` permite `NULL` para el plan gratuito. Los planes de pago utilizan el enum `BillingPeriod` con `MONTHLY` y `YEARLY`. Cada nuevo usuario de Auth recibe una suscripción gratuita activa.

La idempotencia se almacena en `idempotency_keys`. El checkout utiliza una transacción Prisma para actualizar `subscriptions` y `user_access`, crear filas en `payment_logs` y `payment_notifications`, y completar la operación idempotente sin dejar escrituras parciales.

## Hoja de Ruta de Despliegue y Escalabilidad

El repositorio incluye un `Dockerfile` multietapa inicial y `compose.yaml`. Estos archivos proporcionan una imagen reproducible, pero la estrategia de producción se terminará de definir conforme se implementen las operaciones restantes y las integraciones externas.

El modelo de despliegue previsto es:

- Ejecutar la API en contenedores Docker sin estado detrás de un balanceador de carga.
- Escalar horizontalmente las réplicas sin guardar sesiones o estado de solicitudes en memoria.
- Utilizar el pool de conexiones de Supabase PostgreSQL y límites razonables por
  instancia.
- Mover notificaciones de pago y otros trabajos no bloqueantes a consumidores de Kafka, permitiendo escalar API y workers de manera independiente.
- Agregar health checks, readiness checks y apagado ordenado para la orquestación.
- Guardar secretos en la plataforma de despliegue, no en imágenes Docker ni en Git.
- Incorporar logs estructurados, métricas, trazas y alertas antes de producción.

El pipeline futuro de CI/CD deberá:

1. Instalar dependencias con `npm ci`.
2. Ejecutar validación de formato, lint, tipos y pruebas con cobertura.
3. Validar el esquema Prisma y las migraciones SQL.
4. Construir y analizar la imagen Docker.
5. Publicar imágenes inmutables etiquetadas con el SHA del commit.
6. Desplegar primero en un entorno de staging.
7. Ejecutar smoke tests y validaciones de migración antes de producción.

Esta sección es una dirección arquitectónica provisional. Las políticas concretas de hosting, orquestación, rollback, migración y releases se actualizarán al sustituir la integración simulada por infraestructura de producción.

## Integración Externa Simulada

El ejercicio permite simular el servicio externo mediante una URL de webhook o consola.
Esta implementación utiliza `ConsoleEventPublisher`: el checkout crea una fila
`payment_notifications` dentro de la misma transacción y el worker la procesa fuera del
camino síncrono de la solicitud.

Las variables `OUTBOX_POLL_INTERVAL_MS`, `OUTBOX_BATCH_SIZE`,
`OUTBOX_MAX_RETRIES` y `PAYMENT_NOTIFICATION_TOPIC` permiten configurar el worker.
Kafka y Resend quedan como alternativas de producción; reemplazar el adaptador de consola
no requiere modificar el caso de uso ni el checkout.
