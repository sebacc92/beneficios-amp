import { component$, $ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { LuUsers, LuSparkles, LuTicket, LuMessageSquare, LuDownload } from "@qwikest/icons/lucide";
import { desc } from "drizzle-orm";
import { getDB } from "~/db";
import { users as usersTable, benefits as benefitsTable } from "~/db/schema";
import { getSessions } from "~/server/chatbotDb";
import { getCouponActivity } from "~/server/coupons";
import { parseValidUntil } from "~/utils/benefit-status";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

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
      numeroSocio: u.numeroSocio,
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
    return await db.select().from(benefitsTable).orderBy(desc(benefitsTable.createdAt));
  } catch (err) {
    console.error("Failed to load custom benefits:", err);
    return [];
  }
});

export const useCouponActivityLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    return await getCouponActivity(event);
  } catch (err) {
    console.error("Failed to load coupon activity:", err);
    return null;
  }
});

const CHART = { width: 600, height: 180, left: 36, right: 8, top: 12, bottom: 28 };

const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const couponLabel = (count: number) => (count === 1 ? "1 cupón" : `${count} cupones`);

/** Bars with a 4px rounded top, anchored to the baseline. */
const barPath = (x: number, y: number, width: number, base: number) => {
  const radius = Math.min(4, width / 2, base - y);
  return `M ${x} ${base} V ${y + radius} Q ${x} ${y} ${x + radius} ${y} H ${x + width - radius} Q ${x + width} ${y} ${x + width} ${y + radius} V ${base} Z`;
};

const CouponActivityChart = component$<{ days: { day: string; generated: number }[] }>(({ days }) => {
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const base = CHART.height - CHART.bottom;
  const max = Math.max(1, ...days.map((d) => d.generated));
  const yMax = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const slot = plotWidth / days.length;
  const barWidth = Math.max(2, slot - 4);
  const yFor = (value: number) => base - (value / yMax) * (base - CHART.top);
  const ticks = yMax === 1 ? [0, 1] : [0, yMax / 2, yMax];

  return (
    <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} class="w-full h-auto text-brand-navy" role="img" aria-labelledby="coupon-chart-title">
      <title id="coupon-chart-title">
        {`Cupones generados por día, del ${shortDay(days[0].day)} al ${shortDay(days[days.length - 1].day)}`}
      </title>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={CHART.left} x2={CHART.width - CHART.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#e2e8f0" stroke-width="1" />
          <text x={CHART.left - 8} y={yFor(tick) + 4} text-anchor="end" fill="#64748b" font-size="11">{Number.isInteger(tick) ? tick : tick.toFixed(1)}</text>
        </g>
      ))}
      {days.map((d, index) => {
        const x = CHART.left + index * slot;
        // Weekly ticks counted back from today, so the latest day is always labelled.
        const showLabel = (days.length - 1 - index) % 7 === 0;
        return (
          <g key={d.day}>
            {d.generated > 0 && <path d={barPath(x + 2, yFor(d.generated), barWidth, base)} fill="currentColor" />}
            {/* Full-height hit target so thin bars are easy to hover. */}
            <rect x={x} y={CHART.top} width={slot} height={base - CHART.top} fill="transparent" class="hover:fill-slate-900/5">
              <title>{`${shortDay(d.day)}: ${couponLabel(d.generated)}`}</title>
            </rect>
            {showLabel && (
              <text x={x + slot / 2} y={CHART.height - 8} text-anchor="middle" fill="#64748b" font-size="11">{shortDay(d.day)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
});

export default component$(() => {
  const sessionsLoader = useChatSessions();
  const adminUsers = useAdminUsersLoader();
  const benefits = useAdminCustomBenefitsLoader();
  const activity = useCouponActivityLoader();

  const publishedBenefits = benefits.value.filter((b) => !parseValidUntil(b.validUntil).isDraft);
  const draftCount = benefits.value.length - publishedBenefits.length;
  const featuredPublished = publishedBenefits.filter((b) => b.isFeatured).length;
  const featuredDrafts = benefits.value.filter((b) => b.isFeatured).length - featuredPublished;
  const members = adminUsers.value.filter((u) => u.role !== "admin");
  // Readable columns instead of the raw `draft|fecha` encoding.
  const benefitsReport = benefits.value.map((b) => {
    const { isDraft, validUntil } = parseValidUntil(b.validUntil);
    return {
      titulo: b.titulo,
      descuento: b.resumen,
      estado: isDraft ? "Borrador" : "Activo",
      valido_hasta: validUntil ?? "",
      destacado: b.isFeatured ? "Sí" : "No",
      solo_gold: b.isPremiumOnly ? "Sí" : "No",
      creado: b.createdAt,
    };
  });

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
            <span class="w-2 h-2 rounded-full bg-brand-navy"></span>
            <span class="text-[11px] font-extrabold tracking-widest text-slate-500 uppercase">
              Administración / Monitoreo
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-none">
            Estadísticas Generales
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Visualizá métricas clave, descargas de cupones y rendimiento general del club de beneficios.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick$={() => downloadCSV(members, `reporte-socios-${Date.now()}.csv`)}
            disabled={members.length === 0}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LuDownload class="w-4 h-4" />
            <span>Exportar Activos</span>
          </button>
        </div>
      </div>

      <div class="space-y-8 animate-in fade-in duration-300">
        {/* Metrics row */}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Total Activos</span>
              <span class="text-3xl font-display font-black text-slate-800">
                {members.length}
              </span>
            </div>
            <LuUsers class="w-8 h-8 text-brand-navy" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Beneficios Destacados</span>
              <span class="text-3xl font-display font-black text-brand-gold">{featuredPublished}</span>
              {featuredDrafts > 0 && (
                <span class="block text-xs font-medium text-slate-500">+ {featuredDrafts} en borrador</span>
              )}
            </div>
            <LuSparkles class="w-8 h-8 text-brand-gold" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Beneficios publicados</span>
              <span class="text-3xl font-display font-black text-slate-800">{publishedBenefits.length}</span>
              {draftCount > 0 && (
                <span class="block text-xs font-medium text-slate-500">+ {draftCount} en borrador</span>
              )}
            </div>
            <LuTicket class="w-8 h-8 text-purple-500" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Chats Auditados</span>
              <span class="text-3xl font-display font-black text-emerald-700">{sessionsLoader.value.length}</span>
            </div>
            <LuMessageSquare class="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        {/* Banners & Reports layout */}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
          {/* Coupon activity (left 2 cols) */}
          <div class="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 class="text-base font-bold text-slate-800 uppercase tracking-wide">Cupones de los últimos 30 días</h3>
              <p class="text-xs text-slate-500 font-medium">Cupones generados por día (hora de Argentina).</p>
            </div>

            {activity.value === null ? (
              <p role="alert" class="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
                No se pudo cargar la actividad de cupones.
              </p>
            ) : activity.value.generated === 0 ? (
              <p class="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                No se generaron cupones en los últimos 30 días.
              </p>
            ) : (
              <>
                <dl class="grid grid-cols-3 gap-4">
                  <div>
                    <dt class="text-xs font-bold text-slate-500 uppercase">Generados</dt>
                    <dd class="text-2xl font-display font-black text-slate-800">{activity.value.generated}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-bold text-slate-500 uppercase">Canjeados</dt>
                    <dd class="text-2xl font-display font-black text-slate-800">{activity.value.used}</dd>
                  </div>
                  <div>
                    <dt class="text-xs font-bold text-slate-500 uppercase">Canje</dt>
                    <dd class="text-2xl font-display font-black text-slate-800">
                      {Math.round((activity.value.used / activity.value.generated) * 100)}%
                    </dd>
                  </div>
                </dl>
                <CouponActivityChart days={activity.value.days} />
                <details class="text-sm text-slate-600">
                  <summary class="cursor-pointer font-bold text-slate-700">Ver datos por día</summary>
                  <table class="mt-3 w-full text-left text-xs">
                    <thead>
                      <tr class="text-slate-500">
                        <th scope="col" class="py-1 font-bold">Día</th>
                        <th scope="col" class="py-1 font-bold text-right">Cupones generados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.value.days.map((d) => (
                        <tr key={d.day} class="border-t border-slate-100">
                          <td class="py-1">{shortDay(d.day)}</td>
                          <td class="py-1 text-right tabular-nums">{d.generated}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </div>

          {/* Downloader Reports Panel (Right 1 col) */}
          <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 class="text-base font-bold text-slate-800 uppercase tracking-wide">Reportes Descargables</h3>
              <p class="text-xs text-slate-400 font-medium">Exportaciones directas inmediatas en formato CSV.</p>
            </div>

            <div class="flex flex-col gap-3 pt-2">
              <button
                onClick$={() => downloadCSV(members, `socios_report_${Date.now()}.csv`)}
                disabled={members.length === 0}
                class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div class="flex items-center gap-2">
                  <LuUsers class="w-4 h-4 text-brand-navy" />
                  <span>Reporte de Activos</span>
                </div>
                <div class="flex items-center gap-1.5 text-slate-400">
                  <LuDownload class="w-3.5 h-3.5" />
                  <span>CSV</span>
                </div>
              </button>

              <button
                onClick$={() => downloadCSV(benefitsReport, `benefits_report_${Date.now()}.csv`)}
                disabled={benefitsReport.length === 0}
                class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                disabled={sessionsLoader.value.length === 0}
                class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
  title: "LPRC Club - Estadísticas",
  meta: [
    {
      name: "description",
      content: "Estadísticas del panel de administración.",
    },
  ],
};
