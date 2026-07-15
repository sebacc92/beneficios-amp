import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

dotenv.config({ path: ".env.local" });

const dbUrl = process.env.PRIVATE_TURSO_DATABASE_URL;
const dbAuthToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;

if (!dbUrl) {
  console.error("PRIVATE_TURSO_DATABASE_URL no está definida.");
  process.exit(1);
}

const db = createClient({ url: dbUrl, authToken: dbAuthToken });

function cleanHtml(html) {
  if (!html) return html;
  
  let cleaned = html;
  
  // 1. Fix typos
  cleaned = cleaned.replace(/p\+agina/gi, "página");
  cleaned = cleaned.replace(/p\+ginas/gi, "páginas");
  
  // 2. Decode/Normalize non-breaking spaces
  cleaned = cleaned.replace(/&nbsp;/gi, " ");
  cleaned = cleaned.replace(/\xa0/g, " ");
  
  // 3. Remove inline styles and presentational attributes
  cleaned = cleaned.replace(/\s*style="[^"]*"/gi, "");
  cleaned = cleaned.replace(/\s*face="[^"]*"/gi, "");
  cleaned = cleaned.replace(/\s*size="[^"]*"/gi, "");
  cleaned = cleaned.replace(/\s*color="[^"]*"/gi, "");
  cleaned = cleaned.replace(/\s*class="Apple-converted-space"/gi, "");
  
  // 4. Remove empty paragraphs or other empty tags
  cleaned = cleaned.replace(/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, "");
  cleaned = cleaned.replace(/<li>\s*<\/li>/gi, "");
  cleaned = cleaned.replace(/<div>\s*<\/div>/gi, "");
  
  // 5. Collapse multiple spaces
  cleaned = cleaned.replace(/ {2,}/g, " ");
  
  return cleaned.trim();
}

async function normalizeDb() {
  console.log("=== Normalizing Turso Database Descriptions ===");
  const result = await db.execute("SELECT id, descripcion, resumen FROM custom_benefits");
  
  let updatedCount = 0;
  for (const row of result.rows) {
    const origDesc = row.descripcion || "";
    const origRes = row.resumen || "";
    
    const cleanDesc = cleanHtml(origDesc);
    const cleanRes = cleanHtml(origRes);
    
    if (cleanDesc !== origDesc || cleanRes !== origRes) {
      console.log(`Normalizing benefit ID ${row.id}:`);
      if (cleanDesc !== origDesc) {
        console.log(`  - Description changed`);
      }
      if (cleanRes !== origRes) {
        console.log(`  - Resumen changed`);
      }
      
      await db.execute({
        sql: "UPDATE custom_benefits SET descripcion = ?, resumen = ? WHERE id = ?",
        args: [cleanDesc, cleanRes, row.id]
      });
      updatedCount++;
    }
  }
  console.log(`✓ Normalized ${updatedCount} benefits in database.`);
}

async function normalizeSeed() {
  console.log("\n=== Normalizing seed.json ===");
  const seedPath = path.join(process.cwd(), "src/server/data/seed.json");
  
  let seedData;
  try {
    const rawData = await fs.readFile(seedPath, "utf-8");
    seedData = JSON.parse(rawData);
  } catch (err) {
    console.error(`Failed to read/parse seed.json at ${seedPath}:`, err.message);
    return;
  }
  
  if (!seedData || !seedData.benefits) {
    console.warn("seed.json does not contain benefits array.");
    return;
  }
  
  let updatedCount = 0;
  for (const b of seedData.benefits) {
    const origDesc = b.descripcion || "";
    const origRes = b.resumen || "";
    
    const cleanDesc = cleanHtml(origDesc);
    const cleanRes = cleanHtml(origRes);
    
    if (cleanDesc !== origDesc || cleanRes !== origRes) {
      b.descripcion = cleanDesc;
      b.resumen = cleanRes;
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    console.log(`Saving normalized seed.json to disk (${updatedCount} benefits updated)...`);
    await fs.writeFile(seedPath, JSON.stringify(seedData, null, 2), "utf-8");
    console.log("✓ seed.json updated successfully.");
  } else {
    console.log("No benefits in seed.json required normalization.");
  }
}

async function run() {
  await normalizeDb();
  await normalizeSeed();
  console.log("\n🎉 Data normalization completed!");
}

run().catch(console.error);
