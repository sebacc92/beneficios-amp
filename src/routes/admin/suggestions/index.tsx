import { component$, useSignal, useComputed$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { desc } from "drizzle-orm";
import { getDB } from "~/db";
import { suggestions } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

export const useAdminSuggestionsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }

  try {
    const db = getDB(event);

    // Self-provision the table so the panel works even before running `drizzle-kit push`
    try {
      const { sql } = await import("drizzle-orm");
      await db.run(
        sql`CREATE TABLE IF NOT EXISTS suggestions (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, email TEXT NOT NULL, telefono TEXT, tipo TEXT NOT NULL, comercio TEXT, mensaje TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'nuevo', created_at TEXT NOT NULL)`
      );
    } catch {
      console.info("suggestions table check completed.");
    }

    const result = await db
      .select()
      .from(suggestions)
      .orderBy(desc(suggestions.createdAt));
    return result;
  } catch (err) {
    console.error("Failed to load admin suggestions:", err);
    return [];
  }
});

export const useUpdateStatusAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const { eq } = await import("drizzle-orm");
      const db = getDB(requestEvent);
      await db
        .update(suggestions)
        .set({ status: data.status })
        .where(eq(suggestions.id, data.suggestionId));
      return { success: true };
    } catch (err) {
      console.error(err);
      return requestEvent.fail(500, { message: "No se pudo actualizar el estado." });
    }
  },
  zod$({
    suggestionId: z.string(),
    status: z.enum(["nuevo", "leido", "resuelto"]),
  })
);

export const useDeleteSuggestionAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const { eq } = await import("drizzle-orm");
      const db = getDB(requestEvent);
      await db.delete(suggestions).where(eq(suggestions.id, data.suggestionId));
      return { success: true };
    } catch (err) {
      console.error(err);
      return requestEvent.fail(500, { message: "No se pudo eliminar la sugerencia." });
    }
  },
  zod$({
    suggestionId: z.string(),
  })
);

const TIPO_LABELS: Record<string, string> = {
  "Sugerir Comercio": "Nuevo comercio",
  "Problema Comercio": "Inconveniente",
  "Consulta General": "Consulta",
  Otro: "Otro",
};

export default component$(() => {
  const allSuggestions = useAdminSuggestionsLoader();
  const updateStatus = useUpdateStatusAction();
  const deleteSuggestion = useDeleteSuggestionAction();

  const searchQuery = useSignal("");
  const statusFilter = useSignal("all"); // "all" | "nuevo" | "leido" | "resuelto"
  const tipoFilter = useSignal("all");

  const stats = useComputed$(() => {
    const list = allSuggestions.value;
    const total = list.length;
    const nuevos = list.filter((s) => s.status === "nuevo").length;
    const resueltos = list.filter((s) => s.status === "resuelto").length;
    const comercios = list.filter((s) => s.tipo === "Sugerir Comercio").length;
    return { total, nuevos, resueltos, comercios };
  });

  const filteredSuggestions = useComputed$(() => {
    const query = searchQuery.value.toLowerCase().trim();
    const status = statusFilter.value;
    const tipo = tipoFilter.value;
    let list = allSuggestions.value;

    if (status !== "all") list = list.filter((s) => s.status === status);
    if (tipo !== "all") list = list.filter((s) => s.tipo === tipo);

    if (query) {
      list = list.filter(
        (s) =>
          s.nombre.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query) ||
          s.mensaje.toLowerCase().includes(query) ||
          (s.comercio && s.comercio.toLowerCase().includes(query))
      );
    }

    return list;
  });

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      {/* Header Section */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Comunicación
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Buzón de Sugerencias
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Mensajes enviados por los agremiados desde el formulario público de sugerencias: nuevos comercios, inconvenientes y consultas.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Recibidas Totales</span>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-slate-800">{stats.value.total}</span>
            <span class="text-xs text-slate-400 font-semibold">mensajes</span>
          </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Sin Leer</span>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-brand-gold">{stats.value.nuevos}</span>
            <span class="text-xs text-slate-400 font-semibold">pendientes</span>
          </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Resueltas</span>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-brand-green">{stats.value.resueltos}</span>
            <span class="text-xs text-brand-green/80 font-bold">gestionadas</span>
          </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Comercios Sugeridos</span>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-slate-800">{stats.value.comercios}</span>
            <span class="text-xs text-slate-400 font-semibold">propuestas</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div class="flex flex-col sm:flex-row gap-4 justify-between items-center text-left">
        <div class="relative w-full sm:max-w-md">
          <input
            type="text"
            placeholder="Buscar por nombre, email, comercio o mensaje..."
            value={searchQuery.value}
            onInput$={(ev) => {
              searchQuery.value = (ev.target as HTMLInputElement).value;
            }}
            class="w-full bg-white text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:outline-none transition-all shadow-sm"
          />
        </div>

        <div class="flex gap-2 w-full sm:w-auto">
          <select
            value={tipoFilter.value}
            onChange$={(_, el) => {
              tipoFilter.value = el.value;
            }}
            class="bg-white text-slate-700 border border-slate-200 rounded-2xl text-xs px-4 py-3 font-bold uppercase tracking-wider focus:border-brand-green focus:outline-none transition-all shadow-sm cursor-pointer"
          >
            <option value="all">Todos los Motivos</option>
            <option value="Sugerir Comercio">Nuevo comercio</option>
            <option value="Problema Comercio">Inconveniente</option>
            <option value="Consulta General">Consulta</option>
            <option value="Otro">Otro</option>
          </select>
          <select
            value={statusFilter.value}
            onChange$={(_, el) => {
              statusFilter.value = el.value;
            }}
            class="bg-white text-slate-700 border border-slate-200 rounded-2xl text-xs px-4 py-3 font-bold uppercase tracking-wider focus:border-brand-green focus:outline-none transition-all shadow-sm cursor-pointer"
          >
            <option value="all">Todos los Estados</option>
            <option value="nuevo">Sin Leer</option>
            <option value="leido">Leídas</option>
            <option value="resuelto">Resueltas</option>
          </select>
        </div>
      </div>

      {/* Suggestions Table */}
      <div class="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm text-left">
        <table class="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <th class="px-6 py-4">Contacto</th>
              <th class="px-6 py-4">Motivo</th>
              <th class="px-6 py-4">Mensaje</th>
              <th class="px-6 py-4">Recibida</th>
              <th class="px-6 py-4 text-center">Estado</th>
              <th class="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-medium align-top">
            {filteredSuggestions.value.length > 0 ? (
              filteredSuggestions.value.map((item) => (
                <tr
                  key={item.id}
                  class={`hover:bg-slate-50 transition-colors ${item.status === "nuevo" ? "bg-brand-gold/4" : ""}`}
                >
                  <td class="px-6 py-4">
                    <div class="font-bold text-slate-800">{item.nombre}</div>
                    <div class="text-[11px] text-slate-500 mt-0.5">
                      <a href={`mailto:${item.email}`} class="hover:text-brand-green">{item.email}</a>
                    </div>
                    {item.telefono && (
                      <div class="text-[11px] text-slate-400 mt-0.5">{item.telefono}</div>
                    )}
                  </td>
                  <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider">
                      {TIPO_LABELS[item.tipo] || item.tipo}
                    </span>
                    {item.comercio && (
                      <div class="text-[11px] text-slate-500 mt-1.5 font-semibold">📍 {item.comercio}</div>
                    )}
                  </td>
                  <td class="px-6 py-4 max-w-sm">
                    <p class="text-slate-600 line-clamp-3 leading-relaxed">{item.mensaje}</p>
                  </td>
                  <td class="px-6 py-4 text-slate-550 whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleDateString("es-AR")}
                    <span class="block text-[10px] text-slate-400">
                      {new Date(item.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-center">
                    <span
                      class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                        item.status === "resuelto"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                          : item.status === "leido"
                            ? "bg-slate-100 text-slate-600 border-slate-250"
                            : "bg-amber-50 text-amber-700 border-amber-250 animate-pulse"
                      }`}
                    >
                      {item.status === "resuelto" ? "Resuelta" : item.status === "leido" ? "Leída" : "Sin leer"}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center justify-center gap-2">
                      {item.status !== "resuelto" ? (
                        <Form action={updateStatus}>
                          <input type="hidden" name="suggestionId" value={item.id} />
                          <input type="hidden" name="status" value="resuelto" />
                          <button
                            type="submit"
                            title="Marcar como resuelta"
                            class="p-2 rounded-xl border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-all"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </button>
                        </Form>
                      ) : (
                        <Form action={updateStatus}>
                          <input type="hidden" name="suggestionId" value={item.id} />
                          <input type="hidden" name="status" value="leido" />
                          <button
                            type="submit"
                            title="Reabrir (marcar como leída)"
                            class="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M16 15v-1a4 4 0 00-4-4H4m0 0l4-4m-4 4l4 4" />
                            </svg>
                          </button>
                        </Form>
                      )}

                      {item.status === "nuevo" && (
                        <Form action={updateStatus}>
                          <input type="hidden" name="suggestionId" value={item.id} />
                          <input type="hidden" name="status" value="leido" />
                          <button
                            type="submit"
                            title="Marcar como leída"
                            class="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                        </Form>
                      )}

                      <Form action={deleteSuggestion}>
                        <input type="hidden" name="suggestionId" value={item.id} />
                        <button
                          type="submit"
                          title="Eliminar"
                          onClick$={(ev) => {
                            if (!confirm(`¿Eliminar la sugerencia de "${item.nombre}"? Esta acción no se puede deshacer.`)) {
                              ev.preventDefault();
                            }
                          }}
                          class="p-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-all"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} class="px-6 py-10 text-center text-slate-400 font-bold uppercase tracking-widest bg-slate-50/50">
                  No se encontraron sugerencias con los filtros seleccionados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Club - Buzón de Sugerencias",
  meta: [
    {
      name: "description",
      content: "Administrar y responder las sugerencias enviadas por los agremiados.",
    },
  ],
};
