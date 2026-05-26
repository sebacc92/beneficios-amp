import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

// Read .env.local manually
const envPath = path.resolve(".env.local");
if (!fs.existsSync(envPath)) {
  console.error("No se encontró el archivo .env.local");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/PRIVATE_TURSO_DATABASE_URL\s*=\s*["']?([^\s"']+)["']?/);
const dbTokenMatch = envContent.match(/PRIVATE_TURSO_AUTH_TOKEN\s*=\s*["']?([^\s"']+)["']?/);

if (!dbUrlMatch) {
  console.error("No se encontró PRIVATE_TURSO_DATABASE_URL en .env.local");
  process.exit(1);
}

const url = dbUrlMatch[1];
const authToken = dbTokenMatch ? dbTokenMatch[1] : undefined;

console.log("Conectando a la base de datos Turso...");
const client = createClient({ url, authToken });

// Beautiful Custom Inline SVGs
const svgSwiss = `data:image/svg+xml;utf8,` + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="100%" height="100%">
  <defs>
    <linearGradient id="gSwiss" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#gSwiss)" rx="16"/>
  <rect width="100%" height="100%" fill="none" stroke="#06b6d4" stroke-width="2" rx="16" opacity="0.4"/>
  <!-- Turquoise Cross Icon -->
  <g transform="translate(110, 60)">
    <rect x="30" y="0" width="20" height="80" fill="#06b6d4" rx="4" />
    <rect x="0" y="30" width="80" height="20" fill="#06b6d4" rx="4" />
  </g>
  <text x="50%" y="200" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="900" fill="#ffffff" letter-spacing="1">SWISS MEDICAL</text>
  <text x="50%" y="235" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#06b6d4" letter-spacing="3">SPONSOR PLATINUM</text>
</svg>
`.trim());

const svgOsde = `data:image/svg+xml;utf8,` + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="100%" height="100%">
  <defs>
    <linearGradient id="gOsde" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#047857" />
      <stop offset="100%" stop-color="#065f46" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#gOsde)" rx="16"/>
  <!-- Sun/Wave Icon -->
  <circle cx="150" cy="70" r="30" fill="none" stroke="#f59e0b" stroke-width="4" />
  <circle cx="150" cy="70" r="15" fill="#f59e0b" />
  <path d="M 110,130 Q 150,110 190,130" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" />
  <text x="50%" y="145" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="900" fill="#ffffff">OSDE</text>
  <text x="50%" y="170" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#f59e0b" letter-spacing="2">SALUD PARA SIEMPRE</text>
</svg>
`.trim());

const svgAmpSeguros = `data:image/svg+xml;utf8,` + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100" width="100%" height="100%">
  <defs>
    <linearGradient id="gAmp" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#b45309" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#gAmp)" rx="12"/>
  <text x="50%" y="45" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="900" fill="#ffffff" letter-spacing="2">AMP SEGUROS</text>
  <text x="50%" y="72" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="800" fill="#fef3c7" letter-spacing="4">PROTECCIÓN MÉDICA INTEGRAL</text>
</svg>
`.trim());

const svgLaSante = `data:image/svg+xml;utf8,` + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#ffffff" rx="12" stroke="#e2e8f0" stroke-width="2"/>
  <!-- Pharmacy Green Cross -->
  <g transform="translate(15, 30)">
    <rect x="10" y="0" width="8" height="28" fill="#10b981" rx="2" />
    <rect x="0" y="10" width="28" height="8" fill="#10b981" rx="2" />
  </g>
  <text x="115" y="44" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800" fill="#1e293b">LA SANTÉ</text>
  <text x="115" y="62" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="8" font-weight="700" fill="#10b981" letter-spacing="1">Red de Farmacias</text>
</svg>
`.trim());

const svgSportclub = `data:image/svg+xml;utf8,` + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#111827" rx="12"/>
  <rect width="100%" height="100%" fill="none" stroke="#ea580c" stroke-width="1" rx="12" opacity="0.3"/>
  <text x="50%" y="46" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="900" font-style="italic" fill="#ffffff" letter-spacing="1">Sport<tspan fill="#ea580c">Club</tspan></text>
  <text x="50%" y="68" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="7" font-weight="800" fill="#9ca3af" letter-spacing="3">TU LUGAR DE ENTRENAMIENTO</text>
</svg>
`.trim());

const svgStarbucks = `data:image/svg+xml;utf8,` + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#0b513b" rx="12"/>
  <!-- Small Siren Icon representation -->
  <circle cx="45" cy="50" r="18" fill="none" stroke="#ffffff" stroke-width="2"/>
  <polygon points="45,38 48,46 56,46 50,51 52,59 45,54 38,59 40,51 34,46 42,46" fill="#ffffff"/>
  <text x="120" y="52" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800" fill="#ffffff" letter-spacing="1">STARBUCKS</text>
</svg>
`.trim());

const mockSponsors = [
  {
    id: "sp-swiss-medical",
    name: "Swiss Medical Group",
    imageUrl: svgSwiss,
    linkUrl: "https://www.swissmedical.com.ar",
    x: 0,
    y: 0,
    w: 3,
    h: 3,
    createdAt: new Date().toISOString()
  },
  {
    id: "sp-amp-seguros",
    name: "AMP Seguros",
    imageUrl: svgAmpSeguros,
    linkUrl: "https://www.amepla.org.ar",
    x: 3,
    y: 0,
    w: 3,
    h: 1,
    createdAt: new Date().toISOString()
  },
  {
    id: "sp-osde",
    name: "OSDE",
    imageUrl: svgOsde,
    linkUrl: "https://www.osde.com.ar",
    x: 3,
    y: 1,
    w: 3,
    h: 2,
    createdAt: new Date().toISOString()
  },
  {
    id: "sp-la-sante",
    name: "Farmacia La Santé",
    imageUrl: svgLaSante,
    linkUrl: "https://www.lasante.com.ar",
    x: 0,
    y: 3,
    w: 2,
    h: 1,
    createdAt: new Date().toISOString()
  },
  {
    id: "sp-sportclub",
    name: "SportClub",
    imageUrl: svgSportclub,
    linkUrl: "https://www.sportclub.com.ar",
    x: 2,
    y: 3,
    w: 2,
    h: 1,
    createdAt: new Date().toISOString()
  },
  {
    id: "sp-starbucks",
    name: "Starbucks Coffee",
    imageUrl: svgStarbucks,
    linkUrl: "https://www.starbucks.com.ar",
    x: 4,
    y: 3,
    w: 2,
    h: 1,
    createdAt: new Date().toISOString()
  }
];

async function seed() {
  try {
    console.log("Limpiando sponsors existentes...");
    await client.execute("DELETE FROM sponsors;");

    console.log("Insertando sponsors de ejemplo...");
    for (const sp of mockSponsors) {
      await client.execute({
        sql: "INSERT INTO sponsors (id, name, image_url, link_url, x, y, w, h, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [sp.id, sp.name, sp.imageUrl, sp.linkUrl, sp.x, sp.y, sp.w, sp.h, sp.createdAt]
      });
      console.log(`- Sponsor insertado: ${sp.name}`);
    }

    console.log("¡Sponsors insertados con éxito!");
  } catch (err) {
    console.error("Error al sembrar sponsors:", err);
  } finally {
    client.close();
  }
}

seed();
