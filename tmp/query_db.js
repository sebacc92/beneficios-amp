import fs from "fs";
import path from "path";

async function main() {
  try {
    const seedPath = "/home/seba/devs/beneficios/src/server/data/seed.json";
    const data = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
    
    if (data.filters) {
      console.log("\n--- CATEGORIES ---");
      console.log(data.filters.categorias.slice(0, 20));

      console.log("\n--- LOCATIONS ---");
      console.log(data.filters.ubicaciones.slice(0, 20));

      console.log("\n--- OFFERS ---");
      console.log(data.filters.ofertas.slice(0, 20));
    } else {
      console.log("No filters key found in seed.json");
    }
  } catch (error) {
    console.error("Error reading seed.json:", error);
  }
}

main();
