import { component$, $ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { LuUsers, LuSparkles, LuTicket, LuMessageSquare, LuDownload, LuCheckCircle2, LuPercent, LuStore } from "@qwikest/icons/lucide";
import { desc } from "drizzle-orm";
import { getDB } from "~/db";
import { users as usersTable, customBenefits as customBenefitsTable, coupons as couponsTable } from "~/db/schema";
import { getSessions } from "~/server/chatbotDb";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { ensureDbSeeded } from "~/server/cache";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

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

export const useCouponsStatsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    const rows = await db.select().from(couponsTable).orderBy(desc(couponsTable.createdAt));

    const used = rows.filter((c) => c.status === "used");
    const active = rows.filter((c) => c.status === "active");

    // Conteo de canjes por día (últimos 7 días) según usedAt.
    const now = new Date();
    const days: { key: string; label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ key: d.toISOString().slice(0, 10), label: WEEKDAYS[d.getDay()], count: 0 });
    }
    for (const c of used) {
      if (!c.usedAt) continue;
      const key = new Date(c.usedAt).toISOString().slice(0, 10);
      const bucket = days.find((d) => d.key === key);
      if (bucket) bucket.count++;
    }

    // Top beneficios por canje.
    const benefitCounts: Record<string, number> = {};
    for (const c of used) {
      benefitCounts[c.benefitTitle] = (benefitCounts[c.benefitTitle] || 0) + 1;
    }
    const topBenefits = Object.entries(benefitCounts)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      coupons: rows.map((c) => ({
        code: c.code,
        beneficio: c.benefitTitle,
        agremiado: c.userName,
        matricula: c.userMatricula || "",
        estado: c.status,
        generado: c.createdAt,
        canjeado: c.usedAt || "",
      })),
      total: rows.length,
      used: used.length,
      active: active.length,
      redemptionRate: rows.length > 0 ? Math.round((used.length / rows.length) * 100) : 0,
      last7Days: days.map((d) => ({ label: d.label, count: d.count })),
      topBenefits,
    };
  } catch (err) {
    console.error("Failed to load coupons stats:", err);
    return { coupons: [], total: 0, used: 0, active: 0, redemptionRate: 0, last7Days: [], topBenefits: [] };
  }
});

export default component$(() => {
  const sessionsLoader = useChatSessions();
  const adminUsers = useAdminUsersLoader();
  const customBenefits = useAdminCustomBenefitsLoader();
  const couponsStats = useCouponsStatsLoader();

  // Geometría del gráfico de canjes (últimos 7 días).
  const days = couponsStats.value.last7Days;
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const chartPoints = days.map((d, i) => {
    const x = days.length > 1 ? 20 + (i * 360) / (days.length - 1) : 200;
    const y = 120 - (d.count / maxCount) * 95;
    return { x, y, ...d };
  });
  const linePath = chartPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = chartPoints.length
    ? `${linePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(1)} 120 L ${chartPoints[0].x.toFixed(1)} 120 Z`
    : "";

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

        {/* Coupon metrics row */}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Cupones Generados</span>
              <span class="text-3xl font-display font-black text-slate-800">{couponsStats.value.total}</span>
            </div>
            <LuTicket class="w-8 h-8 text-slate-400" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Cupones Usados</span>
              <span class="text-3xl font-display font-black text-emerald-700">{couponsStats.value.used}</span>
            </div>
            <LuCheckCircle2 class="w-8 h-8 text-emerald-500" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Cupones Activos</span>
              <span class="text-3xl font-display font-black text-brand-green">{couponsStats.value.active}</span>
            </div>
            <LuTicket class="w-8 h-8 text-brand-green" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Tasa de Canje</span>
              <span class="text-3xl font-display font-black text-brand-gold">{couponsStats.value.redemptionRate}%</span>
            </div>
            <LuPercent class="w-8 h-8 text-brand-gold" />
          </div>
        </div>

        {/* Banners & Reports layout */}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
          {/* Interactive SVG Chart (Left 2 cols) */}
          <div class="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-base font-bold text-slate-800 uppercase tracking-wide">Canjes de Cupones</h3>
                <p class="text-xs text-slate-400 font-medium">Cupones usados en los últimos 7 días.</p>
              </div>
              <div class="text-right">
                <span class="text-2xl font-display font-black text-emerald-700 leading-none">
                  {days.reduce((acc, d) => acc + d.count, 0)}
                </span>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">esta semana</span>
              </div>
            </div>

            {/* Real SVG Chart from coupon usage */}
            <div class="w-full h-56 bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-center relative">
              <svg viewBox="0 0 400 150" class="w-full h-full text-brand-green">
                <defs>
                  <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--color-emerald-500, #10b981)" stop-opacity="0.25" />
                    <stop offset="100%" stop-color="var(--color-emerald-500, #10b981)" stop-opacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="20" y1="25" x2="380" y2="25" stroke="#f1f5f9" stroke-width="1" />
                <line x1="20" y1="72" x2="380" y2="72" stroke="#f1f5f9" stroke-width="1" />
                <line x1="20" y1="120" x2="380" y2="120" stroke="#e2e8f0" stroke-width="1" />

                {areaPath && <path d={areaPath} fill="url(#chart-grad)" />}
                {linePath && (
                  <path d={linePath} fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                )}

                {chartPoints.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke="currentColor" stroke-width="2.5" />
                    {p.count > 0 && (
                      <text x={p.x} y={p.y - 8} fill="#0f766e" font-size="9" font-weight="bold" text-anchor="middle">
                        {p.count}
                      </text>
                    )}
                    <text x={p.x} y="140" fill="#94a3b8" font-size="8" font-weight="bold" text-anchor="middle">
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Top benefits by redemption */}
            <div class="border-t border-slate-100 pt-5">
              <h4 class="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <LuStore class="w-3.5 h-3.5" /> Beneficios más usados
              </h4>
              {couponsStats.value.topBenefits.length === 0 ? (
                <p class="text-sm text-slate-400 font-medium py-2">Todavía no hay cupones usados.</p>
              ) : (
                <div class="space-y-2.5">
                  {couponsStats.value.topBenefits.map((b, i) => {
                    const pct = Math.round((b.count / couponsStats.value.topBenefits[0].count) * 100);
                    return (
                      <div key={i} class="flex items-center gap-3">
                        <span class="text-xs font-bold text-slate-600 w-40 truncate" title={b.title}>{b.title}</span>
                        <div class="flex-grow h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div class="h-full bg-brand-green rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span class="text-xs font-black text-slate-700 w-6 text-right">{b.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
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
                onClick$={() => downloadCSV(couponsStats.value.coupons, `reporte-cupones-${Date.now()}.csv`)}
                class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-slate-700"
              >
                <div class="flex items-center gap-2">
                  <LuCheckCircle2 class="w-4 h-4 text-emerald-600" />
                  <span>Reporte de Cupones</span>
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
