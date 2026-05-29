import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function run() {
  try {
    const res = await client.execute("SELECT * FROM hero_slides WHERE id = 'slide-1779979433205659'");
    console.log("Slide Details:");
    console.log(res.rows[0]);
  } catch (error) {
    console.error(error);
  } finally {
    client.close();
  }
}

run();
