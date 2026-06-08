import { component$, $ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { LuUsers, LuSparkles, LuTicket, LuMessageSquare, LuDownload } from "@qwikest/icons/lucide";
import { desc } from "drizzle-orm";
import { getDB } from "~/db";
import { users as usersTable, customBenefits as customBenefitsTable } from "~/db/schema";
import { getSessions } from "~/server/chatbotDb";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { ensureDbSeeded } from "~/server/cache";

// --- SECURITY & LOADERS ---

export const useChatSessions = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  const sessions = await getSessions(event);
  return sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    lastActive: s.lastActive,
    messageCount: s.messages.length,
  }));
});

export const useAdminUsersLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    const result = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    return result.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      matricula: u.matricula,
      role: u.role,
      createdAt: u.createdAt,
    }));
  } catch (err) {
    console.error("Failed to load admin users:", err);
    return [];
  }
});

export const useAdminCustomBenefitsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    await ensureDbSeeded(db);
    return await db.select().from(customBenefitsTable).orderBy(desc(customBenefitsTable.createdAt));
  } catch (err) {
    console.error("Failed to load custom benefits:", err);
    return [];
  }
});

export default component$(() => {
  const sessionsLoader = useChatSessions();
  const adminUsers = useAdminUsersLoader();
  const customBenefits = useAdminCustomBenefitsLoader();

  // Client-side CSV download utility
  const downloadCSV = $((dataList: any[], filename: string) => {
    if (dataList.length === 0) return;
    const headers = Object.keys(dataList[0]).join(",");
    const rows = dataList.map((row) =>
      Object.values(row)
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      {/* SaaS Dashboard layout header */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Monitoreo
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Estadísticas Generales
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Visualizá métricas clave, descargas de cupones y rendimiento general del club de beneficios.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick$={() => downloadCSV(adminUsers.value.filter((u) => u.role !== "admin"), `reporte-agremiados-${Date.now()}.csv`)}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
          >
            <LuDownload class="w-4 h-4" />
            <span>Exportar Agremiados</span>
          </button>
        </div>
      </div>

      <div class="space-y-8 animate-in fade-in duration-300">
        {/* Metrics row */}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Total Agremiados</span>
              <span class="text-3xl font-display font-black text-slate-800">
                {adminUsers.value.filter((u) => u.role !== "admin").length}
              </span>
            </div>
            <LuUsers class="w-8 h-8 text-brand-green" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Beneficios Destacados</span>
              <span class="text-3xl font-display font-black text-brand-gold">
                {customBenefits.value.filter((b) => b.isFeatured).length}
              </span>
            </div>
            <LuSparkles class="w-8 h-8 text-brand-gold" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Beneficios</span>
              <span class="text-3xl font-display font-black text-slate-800">{customBenefits.value.length}</span>
            </div>
            <LuTicket class="w-8 h-8 text-purple-500" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Chats Auditados</span>
              <span class="text-3xl font-display font-black text-emerald-700">{sessionsLoader.value.length}</span>
            </div>
            <LuMessageSquare class="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        {/* Banners & Reports layout */}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
          {/* Interactive SVG Chart (Left 2 cols) */}
          <div class="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 class="text-base font-bold text-slate-800 uppercase tracking-wide">Tendencia de Uso Semanal</h3>
              <p class="text-xs text-slate-400 font-medium">Visualización de interacciones del chatbot e ingresos al portal.</p>
            </div>

            {/* Breathtaking Pure SVG Interactive Chart */}
            <div class="w-full h-56 bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-center relative">
              <svg viewBox="0 0 400 150" class="w-full h-full text-brand-green">
                <defs>
                  <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--color-emerald-500, #10b981)" stop-opacity="0.25" />
                    <stop offset="100%" stop-color="var(--color-emerald-500, #10b981)" stop-opacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="20" y1="20" x2="380" y2="20" stroke="#f1f5f9" stroke-width="1" />
                <line x1="20" y1="60" x2="380" y2="60" stroke="#f1f5f9" stroke-width="1" />
                <line x1="20" y1="100" x2="380" y2="100" stroke="#f1f5f9" stroke-width="1" />

                {/* Shaded Area */}
                <path
                  d="M 20 120 L 70 90 L 140 100 L 210 50 L 280 70 L 350 30 L 380 40 L 380 120 Z"
                  fill="url(#chart-grad)"
                />

                {/* Line Chart */}
                <path
                  d="M 20 120 L 70 90 L 140 100 L 210 50 L 280 70 L 350 30 L 380 40"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />

                {/* Nodes */}
                <circle cx="70" cy="90" r="4" fill="currentColor" />
                <circle cx="210" cy="50" r="4" fill="currentColor" />
                <circle cx="350" cy="30" r="4" fill="currentColor" />

                {/* SVG Labels */}
                <text x="20" y="140" fill="#94a3b8" font-size="8" font-weight="bold">LUN</text>
                <text x="140" y="140" fill="#94a3b8" font-size="8" font-weight="bold">MIE</text>
                <text x="280" y="140" fill="#94a3b8" font-size="8" font-weight="bold">VIE</text>
                <text x="360" y="140" fill="#94a3b8" font-size="8" font-weight="bold">DOM</text>
              </svg>
            </div>
          </div>

          {/* Downloader Reports Panel (Right 1 col) */}
          <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 class="text-base font-bold text-slate-800 uppercase tracking-wide">Reportes Descargables</h3>
              <p class="text-xs text-slate-400 font-medium">Exportaciones directas inmediatas en formato CSV.</p>
            </div>

            <div class="flex flex-col gap-3 pt-2">
              <button
                onClick$={() => downloadCSV(adminUsers.value.filter((u) => u.role !== "admin"), `agremiados_report_${Date.now()}.csv`)}
                class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-slate-700"
              >
                <div class="flex items-center gap-2">
                  <LuUsers class="w-4 h-4 text-brand-green" />
                  <span>Reporte de Agremiados</span>
                </div>
                <div class="flex items-center gap-1.5 text-slate-400">
                  <LuDownload class="w-3.5 h-3.5" />
                  <span>CSV</span>
                </div>
              </button>

              <button
                onClick$={() => downloadCSV(customBenefits.value, `custom_benefits_report_${Date.now()}.csv`)}
                class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-slate-700"
              >
                <div class="flex items-center gap-2">
                  <LuTicket class="w-4 h-4 text-purple-500" />
                  <span>Reporte de Beneficios</span>
                </div>
                <div class="flex items-center gap-1.5 text-slate-400">
                  <LuDownload class="w-3.5 h-3.5" />
                  <span>CSV</span>
                </div>
              </button>

              <button
                onClick$={() => downloadCSV(sessionsLoader.value, `chatbot_audit_report_${Date.now()}.csv`)}
                class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-slate-700"
              >
                <div class="flex items-center gap-2">
                  <LuMessageSquare class="w-4 h-4 text-emerald-500" />
                  <span>Reporte de Auditoría de Chats</span>
                </div>
                <div class="flex items-center gap-1.5 text-slate-400">
                  <LuDownload class="w-3.5 h-3.5" />
                  <span>CSV</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Club - Estadísticas",
  meta: [
    {
      name: "description",
      content: "Estadísticas del panel de administración.",
    },
  ],
};
