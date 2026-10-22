import { component$, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  Link,
  z,
  zod$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { destroySession } from "~/server/auth";
import { LuShield, LuTicket } from "@qwikest/icons/lucide";
import { CouponCard } from "~/components/ui/CouponCard";
import NotificationPanel from "~/components/notification-panel/notification-panel";
import { createQrDataUrl } from "~/server/qr";
import { getCouponHistory } from "~/server/coupon-history";

// Loader to retrieve the logged-in user from the sharedMap (populated by middleware)
export const useUserLoader = routeLoader$(async (event) => {
  event.headers.set("Cache-Control", "private, no-store");
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user) {
    throw event.redirect(302, "/login");
  }
  return {
    ...user,
    credentialQr: await createQrDataUrl(`LPRC:${user.id}`),
    history: await getCouponHistory(event, user.id),
  };
});

// Action to update user profile details
export const useUpdateProfileAction = routeAction$(
  async (data, requestEvent) => {
    try {
      const user = requestEvent.sharedMap.get("user") as
        | AuthenticatedUser
        | undefined;
      if (!user) return requestEvent.fail(401, { message: "Sesión expirada." });

      const db = getDB(requestEvent);
      await db
        .update(users)
        .set({
          name: data.name.trim(),
          numeroSocio: data.numeroSocio.trim(),
        })
        .where(eq(users.id, user.id));

      return { success: true };
    } catch (e: any) {
      console.error("Profile update error:", e);
      return requestEvent.fail(500, {
        message: "Error al actualizar los datos.",
      });
    }
  },
  zod$({
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    numeroSocio: z.string().min(2, "Por favor ingresá tu número de socio."),
  }),
);

// Action to log out (revoke the session row, then clear the cookie)
export const useLogoutAction = routeAction$(async (_, requestEvent) => {
  await destroySession(requestEvent);
  throw requestEvent.redirect(302, "/login");
});

export default component$(() => {
  const userLoader = useUserLoader();
  const updateAction = useUpdateProfileAction();
  const logoutAction = useLogoutAction();

  const user = userLoader.value;
  const showEditForm = useSignal(false);
  const history = user.history;

  return (
    <div class="bg-slate-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div class="max-w-4xl mx-auto space-y-8">
        {/* Header Section */}
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-6 gap-4">
          <div>
            <span class="text-xs font-bold tracking-widest text-slate-400 uppercase">
              Portal de Usuarios
            </span>
            <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none mt-1">
              Bienvenido/a, {user.name.split(" ")[0]}
            </h1>
            <p class="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Gestioná tu credencial, accedé a tus beneficios y personalizá tu
              experiencia.
            </p>
          </div>
          <div class="flex items-center gap-3">
            {user.role === "admin" && (
              <Link
                href="/admin"
                class="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-gold text-brand-gold bg-transparent hover:bg-brand-gold hover:text-brand-green-dark text-xs sm:text-sm font-bold rounded-full transition-all duration-300 shadow-sm"
              >
                <LuShield class="w-4 h-4" />
                <span>Panel Admin</span>
              </Link>
            )}
            <Form action={logoutAction}>
              <button
                type="submit"
                class="px-4 py-2 bg-slate-200 hover:bg-red-50 hover:text-red-700 text-slate-600 text-xs sm:text-sm font-semibold rounded-full transition-all shadow-sm cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </Form>
          </div>
        </div>

        {/* Global actions success/fail alerts */}
        {updateAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs sm:text-sm font-bold text-emerald-800 shadow-sm animate-fade-in">
            ✓ Los cambios en tu perfil fueron guardados con éxito.
          </div>
        )}

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Digital Credential */}
          <div class="md:col-span-1 space-y-6">
            <h2 class="text-sm font-bold tracking-wider text-slate-500 uppercase">
              Credencial Digital
            </h2>

            {/* Digital Club Credential */}
            <div class="w-full aspect-[1.586/1] max-w-sm mx-auto rounded-2xl relative p-5 flex flex-col justify-between overflow-hidden shadow-xl border select-none group transition-all duration-500 transform hover:scale-[1.02] bg-gradient-to-br from-brand-green-dark to-brand-green text-white border-slate-700">
              {/* Top row */}
              <div class="flex justify-between items-start relative z-10">
                <div class="flex flex-col">
                  <span class="font-display font-extrabold text-sm sm:text-base leading-none tracking-tight">
                    LPRC<span class="text-brand-gold">+</span>
                  </span>
                  <span class="text-[8px] uppercase tracking-wider text-slate-300 font-bold mt-0.5">
                    Credencial Oficial
                  </span>
                </div>

                {/* Role Badge */}
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8px] font-extrabold tracking-widest uppercase border bg-brand-green border-brand-gold text-white">
                  <span>Activo</span>
                </span>
              </div>

              {/* Bottom row (Doctor details) */}
              <div class="space-y-2.5 relative z-10">
                <div class="space-y-0.5">
                  <div class="text-[8px] font-bold text-slate-300 tracking-wider uppercase">
                    Socio del Club
                  </div>
                  <div class="font-display font-bold text-xs sm:text-sm truncate tracking-wide uppercase">
                    {user.name}
                  </div>
                </div>

                <div class="flex justify-between items-end">
                  <div class="space-y-0.5">
                    <div class="text-[8px] font-bold text-slate-300 tracking-wider uppercase">
                      DNI / Nro. Socio
                    </div>
                    <div class="font-bold text-xs tracking-widest">
                      {user.numeroSocio || "S/M"}
                    </div>
                  </div>

                  {/* QR Mockup inside Card */}
                  <div class="w-9 h-9 bg-white rounded-md p-0.5 flex items-center justify-center border border-slate-200">
                    <img
                      src={user.credentialQr}
                      alt="QR de tu credencial"
                      width={32}
                      height={32}
                      class="object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            <NotificationPanel />
          </div>

          {/* Right Column: Upgrade Premium & Profile Settings */}
          <div class="md:col-span-2 space-y-8">
            {/* Profile Settings form card */}
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div class="space-y-0.5">
                  <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    Ajustes del Perfil
                  </h3>
                  <p class="text-xs text-slate-400 font-medium">
                    Mantené tus credenciales actualizadas.
                  </p>
                </div>
                <button
                  onClick$={() => (showEditForm.value = !showEditForm.value)}
                  class="text-xs font-bold text-brand-green hover:underline cursor-pointer"
                >
                  {showEditForm.value ? "Cancelar" : "Modificar Datos"}
                </button>
              </div>

              {showEditForm.value ? (
                <Form action={updateAction} class="space-y-5">
                  {updateAction.value?.message && (
                    <p role="alert" class="text-sm text-red-700">
                      {updateAction.value.message}
                    </p>
                  )}
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1">
                      <label
                        for="name"
                        class="text-xs font-bold text-slate-500 tracking-wider uppercase block"
                      >
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={user.name}
                        class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                        aria-invalid={!!updateAction.value?.fieldErrors?.name}
                        aria-describedby={
                          updateAction.value?.fieldErrors?.name
                            ? "profile-name-error"
                            : undefined
                        }
                      />
                      {updateAction.value?.fieldErrors?.name && (
                        <p
                          id="profile-name-error"
                          role="alert"
                          class="text-xs text-red-700"
                        >
                          {updateAction.value.fieldErrors.name}
                        </p>
                      )}
                    </div>

                    <div class="space-y-1">
                      <label
                        for="numeroSocio"
                        class="text-xs font-bold text-slate-500 tracking-wider uppercase block"
                      >
                        DNI (Nro. Socio)
                      </label>
                      <input
                        type="text"
                        id="numeroSocio"
                        name="numeroSocio"
                        required
                        value={user.numeroSocio || ""}
                        class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                        aria-invalid={
                          !!updateAction.value?.fieldErrors?.numeroSocio
                        }
                        aria-describedby={
                          updateAction.value?.fieldErrors?.numeroSocio
                            ? "profile-member-error"
                            : undefined
                        }
                      />
                      {updateAction.value?.fieldErrors?.numeroSocio && (
                        <p
                          id="profile-member-error"
                          role="alert"
                          class="text-xs text-red-700"
                        >
                          {updateAction.value.fieldErrors.numeroSocio}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={updateAction.isRunning}
                    class="py-3 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
                  >
                    {updateAction.isRunning
                      ? "Guardando..."
                      : "Guardar Ajustes"}
                  </button>
                </Form>
              ) : (
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm py-2">
                  <div class="space-y-1">
                    <span class="text-xs font-bold text-slate-400 uppercase block tracking-wider">
                      Nombre Completo
                    </span>
                    <span class="font-semibold text-slate-800">
                      {user.name}
                    </span>
                  </div>

                  <div class="space-y-1">
                    <span class="text-xs font-bold text-slate-400 uppercase block tracking-wider">
                      Correo Electrónico
                    </span>
                    <span class="font-semibold text-slate-800">
                      {user.email}
                    </span>
                  </div>

                  <div class="space-y-1">
                    <span class="text-xs font-bold text-slate-400 uppercase block tracking-wider">
                      DNI (Nro. Socio)
                    </span>
                    <span class="font-semibold text-slate-800">
                      {user.numeroSocio || "No registrada"}
                    </span>
                  </div>

                  <div class="space-y-1">
                    <span class="text-xs font-bold text-slate-400 uppercase block tracking-wider">
                      Fecha de Creación
                    </span>
                    <span class="font-semibold text-slate-800">
                      {new Date(user.createdAt).toLocaleDateString("es-AR", {
                        timeZone: "America/Argentina/Buenos_Aires",
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <section
              id="mis-cupones"
              class="scroll-mt-52 bg-white rounded-3xl border border-slate-200 p-4 sm:p-8 shadow-sm space-y-4"
              aria-labelledby="coupons-title"
            >
              <h2
                id="coupons-title"
                class="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4"
              >
                Mis cupones
              </h2>
              <nav
                aria-label="Estado de los cupones"
                class="flex flex-wrap gap-2"
              >
                {(
                  [
                    ["active", "Activos"],
                    ["used", "Usados"],
                    ["expired", "Vencidos"],
                    ["all", "Todos"],
                  ] as const
                ).map(([state, label]) => (
                  <Link
                    key={state}
                    href={`/perfil/?estado=${state}#mis-cupones`}
                    aria-current={history.status === state ? "page" : undefined}
                    class={`min-h-11 flex items-center rounded-full px-3 py-2 text-xs font-bold ${history.status === state ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  >
                    {label} ({history.counts[state]})
                  </Link>
                ))}
              </nav>
              {history.records.length ? (
                <div class="space-y-3 rounded-2xl bg-primary p-3">
                  {history.records.map((coupon) => (
                    <CouponCard key={coupon.id} coupon={coupon} />
                  ))}
                </div>
              ) : (
                <div class="flex flex-col items-center gap-3 py-8 text-center text-slate-600 text-sm">
                  <LuTicket class="w-7 h-7" />
                  <p>
                    {history.status === "all"
                      ? "Todavía no generaste cupones."
                      : `No tenés cupones ${history.status === "active" ? "activos" : history.status === "used" ? "usados" : "vencidos"}.`}
                  </p>
                  <Link
                    href="/beneficios/"
                    class="min-h-11 inline-flex items-center rounded-full bg-brand-gold px-5 py-2 font-bold text-slate-950"
                  >
                    Explorar beneficios
                  </Link>
                </div>
              )}
              {history.pages > 1 && (
                <nav
                  aria-label="Páginas de cupones"
                  class="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-700"
                >
                  {history.page > 1 && (
                    <Link
                      class="min-h-11 inline-flex items-center underline"
                      href={`/perfil/?estado=${history.status}&pagina=${history.page - 1}#mis-cupones`}
                    >
                      ← Anterior
                    </Link>
                  )}
                  <span>
                    Página {history.page} de {history.pages} · {history.total}{" "}
                    cupones
                  </span>
                  {history.page < history.pages && (
                    <Link
                      class="min-h-11 inline-flex items-center underline"
                      href={`/perfil/?estado=${history.status}&pagina=${history.page + 1}#mis-cupones`}
                    >
                      Siguiente →
                    </Link>
                  )}
                </nav>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Mi Perfil - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content:
        "Gestioná tu credencial digital y consultá tus beneficios personalizados del Club de Beneficios LPRC.",
    },
  ],
};
