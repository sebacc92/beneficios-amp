import { component$ } from "@builder.io/qwik";
import { Link, routeLoader$, useLocation, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { getAdminCouponPage, parseAdminCouponQuery } from "~/server/admin-coupons";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

export const useAdminCouponsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }

  const query = parseAdminCouponQuery(event.url);
  try {
    return { query, ...(await getAdminCouponPage(event, query)), loadError: false };
  } catch (err) {
    console.error("Failed to load admin coupons:", err);
    return {
      query,
      records: [],
      pageSize: 25,
      total: 0,
      page: 1,
      pages: 1,
      stats: { total: 0, redeemed: 0, active: 0, rate: 0, topBenefits: [] },
      loadError: true,
    };
  }
});

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  used: { label: "Canjeado", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expired: { label: "Vencido", class: "bg-slate-100 text-slate-600 border-slate-200" },
  active: { label: "Activo", class: "bg-amber-50 text-amber-800 border-amber-200" },
};

// Workers render in UTC, so the club's timezone has to be explicit.
const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const StatusBadge = component$<{ status: string }>(({ status }) => {
  const badge = STATUS_LABELS[status] ?? STATUS_LABELS.active;
  return (
    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border uppercase tracking-wider ${badge.class}`}>
      {badge.label}
    </span>
  );
});

/** Builds the list URL keeping the other filters; going back to page 1 unless a page is given. */
const couponsHref = (current: URL, changes: Record<string, string | number | null>) => {
  const url = new URL(current);
  url.searchParams.delete("pagina");
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "" || (key === "estado" && value === "all") || (key === "pagina" && value === 1)) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
};

export default component$(() => {
  const data = useAdminCouponsLoader();
  const location = useLocation();
  const navigate = useNavigate();
  const { query, records, pageSize, total, page, pages } = data.value;

  const stats = data.value.stats;
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      {/* Header Section */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-navy"></span>
            <span class="text-[11px] font-extrabold tracking-widest text-slate-500 uppercase">
              Administración / Transacciones
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-none">
            Historial de Cupones
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Monitoreá el uso de cupones de beneficios, registros de canje y estadísticas generales de redención.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block">Generados Totales</span>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-slate-800">{stats.total}</span>
            <span class="text-xs text-slate-400 font-semibold">cupones</span>
          </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block">Canjeados (Usados)</span>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-brand-navy">{stats.redeemed}</span>
            <span class="text-xs text-brand-navy/80 font-bold">canjes exitosos</span>
          </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block">Tasa de Redención</span>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-brand-gold">{stats.rate}%</span>
            <span class="text-xs text-slate-400 font-semibold">de efectividad</span>
          </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-2">
          <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest block">Top Beneficios</span>
          <div class="space-y-1">
            {stats.topBenefits.length > 0 ? (
              stats.topBenefits.map((b, idx) => (
                <div key={idx} class="flex justify-between text-xs font-semibold">
                  <span class="text-slate-600 line-clamp-1 flex-grow pr-2">{b.title}</span>
                  <span class="text-brand-navy font-bold shrink-0">{b.count} usos</span>
                </div>
              ))
            ) : (
              <span class="text-xs text-slate-400 italic">Sin datos registrados</span>
            )}
          </div>
        </div>
      </div>

      {/* Filters live in the URL so a reload or a shared link keeps them */}
      <div class="flex flex-col sm:flex-row gap-4 justify-between items-center text-left">
        <form
          role="search"
          preventdefault:submit
          onSubmit$={(_, form) => {
            const value = new FormData(form).get("buscar")?.toString().trim() ?? "";
            navigate(couponsHref(location.url, { buscar: value }));
          }}
          class="relative flex w-full sm:max-w-md gap-2"
        >
          <input
            type="search"
            name="buscar"
            aria-label="Buscar cupones"
            placeholder="Buscar por código, socio, DNI o beneficio..."
            value={query.search}
            class="w-full bg-white text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:outline-none transition-all shadow-sm"
          />
          <button type="submit" class="shrink-0 rounded-2xl bg-brand-navy px-4 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-navy-dark cursor-pointer">
            Buscar
          </button>
        </form>

        <div class="flex gap-2 w-full sm:w-auto">
          <select
            aria-label="Filtrar por estado"
            value={query.status}
            onChange$={(_, el) => navigate(couponsHref(location.url, { estado: el.value }))}
            class="bg-white text-slate-700 border border-slate-200 rounded-2xl text-base sm:text-xs px-4 py-3 font-bold uppercase tracking-wider focus:border-brand-navy focus:outline-none transition-all shadow-sm cursor-pointer"
          >
            <option value="all">Todos los Estados</option>
            <option value="active">Activos / Pendientes</option>
            <option value="used">Canjeados / Aplicados</option>
            <option value="expired">Vencidos</option>
          </select>
        </div>
      </div>

      {data.value.loadError && (
        <div role="alert" class="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-xs font-bold text-red-700 shadow-sm text-left">
          No se pudieron cargar los cupones. Recargá la página.
        </div>
      )}

      <p class="text-xs font-semibold text-slate-500 text-left" aria-live="polite">
        {total === 0
          ? "No hay cupones para mostrar."
          : `Mostrando ${firstShown}–${lastShown} de ${total} ${total === 1 ? "cupón" : "cupones"}${query.search ? ` para «${query.search}»` : ""}.`}
      </p>

      {/* Coupons: stacked cards on phones, table from sm up */}
      <ul class="space-y-3 sm:hidden text-left">
        {records.length === 0 && (
          <li class="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs font-bold text-slate-500">
            No se encontraron cupones con los filtros seleccionados
          </li>
        )}
        {records.map((coupon) => (
          <li key={coupon.id} class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono font-bold text-brand-navy-dark tracking-wider">{coupon.code}</span>
              <StatusBadge status={coupon.status} />
            </div>
            <div>
              <p class="font-bold text-slate-800">{coupon.benefitTitle}</p>
              <p class="text-xs text-slate-500">{coupon.benefitResumen}</p>
            </div>
            <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt class="text-slate-500">Socio</dt>
              <dd class="font-bold text-slate-700">{coupon.userName}</dd>
              <dt class="text-slate-500">DNI</dt>
              <dd class="font-mono text-slate-700">{coupon.numeroSocio || "N/A"}</dd>
              <dt class="text-slate-500">Generado</dt>
              <dd class="text-slate-700">{formatDateTime(coupon.createdAt)}</dd>
              <dt class="text-slate-500">Canjeado</dt>
              <dd class="text-slate-700">{coupon.usedAt ? formatDateTime(coupon.usedAt) : "Pendiente"}</dd>
            </dl>
          </li>
        ))}
      </ul>

      <div class="hidden sm:block overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm text-left">
        <table class="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              <th class="px-6 py-4">Código</th>
              <th class="px-6 py-4">Beneficio</th>
              <th class="px-6 py-4">Socio</th>
              <th class="px-6 py-4">DNI</th>
              <th class="px-6 py-4">Generado</th>
              <th class="px-6 py-4">Canjeado</th>
              <th class="px-6 py-4 text-center">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-medium">
            {records.length > 0 ? (
              records.map((coupon) => (
                <tr key={coupon.id} class="hover:bg-slate-50 transition-colors">
                  <td class="px-6 py-4 font-mono font-bold text-brand-navy-dark tracking-wider">{coupon.code}</td>
                  <td class="px-6 py-4">
                    <div class="font-bold text-slate-800">{coupon.benefitTitle}</div>
                    <div class="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{coupon.benefitResumen}</div>
                  </td>
                  <td class="px-6 py-4 text-slate-700 font-bold">{coupon.userName}</td>
                  <td class="px-6 py-4 text-slate-500 font-mono">{coupon.numeroSocio || "N/A"}</td>
                  <td class="px-6 py-4 text-slate-600">{formatDateTime(coupon.createdAt)}</td>
                  <td class="px-6 py-4 text-slate-600">
                    {coupon.usedAt ? formatDateTime(coupon.usedAt) : <span class="text-slate-500 italic">Pendiente</span>}
                  </td>
                  <td class="px-6 py-4 text-center">
                    <StatusBadge status={coupon.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} class="px-6 py-10 text-center text-slate-500 font-bold uppercase tracking-widest bg-slate-50/50">
                  No se encontraron cupones con los filtros seleccionados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Páginas de cupones" class="flex items-center justify-between gap-3 text-sm font-bold">
          {page > 1 ? (
            <Link href={couponsHref(location.url, { pagina: page - 1 })} class="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-700 hover:bg-slate-50">
              ← Anterior
            </Link>
          ) : (
            <span class="rounded-2xl border border-slate-100 px-4 py-2.5 text-slate-300" aria-hidden="true">← Anterior</span>
          )}
          <span class="text-slate-500">Página {page} de {pages}</span>
          {page < pages ? (
            <Link href={couponsHref(location.url, { pagina: page + 1 })} class="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-700 hover:bg-slate-50">
              Siguiente →
            </Link>
          ) : (
            <span class="rounded-2xl border border-slate-100 px-4 py-2.5 text-slate-300" aria-hidden="true">Siguiente →</span>
          )}
        </nav>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "LPRC Club - Control de Cupones",
  meta: [
    {
      name: "description",
      content: "Administrar e inspeccionar historial de cupones de descuentos.",
    },
  ],
};
