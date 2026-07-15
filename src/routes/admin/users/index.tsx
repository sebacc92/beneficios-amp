import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuSearch, LuDatabase, LuUserCheck, LuAlertTriangle } from "@qwikest/icons/lucide";
import { desc, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users as usersTable } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { isValidDni, lookupPadron, lookupLocalMember } from "~/server/membership";

// ─── El padrón oficial de agremiados vive en los sistemas de la AMP. ────────
// Esta sección consulta ese servicio por DNI (de a una persona) y muestra la
// copia local: agremiados que ya ingresaron al portal alguna vez.

// --- SECURITY & LOADERS ---

export const useLocalMembersLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/admin/login");
  }
  try {
    const db = getDB(event);
    const result = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    return result
      .filter((u) => u.role !== "admin")
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        dni: u.dni || u.matricula,
        padronId: u.padronId,
        origen: u.origen,
        createdAt: u.createdAt,
        lastSyncedAt: u.lastSyncedAt,
      }));
  } catch (err) {
    console.error("Failed to load local members:", err);
    return [];
  }
});

// --- ACTIONS ---

export const usePadronSearchAction = routeAction$(
  async (data, event) => {
    const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") {
      return event.fail(403, { message: "No autorizado." });
    }

    const dni = data.dni.trim();
    if (!isValidDni(dni)) {
      return event.fail(400, { message: "Ingresá un DNI válido (solo números, sin puntos)." });
    }

    const result = await lookupPadron(event.env, dni);

    if (result.status === "unavailable") {
      return event.fail(502, {
        message: "No se pudo consultar el padrón de la AMP. Probá nuevamente en unos minutos.",
      });
    }

    // ¿Ya usó el portal? (copia local)
    let local: { id: string; createdAt: string } | null = null;
    try {
      const db = getDB(event);
      const localMember = await lookupLocalMember(db, dni);
      if (localMember?.id) {
        const [row] = await db
          .select({ createdAt: usersTable.createdAt })
          .from(usersTable)
          .where(eq(usersTable.id, localMember.id))
          .limit(1);
        local = { id: localMember.id, createdAt: row?.createdAt ?? "" };
      }
    } catch (err) {
      console.error("Local member check failed:", err);
    }

    if (result.status === "not_found") {
      return { found: false as const, dni, local };
    }

    return {
      found: true as const,
      dni,
      persona: {
        origen: result.member.origen,
        name: result.member.name,
        dni: result.member.dni,
        padronId: result.member.padronId,
        email: result.member.email,
      },
      local,
    };
  },
  zod$({
    dni: z.string().min(1, "Ingresá un DNI."),
  })
);

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default component$(() => {
  const localMembers = useLocalMembersLoader();
  const search = usePadronSearchAction();
  const searchResult = search.value && !search.value.failed ? search.value : null;

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      {/* Header */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Padrón
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Médicos Agremiados
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            El padrón oficial vive en los sistemas de la AMP y se consulta por DNI, de a una persona.
            Acá también ves los agremiados que ya usaron el portal.
          </p>
        </div>
      </div>

      {/* Consulta al padrón */}
      <section class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5 text-left">
        <div class="flex items-center gap-2.5">
          <LuSearch class="w-5 h-5 text-brand-green" />
          <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Consultar padrón por DNI</h2>
        </div>

        <Form action={search} class="flex flex-col sm:flex-row gap-3 max-w-xl">
          <input
            type="text"
            name="dni"
            inputMode="numeric"
            required
            placeholder="Ej: 27235644"
            class="flex-1 bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-mono font-bold"
          />
          <button
            type="submit"
            disabled={search.isRunning}
            class="px-6 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer disabled:opacity-60"
          >
            {search.isRunning ? "Consultando..." : "Consultar"}
          </button>
        </Form>

        {/* Error del servicio / validación */}
        {search.value?.failed && search.value?.message && (
          <div class="flex items-center gap-2.5 rounded-2xl border border-red-150 bg-red-50 px-4 py-3.5 text-xs font-bold text-red-800 shadow-sm max-w-xl">
            <LuAlertTriangle class="w-4 h-4 shrink-0" />
            {search.value.message}
          </div>
        )}

        {/* No figura */}
        {searchResult && !searchResult.found && (
          <div class="rounded-2xl border border-amber-150 bg-amber-50 px-4 py-3.5 text-xs font-bold text-amber-800 shadow-sm max-w-xl">
            El DNI {searchResult.dni} no figura en el padrón de agremiados de la AMP.
          </div>
        )}

        {/* Resultado del padrón */}
        {searchResult && searchResult.found && searchResult.persona && (
          <div class="rounded-2xl border border-emerald-150 bg-emerald-50/60 p-5 sm:p-6 max-w-xl space-y-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-2">
                <LuUserCheck class="w-5 h-5 text-emerald-600" />
                <span class="text-sm font-extrabold text-emerald-900">{searchResult.persona.name}</span>
              </div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                {searchResult.persona.origen || "Padrón AMP"}
              </span>
            </div>

            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
              <div class="flex justify-between sm:block">
                <dt class="font-bold text-slate-500 uppercase tracking-wider text-[10px]">DNI</dt>
                <dd class="font-mono font-bold text-slate-800">{searchResult.persona.dni}</dd>
              </div>
              <div class="flex justify-between sm:block">
                <dt class="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Identificador padrón</dt>
                <dd class="font-mono font-bold text-slate-800">{searchResult.persona.padronId ?? "—"}</dd>
              </div>
              <div class="flex justify-between sm:block sm:col-span-2">
                <dt class="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Email</dt>
                <dd class="font-semibold text-slate-800">{searchResult.persona.email || "No informado"}</dd>
              </div>
            </dl>

            <div class="pt-3 border-t border-emerald-100">
              {searchResult.local ? (
                <p class="text-[11px] font-bold text-emerald-700">
                  ✓ Ya ingresó al portal (alta local: {formatDate(searchResult.local.createdAt)})
                </p>
              ) : (
                <p class="text-[11px] font-bold text-slate-500">
                  Todavía nunca ingresó al portal. Se registrará solo la primera vez que se loguee con su DNI.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Copia local: agremiados con actividad en el portal */}
      <section class="space-y-4 text-left">
        <div class="flex items-center gap-2.5">
          <LuDatabase class="w-5 h-5 text-brand-green" />
          <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Agremiados que usaron el portal ({localMembers.value.length})
          </h2>
        </div>
        <p class="text-xs text-slate-500 font-medium max-w-3xl -mt-2">
          Esta lista no es el padrón: son las cuentas locales que se crean automáticamente cuando un
          agremiado inicia sesión. Sus datos se refrescan desde el padrón en cada ingreso.
        </p>

        <div class="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table class="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th class="px-6 py-4">DNI</th>
                <th class="px-6 py-4">Nombre Completo</th>
                <th class="px-6 py-4">Correo Electrónico</th>
                <th class="px-6 py-4">Primer Ingreso</th>
                <th class="px-6 py-4">Última Sincronización</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
              {localMembers.value.map((m) => (
                <tr key={m.id} class="hover:bg-slate-50 transition-colors">
                  <td class="px-6 py-4 font-mono text-slate-800 font-bold">{m.dni || "S/D"}</td>
                  <td class="px-6 py-4 text-slate-700">{m.name}</td>
                  <td class="px-6 py-4 text-slate-500">{m.email}</td>
                  <td class="px-6 py-4 text-slate-500">{formatDate(m.createdAt)}</td>
                  <td class="px-6 py-4 text-slate-500">{formatDate(m.lastSyncedAt)}</td>
                </tr>
              ))}
              {localMembers.value.length === 0 && (
                <tr>
                  <td colSpan={5} class="px-6 py-10 text-center text-slate-400 text-xs font-semibold">
                    Todavía ningún agremiado ingresó al portal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Club - Médicos Agremiados",
  meta: [
    {
      name: "description",
      content: "Consulta del padrón de la AMP por DNI y actividad de agremiados en el portal.",
    },
  ],
};
