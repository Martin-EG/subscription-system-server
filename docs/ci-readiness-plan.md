# Plan de CI y Readiness

Este documento define el último bloque de trabajo del ejercicio: automatizar la
validación del repositorio y exponer señales de salud apropiadas para despliegue. Es una
planificación; no implica que los puntos siguientes ya estén implementados.

## Estado actual

- `GET /health` devuelve `200` si el proceso Express está atendiendo solicitudes.
- PostgreSQL no participa en la comprobación de salud.
- Los workers arrancan después de que el servidor comienza a escuchar.
- Existe manejo de `SIGINT` y `SIGTERM`, pero `server.close()` no se espera antes de
  desconectar workers y base de datos.
- Las pruebas unitarias y la integración PostgreSQL tienen comandos separados.
- No existe un workflow en `.github/workflows`.
- `npm run lint` debe quedar sin errores antes de convertirse en una regla obligatoria
  del pipeline.

## Objetivos

1. Separar liveness de readiness.
2. Evitar enviar tráfico a una réplica que no pueda usar PostgreSQL.
3. Garantizar apagado ordenado y verificable.
4. Ejecutar automáticamente formato, lint, tipos, pruebas, integración y build.
5. Producir una imagen Docker validada y lista para un despliegue posterior.

## Fase 0: estabilizar checks locales

Antes de crear el workflow:

- Corregir todos los errores actuales de `npm run lint`.
- Confirmar que estos comandos terminan con código `0`:

```bash
npm ci
npm run prisma:generate
npm run format:check
npm run lint
npm run typecheck
npm test -- --runInBand
npm run build
npm run test:integration
```

También conviene agregar un script compuesto:

```json
{
  "scripts": {
    "verify": "npm run format:check && npm run lint && npm run typecheck && npm test -- --runInBand && npm run build"
  }
}
```

**Criterio de aceptación:** un clon limpio puede ejecutar todos los comandos sin cambios
manuales ni dependencias globales, excepto Docker para la integración.

## Fase 1: liveness y readiness

### Liveness

Mantener una ruta sin dependencias externas:

```http
GET /health/live
```

Respuesta:

```json
{
  "status": "ok"
}
```

Debe devolver `200` mientras el event loop y Express sigan operativos. No debe consultar
PostgreSQL, Supabase ni el publicador externo.

### Readiness

Agregar:

```http
GET /health/ready
```

La ruta debe ejecutar una consulta mínima mediante Prisma, por ejemplo `SELECT 1`, con
un timeout corto. Respuestas propuestas:

```json
{
  "status": "ready",
  "checks": {
    "database": "up"
  }
}
```

Cuando PostgreSQL no esté disponible:

```json
{
  "status": "not_ready",
  "checks": {
    "database": "down"
  }
}
```

El segundo caso debe usar `503 Service Unavailable`.

### Diseño recomendado

- Crear un puerto `ReadinessProbe` en aplicación o presentación.
- Implementar `PrismaReadinessProbe` en infraestructura.
- Inyectarlo en `createApp`, evitando construir Prisma directamente en la ruta.
- Mantener `GET /health` temporalmente como alias de liveness para compatibilidad.
- No incluir detalles de errores, credenciales ni URLs en la respuesta pública.

Pruebas requeridas:

- Liveness devuelve `200` sin invocar dependencias.
- Readiness devuelve `200` cuando el probe funciona.
- Readiness devuelve `503` cuando el probe falla o excede el timeout.
- Prueba PostgreSQL real del probe contra el contenedor de integración.

**Criterio de aceptación:** una réplica sin conexión a PostgreSQL permanece viva pero no
recibe tráfico.

## Fase 2: apagado ordenado

Cambiar el cierre para esperar explícitamente:

1. Marcar readiness como `false`.
2. Dejar de aceptar conexiones HTTP.
3. Esperar solicitudes activas con un timeout máximo.
4. Detener los workers y evitar nuevos ciclos.
5. Desconectar el publicador.
6. Desconectar Prisma.
7. Finalizar el proceso con código apropiado.

Agregar pruebas para llamadas repetidas y errores durante el cierre. Un timeout evita que
una réplica quede indefinidamente en estado `Terminating`.

**Criterio de aceptación:** durante `SIGTERM`, readiness cambia a `503` antes de cerrar
recursos y no quedan trabajos nuevos en ejecución.

## Fase 3: workflow de CI

Crear `.github/workflows/ci.yml` para `pull_request` y pushes a `main`.

Jobs recomendados:

### `quality`

- `actions/checkout`
- `actions/setup-node` con Node.js 22 y caché de npm
- `npm ci`
- `npm run prisma:generate`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test -- --runInBand`
- Publicar cobertura como artifact opcional

### `postgres-integration`

- Ejecutar en paralelo con `quality`.
- Usar `npm run test:integration`.
- Conservar logs de Docker/PostgreSQL como artifact cuando falle.
- Establecer un timeout del job para evitar ejecuciones colgadas.

### `build`

- Depender de `quality` y `postgres-integration`.
- Ejecutar `npm run build`.
- Construir la imagen con `docker build`.
- Ejecutar un smoke test del contenedor contra `/health/live`.
- No publicar imágenes desde pull requests.

Controles adicionales:

- Cancelar ejecuciones anteriores de la misma rama mediante `concurrency`.
- Permisos mínimos del token de GitHub.
- Fijar versiones mayores conocidas de las actions.
- Convertir los tres jobs en checks obligatorios de protección de `main`.

**Criterio de aceptación:** ningún PR puede fusionarse si falla calidad, integración real
o construcción de imagen.

## Fase 4: probes del contenedor

Agregar un `HEALTHCHECK` al `Dockerfile` o al manifiesto de despliegue. Para Docker
Compose:

```yaml
healthcheck:
  test: ['CMD', 'wget', '--spider', '-q', 'http://127.0.0.1:3000/health/ready']
  interval: 10s
  timeout: 3s
  retries: 3
  start_period: 10s
```

En Kubernetes o una plataforma equivalente:

- Liveness: `/health/live`.
- Readiness: `/health/ready`.
- Startup probe opcional si las migraciones o el arranque pueden tardar.

La imagen Alpine debe incluir una herramienta de consulta HTTP o utilizar un pequeño
script Node para el probe.

**Criterio de aceptación:** el orquestador reinicia procesos bloqueados y retira del
balanceador las réplicas sin PostgreSQL.

## Fase 5: migraciones y despliegue

Para una evolución posterior:

- Sustituir `prisma db push` por migraciones versionadas para entornos compartidos.
- Ejecutar migraciones una sola vez antes de desplegar nuevas réplicas.
- No ejecutar migraciones concurrentemente desde cada contenedor.
- Agregar smoke tests posteriores al despliegue.
- Definir rollback de aplicación y estrategia forward-only para cambios de esquema.
- Publicar imágenes inmutables etiquetadas con el SHA.

## Orden recomendado

1. Limpiar lint y agregar `npm run verify`.
2. Implementar `/health/live` y `/health/ready`.
3. Mejorar el apagado ordenado.
4. Agregar `.github/workflows/ci.yml`.
5. Incorporar probes al contenedor.
6. Proteger `main` con checks obligatorios.
7. Diseñar migraciones y despliegue cuando exista un entorno de staging.

Este orden entrega primero señales correctas de operación y después las utiliza dentro
del pipeline y del contenedor.
