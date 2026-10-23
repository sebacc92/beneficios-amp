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

En `/admin/benefits`, **Mostrar en Beneficios destacados** incluye el beneficio publicado en la selección de portada. Se muestran hasta seis destacados, empezando por los de creación más reciente. **Nuevos beneficios** muestra los seis activos más recientes y puede incluir destacados. El listado administrativo identifica los destacados y permite filtrarlos; las vistas previas reutilizan la tarjeta pública.

El ingreso y el canje reconocen el mismo DNI con o sin puntos y espacios, incluso en registros históricos. Las altas y ediciones guardan sólo los números y rechazan identificadores equivalentes ya registrados; si hay varias cuentas históricas con el mismo DNI, el ingreso solicita intervención administrativa. Ejecutar `pnpm migrate` antes de publicar para crear `idx_users_dni_normalized`, sin modificar los datos existentes. La consulta usa los usuarios del portal; no verifica por sí sola el padrón oficial ni el estado de la cuota del club.

En `/admin/benefits`, **Agregar** junto a Categoría, Ubicación u Oferta / Descuento permite guardar nuevas opciones al crear o editar un beneficio. La opción queda seleccionada sin perder lo escrito en el formulario y también está disponible en los filtros del catálogo y el mapa. Los nombres repetidos se reutilizan, ignorando mayúsculas y espacios adicionales. Ejecutar `pnpm migrate` antes de publicar esta función para crear la tabla `benefit_filter_options`.

Al eliminar un beneficio que tiene cupones emitidos, el panel indica cuántos son y pide confirmación; si se confirma, el beneficio y sus cupones se borran juntos y desaparecen del historial de los socios. Si un socio genera un cupón mientras el diálogo está abierto, el borrado se detiene y se vuelve a pedir confirmación con el nuevo total.

El guardado valida que cada opción exista y corresponda al campo seleccionado. El panel incluye navegación móvil; el catálogo ofrece carruseles con controles accesibles, paginación con rango de resultados y acciones contextuales cuando no hay coincidencias. Los enlaces para saltar al contenido facilitan la navegación con teclado y las animaciones respetan la preferencia de movimiento reducido.

Cada beneficio tiene en el panel los campos **Válido hasta**, **Condiciones** y **Solo socios Gold**; la página pública muestra la vigencia y las condiciones, y editar un beneficio conserva los datos que el formulario no muestra. Si se dejan vacías la latitud y la longitud, el beneficio queda sin ubicación y no aparece en el mapa; también se pueden completar pegando un link de Google Maps.

La Agenda (`/admin/eventos`), los Sorteos (`/admin/sorteos`) y las solicitudes de comercios de "Sumá tu comercio" (`/admin/solicitudes`) se administran desde el panel. Un sorteo figura como vigente hasta que termina su día de sorteo en hora de Argentina. Las sugerencias y reclamos de `/sugerencias` se guardan y aparecen en la misma bandeja de Solicitudes. Ejecutar `pnpm migrate` antes de publicar para crear las tablas `raffles` y `suggestions`; los sorteos anteriores no se migran y se cargan desde el panel.

## Identidad LPRC

El portal sigue la estética de [lprc.com.ar](https://lprc.com.ar): azul noche `#0a1128`, amarillo `#FFD700`, títulos en Oswald en mayúscula, textos en Inter y esquinas rectas. Los tokens y las utilidades compartidas (`btn` y sus variantes, `eyebrow`, `heading-display`, `title-bar`, `badge`, `card`, `field`) están en `src/global.css`; la escala de `rounded-*` está aplanada a 0–4 px y `rounded-full` queda para círculos reales. `SectionHeading` y `HaceteSocio` (CTA "Hacete socio" por WhatsApp, igual que el sitio del club) están en `src/components/`.

Los datos del club (dirección, teléfono de secretaría, WhatsApp, redes y enlaces a lprc.com.ar) se cargan sólo desde `src/utils/club.ts`. Los tomamos de lprc.com.ar; confirmar con el club la dirección y los teléfonos antes de publicar.

Rutas públicas nuevas o renombradas: `/ayuda-ingreso` reúne la ayuda para socios que no pueden ingresar (`/recuperar-password` redirige ahí con 301) y `/register` pasó a ser la página "Hacete socio". "Agenda" aparece en el menú sólo mientras haya eventos próximos y "Sugerencias" está en el pie. Los beneficios vencidos (`valid_until` pasado, en hora de Argentina) salen del sitio como los borradores. `/descargar` sólo entrega PDFs propios publicados en `/uploads/` o `/media/`.

### Migración de esta versión

Antes de publicar, ejecutar `pnpm migrate` contra la base de producción (revisar el destino en `.env.local`). Agrega, sin tocar datos existentes:

- `benefits`: `address`, `hours`, `phone`, `whatsapp`, `instagram`, `website` (ficha "El comercio", mapa y cupón).
- `events`: `kind`, `registration_url`. `raffles`: `status` (borrador/publicado, por defecto publicado) y `requirements`.
- `sponsors`: `is_active` (visible por defecto) y `tier` (principal, oficial o proveedor).
- `site_settings`: `popup_starts_at`, `popup_ends_at`, `popup_audience` y `campaign_benefit_slugs` (beneficios de la campaña elegidos a mano).
- `merchant_requests` y `suggestions`: `notes`, `assigned_to`, `contacted_at`, `updated_at`.
- `users`: `last_login_at` y `must_change_password` (contraseñas temporales de administradores). `chat_sessions`: `reviewed_at`.

Sin esta migración, el login, el panel y varias páginas públicas fallan al leer las columnas nuevas.

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
