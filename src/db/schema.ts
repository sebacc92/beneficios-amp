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
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  matricula: text("matricula"),
  role: text("role", { enum: ["admin", "member", "premium"] }).default("member").notNull(),
  avatarUrl: text("avatar_url"),
  premiumExpiresAt: text("premium_expires_at"), // ISO Date string
  createdAt: text("created_at").notNull(),
});

// --- Custom Benefits (CRUD) ---
export const customBenefits = sqliteTable("custom_benefits", {
  id: text("id").primaryKey(),
  titulo: text("titulo").notNull(),
  resumen: text("resumen").notNull(),
  descripcion: text("descripcion").notNull(),
  imagen: text("imagen"),
  slug: text("slug").unique().notNull(),
  isFeatured: integer("is_featured", { mode: "boolean" }).default(false).notNull(),
  isPremiumOnly: integer("is_premium_only", { mode: "boolean" }).default(false).notNull(),
  categoryId: integer("category_id").notNull(),
  locationId: integer("location_id").notNull(),
  offerId: integer("offer_id").notNull(),
  couponCode: text("coupon_code"),
  validUntil: text("valid_until"),
  terms: text("terms"),
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
  x: integer("x").default(0).notNull(), // Starting column (0 to 5)
  y: integer("y").default(0).notNull(), // Starting row (0+)
  w: integer("w").default(2).notNull(), // Width span (1 to 6)
  h: integer("h").default(2).notNull(), // Height span (1+)
  createdAt: text("created_at").notNull(),
});

