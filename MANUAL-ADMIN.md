# Manual del Panel de Administración — Club de Beneficios AMP+

Guía práctica para administrar el portal de beneficios de la **Agremiación Médica Platense**.
Está pensada para personas sin conocimientos técnicos: te explica **qué es cada sección, para qué sirve y cómo hacer las tareas más comunes**.

> 🔴 **Atención:** los pasos marcados con este color son **acciones que no se pueden deshacer** (borran información de forma permanente). Leelos con cuidado antes de confirmar.

---

## Índice

1. [Cómo entrar al panel](#1-cómo-entrar-al-panel)
2. [Estadísticas](#2-estadísticas)
3. [Carrusel Hero (imágenes grandes del inicio)](#3-carrusel-hero)
4. [Galería de Fotos](#4-galería-de-fotos)
5. [Beneficios](#5-beneficios) · [Crear](#51-crear-un-beneficio) · [Editar](#52-editar-un-beneficio) · [Acceso del local](#53-dar-acceso-a-un-comercio)
6. [Sponsors](#6-sponsors)
7. [Asistente IA (chatbot)](#7-asistente-ia)
8. [Agremiados](#8-agremiados)
9. [Cupones](#9-cupones)
10. [Sugerencias](#10-sugerencias)
11. [Popup Inicial](#11-popup-inicial)
12. [Campaña Inicio](#12-campaña-inicio)
13. [Administradores](#13-administradores)
14. [Preguntas frecuentes](#14-preguntas-frecuentes)

---

## 1. Cómo entrar al panel

1. Ingresá a **`/admin`** (por ejemplo `https://tusitio.com/admin`).
2. Escribí tu **usuario** y **contraseña** de administrador.
3. Vas a ver el menú lateral izquierdo con todas las secciones.

**Cerrar sesión:** botón al pie del menú lateral. La sesión se cierra sola después de un tiempo por seguridad.

> Si no tenés usuario de administrador, pedíselo a otra persona que ya sea admin (ver [Administradores](#13-administradores)).

---

## 2. Estadísticas

**Qué es:** la pantalla de inicio del panel. Muestra el "estado de salud" del club de un vistazo.

**Qué vas a ver:**
- **Agremiados registrados** (los que ya entraron al portal — *no* es el padrón total), **Agremiados activos** (ingresaron en los últimos 30 días), **Beneficios publicados** y **Chats del asistente**.
- **Engagement:** suscriptores a notificaciones push, **sugerencias nuevas** por leer, **comercios por revisar** (solicitudes) y **altas de agremiados este mes**.
- **Salud del catálogo:** cuántos beneficios están publicados, en borrador, **por vencer** (próximos 30 días), con PDF y con ubicación en el mapa.
- **Altas de agremiados** por mes (últimos 6 meses) y **sugerencias por tipo**.
- **Cupones**: generados, usados, activos y **tasa de canje** (qué porcentaje se usó), con un **gráfico** de los últimos 7 días y el ranking de **beneficios más usados**.
- **Uso real (tracking):** **vistas** de beneficios, **descargas de PDF**, **escaneos de credencial** y el ranking de **beneficios más vistos**.
- **Reportes descargables** en formato Excel/CSV.

**Cómo descargar un reporte:** hacé clic en cualquier botón de la columna "Reportes Descargables" (Agremiados, Beneficios, Cupones, Auditoría de Chats). Se baja un archivo `.csv` que abrís con Excel o Google Sheets.

> Las métricas de tracking (vistas, descargas, escaneos, más vistos) **empiezan en cero** y se van llenando a medida que la gente usa el sitio. Es normal que al principio estén vacías o bajas.

---

## 3. Carrusel Hero

**Qué es:** las imágenes grandes que rotan en la parte superior de la página de inicio.

**Cómo agregar un slide:**
1. Clic en **"Añadir"** / **"Nuevo slide"**.
2. Subí la **imagen de escritorio** y, si querés, una **imagen para celular** (se ve mejor en teléfonos).
3. Escribí el **título**, **subtítulo**, el **texto del botón** y el **enlace** al que lleva.
4. Guardá.

**Otras acciones:**
- **Activar/Desactivar:** un slide desactivado no se muestra en la home, pero no se borra.
- **Reordenar:** arrastrá las tarjetas para cambiar el orden en que aparecen.
- 🔴 **Eliminar:** borra el slide para siempre. El sistema te pide confirmar.

**Consejo:** usá imágenes horizontales y de buena calidad. Poné el texto importante en el título, no encima de la imagen.

---

## 4. Galería de Fotos

**Qué es:** la galería de imágenes que se muestra en la página principal (por ejemplo, fotos de eventos o del club).

**Cómo agregar una foto:**
1. Clic en **"Añadir Foto"** (botón verde con "+").
2. Se abre el panel de carga. Subí la imagen y poné un **título**.
3. Guardá con **"Agregar Foto"**.
4. Para cerrar el panel sin cargar nada, usá el botón **"Cerrar panel"** (✕).

**Otras acciones:**
- **Activar/Desactivar** una foto.
- **Reordenar** arrastrando las tarjetas.
- 🔴 **Eliminar** una foto es permanente (pide confirmación).

---

## 5. Beneficios

**Qué es:** el corazón del portal. Acá cargás y administrás los descuentos de los comercios adheridos.

**La lista:** muestra todos los beneficios propios. Arriba tenés herramientas para encontrarlos:
- **Buscador** por título.
- **Filtro por categoría** y **por ubicación** (las mismas opciones que ve el público).
- **Filtro por estado**: Todos / Activos / Borradores / **Vencidos**.
- La línea **"Mostrando X de N beneficios"** te dice cuántos quedan con los filtros puestos.
- Botón **"Limpiar filtros"** para volver a ver todo.
- La lista se pagina de a **25**.

**Métricas por beneficio (columnas de la tabla):**
- **Vistas:** cuántas veces se abrió la ficha del beneficio.
- **Cupones:** cuántos cupones generaron los agremiados para ese beneficio.
- **PDF:** cuántas veces se descargó el PDF del cupón.
- Comparando **Vistas** contra **Cupones** ves qué tan bien "convierte" cada beneficio (mucha vista y pocos cupones = quizás la oferta no engancha).
- Desde **Estadísticas → "Beneficios más vistos" → "Ver todos"** llegás a esta tabla **ordenada por vistas** (de mayor a menor).
> Los **escaneos de credencial** no se muestran por beneficio: se registran por credencial (en Estadísticas verás el total), no por comercio.

**Ordenar el listado (arrastrar):** cada fila tiene un **tirador** (⠿) a la izquierda. Arrastrá las filas para definir el **orden en que se ven en el sitio público**. Los beneficios que nunca ordenaste quedan al final.
> Para poder arrastrar tenés que **no** tener filtros puestos. Si hay filtros activos, el sistema te avisa "Limpiá los filtros para reordenar".

**Estado de cada beneficio (interruptor):**
- **Activo:** se ve en el sitio público.
- **Borrador:** queda guardado pero **no** se muestra al público. Útil para preparar un beneficio antes de publicarlo.

**Acciones por fila (íconos a la derecha):**
- 🔔 **Campana:** envía una **notificación push** de ese beneficio a todos los que la tengan activada. Pide confirmación.
- 🔑 **Llave:** administra el **acceso del comercio** (ver [5.3](#53-dar-acceso-a-un-comercio)).
- ✏️ **Lápiz:** editar el beneficio.
- 🔴 🗑️ **Tacho:** **elimina el beneficio de forma permanente.** Pide confirmación; no se puede recuperar.

### 5.1 Crear un beneficio

1. Clic en **"Crear Beneficio"**.
2. **Título** (nombre del comercio).
3. **Descripción detallada** con el **editor de texto**: usá la barra de arriba para poner **negrita**, **itálica**, **listas** y **enlaces**. Escribí las condiciones, aclaraciones, etc.
   > Por seguridad, el sistema sólo guarda esos formatos. Si pegás código u otras etiquetas raras, se limpian solas.
4. **Descuentos (uno o varios):** en la sección **"Descuentos"** cargás cada descuento en su fila:
   - El **número** (el porcentaje, ej. `20`) y, opcionalmente, la **condición** (ej. *"lunes a jueves"*, *"en efectivo"*, *"en mano de obra"*).
   - Clic en **"+ Agregar descuento"** para sumar filas. Ejemplos reales: **20% lunes a jueves** y **25% viernes a domingo**; o **5% en productos** y **20% en mano de obra**.
   - El **primero** es el **principal** (queda marcado como *Principal*): define el *badge* que se ve en las tarjetas y el filtro por descuento del listado. Para quitar una fila, usá la **×**.
   - No hace falta cargar el "resumen" a mano: el badge se arma **solo** con los porcentajes ("20% y 25%", o "Hasta 25%" si no entran; en la ficha se listan todos con su condición).
5. **Categoría** y **Ubicación**.
6. **Imágenes del beneficio:** subí las fotos (hasta **10**) y marcá una como **Principal** con la **estrella (★)**. Esa foto es la que se usa como imagen del beneficio.
   - En la **vista previa con marco** ves cómo se recorta en **escritorio (16:9)** y en **celular (vertical)**. Si aparece el aviso "se recortará", conviene una imagen con esa proporción.
   - ¿Querés una imagen distinta para el celular (o para escritorio)? Tildá **"Usar otra imagen para mobile"** (o para desktop) y elegí otra foto de la galería o subí una nueva.
   - Las fotos que no son la principal se muestran en el **carrusel** del beneficio.
7. **Documentación adicional (PDF, opcional):** más abajo, en su propia sección, podés subir una lista de precios, catálogo o bases y condiciones.
8. **Vigencia y condiciones (opcionales):** dos campos vacíos por defecto. La **fecha de vencimiento** y las **condiciones** (ej. "válido de lunes a viernes") **solo aparecen en la ficha y en el PDF si los cargás**. Si los dejás vacíos, no se muestran.
9. **Ubicación en el mapa:** marcá el punto o pegá las coordenadas para que aparezca el mapa.
10. Mirá la **previsualización en vivo** (cómo se verá en compu y en celular).
11. **Guardá** desde la **barra inferior fija** (siempre visible mientras scrolleás). Cuando hay cambios sin guardar, aparece el aviso **"• Cambios sin guardar"**. Aparece el aviso "creado exitosamente".

> Nota: antes todos los beneficios mostraban una vigencia y condiciones genéricas por defecto. Eso **ya no pasa**: si no cargás estos campos, no se muestra nada.

> ⏳ **Vencimiento automático:** si cargás una **fecha de vigencia**, el beneficio **se oculta solo** del sitio (listados, buscador, home, mapa y asistente) **a partir del día siguiente** a esa fecha — **no hace falta desactivarlo a mano**. La ficha sigue accesible por link, pero muestra un cartel de "beneficio vencido" y **no** deja descargar el cupón. En el panel, los vencidos **siguen visibles** con un badge **"Vencido"**; podés listarlos con el filtro de estado **"Vencidos"**. Sin fecha, el beneficio **no vence**.

> 🎟️ **El cupón (PDF) que descarga el agremiado incluye ahora**: todos los descuentos con su condición, el resumen, las **condiciones/términos** (inclusiones y exclusiones) y la vigencia. Por eso conviene cargar bien las **condiciones**: es lo que el comercio va a leer del voucher.

### 5.2 Editar un beneficio

1. En la lista, clic en el **lápiz** ✏️.
2. Cambiá lo que necesites (mismos campos que al crear). La descripción se abre en el **editor de texto** con el formato que ya tenía. La **vigencia y las condiciones** se muestran con lo que tenga cargado (o vacías si no tiene).
3. La galería mantiene las fotos que ya tenía; podés **agregar**, **quitar** o cambiar la **Principal (★)**.
4. **Guardá** desde la **barra inferior fija**; el aviso **"• Cambios sin guardar"** te recuerda si hay ediciones pendientes.

> Si un beneficio ya tenía **imágenes distintas para escritorio y celular**, se cargan tal cual (la de celular aparece como "otra imagen para mobile") y se conservan aunque guardes sin tocar nada.
> Si el resumen guardado no coincide con el que generaría la oferta, el formulario arranca en modo **"Personalizar texto"** para no pisar el texto que ya habías escrito.

### 5.3 Dar acceso a un comercio

Sirve para que cada **local** entre a su propio panel (`/comercios`) y registre los usos del descuento.

1. En la fila del beneficio, clic en la **llave** 🔑.
2. Escribí un **usuario** y una **contraseña** (mínimo 6 caracteres) para ese local.
3. Guardá con **"Crear acceso"**.
4. Entregale esas credenciales al comercio.

**Otras acciones:**
- **Actualizar:** cambiar el usuario o la contraseña (dejá la contraseña vacía para no cambiarla).
- **Activar/Desactivar:** cortar o restablecer el acceso sin borrarlo.
- 🔴 **Quitar acceso:** elimina las credenciales del local.

> ⚠️ Un mismo **usuario** no puede estar en dos locales distintos. Si aparece "ya está en uso", elegí otro.

---

## 6. Sponsors

**Qué es:** la grilla de logos de auspiciantes que se muestra en la home.

**Cómo agregar:** clic en "Nuevo", cargá **nombre**, **enlace** (a dónde lleva el logo) y el **logotipo**. Definí su **posición y tamaño** en la grilla.

**Otras acciones:** editar, reordenar y 🔴 **eliminar** (permanente, pide confirmación).

---

## 7. Asistente IA

**Qué es:** la configuración del **chatbot** que atiende a los visitantes del sitio.

**Qué podés configurar:**
- **Avatar** y **teléfono de WhatsApp** de consulta.
- **Tono** del asistente (formal, cercano, etc.).
- **Instrucciones operativas** y **base de conocimientos** (lo que el bot "sabe" del club).
- **Saludo inicial** y **llamado a la acción**.

**Historial:** más abajo ves las **conversaciones auditadas**. Podés abrir cada una para leerla.

> 🔴 **Eliminar una conversación** del historial es permanente.

**Qué sabe y qué NO hace el bot (ya viene configurado así):**
- **Conoce los beneficios reales**: puede recomendar por rubro, ubicación o nombre, decir cuáles son los destacados y **cuál es el último agregado**, con el enlace a cada ficha.
- **Tiene los datos de contacto reales** de la AMP (dirección, teléfonos, WhatsApp) y no los inventa.
- **Límites de seguridad (no se pueden saltear):** nunca da información de agremiados (cantidades, listados, datos personales ni si alguien está o no agremiado) ni datos internos del sistema. Ante esas preguntas se niega con amabilidad y deriva a la **Secretaría**.
- **Sólo habla de temas del club, la credencial y la AMP.** Si le preguntan otra cosa, redirige con cortesía.
- Habla en tono cordial rioplatense y, si no sabe algo, deriva al contacto oficial en vez de inventar.

**Consejo:** el **Tono**, las **Instrucciones** y la **base de conocimientos** ajustan cómo responde, pero los límites de seguridad de arriba se aplican siempre.

---

## 8. Agremiados

**Qué es:** el listado de agremiados que ya usaron el portal, más una herramienta para consultar el padrón.

**Consultar el padrón por DNI:** escribí un DNI y el sistema lo busca **en vivo** en el padrón oficial de la AMP, mostrándote los datos de esa persona. Sirve para verificar si alguien figura como agremiado.

> El alta y baja de agremiados se maneja desde el **padrón oficial**, no desde este panel.

---

## 9. Cupones

**Qué es:** el registro de todos los cupones que generaron los agremiados desde los beneficios.

**Qué podés hacer:**
- Ver la lista con su **estado** (activo / usado).
- **Filtrar** por estado y **buscar** por beneficiario o beneficio.
- Los números coinciden con lo que muestra **Estadísticas**.

---

## 10. Sugerencias

**Qué es:** los mensajes (dudas y sugerencias) que la gente envía desde el formulario público del sitio.

**Qué podés hacer:**
- Leer cada sugerencia.
- **Cambiar su estado** (por ejemplo, marcarla como atendida).
- 🔴 **Eliminar** una sugerencia (permanente).

---

## 11. Popup Inicial

**Qué es:** el cartel/aviso que aparece encima de la página de inicio cuando alguien entra.

**Cómo configurarlo:** cargá **título**, **descripción**, una **imagen**, el **texto y el enlace del botón**, y **activalo**. Con el popup activo, aparece en la home. Desactivalo cuando la promoción termine.

> Usalo para anuncios puntuales (una promo, un aviso importante). Si lo dejás siempre activo, pierde efecto.

---

## 12. Campaña Inicio

**Qué es:** una sección temática destacada en la home (por ejemplo, "Día de la Madre" o "Selección Gourmet").

**Cómo configurarla:** cargá el **tag** (etiqueta superior), un **emoji**, el **título**, el **subtítulo** y elegí los **beneficios** que la componen. **Activala** para que aparezca. Desactivala cuando la campaña termine.

---

## 13. Administradores

**Qué es:** la gestión de las personas que pueden entrar a este panel.

**Registrar un nuevo administrador:** completá **nombre**, **usuario**, **correo** (opcional) y una **contraseña inicial**. Entregale esos datos a la persona; que la cambie en su primer ingreso.

**Cambiar una contraseña:** desde la lista, usá la opción "Cambiar Contraseña" del admin correspondiente.

> 🔴 **Cuidado:** no elimines ni desactives tu propia cuenta si sos el único administrador; podrías quedarte sin acceso al panel. Asegurate de que siempre haya al menos un administrador activo.

---

## 14. Preguntas frecuentes

**Cargué un beneficio pero no aparece en el sitio.**
Fijate que su estado sea **Activo** (no "Borrador") en la lista de Beneficios.

**El comercio no puede entrar a su panel.**
Verificá en el beneficio (ícono 🔑) que el **acceso esté activo** y que el usuario/contraseña sean los correctos.

**Un agremiado dice que su credencial figura como inválida.**
La credencial se verifica **en vivo contra el padrón oficial**. Si el DNI no figura en el padrón, aparecerá como inválida. Consultá su DNI desde **Agremiados → Consultar padrón**.

**¿Puedo recuperar algo que borré?**
No. Las acciones marcadas con 🔴 (eliminar beneficios, fotos, slides, sponsors, sugerencias, conversaciones, y "Quitar acceso" de un comercio) son **permanentes**. Antes de borrar, el sistema **te pide confirmar mostrando el nombre** de lo que vas a eliminar ("¿Eliminar 'La Trattoria La Plata'? Esta acción no se puede deshacer"): leelo con atención. Ante la duda, **desactivá** en lugar de eliminar.

**Las notificaciones push no llegan.**
Sólo las reciben las personas que **activaron las notificaciones** desde su perfil. En iPhone, además, deben tener la app agregada a la pantalla de inicio.

**¿Por qué el DNI aparece tapado (12.34X.XXX)?**
Por privacidad. En la verificación pública y en el PDF, el DNI se muestra **enmascarado** a propósito. Es correcto que se vea así.
