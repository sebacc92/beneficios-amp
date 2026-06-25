import { lookupMember } from "./provider";
import type { Member, MemberValidationResult } from "./types";

export type { Member, MemberValidationResult } from "./types";

/**
 * Valida un agremiado/empleado por matrícula o DNI.
 * Punto de entrada único usado por el portal de comercios y el admin.
 */
export async function validateMember(db: any, rawQuery: string): Promise<MemberValidationResult> {
  const query = (rawQuery || "").trim();
  if (query.length < 4) {
    return { valid: false, member: null, reason: "Ingresá una matrícula o DNI válido (mínimo 4 caracteres)." };
  }

  const raw = await lookupMember(db, query);
  if (!raw) {
    return {
      valid: false,
      member: null,
      reason: "La matrícula o DNI no corresponde a un agremiado registrado.",
    };
  }

  const member: Member = { ...raw };

  if (member.estado === "inactivo") {
    return { valid: false, member, reason: "El agremiado figura como inactivo." };
  }

  return { valid: true, member };
}
