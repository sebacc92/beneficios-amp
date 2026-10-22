/**
 * Creates (or resets the password of) an administrator account.
 *
 *   pnpm create-admin -- --email admin@lprc.ar --password 'una-clave-larga' --name 'Admin LPRC'
 *
 * Needed because /admin used to be reachable by anyone through a hardcoded mock
 * admin. Now the panel requires a real account, and this is how you create the
 * first one. The password is hashed with PBKDF2-HMAC-SHA256 using the exact same
 * format src/utils/crypto.ts verifies.
 */
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const PBKDF2_ITERATIONS = 150_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1]?.startsWith("--") ? "true" : argv[++i];
    args[key] = value;
  }
  return args;
}

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_BITS,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

const args = parseArgs(process.argv.slice(2));
const email = args.email?.toLowerCase().trim();
const password = args.password;
const name = args.name?.trim() || "Administrador";

if (!email || !password) {
  console.error("Usage: pnpm create-admin -- --email <email> --password <password> [--name <name>]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("✗ Elegí una contraseña de al menos 8 caracteres.");
  process.exit(1);
}

const url = process.env.PRIVATE_TURSO_DATABASE_URL?.trim();
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN?.trim();
if (!url) {
  console.error("✗ PRIVATE_TURSO_DATABASE_URL is missing (.env.local)");
  process.exit(1);
}

const db = createClient({ url, authToken });

async function main() {
  const passwordHash = await hashPassword(password);
  const existing = await db.execute({
    sql: "SELECT id, role FROM users WHERE email = ?",
    args: [email],
  });

  if (existing.rows.length > 0) {
    const { id } = existing.rows[0];
    await db.execute({
      sql: "UPDATE users SET password_hash = ?, role = 'admin', name = ? WHERE id = ?",
      args: [passwordHash, name, id],
    });
    // Any session issued before the password change must stop working.
    await db.execute({ sql: "DELETE FROM sessions WHERE user_id = ?", args: [id] }).catch(() => {});
    console.log(`✓ Cuenta existente actualizada a admin y contraseña reiniciada: ${email}`);
    return;
  }

  const id = "usr-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await db.execute({
    sql: `INSERT INTO users (id, email, password_hash, name, numero_socio, role, avatar_url, premium_expires_at, created_at)
          VALUES (?, ?, ?, ?, NULL, 'admin', NULL, NULL, ?)`,
    args: [id, email, passwordHash, name, new Date().toISOString()],
  });
  console.log(`✓ Administrador creado: ${email}`);
  console.log("  Ingresá en /admin/login con ese correo y contraseña.");
}

main()
  .catch((err) => {
    console.error("✗ Failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
