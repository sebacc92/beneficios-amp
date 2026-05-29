import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function run() {
  try {
    const res = await client.execute("SELECT id, title, button_text, button_link, is_active FROM hero_slides");
    console.log("All Slides:");
    console.log(res.rows);
  } catch (error) {
    console.error(error);
  } finally {
    client.close();
  }
}

run();
