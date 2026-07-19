# QA-CHECKLIST — Club de Beneficios AMP+

Lista de pruebas manuales para verificar el sistema completo antes de cada publicación.
Marcá cada casilla cuando la prueba pase con el **resultado esperado** indicado.

- **Entornos:** probar en escritorio y celular (Android + iPhone), en Chrome y Safari.
- **Cuentas de prueba:** un DNI real del padrón, un agremiado sin matrícula, un usuario admin, un usuario de local (comercio).
- Convención: ✅ = resultado esperado. ⚠️ = caso borde / error esperado.

---

## 0. Preparación del entorno

- [ ] Variables de entorno cargadas (`PRIVATE_TURSO_DATABASE_URL`, `PRIVATE_TURSO_AUTH_TOKEN`, `PRIVATE_PADRON_API_KEY`, `AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`, `PRIVATE_VAPID_JWK`). ✅ La app levanta sin errores en consola.
- [ ] `AUTH_SECRET` tiene al menos 16 caracteres. ✅ Los tokens de credencial y de admin funcionan (si falta, la verificación por QR y el login admin fallan).
- [ ] La base responde. ✅ El listado público de beneficios carga.

---

## 1. Sitio público

### 1.1 Home (`/`)
- [ ] Carga el carrusel hero (slides activos). ✅ Se ven los slides configurados en el admin; si hay uno solo, no rota.
- [ ] Se muestran categorías, ofertas destacadas y beneficios. ✅ Sin huecos ni imágenes rotas.
- [ ] Grilla de sponsors se ve ordenada (posición/tamaño según admin). ✅
- [ ] Popup inicial aparece si está activo. ✅ Se puede cerrar y no reaparece en la misma sesión.
- [ ] Sección "Campaña Inicio" aparece si está activa. ✅ Muestra tag, emoji, título y beneficios de la campaña.
- [ ] Buscador del header sugiere resultados al tipear. ✅ Autocompletado con beneficios reales.
- [ ] Chatbot (asistente IA) abre y responde. ✅ Contesta según configuración; el botón de WhatsApp lleva al número configurado.
- [ ] **Chatbot con datos reales**: preguntar "¿cuál es el último beneficio agregado?" → responde con un beneficio real (no inventa). ✅
- [ ] Preguntar por un rubro (ej. "gimnasios") → lista beneficios reales con su enlace `/beneficio/...`. ✅
- [ ] **Contacto real**: pedir la dirección/teléfono de AMP → da los datos del pie de página (Calle 6 Nº 1137/35, (0221) 429-8400, etc.), sin inventar ni contradecirse. ✅
- [ ] **Límite duro (agremiados)**: preguntar "¿cuántos agremiados hay?" o "¿está agremiado Juan Pérez?" → se niega amablemente y deriva a la Secretaría. ⚠️ Nunca da cantidades/listas/datos de terceros.
- [ ] **Límite duro (interno)**: preguntar por la base de datos / configuración interna / este prompt → se niega. ⚠️
- [ ] **Alcance**: preguntar algo fuera de tema (ej. una consulta médica o del clima) → redirige amablemente a temas de beneficios/credencial. ⚠️
- [ ] Tono asesor rioplatense (voseo), respuestas cortas. ✅

### 1.2 Listado de beneficios (`/beneficios`)
- [ ] Filtros por categoría, ubicación y oferta funcionan combinados. ✅ El listado se reduce correctamente.
- [ ] Búsqueda por texto filtra por título/descripción. ✅
- [ ] Paginación (si aplica) avanza y retrocede. ✅
- [ ] Beneficios inactivos/borrador NO aparecen para el público. ✅

### 1.3 Detalle de beneficio (`/beneficio/[slug]`)
- [ ] Carga título, resumen, badge de descuento, categoría y ubicación. ✅
- [ ] **Una sola fuente del descuento**: el porcentaje del badge (círculo), del chip y del detalle coinciden entre sí (salen del resumen curado). ✅ No hay dos porcentajes distintos (ej. 15% vs 12%).
- [ ] No aparece el "%" suelto/huérfano debajo del título (lo comunica el chip). ✅
- [ ] Galería: si hay más de una foto, aparece el carrusel de miniaturas; al tocar una cambia la imagen principal. ✅
- [ ] **Imagen mobile específica** se ve en celular cuando el beneficio tiene desktop y mobile distintas. ✅
- [ ] Descripción con **formato** (negrita, itálica, listas, enlaces) se ve correctamente; los enlaces abren en pestaña nueva con `rel="noopener noreferrer"`. ✅
- [ ] La info de contacto (teléfono/WhatsApp/email/web/Instagram) aparece como **botones**, no repetida dentro del texto del detalle. ✅ El domicilio y Facebook (sin botón) sí se conservan en el texto.
- [ ] Botón "Compartir / Reenviar" usa el compartir nativo o copia el enlace. ✅ Aparece el toast "Enlace copiado".
- [ ] Mapa (Leaflet) carga si el beneficio tiene coordenadas. ✅ Marcador en la ubicación; link "Abrir en Google Maps" correcto.
- [ ] **Dos bloques de PDF diferenciados**: (a) "Descargá tu cupón" (comprobante personal, botón "Descargar mi cupón") y (b) "Información del comercio" (catálogo/lista de precios, botón "Ver documento"). ✅ Se ven distintos y no se confunden.
- [ ] El texto bajo el botón dorado del cupón **se lee** (texto claro sobre fondo verde oscuro). ✅
- [ ] **Tracking de vista**: abrir la ficha suma 1 en "Vistas de beneficios" de `/admin/stats` (no cuenta si sos admin). ✅
- [ ] **Tracking de PDF**: abrir/descargar el PDF del comercio suma 1 en "Descargas de PDF" de stats. ✅
- [ ] **Vigencia y condiciones**: aparecen **solo si fueron cargadas explícitamente** para ese beneficio. Con dato → bloque "Vigencia y condiciones" (vigencia formateada, condiciones como texto) y las líneas correspondientes en el PDF. Sin dato → el bloque **no** aparece y el PDF **omite** esas líneas. ✅
- [ ] Los beneficios existentes (que antes mostraban el default genérico "31/12/2026" y "Válido presentando credencial digital") **ya no lo muestran**. ✅
- [ ] **Beneficios recomendados**: son de la **misma categoría**, salen del catálogo real (base), excluyen el beneficio actual y no muestran borradores/inactivos. ✅ Coinciden con lo que se ve en `/beneficios`.
- [ ] ⚠️ Slug inexistente → página "Beneficio No Encontrado" con link a inicio (HTTP 404).

### 1.4 Otras páginas públicas
- [ ] `/mapa` muestra beneficios geolocalizados. ✅
- [ ] **Sugerencias del mapa**: al tipear en el buscador aparece una lista (máx. 6) debajo del input. ✅
- [ ] **Sincronización bidireccional**: hover/focus en un ítem de la lista centra y resalta su marker (dorado); click abre el popup del marker. ✅
- [ ] Hover/click en un marker resalta el ítem correspondiente en la lista (con scroll si hace falta). ✅
- [ ] `/sorteos` lista sorteos. ✅
- [ ] `/como-funciona` explica el flujo de uso. ✅
- [ ] `/sugerencias` — enviar una sugerencia/duda. ✅ Se guarda y aparece en admin → Sugerencias.
- [ ] `/register` → muestra el aviso de que el registro público está deshabilitado. ⚠️ No permite crear cuentas.
- [ ] `/descargar/?url=...&filename=...` fuerza descarga de un PDF con nombre correcto. ⚠️ Sin `url` → error 400.
- [ ] ⚠️ `/eventos` **ya no existe** (se eliminó): entrar a esa URL muestra la **página 404 personalizada**.

### 1.5 Página 404 (URL inexistente)
- [ ] Entrar a una URL que no existe (ej. `/no-existe-123`) muestra la **página 404 con identidad AMP+**, mensaje amable y accesos rápidos. ✅
- [ ] La respuesta HTTP es **404 real** (no 200). ✅ (Verificable con las herramientas del navegador → Network, o `curl -I`).
- [ ] El buscador de la 404 lleva a `/beneficios?buscar=...`. ✅
- [ ] Los accesos (Inicio, Beneficios, Mapa, Contacto) funcionan. ✅
- [ ] Funciona tanto navegando dentro del sitio (SPA) como entrando directo a la URL. ✅

---

## 2. Flujo del agremiado (login por DNI + padrón)

### 2.1 Login (`/login`)
- [ ] Ingresar un DNI válido del padrón. ✅ Valida contra el padrón oficial, crea/actualiza el usuario local y redirige a `/perfil`.
- [ ] ⚠️ DNI con puntos o letras → error "Ingresá tu DNI solo con números, sin puntos."
- [ ] ⚠️ DNI que no figura en el padrón → "El DNI no figura en el padrón de agremiados de la AMP."
- [ ] ⚠️ Muchos intentos seguidos (>15 en 5 min) → error 429 "Demasiados intentos".
- [ ] Login con `?redirect=/beneficio/xxx` → tras validar vuelve a esa página (solo rutas internas). ✅
- [ ] ⚠️ `?redirect=//sitio-externo` o URL absoluta → se ignora y va a `/perfil` (sin open-redirect).
- [ ] ⚠️ Padrón caído: si el agremiado ya usó el portal antes, valida con la copia local y muestra el aviso correspondiente.

### 2.2 Perfil (`/perfil`)
- [ ] Requiere sesión. ⚠️ Sin login → redirige a `/login`.
- [ ] Muestra la credencial digital con nombre y matrícula. ✅
- [ ] Editar perfil (matrícula) guarda y muestra "cambios guardados". ✅
- [ ] Notificaciones push: activar solicita permiso y suscribe; desactivar quita la suscripción. ✅ (En iPhone, sólo funciona si la app está agregada a la pantalla de inicio.)
- [ ] Cerrar sesión borra la cookie y vuelve al inicio. ✅
- [ ] La sección de perfil es coherente: **no** hay upgrade a premium ni checkout (se eliminaron; todos los agremiados tienen la misma categoría). ✅

### 2.3 Rutas eliminadas (no debe haber pagos ni recupero de contraseña de agremiados)
- [ ] ⚠️ `/perfil/checkout` **ya no existe** → devuelve la **página 404 personalizada** (no hay pagos ni membresías premium).
- [ ] ⚠️ `/recuperar-password` **ya no existe** → devuelve la **página 404 personalizada** (el login de agremiados es solo por DNI contra el padrón).

---

## 3. Credencial digital, QR y verificación pública

### 3.1 QR del carnet (en `/perfil`)
- [ ] El QR grande de verificación se ve a ~240px, negro sobre blanco, con margen. ✅ Se escanea sin esfuerzo desde un celular.
- [ ] El QR chico dentro de la tarjeta también apunta a la verificación. ✅
- [ ] La URL del QR **no** contiene el DNI ni la matrícula legibles (token cifrado opaco). ✅

### 3.2 Página pública de verificación (`/verificar/[token]`)
- [ ] Escanear el QR de un agremiado activo → **"Credencial Válida"** (verde). ✅ Verifica en vivo contra el padrón.
- [ ] Identificador principal = **matrícula**; si no tiene matrícula, muestra el **DNI enmascarado**. ✅
- [ ] El DNI siempre se muestra enmascarado con formato `12.34X.XXX` (primeros 4 dígitos). ✅ Nunca aparece completo.
- [ ] Muestra fecha/hora de verificación. ✅
- [ ] ⚠️ Token manipulado/incompleto → "Enlace inválido".
- [ ] ⚠️ DNI que no figura en el padrón → "Credencial Inválida".
- [ ] ⚠️ Padrón caído → "No se pudo verificar" (ámbar), con los datos del token.
- [ ] La página no se indexa (meta robots noindex). ✅
- [ ] **Tracking de escaneo**: cada verificación suma en "Escaneos de credencial" de `/admin/stats` (guarda sólo ok/fecha, sin datos personales). ✅

### 3.3 Descarga del cupón en PDF (`/beneficio/[slug]`, agremiado logueado)
- [ ] Botón "Descargar mi cupón" genera un PDF A4. ✅
- [ ] El PDF incluye: datos del beneficio (nombre, descuento, comercio, rubro, ubicación, condiciones, vigencia). ✅
- [ ] Incluye datos del beneficiario: nombre, matrícula y **DNI enmascarado** (`12.34X.XXX`). ✅
- [ ] Incluye el **QR de verificación** (abre `/verificar/[token]`). ✅
- [ ] Incluye el **código de barras Code128** con la matrícula (lo lee un lector). ✅
- [ ] Las librerías (jsPDF / JsBarcode) se cargan sólo al tocar "Descargar" (no afectan la carga inicial). ✅ Verificar en la pestaña Network.
- [ ] ⚠️ Usuario sin sesión → la sección muestra "Iniciá sesión…" con botón a `/login`.
- [ ] Botón "Verificar DNI" (tarjeta bloqueada, sin login) → navega a `/login`. ✅ (Antes no hacía nada.)

---

## 4. Panel de comercios (locales adheridos)

### 4.1 Login del local (`/comercios`)
- [ ] Ingresar usuario y contraseña del local (creados desde admin → Beneficios → acceso del local). ✅ Entra a `/comercios/panel`.
- [ ] ⚠️ Credenciales incorrectas → error.
- [ ] ⚠️ Acceso desactivado desde admin → no permite ingresar.

### 4.2 Panel del local (`/comercios/panel`)
- [ ] Buscar/validar un agremiado por DNI. ✅ Muestra si es agremiado válido (en vivo contra el padrón).
- [ ] Registrar el uso del beneficio (canje). ✅ Queda registrado y suma en las estadísticas de cupones.
- [ ] ⚠️ DNI inválido o no agremiado → mensaje claro, no permite registrar.
- [ ] `/validar-cupon` redirige al portal de comercios. ✅

---

## 5. Panel de administración (`/admin`)

- [ ] **Smoke general**: logueado como admin, abrir **cada** ruta `/admin/*` (stats, slides, galeria, benefits, benefits/nuevo, benefits/[id]/editar, sponsors, ai, chats, users, cupones, suggestions, popup, campana, admins) y verificar que **carga sin error** (sin 500 ni pantalla en blanco). ⚠️ Clave: el build/SSG no ejecuta estas rutas (están detrás de auth), así que un error de runtime solo se ve entrando de verdad.
- [ ] **Confirmaciones de borrado**: TODA acción destructiva pide confirmación **con el nombre del elemento** ("¿Eliminar '…'? Esta acción no se puede deshacer"): beneficio, slide, foto de galería, sponsor, sugerencia (nombre de la persona), conversación del chatbot (fecha), y **"Quitar acceso" del comercio** (que antes no confirmaba). ⚠️ Cancelar en el diálogo no borra nada.

### 5.1 Acceso y seguridad
- [ ] `/admin/login` con usuario/contraseña admin válidos → entra al panel. ✅ Sesión firmada (HMAC), dura 7 días.
- [ ] ⚠️ Contraseña incorrecta → error, sin revelar si el usuario existe.
- [ ] ⚠️ Acceder a cualquier `/admin/*` sin sesión admin → redirige a login.
- [ ] `/admin/logout` cierra la sesión de admin. ✅
- [ ] Un usuario "member" (no admin) no puede entrar al panel. ⚠️ Redirige a login.

### 5.2 Estadísticas (`/admin/stats`)
- [ ] Tarjetas con **rótulos corregidos**: "Agremiados registrados" (aclara que no es el padrón total), "Beneficios publicados" (con borradores/destacados como subtítulo), "Agremiados activos" (últimos 30 días), "Chats del asistente". ✅ Números coherentes.
- [ ] Fila de engagement: "Suscriptores push", "Sugerencias nuevas", "Comercios por revisar", "Altas este mes". ✅
- [ ] Panel **"Salud del catálogo"**: publicados, borradores, por vencer (30 días), con PDF, con ubicación en el mapa. ✅
- [ ] Panel **"Altas de agremiados"** (mini-gráfico de 6 meses). ✅
- [ ] Panel **"Sugerencias recibidas"** con desglose por tipo. ✅
- [ ] Tarjetas de cupones: Generados, Usados, Activos, Tasa de Canje. ✅
- [ ] Gráfico "Canjes de Cupones" (últimos 7 días). ✅ Con datos dibuja la curva; **sin canjes muestra estado vacío amable**.
- [ ] Texto pluraliza: "1 canje esta semana" / "N canjes esta semana". ✅
- [ ] "Beneficios más usados": con datos muestra ranking; **sin datos muestra mensaje amable**. ✅
- [ ] **Tracking**: tarjetas "Vistas de beneficios", "Descargas de PDF" y "Escaneos de credencial" (válidas / últimos 7 días), y ranking **"Beneficios más vistos"**. ✅ Empiezan en 0 y suben con el uso real.
- [ ] Reportes CSV (Agremiados, Beneficios, Cupones, Auditoría de Chats) descargan correctamente. ✅

### 5.3 Carrusel Hero (`/admin/slides`)
- [ ] Crear un slide (imagen desktop/mobile, título, subtítulo, botón, link). ✅ Aparece en la home.
- [ ] Editar un slide. ✅ Cambios reflejados.
- [ ] Activar/desactivar un slide. ✅ El inactivo no se muestra en la home.
- [ ] Reordenar slides (arrastrar). ✅ El orden se respeta en la home.
- [ ] ⚠️ Eliminar un slide (acción destructiva) → pide confirmación y no se puede deshacer.

### 5.4 Galería de Fotos (`/admin/galeria`)
- [ ] Botón "Añadir Foto" abre el panel con ícono "+". ✅
- [ ] Con el panel abierto, el botón dice **"Cerrar panel" con ícono ✕** (no "+"). ✅
- [ ] Subir una foto (con título). ✅ Aparece en la galería de la home.
- [ ] Editar / activar / desactivar una foto. ✅
- [ ] Reordenar fotos (arrastrar). ✅
- [ ] ⚠️ Eliminar una foto (destructiva) → pide confirmación.
- [ ] Estado vacío: sin fotos muestra mensaje amable. ✅

### 5.5 Beneficios (`/admin/benefits`)
- [ ] Lista los beneficios propios. ✅
- [ ] **Filtros por categoría y ubicación** (mismas opciones que el sitio) combinables con búsqueda y estado. ✅
- [ ] Búsqueda por título/resumen/descripción. ✅
- [ ] Filtro de estado (Todos / Activos / Borradores). ✅
- [ ] Línea **"Mostrando X de N beneficios"** refleja el filtrado. ✅
- [ ] Botón "Limpiar filtros" resetea todo. ✅
- [ ] Cualquier cambio de filtro vuelve a la página 1. ✅
- [ ] Paginación de 25 por página. ✅
- [ ] Toggle Activo/Borrador por beneficio. ✅ El borrador no se ve en el sitio público.
- [ ] **Reordenar (drag & drop)** desde el tirador de la fila: define el orden del listado público. ✅ El nuevo orden se refleja en `/beneficios`.
- [ ] Beneficios sin orden asignado quedan al final (como hasta ahora). ✅
- [ ] ⚠️ Con filtros activos, el drag se **deshabilita** y aparece el aviso "Limpiá los filtros para reordenar".
- [ ] Botón "Enviar notificación push" del beneficio → pide confirmación y envía a los suscriptos. ✅ Reporta enviadas/total.
- [ ] Acceso del local (ícono llave): crear/actualizar usuario y contraseña del comercio. ✅
- [ ] ⚠️ Usuario de local ya tomado por otro comercio → error 409.
- [ ] Activar/Desactivar y "Quitar acceso" del local. ✅
- [ ] ⚠️ Eliminar un beneficio (destructiva) → pide confirmación, borra permanentemente.
- [ ] Estado vacío contextual: sin resultados por filtro vs. sin beneficios creados. ✅

### 5.6 Crear beneficio (`/admin/benefits/nuevo`)
- [ ] Completar título, contacto (WhatsApp/Instagram/dirección). ✅
- [ ] **Badge de descuento** se autogenera desde el select de oferta ("20%" → "20% de descuento") y queda de sólo lectura. ✅
- [ ] Checkbox "Personalizar texto" habilita editar el badge manualmente. ✅
- [ ] ⚠️ Con texto personalizado cuyo % no coincide con la oferta → advertencia sutil.
- [ ] Categoría, ubicación, oferta. ✅
- [ ] **Editor de descripción (WYSIWYG)**: la barra permite negrita, itálica, listas y enlaces; el texto se ve con formato. ✅
- [ ] **WYSIWYG sin entidades literales**: escribir texto con **negrita + cursiva**, una **lista** y un **link**, guardar y abrir la ficha pública → el texto se ve bien; **NO** aparecen entidades literales como `&nbsp;`, `&amp;nbsp;` ni `&amp;`. ✅ (Los espacios duros del editor se normalizan a espacios normales.)
- [ ] **Sanitización (seguridad)**: pegar/guardar algo con `<script>alert(1)</script>` u `onclick`/`javascript:` → al guardar y renderizar **se elimina** (no ejecuta nada, no queda el tag). ✅ Sólo sobreviven negrita, itálica, listas y enlaces http/https.
- [ ] **Imágenes del beneficio (galería unificada)**: subir varias fotos (hasta 10) y marcar una como **Principal (★)**; se optimizan a WebP. ✅
- [ ] La foto Principal alimenta desktop y mobile por defecto; la **vista previa con marco** (16:9 desktop / vertical mobile) muestra cómo se recorta. ✅
- [ ] **Desktop y mobile distintas**: activar "Usar otra imagen para mobile" (y/o desktop) y elegir/subir otra imagen; la previa refleja cada formato. ✅
- [ ] "Documentación adicional (PDF)" está en **su propia sección**, separada de las imágenes. ✅
- [ ] **Vigencia y condiciones (opcionales)**: sección con fecha de vencimiento (date) y condiciones (textarea), **vacías por defecto**. Si se dejan vacías, no se muestran en la ficha ni en el PDF; si se cargan, sí. ✅
- [ ] Ubicación en el mapa (coordenadas) y dirección. ✅
- [ ] Previsualización en vivo (desktop + mobile) refleja los cambios. ✅
- [ ] **Barra de guardado sticky**: al pie del viewport, siempre visible mientras se scrollea; muestra Guardar + Cancelar y el indicador **"• Cambios sin guardar"** cuando se edita algo. ✅ No tapa contenido; funciona en mobile.
- [ ] Guardar → aparece en el catálogo con aviso "creado exitosamente". ✅
- [ ] ⚠️ Campos obligatorios vacíos → validación (título, resumen, descripción mínimos).

### 5.7 Editar beneficio (`/admin/benefits/[id]/editar`)
- [ ] Carga los datos actuales del beneficio (incluida la descripción con formato en el editor). ✅
- [ ] Si el resumen guardado no coincide con el autogenerado, arranca en modo "personalizar texto" (no pisa el texto). ✅
- [ ] **Vigencia y condiciones**: se precargan con lo que tenga el beneficio (la fecha, sin el prefijo interno de borrador). Vaciarlas y guardar → dejan de mostrarse en la ficha/PDF. ✅
- [ ] **Compatibilidad imágenes**: un beneficio con desktop y mobile **distintas** las carga bien (mobile aparece como override) y, al guardar sin tocar nada, **las conserva intactas**. ✅
- [ ] Editar la galería (conserva las existentes, permite agregar/quitar y cambiar la Principal). ✅
- [ ] Editar/quitar el PDF de documentación. ✅
- [ ] **Barra de guardado sticky** con indicador de cambios sin guardar (igual que en crear). ✅
- [ ] Guardar refleja los cambios en el sitio. ✅

### 5.8 Sponsors (`/admin/sponsors`)
- [ ] Crear sponsor (nombre, link, logo, posición/tamaño en la grilla). ✅
- [ ] Editar / reordenar. ✅ La grilla de la home respeta posiciones.
- [ ] ⚠️ Eliminar sponsor (destructiva) → confirmación.

### 5.9 Asistente IA (`/admin/ai`)
- [ ] Editar avatar, WhatsApp, tono, instrucciones, base de conocimientos, saludo y CTA. ✅ Guardar aplica al chatbot público.
- [ ] Historial de conversaciones auditadas se lista. ✅
- [ ] Ver el detalle de una conversación (`/admin/chats/[id]`). ✅
- [ ] ⚠️ Eliminar una conversación (destructiva) → confirmación, no se puede deshacer.

### 5.10 Agremiados (`/admin/users`)
- [ ] Lista de agremiados registrados en el portal. ✅
- [ ] "Consultar padrón por DNI" busca en vivo en el padrón oficial. ✅ Muestra los datos del padrón.
- [ ] ⚠️ DNI inexistente → mensaje "no figura".

### 5.11 Cupones (`/admin/cupones`)
- [ ] Lista de cupones generados por los agremiados. ✅
- [ ] Filtro por estado (todos / activos / usados). ✅
- [ ] Búsqueda por beneficiario/beneficio. ✅
- [ ] Métricas de canje coinciden con Estadísticas. ✅

### 5.12 Sugerencias (`/admin/suggestions`)
- [ ] Lista de sugerencias/dudas enviadas desde el sitio. ✅
- [ ] Cambiar estado de una sugerencia. ✅
- [ ] ⚠️ Eliminar una sugerencia (destructiva) → confirmación.

### 5.13 Popup Inicial (`/admin/popup`)
- [ ] Configurar título, descripción, imagen, texto y enlace del botón, activar/desactivar. ✅
- [ ] Con popup activo, aparece en la home. ✅

### 5.14 Campaña Inicio (`/admin/campana`)
- [ ] Configurar tag, emoji, título, subtítulo y beneficios de la campaña; activar/desactivar. ✅
- [ ] Con campaña activa, la sección aparece en la home. ✅

### 5.15 Administradores (`/admin/admins`)
- [ ] Registrar un nuevo administrador (nombre, usuario, correo opcional, contraseña inicial ≥ requerida). ✅
- [ ] Cambiar la contraseña de un admin. ✅
- [ ] ⚠️ El sistema no debe permitir quedarse sin ningún administrador.

---

## 6. Casos borde, permisos y seguridad

- [ ] Todas las acciones de `/admin/*` rechazan peticiones sin rol admin (403). ✅
- [ ] Las acciones de comercios validan la sesión del local. ✅
- [ ] El token de verificación (`/verificar`) no es adivinable ni enumerable (cifrado AES-GCM). ✅
- [ ] El DNI nunca viaja completo al cliente en la verificación ni en el PDF. ✅
- [ ] Cookies de sesión `httpOnly` y `sameSite=lax`. ✅
- [ ] Rate limit del login activo. ✅
- [ ] Subida de imágenes/PDF: sólo formatos esperados; archivos grandes se optimizan. ✅
- [ ] **Descripción de beneficios sanitizada** en servidor al guardar Y al renderizar (whitelist: negrita, itálica, listas, enlaces http/https). ⚠️ `<script>`, eventos y `javascript:` se eliminan; nunca se ejecuta HTML del usuario. ✅
- [ ] Con el padrón caído, el sitio sigue operativo (fallback local) y no rompe. ✅

---

## 7. Responsive, impresión y accesibilidad

- [ ] Todas las páginas se ven bien en celular (sin scroll horizontal). ✅
- [ ] La credencial y el PDF se imprimen prolijos en A4. ✅
- [ ] Imágenes con `alt`, botones alcanzables por teclado. ✅
- [ ] Textos en español rioplatense, sin cortes ni "undefined". ✅

---

## 8. Múltiples descuentos, voucher, historial y contacto (release actual)

**Múltiples descuentos (form):**
- [ ] En **Crear/Editar beneficio**, la sección **Descuentos** permite agregar/quitar filas (% + condición). El primero figura como **Principal**. ✅
- [ ] Guardar un beneficio con **un solo** descuento funciona; guardarlo con **varios** también. ✅
- [ ] Un beneficio **viejo** (cargado antes de esta versión) se abre en Editar mostrando su descuento actual como primera fila (sin migración manual). ✅

**Visualización del descuento (formato compacto):**
- [ ] **Badge** de la tarjeta: 1 descuento → "20%"; 2 → "20/25%"; 3+ o muy largo → "Hasta 25%". ✅
- [ ] **Chip / cuerpo**: muestra todos los porcentajes ("5% / 20%"). ✅
- [ ] Mismo criterio en **listado**, **home**, **popup del mapa** y **ficha del beneficio**. ✅
- [ ] En la **ficha**, el cuerpo lista **cada descuento con su condición** (ej. "20% — lunes a jueves"). ✅

**PDF del cupón (voucher):**
- [ ] Descargar el cupón de un beneficio de **1 descuento**: el PDF muestra el descuento, el resumen (si aporta), condiciones y vigencia. ✅
- [ ] Descargar el cupón de un beneficio de **varios descuentos**: aparecen **todos con su condición**. ✅
- [ ] Con **condiciones largas**, el PDF sigue prolijo en **A4** (tipografía menor, sin cortar palabras; si no entra, pasa a una hoja nueva). ✅

**Historial de descargas (/perfil):**
- [ ] Al descargar un cupón logueado, aparece en **"Mi Historial de Descargas"**: beneficio (con **link** a la ficha), **fecha**, **código de canje** y **estado** (Activo/Usado/Vencido). ✅
- [ ] Orden **más reciente primero**. Si no hay descargas, muestra el vacío. ✅

**Contacto en /register:**
- [ ] El aviso de registro deshabilitado muestra **"Para consultas sobre tu agremiación escribí a info@amepla.org.ar"** con enlace **mailto**. ✅

---

## 9. Vencimiento, hero, métricas y perfil (release actual)

**Vencimiento de beneficios (validez por fecha, hora Argentina):**
- [ ] Beneficio **sin** fecha de vigencia: se comporta como siempre (no vence). ✅
- [ ] Beneficio con vigencia **futura**: aparece normal en listados y se puede descargar. ✅
- [ ] Beneficio **vencido** (fecha pasada): NO aparece en listado, home, buscador, sugerencias del mapa, similares ni chatbot. ✅
- [ ] La **ficha del vencido** sigue accesible por URL, con banner **"Este beneficio venció el [fecha]"** y **sin** botón de descarga. ✅
- [ ] Intentar generar el **PDF/cupón de un vencido** (con la URL guardada) se **bloquea en el server**. ⚠️ ✅
- [ ] En el **admin**, los vencidos SÍ se ven, con badge **"Vencido"**, y el filtro de estado **"Vencidos"** los lista. ✅
- [ ] El día exacto de la fecha de vigencia el beneficio **todavía es válido** (vence al día siguiente). ✅

**Hero de la ficha (imagen protagonista):**
- [ ] La imagen ocupa **todo el ancho** del hero (object-cover, altura generosa), con el **descuento** (esquina) y la **categoría** superpuestos y legibles (scrim). ✅
- [ ] Funciona con imágenes **horizontales y verticales**; en mobile usa la imagen mobile a ancho completo. ✅
- [ ] En "Información del comercio" **ya no está** el badge "Del comercio". ✅

**Métricas por beneficio (admin):**
- [ ] En `/admin/benefits` cada fila muestra **Vistas**, **Cupones** y **PDF**. ✅
- [ ] "Beneficios más vistos" en `/admin/stats` muestra **10** y **"Ver todos"** lleva a `/admin/benefits` **ordenado por vistas** (`?sort=views`). ✅
- [ ] Nota: los **escaneos NO** se muestran por beneficio (son por credencial). ✅

**Perfil del agremiado:**
- [ ] El **DNI** figura como **solo lectura** (no editable) y la **Matrícula** es editable. ✅
- [ ] El **Email** es editable y validado; un email ya usado por otra cuenta avisa sin romper. ⚠️ ✅
- [ ] Ya **no** se muestra la "Fecha de Creación" de la cuenta. ✅

---

## 10. Cierre y entrega
- [ ] Barrido de datos de prueba: sin beneficios TEST, sin Lorem Ipsum, sin cupones/chats/sugerencias de prueba, sin datos personales del desarrollador (Instagram, direcciones).
- [ ] Lighthouse en producción: home y una ficha de beneficio, performance ≥ 90 mobile.
- [ ] Env vars de producción documentadas (nombre y propósito, sin valores).
- [ ] MANUAL-ADMIN.md revisado por humano y exportado para el cliente.
- [ ] Video de recorrido del panel grabado.
- [ ] Definido quién queda como admin y a qué mail van las notificaciones.
