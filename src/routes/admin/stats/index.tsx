import { component$, $ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { LuUsers, LuTicket, LuMessageSquare, LuDownload, LuCheckCircle2, LuPercent, LuStore, LuBell, LuInbox, LuUserCheck, LuFileText, LuMapPin } from "@qwikest/icons/lucide";
import { desc } from "drizzle-orm";
import { getDB } from "~/db";
import {
  users as usersTable,
  customBenefits as customBenefitsTable,
  coupons as couponsTable,
  suggestions as suggestionsTable,
  merchantRequests as merchantRequestsTable,
  pushSubscriptions as pushSubscriptionsTable,
} from "~/db/schema";
import { getSessions } from "~/server/chatbotDb";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { ensureDbSeeded, ensureTrackingSchema } from "~/server/cache";

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
      lastSyncedAt: u.lastSyncedAt, // se actualiza en cada login → "último ingreso"
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

export const useEngagementStats = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  const empty = {
    suggestions: { total: 0, nuevas: 0, byTipo: [] as { tipo: string; count: number }[] },
    merchants: { total: 0, pending: 0 },
    pushSubscribers: 0,
  };
  try {
    const db = getDB(event);
    const [sugRows, merchRows, pushRows] = await Promise.all([
      db.select().from(suggestionsTable),
      db.select().from(merchantRequestsTable),
      db.select().from(pushSubscriptionsTable),
    ]);

    const tipoCounts: Record<string, number> = {};
    for (const s of sugRows) tipoCounts[s.tipo] = (tipoCounts[s.tipo] || 0) + 1;

    return {
      suggestions: {
        total: sugRows.length,
        nuevas: sugRows.filter((s) => s.status === "nuevo").length,
        byTipo: Object.entries(tipoCounts)
          .map(([tipo, count]) => ({ tipo, count }))
          .sort((a, b) => b.count - a.count),
      },
      merchants: {
        total: merchRows.length,
        pending: merchRows.filter((m) => m.status === "pending").length,
      },
      pushSubscribers: pushRows.length,
    };
  } catch (err) {
    console.error("Failed to load engagement stats:", err);
    return empty;
  }
});

export const useTrackingStats = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  const empty = {
    topViewed: [] as { titulo: string; views: number }[],
    totalViews: 0,
    totalPdfDownloads: 0,
    scansTotal: 0,
    scansOk: 0,
    scansLast7d: 0,
  };
  try {
    const db = getDB(event);
    await ensureTrackingSchema(db);
    const { sql } = await import("drizzle-orm");

    const benRows = (await db.all(
      sql`SELECT titulo, COALESCE(views,0) AS views, COALESCE(pdf_downloads,0) AS pdf FROM custom_benefits`
    )) as any[];
    const totalViews = benRows.reduce((a, r) => a + Number(r.views || 0), 0);
    const totalPdfDownloads = benRows.reduce((a, r) => a + Number(r.pdf || 0), 0);
    const topViewed = benRows
      .map((r) => ({ titulo: String(r.titulo), views: Number(r.views || 0) }))
      .filter((r) => r.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    const scanRows = (await db.all(sql`SELECT ok, created_at AS createdAt FROM credential_scans`)) as any[];
    const now = Date.now();
    const scansOk = scanRows.filter((r) => Number(r.ok) === 1).length;
    const scansLast7d = scanRows.filter((r) => {
      const t = Date.parse(r.createdAt);
      return !isNaN(t) && now - t <= 7 * 86400000;
    }).length;

    return { topViewed, totalViews, totalPdfDownloads, scansTotal: scanRows.length, scansOk, scansLast7d };
  } catch (err) {
    console.error("Failed to load tracking stats:", err);
    return empty;
  }
});

// Etiqueta "AAAA-MM" → "Mmm AA" (ej. "2026-07" → "Jul 26"). En español, corto.
const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const mi = Math.max(0, Math.min(11, Number(m) - 1));
  return `${MONTHS_ES[mi]} ${y.slice(2)}`;
}

export default component$(() => {
  const sessionsLoader = useChatSessions();
  const engagement = useEngagementStats();
  const tracking = useTrackingStats();
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

  // --- Métricas derivadas (todas con datos ya existentes en la base) ---
  const now = Date.now();
  const DAY = 86400000;

  // Agremiados: registrados en el portal (la tabla users es la copia local: sólo
  // quienes ya ingresaron alguna vez), activos (login en los últimos 30 días vía
  // last_synced_at) y altas por mes (created_at).
  const members = adminUsers.value.filter((u) => u.role !== "admin");
  const activeMembers30d = members.filter((u) => {
    const t = u.lastSyncedAt ? Date.parse(u.lastSyncedAt) : NaN;
    return !isNaN(t) && now - t <= 30 * DAY;
  }).length;

  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const dd = new Date();
    dd.setDate(1);
    dd.setMonth(dd.getMonth() - i);
    monthKeys.push(`${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`);
  }
  const signupsByMonth = monthKeys.map((k) => ({
    key: k,
    label: monthLabel(k),
    count: members.filter((u) => (u.createdAt || "").slice(0, 7) === k).length,
  }));
  const maxSignups = Math.max(1, ...signupsByMonth.map((s) => s.count));
  const signupsThisMonth = signupsByMonth[signupsByMonth.length - 1]?.count ?? 0;

  // Salud del catálogo (custom_benefits).
  const benefits = customBenefits.value;
  const isDraft = (v: string | null | undefined) => !!v && (v === "draft" || v.startsWith("draft|"));
  const borradores = benefits.filter((b) => isDraft(b.validUntil)).length;
  const publicados = benefits.length - borradores;
  const conPdf = benefits.filter((b) => !!b.pdfUrl).length;
  const conCoords = benefits.filter((b) => !!b.latitud && !!b.longitud).length;
  const porVencer = benefits.filter((b) => {
    if (isDraft(b.validUntil) || !b.validUntil) return false;
    const t = Date.parse(b.validUntil);
    if (isNaN(t)) return false;
    const diff = t - now;
    return diff >= 0 && diff <= 30 * DAY;
  }).length;

  // Uso del chatbot (chat_sessions / chat_messages).
  const totalSessions = sessionsLoader.value.length;
  const totalMessages = sessionsLoader.value.reduce((a, s) => a + s.messageCount, 0);
  const avgMessages = totalSessions > 0 ? Math.round((totalMessages / totalSessions) * 10) / 10 : 0;
  const sessions7d = sessionsLoader.value.filter((s) => {
    const raw = s.lastActive || s.createdAt;
    const t = raw ? Date.parse(raw) : NaN;
    return !isNaN(t) && now - t <= 7 * DAY;
  }).length;

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
              <span class="text-xs font-bold text-slate-400 uppercase block">Agremiados registrados</span>
              <span class="text-3xl font-display font-black text-slate-800">{members.length}</span>
              <span class="text-[10px] text-slate-400 font-semibold block mt-0.5">ingresaron al portal (no es el padrón total)</span>
            </div>
            <LuUsers class="w-8 h-8 text-brand-green" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Beneficios publicados</span>
              <span class="text-3xl font-display font-black text-slate-800">{publicados}</span>
              <span class="text-[10px] text-slate-400 font-semibold block mt-0.5">
                {borradores} en borrador · {customBenefits.value.filter((b) => b.isFeatured).length} destacados
              </span>
            </div>
            <LuTicket class="w-8 h-8 text-purple-500" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Agremiados activos</span>
              <span class="text-3xl font-display font-black text-brand-green">{activeMembers30d}</span>
              <span class="text-[10px] text-slate-400 font-semibold block mt-0.5">ingresaron en los últimos 30 días</span>
            </div>
            <LuUserCheck class="w-8 h-8 text-brand-green" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Chats del asistente</span>
              <span class="text-3xl font-display font-black text-emerald-700">{sessionsLoader.value.length}</span>
              <span class="text-[10px] text-slate-400 font-semibold block mt-0.5">{avgMessages} mensajes/charla · {sessions7d} en 7 días</span>
            </div>
            <LuMessageSquare class="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        {/* Engagement row: suscriptores push, sugerencias, solicitudes de comercios, altas del mes */}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Suscriptores push</span>
              <span class="text-3xl font-display font-black text-slate-800">{engagement.value.pushSubscribers}</span>
              <span class="text-[10px] text-slate-400 font-semibold block mt-0.5">reciben notificaciones</span>
            </div>
            <LuBell class="w-8 h-8 text-brand-gold" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Sugerencias nuevas</span>
              <span class="text-3xl font-display font-black text-slate-800">{engagement.value.suggestions.nuevas}</span>
              <span class="text-[10px] text-slate-400 font-semibold block mt-0.5">{engagement.value.suggestions.total} en total</span>
            </div>
            <LuInbox class="w-8 h-8 text-purple-500" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Comercios por revisar</span>
              <span class="text-3xl font-display font-black text-slate-800">{engagement.value.merchants.pending}</span>
              <span class="text-[10px] text-slate-400 font-semibold block mt-0.5">{engagement.value.merchants.total} solicitudes recibidas</span>
            </div>
            <LuStore class="w-8 h-8 text-brand-green" />
          </div>

          <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase block">Altas este mes</span>
              <span class="text-3xl font-display font-black text-slate-800">{signupsThisMonth}</span>
              <span class="text-[10px] text-slate-400 font-semibold block mt-0.5">nuevos agremiados en el portal</span>
            </div>
            <LuUsers class="w-8 h-8 text-slate-400" />
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

        {/* Catálogo · Altas · Sugerencias */}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
          {/* Salud del catálogo */}
          <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 class="text-base font-bold text-slate-800 uppercase tracking-wide">Salud del catálogo</h3>
            <div class="space-y-3">
              <div class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-2 text-xs font-bold text-slate-600"><LuFileText class="w-4 h-4 text-brand-green" /> Publicados</span>
                <span class="text-sm font-black text-slate-800">{publicados}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-2 text-xs font-bold text-slate-600"><LuFileText class="w-4 h-4 text-slate-400" /> Borradores</span>
                <span class="text-sm font-black text-slate-800">{borradores}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-2 text-xs font-bold text-slate-600"><LuTicket class="w-4 h-4 text-amber-500" /> Por vencer (30 días)</span>
                <span class={["text-sm font-black", porVencer > 0 ? "text-amber-600" : "text-slate-800"]}>{porVencer}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-2 text-xs font-bold text-slate-600"><LuFileText class="w-4 h-4 text-red-500" /> Con PDF</span>
                <span class="text-sm font-black text-slate-800">{conPdf}</span>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-2 text-xs font-bold text-slate-600"><LuMapPin class="w-4 h-4 text-brand-green" /> En el mapa (con ubicación)</span>
                <span class="text-sm font-black text-slate-800">{conCoords}</span>
              </div>
            </div>
          </div>

          {/* Altas de agremiados por mes */}
          <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 class="text-base font-bold text-slate-800 uppercase tracking-wide">Altas de agremiados</h3>
              <p class="text-xs text-slate-400 font-medium">Nuevos registros en el portal · últimos 6 meses.</p>
            </div>
            {members.length === 0 ? (
              <div class="h-40 flex items-center justify-center text-center text-xs text-slate-400 font-medium">
                Todavía no hay agremiados registrados en el portal.
              </div>
            ) : (
              <div class="flex items-end justify-between gap-2 h-40 pt-2">
                {signupsByMonth.map((m) => (
                  <div key={m.key} class="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                    <span class="text-[10px] font-black text-slate-600">{m.count}</span>
                    <div
                      class="w-full max-w-[28px] rounded-t-lg bg-brand-green/80"
                      style={{ height: `${Math.max(4, (m.count / maxSignups) * 100)}%` }}
                    />
                    <span class="text-[9px] font-bold text-slate-400 uppercase">{m.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sugerencias por tipo */}
          <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 class="text-base font-bold text-slate-800 uppercase tracking-wide">Sugerencias recibidas</h3>
              <p class="text-xs text-slate-400 font-medium">
                {engagement.value.suggestions.nuevas} sin leer · {engagement.value.suggestions.total} en total.
              </p>
            </div>
            {engagement.value.suggestions.byTipo.length === 0 ? (
              <div class="h-40 flex items-center justify-center text-center text-xs text-slate-400 font-medium">
                Todavía no llegaron sugerencias por el formulario de contacto.
              </div>
            ) : (
              <div class="space-y-2.5">
                {engagement.value.suggestions.byTipo.map((t) => {
                  const pct = Math.round((t.count / engagement.value.suggestions.byTipo[0].count) * 100);
                  return (
                    <div key={t.tipo} class="flex items-center gap-3">
                      <span class="text-xs font-bold text-slate-600 w-32 truncate" title={t.tipo}>{t.tipo}</span>
                      <div class="flex-grow h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-purple-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span class="text-xs font-black text-slate-700 w-6 text-right">{t.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tracking: vistas, descargas de PDF y escaneos de credencial */}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
          {/* Cards de tracking */}
          <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
            <div class="bg-white p-5 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase block">Vistas de beneficios</span>
                <span class="text-2xl font-display font-black text-slate-800">{tracking.value.totalViews}</span>
              </div>
              <LuMapPin class="w-7 h-7 text-brand-green" />
            </div>
            <div class="bg-white p-5 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase block">Descargas de PDF</span>
                <span class="text-2xl font-display font-black text-slate-800">{tracking.value.totalPdfDownloads}</span>
              </div>
              <LuFileText class="w-7 h-7 text-red-500" />
            </div>
            <div class="bg-white p-5 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase block">Escaneos de credencial</span>
                <span class="text-2xl font-display font-black text-slate-800">{tracking.value.scansTotal}</span>
                <span class="text-[10px] text-slate-400 font-semibold block mt-0.5">
                  {tracking.value.scansOk} válidas · {tracking.value.scansLast7d} en 7 días
                </span>
              </div>
              <LuCheckCircle2 class="w-7 h-7 text-emerald-500" />
            </div>
          </div>

          {/* Beneficios más vistos */}
          <div class="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 class="text-base font-bold text-slate-800 uppercase tracking-wide">Beneficios más vistos</h3>
              <p class="text-xs text-slate-400 font-medium">Vistas acumuladas de la ficha del beneficio.</p>
            </div>
            {tracking.value.topViewed.length === 0 ? (
              <div class="flex items-center gap-2.5 py-3 px-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <LuMapPin class="w-4 h-4 text-slate-300 flex-shrink-0" />
                <p class="text-xs text-slate-500 font-medium">
                  Todavía no hay vistas registradas. El ranking va a aparecer a medida que los agremiados abran las fichas.
                </p>
              </div>
            ) : (
              <div class="space-y-2.5">
                {tracking.value.topViewed.map((b, i) => {
                  const pct = Math.round((b.views / tracking.value.topViewed[0].views) * 100);
                  return (
                    <div key={i} class="flex items-center gap-3">
                      <span class="text-xs font-bold text-slate-600 w-40 truncate" title={b.titulo}>{b.titulo}</span>
                      <div class="flex-grow h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-brand-green rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span class="text-xs font-black text-slate-700 w-8 text-right">{b.views}</span>
                    </div>
                  );
                })}
              </div>
            )}
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
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  {days.reduce((acc, d) => acc + d.count, 0) === 1 ? "canje esta semana" : "canjes esta semana"}
                </span>
              </div>
            </div>

            {/* Real SVG Chart from coupon usage — con estado vacío amable */}
            {days.reduce((acc, d) => acc + d.count, 0) === 0 ? (
              <div class="w-full h-56 bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2">
                <LuTicket class="w-8 h-8 text-slate-300" />
                <p class="text-sm font-bold text-slate-500">Todavía no hay canjes esta semana</p>
                <p class="text-xs text-slate-400 font-medium max-w-xs">Cuando los comercios registren usos de cupones, vas a ver acá la evolución día a día.</p>
              </div>
            ) : (
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
            )}

            {/* Top benefits by redemption */}
            <div class="border-t border-slate-100 pt-5">
              <h4 class="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <LuStore class="w-3.5 h-3.5" /> Beneficios más usados
              </h4>
              {couponsStats.value.topBenefits.length === 0 ? (
                <div class="flex items-center gap-2.5 py-3 px-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <LuStore class="w-4 h-4 text-slate-300 flex-shrink-0" />
                  <p class="text-xs text-slate-500 font-medium">
                    Todavía no hay cupones usados. El ranking de beneficios va a aparecer cuando los comercios registren los primeros canjes.
                  </p>
                </div>
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
