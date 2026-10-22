# Beneficios LPRC

Portal de beneficios de La Plata Rugby Club, construido con Qwik City y Tailwind CSS.

## Cloudflare Workers

- Cuenta: **INDESIGN** (`bcbac71e966ee9b5a273922d06ac70f5`).
- Worker: `beneficios-lprc`.
- URL: https://beneficios-lprc.indesign-bcb.workers.dev
- Archivos: R2 `beneficios-lprc-media`, binding `MEDIA`, servidos por `/media/`.
- Base de datos: **Turso/libSQL existente**. El despliegue no crea ni reemplaza la base.

Se utiliza el adaptador Cloudflare de Qwik con Static Assets de Workers, según la [guía de Qwik](https://qwik.dev/docs/deployments/cloudflare-workers/).

## Desarrollo y validación

```sh
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm test:ux
pnpm deploy:dry-run
pnpm serve
```

`pnpm dev` usa Vite y `.env.local`. Para probar cargas de archivos y el runtime de Cloudflare, usar `pnpm build` seguido de `pnpm serve`, con secretos locales en `.dev.vars` (ignorado por Git).

Secretos requeridos: `PRIVATE_TURSO_DATABASE_URL`, `PRIVATE_TURSO_AUTH_TOKEN` y `OPENAI_API_KEY` para el chatbot. `COUPON_VALIDATOR_PIN` habilita la validación de cupones por comercios; sin él solo pueden validar los administradores autenticados. No copiar tokens de Vercel ni credenciales de otros proyectos.

Las notificaciones usan `PUBLIC_VAPID_KEY` (clave pública P-256 sin comprimir en base64url) y `PRIVATE_VAPID_KEY` (JWK privado codificado en base64url). Conservar el par existente en `.dev.vars`, con permisos `600`, y cargarlo junto con el código mediante `--secrets-file`. Nunca regenerarlo en cada despliegue: las suscripciones del navegador dependen de esa clave pública. Si faltan las claves, la interfaz informa que las notificaciones no están disponibles.

La activación requiere una acción y permiso del usuario; la suscripción queda asociada a su cuenta y dispositivo en `push_subscriptions`. La prueba envía un Web Push sin datos personales y el service worker muestra un aviso genérico. No hay envíos automáticos ni tareas programadas. El service worker no guarda páginas privadas ni intercepta navegación.

`pnpm test:ux` verifica geolocalización, DNI, generación e historial de cupones, VAPID y permisos con SQLite en memoria y servicios de envío simulados. No usa la base de producción.

En `/admin/benefits`, **Agregar** junto a Categoría, Ubicación u Oferta / Descuento permite guardar nuevas opciones al crear o editar un beneficio. La opción queda seleccionada sin perder lo escrito en el formulario y también está disponible en los filtros del catálogo y el mapa. Los nombres repetidos se reutilizan, ignorando mayúsculas y espacios adicionales. Ejecutar `pnpm migrate` antes de publicar esta función para crear la tabla `benefit_filter_options`.

El guardado valida que cada opción exista y corresponda al campo seleccionado. El panel incluye navegación móvil; el catálogo ofrece carruseles con controles accesibles, paginación con rango de resultados y acciones contextuales cuando no hay coincidencias. Los enlaces para saltar al contenido facilitan la navegación con teclado y las animaciones respetan la preferencia de movimiento reducido.

## Despliegue

Verificar que el perfil `indesign` corresponde a la cuenta indicada. El `account_id` está fijado en `wrangler.jsonc`.

```sh
pnpm exec wrangler auth activate indesign
pnpm exec wrangler whoami
pnpm deploy
```

En el primer despliegue se pueden subir los secretos junto al código usando un archivo protegido que contenga solo las claves de este proyecto:

```sh
pnpm build
pnpm exec wrangler deploy --profile indesign --env-file /dev/null --secrets-file .dev.vars
```

Los despliegues posteriores conservan los secretos existentes. Los archivos históricos de `public/uploads` siguen publicados como Static Assets; las cargas nuevas se guardan en R2.

`pnpm cf-typegen` regenera los tipos de los bindings. `pnpm migrate` aplica la migración incremental de sesiones, suscripciones e índices a la base indicada en `.env.local`; revisar el destino antes de ejecutarla. El seed es una operación manual separada.
