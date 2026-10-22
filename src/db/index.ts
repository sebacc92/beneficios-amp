import type { RequestEventBase } from "@builder.io/qwik-city";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { tursoClient } from "../utils/turso";
import * as schema from "./schema";

type DrizzleDB = LibSQLDatabase<typeof schema>;

const DB_KEY = "__drizzle_db";

/**
 * Drizzle ORM bound to the Edge-compatible Turso client.
 *
 * The instance is memoized in `sharedMap`, so the many `getDB()` calls a single
 * render performs (loaders, actions, cache helpers) share one client instead of
 * opening a new HTTP connection each time. `sharedMap` is per-request, so nothing
 * leaks between requests.
 */
export function getDB(requestEvent: RequestEventBase): DrizzleDB {
  const cached = requestEvent.sharedMap.get(DB_KEY) as DrizzleDB | undefined;
  if (cached) return cached;

  const db = drizzle(tursoClient(requestEvent), { schema });
  requestEvent.sharedMap.set(DB_KEY, db);
  return db;
}
