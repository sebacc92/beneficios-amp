/** Options of the /sugerencias form; `?tipo=` only prefills one of these values. */
export const SUGGESTION_TYPES = [
  {
    value: "Sugerir Comercio",
    label: "Recomendar un nuevo comercio adherido",
    title: "Recomendar un comercio",
    hint: "Contanos qué comercio te gustaría ver en el portal.",
  },
  {
    value: "Problema Comercio",
    label: "Reportar un inconveniente con un beneficio o descuento",
    title: "Problema con un beneficio",
    hint: "Un comercio no aplicó el descuento o algo no funcionó.",
  },
  {
    value: "Consulta General",
    label: "Consulta o duda general sobre el club",
    title: "Consulta general",
    hint: "Dudas sobre el portal, tu cuenta o el club.",
  },
  { value: "Otro", label: "Otro motivo", title: "Otro motivo", hint: "Cualquier otra cosa que quieras contarnos." },
] as const;

/** Reasons where the form asks for the shop's name. */
export const SUGGESTION_TYPES_WITH_COMMERCE: readonly string[] = ["Sugerir Comercio", "Problema Comercio"];

export const SUGGESTION_STATUSES = ["pending", "reviewed", "discarded"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const suggestionStatusLabels: Record<SuggestionStatus, string> = {
  pending: "Pendiente",
  reviewed: "Revisada",
  discarded: "Descartada",
};

export function isSuggestionStatus(value: unknown): value is SuggestionStatus {
  return SUGGESTION_STATUSES.includes(value as SuggestionStatus);
}

export function isSuggestionType(value: unknown): boolean {
  return SUGGESTION_TYPES.some((type) => type.value === value);
}

export interface SuggestionInput {
  nombre: string;
  email: string;
  telefono: string;
  tipo: string;
  comercio: string;
  mensaje: string;
}

/** Trims every field and returns the per-field errors the form shows (empty when valid). */
export function validateSuggestion(data: Record<string, unknown>): { values: SuggestionInput; errors: Record<string, string> } {
  const field = (name: string) => String(data[name] ?? "").trim();
  const values = {
    nombre: field("nombre"),
    email: field("email"),
    telefono: field("telefono"),
    tipo: field("tipo"),
    comercio: field("comercio"),
    mensaje: field("mensaje"),
  };
  const errors: Record<string, string> = {};

  if (!values.nombre) errors.nombre = "El nombre es obligatorio.";
  else if (values.nombre.length < 3) errors.nombre = "El nombre debe tener al menos 3 caracteres.";

  if (!values.email) errors.email = "El correo electrónico es obligatorio.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "El formato de correo electrónico no es válido.";

  if (values.telefono && !/^[0-9\s\-+()]{7,20}$/.test(values.telefono)) errors.telefono = "El número de teléfono no es válido.";

  if (!isSuggestionType(values.tipo)) errors.tipo = "Elegí el motivo de tu mensaje.";

  if (!values.mensaje) errors.mensaje = "El mensaje es obligatorio.";
  else if (values.mensaje.length < 10) errors.mensaje = "El mensaje debe tener al menos 10 caracteres.";
  else if (values.mensaje.length > 4000) errors.mensaje = "El mensaje es demasiado largo (máximo 4000 caracteres).";

  if (values.comercio.length > 120) errors.comercio = "El nombre del comercio es demasiado largo.";

  return { values, errors };
}
