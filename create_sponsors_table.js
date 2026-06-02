import { createClient } from "@libsql/client";
const client = createClient({ url: "file:sqlite.db" });
try {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS sponsors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      link_url TEXT,
      x INTEGER DEFAULT 0 NOT NULL,
      y INTEGER DEFAULT 0 NOT NULL,
      w INTEGER DEFAULT 2 NOT NULL,
      h INTEGER DEFAULT 2 NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  console.log("Table created successfully!");
} catch (err) {
  console.error("Error:", err);
}
