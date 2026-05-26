import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error("PRIVATE_TURSO_DATABASE_URL is missing inside .env.local");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken,
  },
});
