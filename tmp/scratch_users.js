import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

// Read .env.local manually
const envPath = path.resolve(".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/PRIVATE_TURSO_DATABASE_URL="([^"]+)"/);
const authTokenMatch = envContent.match(/PRIVATE_TURSO_AUTH_TOKEN="([^"]+)"/);

if (!dbUrlMatch || !authTokenMatch) {
  console.error("Could not parse .env.local file");
  process.exit(1);
}

const url = dbUrlMatch[1];
const authToken = authTokenMatch[1];

console.log("Connecting to:", url);

const client = createClient({ url, authToken });

async function main() {
  try {
    const res = await client.execute("SELECT id, email, name, role FROM users;");
    console.log("Users in database:");
    console.table(res.rows);
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    client.close();
  }
}

main();
