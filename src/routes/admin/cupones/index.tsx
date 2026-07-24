import { component$, useSignal, useComputed$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuTrash2 } from "@qwikest/icons/lucide";
import { desc, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { coupons } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

export const useAdminCouponsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }

  try {
    const db = getDB(event);
    const result = await db
      .select()
      .from(coupons)
      .orderBy(desc(coupons.createdAt));
    return result;
  } catch (err) {
    console.error("Failed to load admin coupons:", err);
    return [];
  }
});

export const useDeleteCouponAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") {
      return requestEvent.fail(403, { message: "No autorizado." });
    }

    try {
      const db = getDB(requestEvent);
      await db.delete(coupons).where(eq(coupons.id, data.id));
      return { success: true };
    } catch (err: any) {
      console.error("Failed to delete coupon:", err);
      return requestEvent.fail(500, { message: "Error al eliminar el cupón." });
    }
  },
  zod$({
    id: z.string(),
  })
);

export const useDeleteCouponsByBenefitAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") {
      return requestEvent.fail(403, { message: "No autorizado." });
    }

    try {
      const db = getDB(requestEvent);
      await db.delete(coupons).where(eq(coupons.benefitId, data.benefitId));
      return { success: true };
    } catch (err: any) {
      console.error("Failed to delete coupons by benefit:", err);
      return requestEvent.fail(500, { message: "Error al eliminar cupones." });
    }
  },
  zod$({
    benefitId: z.string(),
  })
);

export default component$(() => {
  const allCoupons = useAdminCouponsLoader();
  const deleteCouponAction = useDeleteCouponAction();
  const deleteCouponsByBenefitAction = useDeleteCouponsByBenefitAction();
  const searchQuery = useSignal("");
  const statusFilter = useSignal("all"); // "all", "active", "used"

  // Calculated Stats
  const stats = useComputed$(() => {
    const list = allCoupons.value;
    const total = list.length;
    const redeemed = list.filter((c) => c.status === "used").length;
    const active = list.filter((c) => c.status === "active").length;
    const rate = total > 0 ? Math.round((redeemed / total) * 100) : 0;

    // Count top benefits
    const benefitCounts: Record<string, { benefitId: string; title: string; count: number }> = {};
    list.forEach((c) => {
      if (!benefitCounts[c.benefitId]) {
        benefitCounts[c.benefitId] = { benefitId: c.benefitId, title: c.benefitTitle, count: 0 };
      }
      benefitCounts[c.benefitId].count++;
    });

    const topBenefits = Object.values(benefitCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      total,
      redeemed,
      active,
      rate,
      topBenefits,
    };
  });

  // Filtered List
  const filteredCoupons = useComputed$(() => {
    const query = searchQuery.value.toLowerCase().trim();
    const status = statusFilter.value;
    let list = allCoupons.value;

    if (status !== "all") {
      list = list.filter((c) => c.status === status);
    }

    if (query) {
      list = list.filter(
        (c) =>
          c.code.toLowerCase().includes(query) ||
          c.benefitTitle.toLowerCase().includes(query) ||
          c.userName.toLowerCase().includes(query) ||
          (c.userMatricula && c.userMatricula.toLowerCase().includes(query))
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
              Administración / Transacciones
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
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
          <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Generados Totales</span>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-slate-800">{stats.value.total}</span>
            <span class="text-xs text-slate-400 font-semibold">cupones</span>
          </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Canjeados (Usados)</span>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-brand-green">{stats.value.redeemed}</span>
            <span class="text-xs text-brand-green/80 font-bold">canjes exitosos</span>
          </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Tasa de Redención</span>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-brand-gold">{stats.value.rate}%</span>
            <span class="text-xs text-slate-400 font-semibold">de efectividad</span>
          </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-2">
          <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Top Beneficios</span>
          <div class="space-y-1.5">
            {stats.value.topBenefits.length > 0 ? (
              stats.value.topBenefits.map((b, idx) => (
                <div key={idx} class="flex items-center justify-between text-xs font-semibold group">
                  <span class="text-slate-600 line-clamp-1 flex-grow pr-2">{b.title}</span>
                  <div class="flex items-center space-x-2 shrink-0">
                    <span class="text-brand-green font-bold">{b.count} usos</span>
                    <button
                      type="button"
                      onClick$={async () => {
                        if (confirm(`¿Eliminar todos los cupones de "${b.title}"?`)) {
                          await deleteCouponsByBenefitAction.submit({ benefitId: b.benefitId });
                        }
                      }}
                      title="Eliminar cupones de este beneficio"
                      class="text-slate-300 hover:text-red-500 transition-colors p-0.5 rounded"
                    >
                      <LuTrash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <span class="text-xs text-slate-400 italic">Sin datos registrados</span>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div class="flex flex-col sm:flex-row gap-4 justify-between items-center text-left">
        <div class="relative w-full sm:max-w-md">
          <input
            type="text"
            placeholder="Buscar por código, médico, matrícula o beneficio..."
            value={searchQuery.value}
            onInput$={(ev) => {
              searchQuery.value = (ev.target as HTMLInputElement).value;
            }}
            class="w-full bg-white text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:outline-none transition-all shadow-sm"
          />
        </div>

        <div class="flex gap-2 w-full sm:w-auto">
          <select
            value={statusFilter.value}
            onChange$={(ev, el) => {
              statusFilter.value = el.value;
            }}
            class="bg-white text-slate-700 border border-slate-200 rounded-2xl text-xs px-4 py-3 font-bold uppercase tracking-wider focus:border-brand-green focus:outline-none transition-all shadow-sm cursor-pointer"
          >
            <option value="all">Todos los Estados</option>
            <option value="active">Activos / Pendientes</option>
            <option value="used">Canjeados / Aplicados</option>
          </select>
        </div>
      </div>

      {/* Coupons Table */}
      <div class="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm text-left">
        <table class="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <th class="px-6 py-4">Código</th>
              <th class="px-6 py-4">Beneficio</th>
              <th class="px-6 py-4">Agremiado</th>
              <th class="px-6 py-4">Matrícula</th>
              <th class="px-6 py-4">Generado</th>
              <th class="px-6 py-4">Canjeado</th>
              <th class="px-6 py-4 text-center">Estado</th>
              <th class="px-6 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-medium">
            {filteredCoupons.value.length > 0 ? (
              filteredCoupons.value.map((coupon) => (
                <tr key={coupon.id} class="hover:bg-slate-50 transition-colors">
                  <td class="px-6 py-4 font-mono font-bold text-brand-green-dark">
                    {coupon.code.slice(0, 3)} {coupon.code.slice(3)}
                  </td>
                  <td class="px-6 py-4">
                    <div class="font-bold text-slate-800">{coupon.benefitTitle}</div>
                    <div class="text-[10px] text-slate-450 mt-0.5 line-clamp-1">{coupon.benefitResumen}</div>
                  </td>
                  <td class="px-6 py-4 text-slate-700 font-bold">{coupon.userName}</td>
                  <td class="px-6 py-4 text-slate-550 font-mono">{coupon.userMatricula || "N/A"}</td>
                  <td class="px-6 py-4 text-slate-550">
                    {new Date(coupon.createdAt).toLocaleDateString("es-AR")} {new Date(coupon.createdAt).toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td class="px-6 py-4 text-slate-550">
                    {coupon.usedAt ? (
                      `${new Date(coupon.usedAt).toLocaleDateString("es-AR")} ${new Date(coupon.usedAt).toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}`
                    ) : (
                      <span class="text-slate-400 italic">Pendiente</span>
                    )}
                  </td>
                  <td class="px-6 py-4 text-center">
                    <span
                      class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                        coupon.status === "used"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                          : "bg-amber-50 text-amber-700 border-amber-250 animate-pulse"
                      }`}
                    >
                      {coupon.status === "used" ? "Canjeado" : "Activo"}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-center">
                    <button
                      type="button"
                      onClick$={async () => {
                        if (confirm(`¿Eliminar este cupón (${coupon.code})?`)) {
                          await deleteCouponAction.submit({ id: coupon.id });
                        }
                      }}
                      title="Eliminar cupón"
                      class="text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                    >
                      <LuTrash2 class="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} class="px-6 py-10 text-center text-slate-400 font-bold uppercase tracking-widest bg-slate-50/50">
                  No se encontraron cupones con los filtros seleccionados
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
  title: "AMP+ Club - Control de Cupones",
  meta: [
    {
      name: "description",
      content: "Administrar e inspeccionar historial de cupones de descuentos.",
    },
  ],
};
