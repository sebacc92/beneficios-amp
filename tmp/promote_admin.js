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
const dbUrlMatch = envContent.match(/PRIVATE_TURSO_DATABASE_URL="([^"]+)"/);
const authTokenMatch = envContent.match(/PRIVATE_TURSO_AUTH_TOKEN="([^"]+)"/);

if (!dbUrlMatch || !authTokenMatch) {
  console.error("No se pudieron extraer las credenciales de Turso en .env.local");
  process.exit(1);
}

const url = dbUrlMatch[1];
const authToken = authTokenMatch[1];

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Uso: node tmp/promote_admin.js correo@ejemplo.com");
  process.exit(1);
}

console.log("Conectando a:", url);
const client = createClient({ url, authToken });

async function main() {
  try {
    const checkRes = await client.execute({
      sql: "SELECT id, email, name, role FROM users WHERE email = ?;",
      args: [email]
    });

    if (checkRes.rows.length === 0) {
      console.error(`Error: No se encontró ningún usuario registrado con el correo: ${email}`);
      console.log("Por favor registrate primero desde la web en http://localhost:5173/register");
      process.exit(1);
    }

    const user = checkRes.rows[0];
    console.log(`Usuario encontrado: ${user.name} (${user.email}) - Rol actual: ${user.role}`);

    await client.execute({
      sql: "UPDATE users SET role = 'admin' WHERE email = ?;",
      args: [email]
    });

    console.log(`¡Éxito! El usuario ${user.email} ahora tiene el rol de: admin (Administrador)`);
  } catch (err) {
    console.error("Error al actualizar el usuario:", err);
  } finally {
    client.close();
  }
}

main();
