import type { RequestEventBase } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { isValidDni, lookupPadron, lookupLocalMember } from "./provider";
import type { Member, MemberValidationResult } from "./types";

export type { Member, MemberValidationResult } from "./types";
export { isValidDni, lookupPadron, lookupLocalMember } from "./provider";

/**
 * Valida un agremiado por DNI contra el padrón oficial de la AMP.
 * Punto de entrada único usado por el login, el portal de comercios y el admin.
 *
 * Si el padrón no responde, cae a la copia local (agremiados que ya usaron el
 * portal) para no dejar el sistema inoperante durante una caída del servicio.
 */
export async function validateMember(
  event: RequestEventBase,
  rawQuery: string
): Promise<MemberValidationResult> {
  const query = (rawQuery || "").trim();
  if (!isValidDni(query)) {
    return {
      valid: false,
      member: null,
      reason: "Ingresá un DNI válido (solo números, sin puntos).",
    };
  }

  const result = await lookupPadron(event.env, query);

  if (result.status === "found") {
    // Enriquecer con la copia local (id de usuario del portal, rol) si existe.
    let local: Member | null = null;
    try {
      local = await lookupLocalMember(getDB(event), query);
    } catch (err) {
      console.error("[membership] Fallo la consulta local:", err);
    }
    return {
      valid: true,
      member: { ...result.member, id: local?.id ?? null, role: local?.role ?? null },
    };
  }

  if (result.status === "not_found") {
    return {
      valid: false,
      member: null,
      reason: "El DNI no figura en el padrón de agremiados de la AMP.",
    };
  }

  // Padrón caído/inaccesible: fallback a la copia local.
  try {
    const local = await lookupLocalMember(getDB(event), query);
    if (local) {
      return {
        valid: true,
        member: local,
        reason: "El padrón no respondió: se validó con la copia local del portal.",
      };
    }
  } catch (err) {
    console.error("[membership] Fallo el fallback local:", err);
  }

  return {
    valid: false,
    member: null,
    reason: "No se pudo consultar el padrón de la AMP. Probá nuevamente en unos minutos.",
  };
}
