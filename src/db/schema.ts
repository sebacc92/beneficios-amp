import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// --- Settings & AI ---
export const siteSettings = sqliteTable("site_settings", {
  id: integer("id").primaryKey(), // We only use id = 1
  aiEnabled: integer("ai_enabled", { mode: "boolean" }).notNull().default(true),
  aiTone: text("ai_tone"),
  aiInstructions: text("ai_instructions"),
  aiKnowledge: text("ai_knowledge"),
  aiInitialGreeting: text("ai_initial_greeting"),
  aiCallToAction: text("ai_call_to_action"),
  whatsappNumber: text("whatsapp_number"),
  aiAvatarUrl: text("ai_avatar_url"),
  popupActive: integer("popup_active", { mode: "boolean" }).default(false),
  popupTitle: text("popup_title"),
  popupDescription: text("popup_description"),
  popupImageUrl: text("popup_image_url"),
  popupButtonText: text("popup_button_text"),
  popupButtonLink: text("popup_button_link"),
  campaignActive: integer("campaign_active", { mode: "boolean" }).default(true),
  campaignTitle: text("campaign_title"),
  campaignSubtitle: text("campaign_subtitle"),
  campaignEmoji: text("campaign_emoji"),
  campaignTag: text("campaign_tag"),
  campaignQuery: text("campaign_query"),
  campaignBenefitIds: text("campaign_benefit_ids"),
  updatedAt: text("updated_at"), // Store ISO timestamps as string for full edge-compatibility
});

// --- Chat Sessions ---
export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(), // ISO Date strings
  lastActive: text("last_active").notNull(), // ISO Date strings
});

// --- Chat Messages ---
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .references(() => chatSessions.id)
    .notNull(),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(), // ISO Date strings
});

// --- User Management & Session Auth ---
// La fuente de verdad de los agremiados es el padrón de la AMP (web service,
// consulta por DNI). Esta tabla es la copia local: admins + agremiados que ya
// ingresaron al portal (se crean/actualizan solos en cada login).
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").unique(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  matricula: text("matricula"), // legacy: histórico guardaba el DNI acá
  dni: text("dni").unique(),
  padronId: integer("padron_id"), // "identificador" del padrón de la AMP
  origen: text("origen"), // p.ej. "AGREMIADO" según el padrón
  lastSyncedAt: text("last_synced_at"), // última sincronización con el padrón
  role: text("role", { enum: ["admin", "member"] }).default("member").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull(),
});

// --- Custom Benefits (CRUD) ---
export const customBenefits = sqliteTable("custom_benefits", {
  id: text("id").primaryKey(),
  titulo: text("titulo").notNull(),
  resumen: text("resumen").notNull(),
  descripcion: text("descripcion").notNull(),
  imagen: text("imagen"),
  imagenMobile: text("imagen_mobile"),
  galeria: text("galeria"), // JSON array of extra image URLs (gallery)
  slug: text("slug").unique().notNull(),
  isFeatured: integer("is_featured", { mode: "boolean" }).default(false).notNull(),
  categoryId: integer("category_id").notNull(),
  locationId: integer("location_id").notNull(),
  offerId: integer("offer_id").notNull(),
  couponCode: text("coupon_code"),
  validUntil: text("valid_until"),
  terms: text("terms"),
  pdfUrl: text("pdf_url"),
  latitud: text("latitud"),
  longitud: text("longitud"),
  // NOTA: los contadores `views` y `pdf_downloads` viven en esta tabla pero se
  // manejan por SQL crudo (ver ensureTrackingSchema / bumpBenefitCounter en
  // server/cache.ts). No se declaran acá a propósito: si estuvieran en el schema,
  // todos los select().from(customBenefits) intentarían leerlos y fallarían hasta
  // que corra el ALTER que los crea en runtime.
  createdAt: text("created_at").notNull(),
});

// --- Escaneos de verificación de credencial (contador de eventos, sin PII) ---
// Se crea en runtime (ensureTrackingSchema). Sólo se consulta desde /admin/stats.
export const credentialScans = sqliteTable("credential_scans", {
  id: text("id").primaryKey(),
  ok: integer("ok", { mode: "boolean" }).notNull(), // true = credencial válida
  createdAt: text("created_at").notNull(), // ISO Date String
});

// --- News / Announcements ---
export const news = sqliteTable("news", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  image: text("image"),
  isPublished: integer("is_published", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").notNull(),
});

// --- Advertising Banners ---
export const banners = sqliteTable("banners", {
  id: text("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  orderIndex: integer("order_index").default(0).notNull(),
});

// --- Sponsors Modular Grid ---
export const sponsors = sqliteTable("sponsors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  x: integer("x").default(0).notNull(), // Starting column (0 to 5)
  y: integer("y").default(0).notNull(), // Starting row (0+)
  w: integer("w").default(2).notNull(), // Width span (1 to 6)
  h: integer("h").default(2).notNull(), // Height span (1+)
  createdAt: text("created_at").notNull(),
});

// --- Hero Slides ---
export const heroSlides = sqliteTable("hero_slides", {
  id: text("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  buttonText: text("button_text"),
  buttonLink: text("button_link"),
  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: text("created_at").notNull(),
  preTitle: text("pre_title"),
  imageMobile: text("image_mobile"),
  isActive: integer("is_active").default(1).notNull(),
  // srcset responsive: string completo "url-480w 480w, url-768w 768w".
  // image_srcset = variantes desktop; image_mobile_srcset = variantes mobile.
  imageSrcset: text("image_srcset"),
  imageMobileSrcset: text("image_mobile_srcset"),
});

// --- Merchant Club Applications ---
export const merchantRequests = sqliteTable("merchant_requests", {
  id: text("id").primaryKey(),
  businessName: text("business_name").notNull(),
  category: text("category").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  proposal: text("proposal").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: text("created_at").notNull(),
});

// --- Local Access (credenciales de login del local, atadas a un beneficio) ---
// Se guardan aparte de custom_benefits para sobrevivir a la sincronización con
// la API de AMP (que borra/reinserta los beneficios). La unión es por slug,
// que es estable entre sincronizaciones.
export const merchants = sqliteTable("merchants", {
  id: text("id").primaryKey(),
  benefitSlug: text("benefit_slug").unique().notNull(), // beneficio = local
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").notNull(),
});

// --- Web Push: suscripciones de notificaciones ---
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id"), // agremiado suscripto (si está logueado)
  endpoint: text("endpoint").unique().notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: text("created_at").notNull(),
});

// --- Web Push: última notificación enviada (la lee el Service Worker) ---
export const pushMessages = sqliteTable("push_messages", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  url: text("url").notNull(),
  createdAt: text("created_at").notNull(),
});

// --- Sugerencias / Contacto (formulario público de sugerencias) ---
export const suggestions = sqliteTable("suggestions", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull(),
  telefono: text("telefono"),
  tipo: text("tipo").notNull(), // "Sugerir Comercio" | "Problema Comercio" | "Consulta General" | "Otro"
  comercio: text("comercio"),
  mensaje: text("mensaje").notNull(),
  status: text("status", { enum: ["nuevo", "leido", "resuelto"] }).default("nuevo").notNull(),
  createdAt: text("created_at").notNull(), // ISO Date String
});

// --- Photo Gallery ---
export const galleryImages = sqliteTable("gallery_images", {
  id: text("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  title: text("title"),
  orderIndex: integer("order_index").default(0).notNull(),
  isActive: integer("is_active").default(1).notNull(),
  createdAt: text("created_at").notNull(),
});

// --- Sorteos (Raffles) ---
export const raffles = sqliteTable("raffles", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(), // HTML sanitizado (RichTextEditor)
  prizes: text("prizes").notNull(), // JSON array de strings: ["Premio 1", "Premio 2", ...]
  imageUrl: text("image_url").notNull(), // Desktop
  imageMobile: text("image_mobile"), // Mobile (opcional, cae a imageUrl si no está)
  drawDate: text("draw_date").notNull(), // Fecha del sorteo (YYYY-MM-DD)
  terms: text("terms"), // Bases y condiciones (texto plano)
  winnerName: text("winner_name"), // Se completa manualmente al finalizar
  isActive: integer("is_active").default(1).notNull(), // 1 = vigente, 0 = finalizado
  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: text("created_at").notNull(),
});

// --- Coupon System ---
export const coupons = sqliteTable("coupons", {
  id: text("id").primaryKey(),
  code: text("code").unique().notNull(), // Unique 6-digit code e.g. "839105"
  benefitId: text("benefit_id").notNull(),
  benefitTitle: text("benefit_title").notNull(),
  benefitResumen: text("benefit_resumen").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userMatricula: text("user_matricula"),
  status: text("status", { enum: ["active", "used", "expired"] }).default("active").notNull(),
  createdAt: text("created_at").notNull(), // ISO Date String
  usedAt: text("used_at"), // ISO Date String
});


