import fs from "fs/promises";
import path from "path";

async function run() {
  const seedPath = path.join(process.cwd(), "src/server/data/seed.json");
  const rawData = await fs.readFile(seedPath, "utf-8");
  const seedData = JSON.parse(rawData);
  
  console.log("Checking seed.json for relative images...");
  let count = 0;
  for (const b of seedData.benefits) {
    if (b.imagen && !b.imagen.startsWith("http") && !b.imagen.startsWith("/")) {
      console.log(`Relative imagen for ID ${b.id}: ${b.imagen}`);
      count++;
    }
    if (b.imagenMobile && !b.imagenMobile.startsWith("http") && !b.imagenMobile.startsWith("/")) {
      console.log(`Relative imagenMobile for ID ${b.id}: ${b.imagenMobile}`);
      count++;
    }
  }
  console.log(`Check complete. Found ${count} relative path(s) in seed.json.`);
}

run().catch(console.error);
