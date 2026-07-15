import { eq, or } from "drizzle-orm";
import { users } from "~/db/schema";
import type { RawMember } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  PROVEEDOR DE VALIDACIÓN DE AGREMIADOS — PADRÓN OFICIAL DE LA AMP
//
//  Fuente de verdad: web service del padrón. Se consulta de a una persona por
//  DNI. Comportamiento verificado del servicio:
//    - DNI agremiado   → 200 {"origen","ApellidoYNombres","dni","identificador","email"}
//    - DNI no agremiado → 200 con body `null` (no es 404)
//    - API key inválida → 400 "API KEY Error :: API KEY Inválida"
//    - DNI no numérico  → 400 {"Message":"La solicitud no es válida."}
//
//  La tabla local `users` funciona como copia/cache de los agremiados que ya
//  usaron el portal (fallback cuando el padrón no responde).
// ─────────────────────────────────────────────────────────────────────────────

const PADRON_BASE_URL = "https://sistemas.amepla.org.ar/servicios/padron/persona";
const PADRON_TIMEOUT_MS = 8000;

type EnvGetter = { get: (key: string) => string | undefined };

interface PadronPersona {
  origen?: string;
  ApellidoYNombres?: string;
  dni?: number;
  identificador?: number;
  email?: string | null;
}

export type PadronResult =
  | { status: "found"; member: RawMember }
  | { status: "not_found" }
  | { status: "unavailable" };

/** ¿Tiene pinta de DNI? Solo números, 6 a 9 dígitos. */
export function isValidDni(value: string): boolean {
  return /^\d{6,9}$/.test(value);
}

/** Consulta el padrón oficial de la AMP por DNI. */
export async function lookupPadron(env: EnvGetter, dni: string): Promise<PadronResult> {
  const apiKey = env.get("PRIVATE_PADRON_API_KEY");
  if (!apiKey) {
    console.error("[padron] PRIVATE_PADRON_API_KEY no está configurada.");
    return { status: "unavailable" };
  }

  try {
    const res = await fetch(`${PADRON_BASE_URL}/${encodeURIComponent(dni)}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(PADRON_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[padron] HTTP", res.status, await res.text().catch(() => ""));
      return { status: "unavailable" };
    }
    const data = (await res.json()) as PadronPersona | null;
    if (!data || !data.dni) return { status: "not_found" };

    return {
      status: "found",
      member: {
        id: null, // se completa con la copia local si existe
        name: data.ApellidoYNombres?.trim() || `Agremiado ${data.dni}`,
        matricula: null, // el padrón no expone matrícula
        dni: String(data.dni),
        email: data.email?.trim() || null,
        padronId: data.identificador ?? null,
        origen: data.origen ?? null,
        role: null,
        estado: "activo", // el padrón no expone estado: figurar = válido
        tipo:
          data.origen === "AGREMIADO"
            ? "agremiado"
            : data.origen === "EMPLEADO"
              ? "empleado"
              : "desconocido",
      },
    };
  } catch (err) {
    console.error("[padron] No se pudo consultar el padrón:", err);
    return { status: "unavailable" };
  }
}

/**
 * Copia local (tabla `users`): agremiados que ya ingresaron al portal.
 * Se busca por `dni` y también por `matricula` (columna legacy donde
 * históricamente se guardaba el DNI).
 */
export async function lookupLocalMember(db: any, dni: string): Promise<RawMember | null> {
  const [record] = await db
    .select()
    .from(users)
    .where(or(eq(users.dni, dni), eq(users.matricula, dni)))
    .limit(1);

  if (!record) return null;

  return {
    id: record.id,
    name: record.name,
    matricula: record.matricula,
    dni: record.dni ?? record.matricula,
    email: record.email,
    padronId: record.padronId ?? null,
    origen: record.origen ?? null,
    role: record.role,
    estado: "activo",
    tipo: "agremiado",
  };
}
