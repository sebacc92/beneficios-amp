import type { RequestEventBase } from "@builder.io/qwik-city";
import { eq, inArray, sql } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { normalizedDniExpression } from "~/db/dni-expression.mjs";
import { MAX_IMPORT_ROWS, isValidDni, normalizeDni } from "~/utils/dni";

export { MAX_IMPORT_ROWS };

/** At most two matches: callers must reject ambiguous historical identities. */
export async function findUsersByDni(event: RequestEventBase, value: string) {
  const dni = normalizeDni(value);
  if (!isValidDni(dni)) return [];

  return getDB(event)
    .select()
    .from(users)
    .where(eq(sql.raw(normalizedDniExpression), dni))
    .limit(2);
}

/**
 * Members log in with their DNI only, but `users.email` is required and unique.
 * Members imported without an email get this reserved (.invalid) address, which
 * the admin shows as "Sin email" and never receives mail.
 */
const NO_EMAIL_DOMAIN = "sin-email.invalid";

export function placeholderEmail(dni: string): string {
  return `dni-${normalizeDni(dni)}@${NO_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${NO_EMAIL_DOMAIN}`);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface MemberImportRow {
  /** 1-based line in the file, so the admin can find it. */
  line: number;
  name: string;
  email: string;
  dni: string;
}

export interface ClassifiedImportRow extends MemberImportRow {
  status: "valid" | "duplicate" | "error";
  reason?: string;
}

/** Splits CSV text honoring quotes ("Pérez, Juan") and "" escapes; the separator is , ; or tab. */
function splitCsv(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (char === separator) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

const HEADER_ALIASES: Record<"name" | "email" | "dni", string[]> = {
  name: ["nombre", "nombre y apellido", "apellido y nombre", "nombre completo", "socio", "name"],
  email: ["email", "e-mail", "mail", "correo", "correo electronico"],
  dni: ["dni", "documento", "nro documento", "numero de documento", "nro. documento", "doc"],
};

function headerKey(cell: string): keyof typeof HEADER_ALIASES | null {
  const clean = cell.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [keyof typeof HEADER_ALIASES, string[]][]) {
    if (aliases.includes(clean)) return key;
  }
  return null;
}

/**
 * Padrón as exported from a spreadsheet: "nombre, email, dni" (email optional).
 * With a header row the columns can come in any order; without one, two columns
 * mean nombre + DNI and three mean nombre + email + DNI.
 */
export function parseMemberCsv(text: string): { rows: MemberImportRow[]; error?: string } {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split("\n", 1)[0] ?? "";
  const separator = [";", "\t", ","].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best, ",");
  const table = splitCsv(clean, separator)
    .map((cells, index) => ({ cells: cells.map((cell) => cell.trim()), line: index + 1 }))
    .filter((row) => row.cells.some(Boolean));
  if (table.length === 0) return { rows: [], error: "El archivo está vacío." };

  const header = table[0].cells.map(headerKey);
  const hasHeader = header.includes("dni") || header.includes("name");
  let columns: Partial<Record<keyof typeof HEADER_ALIASES, number>>;
  if (hasHeader) {
    columns = {};
    header.forEach((key, index) => {
      if (key && columns[key] === undefined) columns[key] = index;
    });
    if (columns.dni === undefined || columns.name === undefined) {
      return { rows: [], error: "La primera fila tiene encabezados, pero falta la columna “nombre” o “dni”." };
    }
  } else {
    const width = Math.max(...table.map((row) => row.cells.length));
    if (width < 2) return { rows: [], error: "Cada fila necesita al menos nombre y DNI, separados por coma o punto y coma." };
    columns = width === 2 ? { name: 0, dni: 1 } : { name: 0, email: 1, dni: 2 };
  }

  const body = hasHeader ? table.slice(1) : table;
  if (body.length > MAX_IMPORT_ROWS) {
    return { rows: [], error: `El archivo tiene ${body.length} filas; importá hasta ${MAX_IMPORT_ROWS} por vez.` };
  }
  return {
    rows: body.map(({ cells, line }) => ({
      line,
      name: cells[columns.name!] ?? "",
      email: columns.email === undefined ? "" : (cells[columns.email] ?? "").toLowerCase(),
      dni: normalizeDni(cells[columns.dni!] ?? ""),
    })),
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Marks each row valid, duplicate (in the file or already registered) or erroneous, without writing anything. */
export async function classifyMemberImport(event: RequestEventBase, rows: MemberImportRow[]): Promise<ClassifiedImportRow[]> {
  const db = getDB(event);
  const dnis = [...new Set(rows.map((row) => row.dni).filter(isValidDni))];
  const emails = [...new Set(rows.map((row) => row.email).filter((email) => EMAIL_PATTERN.test(email)))];
  const dniExpression = sql.raw(normalizedDniExpression);

  const registeredDni = new Map<string, string>();
  for (const part of chunk(dnis, 400)) {
    const found = await db.select({ dni: sql<string>`${dniExpression}`, name: users.name }).from(users).where(inArray(dniExpression, part));
    for (const row of found) registeredDni.set(row.dni, row.name);
  }
  const registeredEmail = new Set<string>();
  for (const part of chunk(emails, 400)) {
    const found = await db.select({ email: users.email }).from(users).where(inArray(users.email, part));
    for (const row of found) registeredEmail.add(row.email);
  }

  const seenDni = new Map<string, number>();
  const seenEmail = new Map<string, number>();
  return rows.map((row) => {
    if (row.name.trim().length < 3) return { ...row, status: "error", reason: "Falta el nombre (mínimo 3 letras)." };
    if (!isValidDni(row.dni)) return { ...row, status: "error", reason: "DNI inválido: tienen que ser de 5 a 9 números." };
    if (row.email && !EMAIL_PATTERN.test(row.email)) return { ...row, status: "error", reason: "El email no tiene un formato válido." };
    const existing = registeredDni.get(row.dni);
    if (existing !== undefined) return { ...row, status: "duplicate", reason: `Ya está registrado (${existing}).` };
    if (row.email && registeredEmail.has(row.email)) return { ...row, status: "duplicate", reason: "Ese email ya es de otra cuenta." };
    const repeatedDni = seenDni.get(row.dni);
    if (repeatedDni !== undefined) return { ...row, status: "duplicate", reason: `DNI repetido en el archivo (fila ${repeatedDni}).` };
    const repeatedEmail = row.email ? seenEmail.get(row.email) : undefined;
    if (repeatedEmail !== undefined) return { ...row, status: "duplicate", reason: `Email repetido en el archivo (fila ${repeatedEmail}).` };
    seenDni.set(row.dni, row.line);
    if (row.email) seenEmail.set(row.email, row.line);
    return { ...row, status: "valid" };
  });
}

/** Creates the valid rows as members. Returns how many were created. */
export async function importMembers(event: RequestEventBase, rows: ClassifiedImportRow[], passwordHash: string): Promise<number> {
  const valid = rows.filter((row) => row.status === "valid");
  const db = getDB(event);
  const now = new Date().toISOString();
  for (const part of chunk(valid, 100)) {
    await db.insert(users).values(
      part.map((row) => ({
        id: `usr-${crypto.randomUUID()}`,
        email: row.email || placeholderEmail(row.dni),
        // Members never log in with a password; this one exists only because the column is required.
        passwordHash,
        name: row.name.trim(),
        numeroSocio: row.dni,
        role: "member" as const,
        createdAt: now,
      })),
    );
  }
  return valid.length;
}
