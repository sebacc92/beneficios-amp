import { createClient } from "@libsql/client";
const client = createClient({ url: "file:sqlite.db" });
const rs = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sponsors'");
console.log(rs.rows);
