import { component$, $ } from "@builder.io/qwik";
import { Link, routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import {
  LuArrowRight,
  LuCalendarX,
  LuCheckCircle2,
  LuDownload,
  LuGift,
  LuInbox,
  LuMapPinOff,
  LuMessageSquare,
  LuSparkles,
  LuTicket,
  LuUsers,
} from "@qwikest/icons/lucide";
import { count, desc, gte, sql } from "drizzle-orm";
import { getDB } from "~/db";
import { users as usersTable, benefits as benefitsTable, coupons } from "~/db/schema";
import { getSessions } from "~/server/chatbotDb";
import { getCouponActivity } from "~/server/coupons";
import { countPendingMerchantRequests, countPendingSuggestions } from "~/server/club-content";
import { parseValidUntil } from "~/utils/benefit-status";
import { argentinaDay, benefitValidity, hasCoordinates } from "~/utils/benefit-admin";
import { AdminPageHeader } from "~/components/admin/page-header";
import { argentinaDateTime, toCsv } from "~/components/admin/csv";
import { useRafflesWithoutWinnerCount } from "~/routes/admin/layout";
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
      lastLoginAt: u.lastLoginAt,
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

/** Generated and redeemed coupons per Argentine day, plus the most redeemed benefits. */
export const useCouponActivityLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const activity = await getCouponActivity(event);
    const since = `${activity.days[0].day}T03:00:00.000Z`;
    const usedDay = sql<string>`date(${coupons.usedAt}, '-3 hours')`;
    const db = getDB(event);
    const [usedRows, topRows] = await Promise.all([
      db.select({ day: usedDay, total: count() }).from(coupons).where(gte(coupons.usedAt, since)).groupBy(usedDay),
      db
        .select({ benefitId: coupons.benefitId, title: sql<string>`max(${coupons.benefitTitle})`, total: count() })
        .from(coupons)
        .where(gte(coupons.usedAt, since))
        .groupBy(coupons.benefitId)
        .orderBy(desc(count()))
        .limit(5),
    ]);
    const usedByDay = new Map(usedRows.map((row) => [row.day, row.total]));
    return {
      ...activity,
      days: activity.days.map((d) => ({ ...d, used: usedByDay.get(d.day) ?? 0 })),
      top: topRows,
    };
  } catch (err) {
    console.error("Failed to load coupon activity:", err);
    return null;
  }
});

export const useInboxCountsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const [comercios, sugerencias] = await Promise.all([countPendingMerchantRequests(event), countPendingSuggestions(event)]);
    return { comercios, sugerencias };
  } catch (err) {
    console.error("Failed to count pending inbox items:", err);
    return { comercios: 0, sugerencias: 0 };
  }
});

const CHART = { width: 600, height: 220, left: 36, right: 8, top: 12, bottom: 28 };
// Brand navy for generated and the darker brand yellow for redeemed: both readable on white.
const SERIES = { generated: "#162456", used: "#D3AC00" };

const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const couponLabel = (count: number) => (count === 1 ? "1 cupón" : `${count} cupones`);

/** Bars with a 2px rounded top, anchored to the baseline. */
const barPath = (x: number, y: number, width: number, base: number) => {
  const radius = Math.min(2, width / 2, base - y);
  return `M ${x} ${base} V ${y + radius} Q ${x} ${y} ${x + radius} ${y} H ${x + width - radius} Q ${x + width} ${y} ${x + width} ${y + radius} V ${base} Z`;
};

type ChartDay = { day: string; generated: number; used: number };

const CouponActivityChart = component$<{ days: ChartDay[] }>(({ days }) => {
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const base = CHART.height - CHART.bottom;
  const max = Math.max(1, ...days.map((d) => Math.max(d.generated, d.used)));
  const yMax = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const slot = plotWidth / days.length;
  // Two bars per day with a 1px gap between them and 3px between days.
  const barWidth = Math.max(1.5, (slot - 4) / 2);
  const yFor = (value: number) => base - (value / yMax) * (base - CHART.top);
  const ticks = yMax === 1 ? [0, 1] : [0, yMax / 2, yMax];

  return (
    <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} class="h-auto w-full" role="img" aria-labelledby="coupon-chart-title">
      <title id="coupon-chart-title">
        {`Cupones generados y canjeados por día, del ${shortDay(days[0].day)} al ${shortDay(days[days.length - 1].day)}`}
      </title>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={CHART.left} x2={CHART.width - CHART.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#e2e8f0" stroke-width="1" />
          <text x={CHART.left - 8} y={yFor(tick) + 4} text-anchor="end" fill="#475569" font-size="11">{Number.isInteger(tick) ? tick : tick.toFixed(1)}</text>
        </g>
      ))}
      {days.map((d, index) => {
        const x = CHART.left + index * slot;
        // Weekly ticks counted back from today, so the latest day is always labelled.
        const showLabel = (days.length - 1 - index) % 7 === 0;
        return (
          <g key={d.day}>
            {d.generated > 0 && <path d={barPath(x + 1.5, yFor(d.generated), barWidth, base)} fill={SERIES.generated} />}
            {d.used > 0 && <path d={barPath(x + 2.5 + barWidth, yFor(d.used), barWidth, base)} fill={SERIES.used} />}
            {/* Full-height hit target so thin bars are easy to hover. */}
            <rect x={x} y={CHART.top} width={slot} height={base - CHART.top} fill="transparent" class="hover:fill-slate-900/5">
              <title>{`${shortDay(d.day)}: ${couponLabel(d.generated)} generados, ${d.used} canjeados`}</title>
            </rect>
            {showLabel && (
              <text x={x + slot / 2} y={CHART.height - 8} text-anchor="middle" fill="#475569" font-size="11">{shortDay(d.day)}</text>
            )}
          </g>
        );
      })}
      <line x1={CHART.left} x2={CHART.width - CHART.right} y1={base} y2={base} stroke="#94a3b8" stroke-width="1" />
    </svg>
  );
});

interface PendingItem {
  label: string;
  count: number;
  href: string;
  hint: string;
  icon: "inbox" | "gift" | "expired" | "map";
}

const PENDING_ICONS = {
  inbox: () => <LuInbox class="h-5 w-5" />,
  gift: () => <LuGift class="h-5 w-5" />,
  expired: () => <LuCalendarX class="h-5 w-5" />,
  map: () => <LuMapPinOff class="h-5 w-5" />,
};

export default component$(() => {
  const sessionsLoader = useChatSessions();
  const adminUsers = useAdminUsersLoader();
  const benefits = useAdminCustomBenefitsLoader();
  const activity = useCouponActivityLoader();
  const inbox = useInboxCountsLoader();
  const rafflesWithoutWinner = useRafflesWithoutWinnerCount();

  const today = argentinaDay();
  const publishedBenefits = benefits.value.filter((b) => !parseValidUntil(b.validUntil).isDraft);
  const draftCount = benefits.value.length - publishedBenefits.length;
  const featuredPublished = publishedBenefits.filter((b) => b.isFeatured).length;
  const featuredDrafts = benefits.value.filter((b) => b.isFeatured).length - featuredPublished;
  const expiredPublished = publishedBenefits.filter((b) => benefitValidity(b.validUntil, today) === "vencido").length;
  const withoutLocation = benefits.value.filter((b) => !hasCoordinates(b)).length;
  const members = adminUsers.value.filter((u) => u.role !== "admin");
  const goldMembers = members.filter((u) => u.role === "premium").length;
  const inboxTotal = inbox.value.comercios + inbox.value.sugerencias;

  const pending: PendingItem[] = [
    {
      label: inboxTotal === 1 ? "Solicitud pendiente" : "Solicitudes pendientes",
      count: inboxTotal,
      // Open the inbox that has work; merchants first, like the inbox switcher.
      href: inbox.value.comercios === 0 && inbox.value.sugerencias > 0 ? "/admin/solicitudes/?bandeja=sugerencias&estado=pending" : "/admin/solicitudes/?estado=pending",
      hint: inboxTotal ? `${inbox.value.comercios} de comercios · ${inbox.value.sugerencias} de socios` : "Nada sin responder",
      icon: "inbox",
    },
    {
      label: rafflesWithoutWinner.value === 1 ? "Sorteo sin ganador" : "Sorteos sin ganador",
      count: rafflesWithoutWinner.value,
      href: "/admin/sorteos/",
      hint: rafflesWithoutWinner.value ? "Ya se sortearon: cargá quién ganó" : "Todos los sorteos pasados tienen ganador",
      icon: "gift",
    },
    {
      label: expiredPublished === 1 ? "Beneficio vencido" : "Beneficios vencidos",
      count: expiredPublished,
      href: "/admin/benefits/?estado=publicados&vigencia=vencidos",
      hint: expiredPublished ? "Publicados, pero ya no generan cupones" : "Ningún publicado vencido",
      icon: "expired",
    },
    {
      label: "Sin ubicación",
      count: withoutLocation,
      href: "/admin/benefits/?ubicacion=sin",
      hint: withoutLocation ? "No aparecen en el mapa “Cerca mío”" : "Todos aparecen en el mapa",
      icon: "map",
    },
  ];
  const pendingTotal = pending.reduce((sum, item) => sum + item.count, 0);

  const kpis = [
    { label: "Socios registrados", value: members.length, detail: `${goldMembers} Gold`, href: "/admin/users/", icon: <LuUsers class="h-6 w-6" /> },
    { label: "Beneficios publicados", value: publishedBenefits.length, detail: draftCount ? `+ ${draftCount} en borrador` : "Sin borradores", href: "/admin/benefits/?estado=publicados", icon: <LuTicket class="h-6 w-6" /> },
    { label: "Destacados", value: featuredPublished, detail: featuredDrafts ? `+ ${featuredDrafts} en borrador` : "La portada muestra hasta 6", href: "/admin/benefits/?destacados=1", icon: <LuSparkles class="h-6 w-6" /> },
    { label: "Chats del asistente", value: sessionsLoader.value.length, detail: "Conversaciones guardadas", href: "/admin/ai/", icon: <LuMessageSquare class="h-6 w-6" /> },
  ];

  // Readable columns instead of the raw `draft|fecha` encoding.
  const benefitsReport = benefits.value.map((b) => {
    const { isDraft, validUntil } = parseValidUntil(b.validUntil);
    return {
      titulo: b.titulo,
      descuento: b.resumen,
      estado: isDraft ? "Borrador" : "Publicado",
      valido_hasta: validUntil ?? "",
      destacado: b.isFeatured ? "Sí" : "No",
      solo_gold: b.isPremiumOnly ? "Sí" : "No",
      ubicacion: hasCoordinates(b) ? "Sí" : "No",
      direccion: b.address ?? "",
      creado: argentinaDateTime(b.createdAt),
    };
  });
  const membersReport = members.map((u) => ({
    nombre: u.name,
    email: u.email,
    dni: u.numeroSocio ?? "",
    categoria: u.role === "premium" ? "Gold" : "Socio",
    alta: argentinaDateTime(u.createdAt),
    ultimo_ingreso: argentinaDateTime(u.lastLoginAt),
  }));
  const chatsReport = sessionsLoader.value.map((s) => ({
    conversacion: s.id,
    inicio: argentinaDateTime(s.createdAt),
    ultima_actividad: argentinaDateTime(s.lastActive),
    mensajes: s.messageCount,
  }));

  const downloadCSV = $((rows: Record<string, string | number | null>[], filename: string) => {
    if (rows.length === 0) return;
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  const reportButtonClass =
    "flex min-h-12 w-full items-center justify-between gap-3 border border-line bg-white px-4 py-3 text-left text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <div class="relative flex w-full flex-1 flex-col space-y-8 overflow-y-auto px-4 py-8 pb-24 text-left font-sans text-slate-800 sm:px-10 sm:py-10">
      <AdminPageHeader
        eyebrow="Inicio"
        title="Estadísticas"
        description="Lo que pasa en el Club de Beneficios: lo que espera una respuesta, los socios, los beneficios y los cupones."
      />

      <section aria-labelledby="pending-title" class="space-y-4">
        <div class="flex items-baseline justify-between gap-3">
          <h2 id="pending-title" class="heading-display text-xl text-primary">Pendientes</h2>
          {pendingTotal === 0 && (
            <p class="inline-flex items-center gap-1.5 text-sm font-semibold text-green-800">
              <LuCheckCircle2 class="h-4 w-4" /> Todo al día
            </p>
          )}
        </div>
        <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {pending.map((item) => (
            <li key={item.href + item.label}>
              <Link
                href={item.href}
                class={[
                  "group flex h-full flex-col gap-2 border border-l-4 p-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  item.count ? "border-line border-l-accent bg-white hover:border-primary hover:border-l-accent" : "border-line border-l-slate-300 bg-slate-50 hover:bg-white",
                ]}
              >
                <span class="flex items-center justify-between gap-3">
                  <span class="flex items-center gap-3">
                    <span class={["flex h-10 w-10 shrink-0 items-center justify-center", item.count ? "bg-primary text-accent" : "bg-slate-200 text-slate-600"]}>
                      {PENDING_ICONS[item.icon]()}
                    </span>
                    <span class={["font-display text-3xl font-bold leading-none tabular-nums", item.count ? "text-primary" : "text-slate-500"]}>{item.count}</span>
                  </span>
                  <LuArrowRight class="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </span>
                <span class="block text-sm font-bold text-primary">{item.label}</span>
                <span class="block text-xs text-slate-600">{item.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="kpi-title" class="space-y-4">
        <h2 id="kpi-title" class="sr-only">Resumen</h2>
        <ul class="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <li key={kpi.label}>
              <Link
                href={kpi.href}
                class="group flex h-full flex-col justify-between gap-3 border border-line bg-white p-4 transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-5"
              >
                <span class="flex items-start justify-between gap-2">
                  <span class="eyebrow text-[11px] text-slate-600">{kpi.label}</span>
                  <span class="text-primary" aria-hidden="true">{kpi.icon}</span>
                </span>
                <span>
                  <span class="block font-display text-4xl font-bold leading-none text-primary tabular-nums">{kpi.value}</span>
                  <span class="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-600">
                    {kpi.detail}
                    <LuArrowRight class="h-4 w-4 shrink-0 text-slate-400 group-hover:text-primary" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section aria-labelledby="coupons-title" class="card space-y-5 p-5 sm:p-6 xl:col-span-2">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="coupons-title" class="heading-display text-xl text-primary">Cupones de los últimos 30 días</h2>
              <p class="text-sm text-slate-600">Generados y canjeados por día (hora de Argentina).</p>
            </div>
            <Link href="/admin/cupones/" class="btn btn-outline btn-sm">Ver cupones</Link>
          </div>

          {activity.value === null ? (
            <p role="alert" class="border-l-4 border-red-600 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
              No se pudo cargar la actividad de cupones.
            </p>
          ) : activity.value.generated === 0 && activity.value.used === 0 ? (
            <p class="bg-slate-50 px-5 py-10 text-center text-sm text-slate-600">
              No se generaron ni canjearon cupones en los últimos 30 días.
            </p>
          ) : (
            <>
              <dl class="grid grid-cols-3 gap-4 border-y border-line py-4">
                <div>
                  <dt class="flex items-center gap-2 text-xs font-bold uppercase text-slate-600">
                    <span class="h-3 w-3" style={{ backgroundColor: SERIES.generated }} aria-hidden="true" />
                    Generados
                  </dt>
                  <dd class="font-display text-3xl font-bold text-primary tabular-nums">{activity.value.generated}</dd>
                </div>
                <div>
                  <dt class="flex items-center gap-2 text-xs font-bold uppercase text-slate-600">
                    <span class="h-3 w-3" style={{ backgroundColor: SERIES.used }} aria-hidden="true" />
                    Canjeados
                  </dt>
                  <dd class="font-display text-3xl font-bold text-primary tabular-nums">{activity.value.used}</dd>
                </div>
                <div>
                  <dt class="text-xs font-bold uppercase text-slate-600">Canje</dt>
                  <dd class="font-display text-3xl font-bold text-primary tabular-nums">
                    {activity.value.generated ? `${Math.round((activity.value.used / activity.value.generated) * 100)}%` : "—"}
                  </dd>
                </div>
              </dl>
              {/* Scrolls sideways on phones instead of shrinking the axis labels to a few pixels. */}
              <div class="-mx-1 overflow-x-auto px-1">
                <div class="min-w-[540px]">
                  <CouponActivityChart days={activity.value.days} />
                </div>
              </div>
              <details class="text-sm text-slate-700">
                <summary class="cursor-pointer font-bold text-primary">Ver datos por día</summary>
                <div class="mt-3 max-h-72 overflow-y-auto">
                  <table class="w-full text-left text-xs">
                    <thead class="sticky top-0 bg-white">
                      <tr class="text-slate-600">
                        <th scope="col" class="py-1 font-bold">Día</th>
                        <th scope="col" class="py-1 text-right font-bold">Generados</th>
                        <th scope="col" class="py-1 text-right font-bold">Canjeados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.value.days.map((d) => (
                        <tr key={d.day} class="border-t border-slate-100">
                          <td class="py-1">{shortDay(d.day)}</td>
                          <td class="py-1 text-right tabular-nums">{d.generated}</td>
                          <td class="py-1 text-right tabular-nums">{d.used}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </section>

        <div class="space-y-6">
          <section aria-labelledby="top-title" class="card space-y-4 p-5 sm:p-6">
            <div>
              <h2 id="top-title" class="heading-display text-xl text-primary">Más canjeados</h2>
              <p class="text-sm text-slate-600">Top 5 de los últimos 30 días.</p>
            </div>
            {activity.value?.top.length ? (
              <ol class="space-y-3">
                {activity.value.top.map((row, index) => {
                  const max = activity.value?.top[0]?.total || 1;
                  return (
                    <li key={row.benefitId}>
                      <Link href={`/admin/benefits/?editar=${encodeURIComponent(row.benefitId)}`} class="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        <span class="flex items-baseline justify-between gap-3 text-sm">
                          <span class="min-w-0 truncate font-semibold text-primary group-hover:underline">
                            <span class="mr-1.5 font-display text-slate-500">{index + 1}.</span>
                            {row.title}
                          </span>
                          <span class="shrink-0 font-display text-base font-bold tabular-nums text-primary">{row.total}</span>
                        </span>
                        <span class="mt-1 block h-2 bg-slate-100" aria-hidden="true">
                          <span class="block h-full bg-secondary" style={{ width: `${Math.max(4, (row.total / max) * 100)}%` }} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p class="bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">Todavía no hay canjes en este período.</p>
            )}
          </section>
        </div>
      </div>

      <section aria-labelledby="reports-title" class="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 id="reports-title" class="heading-display text-xl text-primary">Reportes</h2>
          <p class="text-sm text-slate-600">Descargas en CSV para abrir con Excel o Google Sheets.</p>
        </div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick$={() => downloadCSV(membersReport, `socios-lprc-${today}.csv`)}
            disabled={membersReport.length === 0}
            class={reportButtonClass}
          >
            <span class="flex items-center gap-2.5"><LuUsers class="h-4 w-4 text-primary" /> Socios</span>
            <span class="flex items-center gap-1.5 text-xs text-slate-500"><LuDownload class="h-4 w-4" /> CSV</span>
          </button>
          <a href="/admin/cupones/exportar/" download class={reportButtonClass}>
            <span class="flex items-center gap-2.5"><LuTicket class="h-4 w-4 text-primary" /> Cupones</span>
            <span class="flex items-center gap-1.5 text-xs text-slate-500"><LuDownload class="h-4 w-4" /> CSV</span>
          </a>
          <button
            type="button"
            onClick$={() => downloadCSV(benefitsReport, `beneficios-lprc-${today}.csv`)}
            disabled={benefitsReport.length === 0}
            class={reportButtonClass}
          >
            <span class="flex items-center gap-2.5"><LuSparkles class="h-4 w-4 text-primary" /> Beneficios</span>
            <span class="flex items-center gap-1.5 text-xs text-slate-500"><LuDownload class="h-4 w-4" /> CSV</span>
          </button>
          <button
            type="button"
            onClick$={() => downloadCSV(chatsReport, `chats-asistente-${today}.csv`)}
            disabled={chatsReport.length === 0}
            class={reportButtonClass}
          >
            <span class="flex items-center gap-2.5"><LuMessageSquare class="h-4 w-4 text-primary" /> Chats del asistente</span>
            <span class="flex items-center gap-1.5 text-xs text-slate-500"><LuDownload class="h-4 w-4" /> CSV</span>
          </button>
        </div>
        <p class="text-xs text-slate-500">El de cupones incluye código, beneficio, socio, DNI, estado y fechas de generación y uso.</p>
      </section>
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
