// Tipos normalizados de la validación de agremiados/empleados.
// La UI (portal de comercios y admin) solo conoce estos tipos, nunca el origen
// de los datos. Hoy el origen es la base local; mañana, el web service de la AMP.

export type MemberEstado = "activo" | "inactivo" | "desconocido";
export type MemberTipo = "agremiado" | "empleado" | "desconocido";

export interface Member {
  /** Id local en la tabla `users` si el agremiado ya existe; null si no. */
  id: string | null;
  name: string;
  matricula: string | null;
  dni: string | null;
  role: string | null;
  estado: MemberEstado;
  tipo: MemberTipo;
}

export interface MemberValidationResult {
  valid: boolean;
  member: Member | null;
  /** Motivo cuando `valid` es false (para mostrar al comercio/admin). */
  reason?: string;
}

/** Forma cruda que devuelve el proveedor antes de normalizar. */
export interface RawMember {
  id: string | null;
  name: string;
  matricula: string | null;
  dni: string | null;
  role: string | null;
  estado: MemberEstado;
  tipo: MemberTipo;
}
