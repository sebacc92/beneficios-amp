import type { RequestEventBase } from "@builder.io/qwik-city";
import { drizzle } from "drizzle-orm/libsql";
import { tursoClient } from "../utils/turso";
import * as schema from "./schema";

/**
 * Instantiate Drizzle ORM with the Edge-compatible Turso client.
 * Because we are running in an Edge environment, we instantiate the DB
 * per-request rather than globally.
 */
export function getDB(requestEvent: RequestEventBase) {
  const client = tursoClient(requestEvent);
  return drizzle(client, { schema });
}
