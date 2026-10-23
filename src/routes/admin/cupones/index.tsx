import { component$ } from "@builder.io/qwik";
import { Link, routeLoader$, useLocation, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { LuDownload, LuExternalLink, LuScanLine, LuSearch } from "@qwikest/icons/lucide";
import { getAdminCouponPage } from "~/server/admin-coupons";
import { ADMIN_COUPON_PERIODS, parseAdminCouponQuery, type AdminCouponStatus } from "~/utils/admin-coupons";
import { AdminPageHeader } from "~/components/admin/page-header";
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
      benefitOptions: [],
      stats: { total: 0, redeemed: 0, active: 0, expired: 0, rate: 0, topBenefits: [] },
      loadError: true,
    };
  }
});

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  used: { label: "Canjeado", class: "badge bg-green-50 text-green-800 border border-green-200" },
  expired: { label: "Vencido", class: "badge badge-muted" },
  active: { label: "Activo", class: "badge badge-accent" },
};

// Workers render in UTC, so the club's timezone has to be explicit.
const formatDateTime = (value: string) =>
  new Date(value)
    .toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
    .replace(",", "");

const NO_DATA = "S/D";

const StatusBadge = component$<{ status: string }>(({ status }) => {
  const badge = STATUS_LABELS[status] ?? STATUS_LABELS.active;
  return <span class={badge.class}>{badge.label}</span>;
});

/** Builds the list URL keeping the other filters; going back to page 1 unless a page is given. */
const couponsHref = (current: URL, changes: Record<string, string | number | null>, pathname = current.pathname) => {
  const url = new URL(current);
  url.pathname = pathname;
  url.searchParams.delete("pagina");
  for (const [key, value] of Object.entries(changes)) {
    if (
      value === null ||
      value === "" ||
      (key === "estado" && value === "all") ||
      (key === "periodo" && value === "todo") ||
      (key === "pagina" && value === 1)
    ) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
};

const actionClass = "inline-flex h-11 w-11 items-center justify-center border border-line text-primary hover:border-primary hover:bg-surface-muted";

/** Benefit page, member lookup and the merchant validation screen for one coupon. */
const CouponActions = component$<{ code: string; status: string; slug: string | null; dni: string | null; title: string }>((props) => (
  <div class="flex items-center gap-2">
    {props.slug && (
      <a href={`/beneficio/${props.slug}/`} target="_blank" rel="noopener noreferrer" class={actionClass} title="Ver beneficio" aria-label={`Ver el beneficio ${props.title} (abre en una pestaña nueva)`}>
        <LuExternalLink class="h-4 w-4" aria-hidden="true" />
      </a>
    )}
    {props.dni && (
      <Link href={`/admin/users/?buscar=${encodeURIComponent(props.dni)}`} class={actionClass} title="Buscar socio" aria-label={`Buscar al socio con DNI ${props.dni}`}>
        <LuSearch class="h-4 w-4" aria-hidden="true" />
      </Link>
    )}
    {props.status === "active" && (
      <a href={`/validar-cupon/?code=${encodeURIComponent(props.code)}`} target="_blank" rel="noopener noreferrer" class="inline-flex h-11 items-center gap-1.5 border border-primary px-3 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-white" title="Validar en el comercio" aria-label={`Validar el cupón ${props.code} (abre en una pestaña nueva)`}>
        <LuScanLine class="h-4 w-4" aria-hidden="true" />
        Validar
      </a>
    )}
  </div>
));

export default component$(() => {
  const data = useAdminCouponsLoader();
  const location = useLocation();
  const navigate = useNavigate();
  const { query, records, pageSize, total, page, pages, benefitOptions } = data.value;

  const stats = data.value.stats;
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);
  const periodLabel = ADMIN_COUPON_PERIODS.find((option) => option.value === query.period)?.label ?? "Todo";
  const benefitName = benefitOptions.find((option) => option.id === query.benefit)?.title;

  const kpis: { status: AdminCouponStatus; label: string; value: number; note: string; valueClass: string }[] = [
    { status: "all", label: "Generados", value: stats.total, note: "cupones", valueClass: "text-primary" },
    { status: "active", label: "Activos", value: stats.active, note: "sin usar todavía", valueClass: "text-primary" },
    { status: "used", label: "Canjeados", value: stats.redeemed, note: `${stats.rate}% de los generados`, valueClass: "text-green-800" },
    { status: "expired", label: "Vencidos", value: stats.expired, note: "el beneficio terminó", valueClass: "text-slate-500" },
  ];

  return (
    <div class="w-full px-4 sm:px-10 py-8 sm:py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto text-left">
      <AdminPageHeader
        title="Cupones"
        description="Cupones generados por los socios y su canje en los comercios. Tocá un total para filtrar la lista."
      >
        <a href={couponsHref(location.url, {}, "/admin/cupones/exportar/")} class="btn btn-outline" download>
          <LuDownload class="h-4 w-4" aria-hidden="true" />
          Exportar CSV
        </a>
      </AdminPageHeader>

      <nav aria-label="Período" class="flex flex-wrap items-center gap-3">
        <span class="eyebrow text-slate-600">Período</span>
        <ul class="grid w-full grid-cols-4 border border-line bg-surface sm:flex sm:w-auto">
          {ADMIN_COUPON_PERIODS.map((option) => {
            const current = query.period === option.value;
            return (
              <li key={option.value} class="border-r border-line last:border-r-0">
                <Link
                  href={couponsHref(location.url, { periodo: option.value })}
                  aria-current={current ? "true" : undefined}
                  class={[
                    "flex min-h-11 items-center justify-center whitespace-nowrap px-3 text-sm font-bold sm:px-4",
                    current ? "bg-primary text-white" : "text-slate-700 hover:bg-surface-muted",
                  ]}
                >
                  {option.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <span class="text-xs text-slate-500">Cuenta los cupones generados en el período{benefitName ? ` para ${benefitName}` : ""}.</span>
      </nav>

      {/* Each total is also a status filter */}
      <ul class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi) => {
          const current = query.status === kpi.status;
          return (
            <li key={kpi.status}>
              <Link
                href={couponsHref(location.url, { estado: kpi.status })}
                aria-current={current ? "true" : undefined}
                class={[
                  "flex h-full flex-col gap-3 border bg-surface p-4 sm:p-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  current ? "border-primary shadow-[inset_0_4px_0_var(--color-accent)]" : "border-line hover:border-slate-400",
                ]}
              >
                <span class="eyebrow text-slate-600">{kpi.label}</span>
                <span class={`font-display text-3xl sm:text-4xl font-bold leading-none ${kpi.valueClass}`}>{kpi.value}</span>
                <span class="text-xs text-slate-500">{kpi.note}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="top-benefits-title" class="card p-4 sm:p-6 space-y-3">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="top-benefits-title" class="heading-display text-lg text-primary">Beneficios más pedidos</h2>
          <span class="text-xs text-slate-500">{periodLabel} · generados y canjeados</span>
        </div>
        {stats.topBenefits.length > 0 ? (
          <ol class="divide-y divide-line">
            {stats.topBenefits.map((benefit, idx) => (
              <li key={benefit.benefitId} class="flex items-start gap-3 py-2">
                <span class="w-5 shrink-0 font-display text-lg font-bold text-slate-400" aria-hidden="true">{idx + 1}</span>
                <div class="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <Link href={couponsHref(location.url, { beneficio: benefit.benefitId })} title="Filtrar la lista por este beneficio" class="block min-w-0 truncate text-sm font-bold text-primary underline-offset-2 hover:underline">
                    {benefit.title}
                  </Link>
                  <span class="block shrink-0 text-sm text-slate-700">
                    <strong class="text-primary">{benefit.generated}</strong> {benefit.generated === 1 ? "generado" : "generados"} ·{" "}
                    <strong class="text-green-800">{benefit.redeemed}</strong> {benefit.redeemed === 1 ? "canjeado" : "canjeados"}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p class="text-sm text-slate-500">Sin cupones en este período.</p>
        )}
      </section>

      {/* Filters live in the URL so a reload or a shared link keeps them */}
      <div class="flex flex-col lg:flex-row gap-3 lg:items-end">
        <form
          role="search"
          preventdefault:submit
          onSubmit$={(_, form) => {
            const value = new FormData(form).get("buscar")?.toString().trim() ?? "";
            navigate(couponsHref(location.url, { buscar: value }));
          }}
          class="flex w-full lg:max-w-md gap-2"
        >
          <div class="flex-1">
            <label for="coupons-search" class="field-label">Buscar</label>
            <input
              id="coupons-search"
              type="search"
              name="buscar"
              placeholder="Código, socio, DNI o beneficio"
              value={query.search}
              class="field"
            />
          </div>
          <button type="submit" class="btn btn-dark self-end">Buscar</button>
        </form>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:flex-1">
          <div>
            <label for="coupons-status" class="field-label">Estado</label>
            <select
              id="coupons-status"
              value={query.status}
              onChange$={(_, el) => navigate(couponsHref(location.url, { estado: el.value }))}
              class="field cursor-pointer"
            >
              <option value="all" selected={query.status === "all"}>Todos</option>
              <option value="active" selected={query.status === "active"}>Activos</option>
              <option value="used" selected={query.status === "used"}>Canjeados</option>
              <option value="expired" selected={query.status === "expired"}>Vencidos</option>
            </select>
          </div>
          <div>
            <label for="coupons-benefit" class="field-label">Beneficio</label>
            <select
              id="coupons-benefit"
              value={query.benefit}
              onChange$={(_, el) => navigate(couponsHref(location.url, { beneficio: el.value }))}
              class="field cursor-pointer"
            >
              <option value="" selected={!query.benefit}>Todos los beneficios</option>
              {benefitOptions.map((option) => (
                <option key={option.id} value={option.id} selected={query.benefit === option.id}>{option.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {data.value.loadError && (
        <div role="alert" class="border-l-4 border-red-600 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
          No se pudieron cargar los cupones. Recargá la página.
        </div>
      )}

      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-slate-600" aria-live="polite">
          {total === 0
            ? "No hay cupones para mostrar."
            : `Mostrando ${firstShown}–${lastShown} de ${total} ${total === 1 ? "cupón" : "cupones"}${query.search ? ` para «${query.search}»` : ""}.`}
        </p>
        {(query.search || query.status !== "all" || query.benefit || query.period !== "todo") && (
          <Link href="/admin/cupones/" class="text-sm font-bold text-secondary underline underline-offset-2">Quitar filtros</Link>
        )}
      </div>

      {/* Coupons: cards until the table fits beside the sidebar */}
      <ul class="grid grid-cols-1 md:grid-cols-2 gap-3 xl:hidden">
        {records.length === 0 && (
          <li class="card p-6 text-center text-sm font-bold text-slate-500 md:col-span-2">
            No se encontraron cupones con los filtros seleccionados
          </li>
        )}
        {records.map((coupon) => (
          <li key={coupon.id} class="card p-4 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-lg font-bold tracking-wider text-primary">{coupon.code}</span>
              <StatusBadge status={coupon.status} />
            </div>
            <div>
              <p class="font-bold text-primary">{coupon.benefitTitle}</p>
              <p class="text-xs text-slate-500">{coupon.benefitResumen}</p>
            </div>
            <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt class="text-slate-500">Socio</dt>
              <dd class="font-bold text-slate-700">{coupon.userName}</dd>
              <dt class="text-slate-500">DNI</dt>
              <dd class="font-mono text-slate-700">{coupon.numeroSocio || NO_DATA}</dd>
              <dt class="text-slate-500">Generado</dt>
              <dd class="text-slate-700">{formatDateTime(coupon.createdAt)}</dd>
              <dt class="text-slate-500">Canjeado</dt>
              <dd class="text-slate-700">{coupon.usedAt ? formatDateTime(coupon.usedAt) : "Pendiente"}</dd>
            </dl>
            <CouponActions code={coupon.code} status={coupon.status} slug={coupon.benefitSlug} dni={coupon.numeroSocio} title={coupon.benefitTitle} />
          </li>
        ))}
      </ul>

      <div class="hidden xl:block overflow-x-auto border border-line bg-surface">
        <table class="w-full border-collapse text-sm">
          <caption class="sr-only">Cupones</caption>
          <thead>
            <tr class="border-b border-line bg-surface-muted text-left">
              <th scope="col" class="eyebrow px-4 py-3 text-slate-600">Código</th>
              <th scope="col" class="eyebrow px-4 py-3 text-slate-600">Beneficio</th>
              <th scope="col" class="eyebrow px-4 py-3 text-slate-600">Socio</th>
              <th scope="col" class="eyebrow px-4 py-3 text-slate-600">Fechas</th>
              <th scope="col" class="eyebrow px-4 py-3 text-slate-600">Estado</th>
              <th scope="col" class="eyebrow px-4 py-3 text-slate-600"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            {records.length > 0 ? (
              records.map((coupon) => (
                <tr key={coupon.id} class="hover:bg-surface-muted">
                  <td class="px-4 py-3 font-mono font-bold tracking-wider text-primary">{coupon.code}</td>
                  <td class="px-4 py-3">
                    <div class="font-bold text-primary">{coupon.benefitTitle}</div>
                    <div class="mt-0.5 line-clamp-1 text-xs text-slate-500">{coupon.benefitResumen}</div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="font-bold text-slate-700 whitespace-nowrap">{coupon.userName}</div>
                    <div class="font-mono text-xs text-slate-500">DNI {coupon.numeroSocio || NO_DATA}</div>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                    <div>Generado {formatDateTime(coupon.createdAt)}</div>
                    <div>{coupon.usedAt ? `Canjeado ${formatDateTime(coupon.usedAt)}` : "Sin canjear"}</div>
                  </td>
                  <td class="px-4 py-3">
                    <StatusBadge status={coupon.status} />
                  </td>
                  <td class="px-4 py-3">
                    <CouponActions code={coupon.code} status={coupon.status} slug={coupon.benefitSlug} dni={coupon.numeroSocio} title={coupon.benefitTitle} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} class="px-6 py-10 text-center font-bold text-slate-500">
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
            <Link href={couponsHref(location.url, { pagina: page - 1 })} class="btn btn-outline btn-sm">
              ← Anterior
            </Link>
          ) : (
            <span class="btn btn-outline btn-sm" aria-disabled="true">← Anterior</span>
          )}
          <span class="text-slate-600">Página {page} de {pages}</span>
          {page < pages ? (
            <Link href={couponsHref(location.url, { pagina: page + 1 })} class="btn btn-outline btn-sm">
              Siguiente →
            </Link>
          ) : (
            <span class="btn btn-outline btn-sm" aria-disabled="true">Siguiente →</span>
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
