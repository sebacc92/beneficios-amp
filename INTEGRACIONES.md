# Integraciones externas — Club de Beneficios AMP+

Documentación de los servicios externos que consume el proyecto. **No se incluyen
valores de secretos**, solo el nombre de la variable de entorno correspondiente.

---

## 1. Webservice del Padrón de Agremiados (AMP)

Es la **fuente de verdad** para saber si un DNI corresponde a un agremiado. Se usa
en el **login del agremiado**, en la **verificación pública de credencial**
(`/verificar/[token]`) y en el **panel de comercios** al validar un socio.

Código: [`src/server/membership/provider.ts`](src/server/membership/provider.ts)
(`lookupPadron`) y el orquestador [`src/server/membership/index.ts`](src/server/membership/index.ts) (`validateMember`).

### Endpoint

```
GET https://sistemas.amepla.org.ar/servicios/padron/persona/{dni}
```

- Se consulta **de a una persona por DNI** (el DNI va en el path, URL-encoded).
- Timeout del lado nuestro: **8 s** (`AbortSignal.timeout`).
- Antes de llamar, validamos el formato: **solo números, 6 a 9 dígitos** (`isValidDni`).

### Autenticación

- Header **`x-api-key: <API_KEY>`**.
- La key se lee de la variable de entorno **`PRIVATE_PADRON_API_KEY`** (no se versiona;
  se configura en el entorno de Vercel / `.env.local`). **El valor no se documenta acá.**

### Qué se envía

Nada de body. Solo el DNI en la URL y el header con la API key. Es un `GET`.

### Qué devuelve

| Caso | HTTP | Body |
|---|---|---|
| DNI **es** agremiado | 200 | objeto de la persona (ver abajo) |
| DNI **no** figura | 200 | `null` (¡ojo! no es 404) |
| API key inválida | 400 | `API KEY Error :: API KEY Inválida` |
| DNI no numérico | 400 | `{"Message":"La solicitud no es válida."}` |

**Ejemplo de respuesta de un agremiado (datos anonimizados):**

```json
{
  "origen": "AGREMIADO",
  "ApellidoYNombres": "PEREZ, JUAN CARLOS",
  "dni": 12345678,
  "identificador": 9087,
  "email": "juanperez@example.com"
}
```

Campos:

| Campo del padrón | Tipo | Notas |
|---|---|---|
| `origen` | string | `"AGREMIADO"` o `"EMPLEADO"` (define el `tipo` interno). |
| `ApellidoYNombres` | string | Nombre completo. |
| `dni` | number | DNI (numérico). |
| `identificador` | number | ID interno del padrón (lo guardamos como `padronId`). |
| `email` | string \| null | Puede venir vacío/null. |

> El padrón **no** expone matrícula ni estado. Para el sistema, **figurar en el padrón
> = credencial válida**; el `estado` se asume `"activo"`.

### Cómo se mapea internamente

`lookupPadron` normaliza la respuesta a un `RawMember`:
`{ name, dni, email, padronId, origen, matricula: null, estado: "activo", tipo }`.
Luego `validateMember` lo **enriquece con la copia local** (tabla `users`): si esa
persona ya usó el portal, se le agrega su `id` de usuario y su `role`.

### Resiliencia (fallback)

Si el padrón **no responde** (timeout, 4xx/5xx, red caída), `validateMember` cae a la
**copia local** (`users`), que contiene a los agremiados que ya ingresaron al portal
alguna vez. Así el login y la verificación siguen operativos durante una caída del
servicio, con el aviso "se validó con la copia local". Si tampoco está en la copia
local, se informa que no se pudo verificar.

### Privacidad

- El DNI **nunca** viaja completo al cliente en la verificación: se muestra
  enmascarado (`12.34X.XXX`).
- El token del QR de credencial va cifrado (AES-GCM); no expone DNI ni matrícula.

---

## 2. Otras integraciones (referencia rápida)

| Servicio | Para qué | Variable de entorno | Notas |
|---|---|---|---|
| **Webservice de Beneficios AMP** | Snapshot del catálogo/taxonomía de beneficios | — (URL pública `https://beneficios.amepla.org.ar/api/v1/...`) | Hoy **no se consulta en vivo**: se sirve el snapshot local `src/server/data/seed.json`. El catálogo real editable vive en la base (Turso). Ver la explicación de caché. |
| **Turso / libSQL** | Base de datos (beneficios, usuarios, cupones, etc.) | `PRIVATE_TURSO_DATABASE_URL`, `PRIVATE_TURSO_AUTH_TOKEN` | Cliente edge-compatible. |
| **Vercel Blob** | Almacenamiento de imágenes/PDF subidos desde el admin | `BLOB_READ_WRITE_TOKEN` | Si falta, cae a disco local (`public/uploads`). |
| **OpenAI** | Chatbot asesor | `OPENAI_API_KEY` | Modelo `gpt-4o-mini`. |
| **Web Push (VAPID)** | Notificaciones push a agremiados | `PRIVATE_VAPID_JWK` | Suscripciones en la tabla `push_subscriptions`. |
| **Sesiones** | Firma HMAC de sesión de admin y token de credencial | `AUTH_SECRET` | Mínimo 16 caracteres. |

> Los valores de estas variables **no** se documentan acá; se configuran en el entorno
> de despliegue (Vercel) y en `.env.local` para desarrollo.
