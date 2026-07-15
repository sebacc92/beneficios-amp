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
- **Total de Agremiados**, **Beneficios**, **Beneficios Destacados** y **Chats Auditados**.
- **Cupones**: generados, usados, activos y **tasa de canje** (qué porcentaje se usó).
- Un **gráfico** de canjes de los últimos 7 días.
- **Beneficios más usados** (ranking).
- **Reportes descargables** en formato Excel/CSV.

**Cómo descargar un reporte:** hacé clic en cualquier botón de la columna "Reportes Descargables" (Agremiados, Beneficios, Cupones, Auditoría de Chats). Se baja un archivo `.csv` que abrís con Excel o Google Sheets.

> Si todavía no hay canjes, el gráfico y el ranking muestran un mensaje amable en vez de aparecer vacíos. Es normal al principio.

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
- **Filtro por estado**: Todos / Activos / Borradores.
- La línea **"Mostrando X de N beneficios"** te dice cuántos quedan con los filtros puestos.
- Botón **"Limpiar filtros"** para volver a ver todo.
- La lista se pagina de a **25**.

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
2. **Título** (nombre del comercio) y **descripción detallada** (condiciones, dirección, etc.).
3. **Descuento:** elegí la **oferta** en el desplegable. El campo **"Resumen (badge)"** se completa **solo** ("20%" → "20% de descuento").
   - Si querés un texto distinto, tildá **"Personalizar texto"** y escribilo a mano.
   - ⚠️ Si el texto que escribís dice un porcentaje diferente al de la oferta, aparece una **advertencia** para que revises.
4. **Categoría**, **Ubicación** y **Oferta**.
5. **Imágenes:** subí la de **escritorio** (formato horizontal 16:9) y, opcionalmente, una de **celular**. Podés marcar "usar la misma de escritorio".
6. **Galería (opcional):** sumá hasta **9 fotos adicionales** que se ven en un carrusel dentro del beneficio.
7. **PDF (opcional):** subí una lista de precios, menú o bases y condiciones.
8. **Ubicación en el mapa:** marcá el punto o pegá las coordenadas para que aparezca el mapa.
9. Mirá la **previsualización en vivo** (cómo se verá en compu y en celular).
10. Guardá. Aparece el aviso "creado exitosamente".

### 5.2 Editar un beneficio

1. En la lista, clic en el **lápiz** ✏️.
2. Cambiá lo que necesites (mismos campos que al crear).
3. La galería mantiene las fotos que ya tenía; podés **agregar** o **quitar** fotos.
4. Guardá.

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

**Consejo:** cuanto más clara y completa sea la base de conocimientos, mejores respuestas da el bot.

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
No. Las acciones marcadas con 🔴 (eliminar beneficios, fotos, slides, sponsors, sugerencias, conversaciones) son **permanentes**. Ante la duda, **desactivá** en lugar de eliminar.

**Las notificaciones push no llegan.**
Sólo las reciben las personas que **activaron las notificaciones** desde su perfil. En iPhone, además, deben tener la app agregada a la pantalla de inicio.

**¿Por qué el DNI aparece tapado (12.34X.XXX)?**
Por privacidad. En la verificación pública y en el PDF, el DNI se muestra **enmascarado** a propósito. Es correcto que se vea así.
