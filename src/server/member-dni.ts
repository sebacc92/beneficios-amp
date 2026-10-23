import type { RequestEventBase } from "@builder.io/qwik-city";
import { eq, sql } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { normalizedDniExpression } from "~/db/dni-expression.mjs";
import { isValidDni, normalizeDni } from "~/utils/dni";

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
