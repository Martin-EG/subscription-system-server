# Pruebas Manuales de Endpoints

Esta guía permite validar los flujos principales de la API desde PowerShell. Las pruebas
modifican suscripciones y pagos, por lo que deben ejecutarse únicamente en un entorno
local o de demostración.

## Preparación

1. Configura `.env`, prepara Supabase y crea los usuarios de demostración como se explica
   en el README.
2. Inicia la API:

```powershell
npm run dev
```

3. En otra terminal, define la URL y autentica ambos usuarios:

```powershell
$baseUrl = "http://localhost:3000"

$userLogin = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/api/v1/auth/login" `
  -ContentType "application/json" `
  -Body (@{
    email = "jane.doe@subsdemo.com"
    password = "Demo123"
  } | ConvertTo-Json)

$adminLogin = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/api/v1/auth/login" `
  -ContentType "application/json" `
  -Body (@{
    email = "admin.john@subsriptive.com"
    password = "Demo123"
  } | ConvertTo-Json)

$userToken = $userLogin.access_token
$adminToken = $adminLogin.access_token
$userId = $userLogin.user.id
```

Los comandos siguientes usan `curl.exe` para mostrar tanto el cuerpo como el código HTTP.

## Salud y autenticación

```powershell
curl.exe -i "$baseUrl/health"
```

Resultado esperado: `200` y `{"status":"ok"}`.

Para comprobar credenciales inválidas:

```powershell
curl.exe -i -X POST "$baseUrl/api/v1/auth/login" `
  -H "Content-Type: application/json" `
  -d '{ "email": "jane.doe@subsdemo.com", "password": "incorrecta" }'
```

Resultado esperado: `401`.

## Consultar planes

```powershell
curl.exe -i "$baseUrl/api/v1/plans?page=1&limit=20" `
  -H "Authorization: Bearer $userToken"
```

Resultado esperado: `200`, con los planes gratuito, mensual y anual.

## Checkout premium

Usa una clave de idempotencia nueva para cada operación lógica:

```powershell
$checkoutKey = "manual-checkout-$([guid]::NewGuid())"

curl.exe -i -X POST "$baseUrl/api/v1/subscriptions/checkout" `
  -H "Authorization: Bearer $userToken" `
  -H "Idempotency-Key: $checkoutKey" `
  -H "Content-Type: application/json" `
  -d '{ "planId": "99902751-fb7d-4d2f-9716-6eca142b060e", "paymentMethod": "simulated-card" }'
```

Resultado esperado: `200`, estado `ACTIVE` y una fecha `expiresAt`.

Repite exactamente el mismo comando con la misma clave. Debe devolver `200` con la misma
respuesta sin crear otro pago. Cambiar el plan o método de pago reutilizando esa clave
debe responder `409`.

Para simular un pago rechazado, usa una clave nueva y:

```json
{
  "planId": "99902751-fb7d-4d2f-9716-6eca142b060e",
  "paymentMethod": "simulated-declined"
}
```

Resultado esperado: `402`.

## Consultar suscripciones

Consulta del usuario autenticado:

```powershell
curl.exe -i "$baseUrl/api/v1/subscriptions" `
  -H "Authorization: Bearer $userToken"
```

Resultado esperado: `200` con su suscripción.

Listado administrativo:

```powershell
curl.exe -i "$baseUrl/api/v1/subscriptions?page=1&limit=20" `
  -H "Authorization: Bearer $adminToken"
```

Consulta administrativa por usuario:

```powershell
curl.exe -i "$baseUrl/api/v1/subscriptions/$userId" `
  -H "Authorization: Bearer $adminToken"
```

Resultados esperados: `200`. Usar `$userToken` en la última consulta debe responder `403`,
y usar `not-a-uuid` como identificador debe responder `400`.

## Cancelar y reactivar

Después de activar un plan premium:

```powershell
curl.exe -i -X PATCH "$baseUrl/api/v1/subscriptions/cancel" `
  -H "Authorization: Bearer $userToken"
```

Resultado esperado: `200` y `cancelAtPeriodEnd: true`. El acceso continúa disponible
hasta `expiresAt`.

Para deshacer la cancelación programada sin cobrar ni extender el periodo:

```powershell
$renewKey = "manual-renew-$([guid]::NewGuid())"

curl.exe -i -X PATCH "$baseUrl/api/v1/subscriptions/renew" `
  -H "Authorization: Bearer $userToken" `
  -H "Content-Type: application/json" `
  -d "{ `"paymentMethod`": `"simulated-card`", `"idempotencyKey`": `"$renewKey`" }"
```

Resultado esperado: `200`, `cancelAtPeriodEnd: false` y la misma fecha `expiresAt`.

Una renovación que abre un periodo nuevo requiere una suscripción `CANCELLED`, `EXPIRED`
o `PAST_DUE`. En un ambiente de prueba puede prepararse ese estado desde Supabase antes
de repetir la solicitud con una clave nueva. En ese caso debe generarse un pago, una
nueva fecha de expiración y acceso premium activo.

## Consultar pagos

La auditoría de pagos es exclusiva para administradores:

```powershell
curl.exe -i "$baseUrl/api/v1/payments?page=1&limit=20" `
  -H "Authorization: Bearer $adminToken"
```

Resultado esperado: `200` con el pago creado por checkout o renovación. Usar el token del
usuario regular debe responder `403`.

## Verificar notificación externa

Después de un checkout o renovación pagada:

1. Busca una fila nueva en `payment_notifications`.
2. Espera el intervalo configurado por `OUTBOX_POLL_INTERVAL_MS`.
3. Revisa la terminal de la API para encontrar el evento publicado por
   `ConsoleEventPublisher`.
4. Confirma que la notificación cambia de `PENDING` a `SENT`.

Swagger UI también está disponible en `http://localhost:3000/docs` para ejecutar pruebas
individuales.
