// Tipos normalizados de la validación de agremiados/empleados.
// La UI (portal de comercios y admin) solo conoce estos tipos, nunca el origen
// de los datos. La fuente de verdad es el padrón de la AMP (web service).

export type MemberEstado = "activo" | "inactivo" | "desconocido";
export type MemberTipo = "agremiado" | "empleado" | "desconocido";

export interface Member {
  /** Id local en la tabla `users` si el agremiado ya usó el portal; null si no. */
  id: string | null;
  name: string;
  matricula: string | null;
  dni: string | null;
  email: string | null;
  /** "identificador" interno del padrón de la AMP. */
  padronId: number | null;
  /** "origen" crudo del padrón (p.ej. "AGREMIADO"). */
  origen: string | null;
  role: string | null;
  estado: MemberEstado;
  tipo: MemberTipo;
}

export interface MemberValidationResult {
  valid: boolean;
  member: Member | null;
  /** Motivo cuando `valid` es false, o aviso cuando se validó con la copia local. */
  reason?: string;
}

/** Forma cruda que devuelve el proveedor antes de normalizar. */
export type RawMember = Member;
