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
  updatedAt: text("updated_at"),
});

// --- Chat Sessions ---
export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  lastActive: text("last_active").notNull(),
});

// --- Chat Messages ---
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .references(() => chatSessions.id)
    .notNull(),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

// --- User Management & Session Auth ---
// `passwordHash` is required for admins. For members it can be a random placeholder
// because members authenticate by DNI (matricula) rather than password.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  matricula: text("matricula"),
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
  createdAt: text("created_at").notNull(),
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

// --- Events Schedule ---
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: text("date").notNull(),
  location: text("location").notNull(),
  image: text("image"),
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
  x: integer("x").default(0).notNull(),
  y: integer("y").default(0).notNull(),
  w: integer("w").default(2).notNull(),
  h: integer("h").default(2).notNull(),
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
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
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

// --- Coupon System ---
export const coupons = sqliteTable("coupons", {
  id: text("id").primaryKey(),
  code: text("code").unique().notNull(),
  benefitId: text("benefit_id").notNull(),
  benefitTitle: text("benefit_title").notNull(),
  benefitResumen: text("benefit_resumen").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userMatricula: text("user_matricula"),
  status: text("status", { enum: ["active", "used", "expired"] }).default("active").notNull(),
  createdAt: text("created_at").notNull(),
  usedAt: text("used_at"),
});
