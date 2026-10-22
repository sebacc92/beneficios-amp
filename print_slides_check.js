import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

try {
  const slides = await client.execute("SELECT id, title, image_url FROM hero_slides");
  console.log(`Hero slides in DB: ${slides.rows.length}`);
  slides.rows.forEach(s => console.log(` - ID: ${s.id}, Title: ${s.title}, Image: ${s.image_url}`));
} catch (error) {
  console.error("Error reading database:", error);
}
