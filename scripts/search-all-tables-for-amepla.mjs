import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

const tables = [
  "site_settings",
  "users",
  "custom_benefits",
  "news",
  "events",
  "banners",
  "sponsors",
  "hero_slides",
  "merchant_requests",
  "merchants",
  "suggestions",
  "gallery_images",
  "coupons"
];

async function run() {
  console.log("Searching all tables for 'amepla'...");
  let found = 0;
  
  for (const table of tables) {
    try {
      const result = await db.execute(`SELECT * FROM ${table}`);
      if (result.rows.length === 0) continue;
      
      const columns = Object.keys(result.rows[0]);
      
      for (const row of result.rows) {
        for (const col of columns) {
          const val = row[col];
          if (typeof val === "string" && val.toLowerCase().includes("amepla")) {
            console.log(`[MATCH] Table: ${table} | ID/Slug: ${row.id || row.slug || "N/A"} | Column: ${col}`);
            console.log(`        Value: ${val}`);
            found++;
          }
        }
      }
    } catch (err) {
      // Ignore if table doesn't exist
      if (!err.message.includes("no such table")) {
        console.warn(`Error checking table ${table}:`, err.message);
      }
    }
  }
  
  console.log(`\nSearch finished. Total matches found: ${found}`);
}

run().catch(console.error);
