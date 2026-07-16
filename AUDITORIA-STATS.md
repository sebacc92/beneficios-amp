# Auditoría de `/admin/stats` — informe de métricas (Tarea 8)

> Informe previo a implementar. Objetivo: contrastar lo que el panel **muestra hoy**
> contra los datos que **realmente existen** en la base, y proponer un set de
> métricas útiles para el administrador de AMP. **No se implementó nada todavía.**

---

## 1. Qué muestra hoy el panel

| Métrica (tarjeta / bloque) | Fuente real | ¿El dato es lo que dice el rótulo? |
|---|---|---|
| **Total Agremiados** | `users` con `role != admin` | ⚠️ **No.** La tabla `users` es una *copia local*: sólo contiene a los agremiados que **ya ingresaron alguna vez** al portal (se crean/actualizan en cada login). El padrón completo vive en el web service de AMP, no en la base. El rótulo correcto sería "Agremiados registrados en el portal". |
| **Beneficios Destacados** | `custom_benefits.is_featured` | ✅ Correcto. |
| **Beneficios** | `count(custom_benefits)` | ⚠️ Incluye **borradores** (`valid_until` que empieza con `draft|`). Mezcla publicados + no publicados. |
| **Chats Auditados** | `count(chat_sessions)` | ✅ Correcto (sesiones de chatbot). |
| **Cupones Generados / Usados / Activos** | `coupons.status` | ✅ Correcto. |
| **Tasa de Canje** | `usados / generados` | ✅ Correcto. |
| **Canjes últimos 7 días** (gráfico) | `coupons.used_at` | ✅ Correcto. |
| **Beneficios más usados** (ranking) | `coupons` agrupado por `benefit_title` | ✅ Correcto. Único ranking real de uso que hay hoy. |
| **Exportables CSV** | agremiados, beneficios, cupones, chats | ✅ Funcionan. Ojo: el CSV de agremiados incluye datos personales (nombre, email, matrícula). |

**Resumen:** casi todo lo que se muestra hoy gira alrededor de **cupones** (que es
el único evento de uso que se persiste) + conteos estáticos. Los rótulos
"Total Agremiados" y "Beneficios" son engañosos y conviene corregirlos.

---

## 2. Datos que YA existen y no se están aprovechando

Estas métricas son implementables **sin agregar tracking nuevo**, con las tablas
actuales:

- **`suggestions`** (formulario público de sugerencias/contacto): total y desglose
  por `tipo` (Sugerir Comercio / Problema Comercio / Consulta General / Otro) y por
  `status` (nuevo / leído / resuelto). Hoy no aparece nada en stats. Muy útil para
  ver la "bandeja" pendiente.
- **`merchant_requests`** (comercios que piden sumarse al club): total y por `status`
  (pending / …). Es un embudo comercial que hoy no se ve.
- **`push_subscriptions`**: cantidad de agremiados suscriptos a notificaciones push.
  Mide alcance real de las campañas push.
- **Agremiados activos por mes**: `users.last_synced_at` se actualiza en **cada login**
  → sirve como "último ingreso". Se pueden contar usuarios con `last_synced_at` dentro
  del mes = **activos/mes**. También `users.created_at` = alta en el portal → **altas
  nuevas por mes** (curva de crecimiento).
- **Uso del chatbot (real)**: `chat_sessions` + `chat_messages` están persistidos.
  Se puede mostrar: sesiones por día/semana, promedio de mensajes por sesión y
  tendencia. (Hoy sólo se muestra el conteo total de sesiones.)
- **Salud del catálogo** (`custom_benefits`): publicados vs. borradores; por categoría
  y por ubicación; **próximos a vencer** (`valid_until` en los próximos N días);
  cuántos tienen PDF; cuántos tienen coordenadas (aparecen en el mapa).
- **Canjes**: además de lo actual, canjes por **categoría/ubicación** del beneficio y
  **top agremiados** por cantidad de canjes.

---

## 3. Propuesta de métricas a AGREGAR

Priorizadas por valor para el administrador de AMP:

**Alta prioridad (datos ya disponibles):**
1. **Agremiados activos por mes** y **altas nuevas por mes** (curva) — vía
   `last_synced_at` / `created_at`.
2. **Bandeja de sugerencias**: nuevas sin leer + desglose por tipo/estado.
3. **Solicitudes de comercios** pendientes (embudo de adhesión).
4. **Uso del chatbot**: sesiones por semana + mensajes promedio por sesión.
5. **Catálogo — salud**: publicados vs. borradores, y **beneficios por vencer**.
6. **Suscriptores push** (alcance de notificaciones).

**Media prioridad (ordenar/enriquecer lo existente):**
7. Canjes por **categoría** y **ubicación** (dónde se usa más el club).
8. **Top agremiados** por canjes (con matrícula/DNI enmascarado, coherente con `/verificar`).

---

## 4. Qué QUITAR o CORREGIR

- **Corregir el rótulo "Total Agremiados"** → "Agremiados registrados en el portal"
  (o traer el total real del padrón desde el web service si se quiere el número global).
- **Separar "Beneficios"** en *publicados* vs *borradores* (hoy los suma juntos).
- **Nada para eliminar de raíz**: las tarjetas de cupones y el gráfico son las métricas
  más sólidas. Sí conviene **reagrupar** el dashboard por temas (Agremiados · Catálogo ·
  Cupones · Contacto/Chatbot) porque hoy es una fila plana de números sueltos.

---

## 5. Imposible de calcular HOY (falta tracking)

Estas métricas **no se pueden** sacar con la base actual; requieren registrar el evento:

| Métrica pedida | Por qué no se puede hoy | Tracking mínimo a agregar |
|---|---|---|
| **Beneficios más vistos** | No hay registro de visitas a `/beneficio/[slug]`. | Tabla `benefit_views` (o contador `views` en `custom_benefits`) que se incremente al abrir la ficha. |
| **Descargas de PDF** | El `pdf_url` existe pero no se loguea la descarga. | Registrar evento al clickear "Descargar/Ver PDF" (tabla `pdf_downloads` o contador). |
| **Escaneos de verificación de credencial** | `/verificar/[token]` valida el token pero **no persiste** el escaneo. | Tabla `credential_scans` (fecha, resultado ok/inválido, beneficio/comercio si aplica). Da además una métrica antifraude. |
| **Temas/intención del chatbot** | Se guardan los mensajes, pero no están clasificados por tema. | Clasificación (etiqueta por sesión) al cerrar/guardar la conversación. El *volumen* de uso sí es calculable hoy. |

> **Nota:** "uso del chatbot" **sí** es calculable hoy en volumen (sesiones/mensajes);
> lo que falta es la *clasificación por tema*, no el tracking base.

---

## Estado de implementación

✅ **Bloque de alta prioridad implementado** en `/admin/stats` (todo con datos ya
existentes, sin migraciones):
- Rótulos corregidos: "Total Agremiados" → **Agremiados registrados** (con aclaración
  de que no es el padrón total); la tarjeta de beneficios ahora muestra **publicados**
  con subtítulo de borradores + destacados.
- Nuevas métricas: **agremiados activos** (login en 30 días vía `last_synced_at`),
  **altas por mes** (mini-gráfico de 6 meses), **suscriptores push**, **sugerencias
  nuevas** + desglose por tipo, **solicitudes de comercios pendientes**, y **uso del
  chatbot** (mensajes promedio por charla + sesiones de 7 días).
- Panel **Salud del catálogo**: publicados, borradores, por vencer (30 días), con PDF,
  con ubicación en el mapa.

⏳ **Pendiente (requiere agregar tracking)** — segundo lote: tablas `benefit_views`,
`pdf_downloads` y `credential_scans` para habilitar "beneficios más vistos", "descargas
de PDF" y "escaneos de verificación". Estas quedan a la espera de tu OK porque implican
registrar eventos nuevos (migración + puntos de captura en las rutas).
