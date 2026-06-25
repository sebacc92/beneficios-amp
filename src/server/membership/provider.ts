import { eq } from "drizzle-orm";
import { users } from "~/db/schema";
import type { RawMember } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  PROVEEDOR DE VALIDACIÓN DE AGREMIADOS / EMPLEADOS
//
//  ⚠️  ESTE ES EL ÚNICO ARCHIVO QUE CAMBIA cuando llegue la documentación
//      técnica del web service de la AMP.
//
//  FASE 1 (actual): se resuelve contra la base local `users`. Solo valida
//  agremiados ya pre-cargados (decisión del cliente).
//
//  FASE 2 (con la doc): reemplazar el cuerpo de `lookupMember()` por el `fetch`
//  al web service oficial, mapeando su respuesta al tipo `RawMember`. El resto
//  del sistema (index.ts, portal de comercios, admin) no se modifica.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca un agremiado/empleado por matrícula o DNI.
 * @returns RawMember si existe, o null si no se encuentra.
 */
export async function lookupMember(db: any, query: string): Promise<RawMember | null> {
  // NOTE: hoy la matrícula y el DNI comparten la columna `users.matricula`.
  // Cuando el web service los devuelva por separado, se diferencian acá.
  const [record] = await db
    .select()
    .from(users)
    .where(eq(users.matricula, query))
    .limit(1);

  if (!record) return null;

  return {
    id: record.id,
    name: record.name,
    matricula: record.matricula,
    dni: record.matricula,
    role: record.role,
    estado: "activo",
    tipo: "agremiado",
  };
}
