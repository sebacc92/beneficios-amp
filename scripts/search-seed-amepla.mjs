import fs from "fs/promises";
import path from "path";

async function run() {
  const seedPath = path.join(process.cwd(), "src/server/data/seed.json");
  const rawData = await fs.readFile(seedPath, "utf-8");
  const seedData = JSON.parse(rawData);
  
  console.log("Searching seed.json for 'amepla.org'...");
  let found = 0;
  for (const b of seedData.benefits) {
    const img = b.imagen || "";
    const imgMob = b.imagenMobile || "";
    if (img.includes("amepla.org") || imgMob.includes("amepla.org")) {
      console.log(`Match in seed benefit ID ${b.id} (${b.titulo}):`);
      console.log(`  imagen: ${img}`);
      console.log(`  imagenMobile: ${imgMob}`);
      found++;
    }
  }
  console.log(`Search complete. Found ${found} match(es) in seed.json.`);
}

run().catch(console.error);
