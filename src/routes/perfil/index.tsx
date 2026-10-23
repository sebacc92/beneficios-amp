import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
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
import { findUsersByDni } from "~/server/member-dni";
import { isValidDni, normalizeDni } from "~/utils/dni";
import { loginUrl } from "~/utils/return-path";

// Loader to retrieve the logged-in user from the sharedMap (populated by middleware)
export const useUserLoader = routeLoader$(async (event) => {
  event.headers.set("Cache-Control", "private, no-store");
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user) {
    throw event.redirect(302, loginUrl(event.url.pathname + event.url.search));
  }
  return {
    ...user,
    credentialQr: await createQrDataUrl(`LPRC:${user.id}`),
    history: await getCouponHistory(event, user.id),
    // The home "Credencial Digital" card links to /perfil/?credencial=1.
    openCredential: event.url.searchParams.get("credencial") === "1",
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
      const dni = normalizeDni(data.numeroSocio);
      // The DNI is the only login: a typo would lock the member out, so a change must be typed twice.
      if (dni !== normalizeDni(user.numeroSocio ?? "") && normalizeDni(data.numeroSocioConfirm ?? "") !== dni) {
        return requestEvent.fail(400, {
          message: "Los dos DNI no coinciden. Revisalos antes de guardar.",
        });
      }
      const matches = await findUsersByDni(requestEvent, dni);
      if (matches.some((match) => match.id !== user.id)) {
        return requestEvent.fail(409, {
          message: "El DNI ingresado ya se encuentra registrado para otro usuario.",
        });
      }
      await db
        .update(users)
        .set({
          name: data.name.trim(),
          numeroSocio: dni,
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
    numeroSocio: z.string().refine(isValidDni, "Ingresá un DNI de 5 a 9 números, con o sin puntos o espacios."),
    numeroSocioConfirm: z.string().optional(),
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
  const credentialDialog = useSignal<HTMLDialogElement>();
  const credentialStatus = user.role === "premium" ? "Socio Gold" : user.role === "admin" ? "Administrador" : "Socio del club";

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (!userLoader.value.openCredential) return;
    credentialDialog.value?.showModal();
    // Drop the flag so a reload or "back" does not reopen it.
    const url = new URL(window.location.href);
    url.searchParams.delete("credencial");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  });
  const dniDraft = useSignal(user.numeroSocio || "");
  const dniConfirm = useSignal("");
  const dniChanged = normalizeDni(dniDraft.value) !== normalizeDni(user.numeroSocio || "");
  const dniMismatch = dniChanged && dniConfirm.value !== "" && normalizeDni(dniConfirm.value) !== normalizeDni(dniDraft.value);
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
            <h1 class="text-3xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-none mt-1">
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
                class="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-gold text-brand-gold bg-transparent hover:bg-brand-gold hover:text-brand-navy-dark text-xs sm:text-sm font-bold rounded-full transition-all duration-300 shadow-sm"
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
            <div class="w-full aspect-[1.586/1] max-w-sm mx-auto rounded-2xl relative p-5 flex flex-col justify-between overflow-hidden shadow-xl border select-none group transition-all duration-500 transform hover:scale-[1.02] bg-gradient-to-br from-brand-navy-dark to-brand-navy text-white border-slate-700">
              {/* Top row */}
              <div class="flex justify-between items-start relative z-10">
                <div class="flex flex-col">
                  <span class="font-display font-extrabold text-sm sm:text-base leading-none tracking-tight">
                    LPRC<span class="text-brand-gold">+</span>
                  </span>
                  <span class="text-[11px] uppercase tracking-wider text-slate-300 font-bold mt-0.5">
                    Credencial Oficial
                  </span>
                </div>

                {/* Role Badge */}
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-widest uppercase border bg-brand-navy border-brand-gold text-white">
                  <span>Activo</span>
                </span>
              </div>

              {/* Bottom row (Doctor details) */}
              <div class="space-y-2.5 relative z-10">
                <div class="space-y-0.5">
                  <div class="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
                    Socio del Club
                  </div>
                  <div class="font-display font-bold text-xs sm:text-sm truncate tracking-wide uppercase">
                    {user.name}
                  </div>
                </div>

                <div class="flex justify-between items-end">
                  <div class="space-y-0.5">
                    <div class="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
                      DNI / Nro. Socio
                    </div>
                    <div class="font-bold text-xs tracking-widest">
                      {user.numeroSocio || "S/M"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick$={() => credentialDialog.value?.showModal()}
                    aria-label="Ampliar el QR de tu credencial"
                    class="w-12 h-12 bg-white rounded-md p-0.5 flex items-center justify-center border border-slate-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                  >
                    <img
                      src={user.credentialQr}
                      alt=""
                      width={44}
                      height={44}
                      class="object-contain"
                    />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick$={() => credentialDialog.value?.showModal()}
              class="w-full max-w-sm mx-auto flex items-center justify-center gap-2 min-h-12 rounded-2xl bg-brand-navy text-white text-sm font-bold px-5 py-3 shadow-md hover:bg-brand-navy-light cursor-pointer"
            >
              Mostrar credencial para escanear
            </button>

            {/* Full-screen credential: big enough for a scanner at the counter. */}
            <dialog
              ref={credentialDialog}
              aria-labelledby="credential-dialog-title"
              class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-center text-slate-900 shadow-2xl backdrop:bg-slate-950/80"
            >
              <div class="flex items-start justify-between gap-4 text-left">
                <div>
                  <p class="text-xs font-bold uppercase tracking-widest text-slate-600">Credencial digital LPRC</p>
                  <h2 id="credential-dialog-title" class="font-display text-2xl font-extrabold leading-tight">
                    {user.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick$={() => credentialDialog.value?.close()}
                  aria-label="Cerrar credencial"
                  class="shrink-0 w-11 h-11 rounded-full border border-slate-200 text-xl leading-none text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  ×
                </button>
              </div>
              <img
                src={user.credentialQr}
                alt={`QR de la credencial de ${user.name}`}
                width={260}
                height={260}
                class="mx-auto my-6 w-[260px] h-[260px] max-w-full"
              />
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between gap-3 border-t border-slate-100 pt-2">
                  <dt class="text-slate-600">DNI</dt>
                  <dd class="font-mono font-bold tracking-widest">{user.numeroSocio || "Sin informar"}</dd>
                </div>
                <div class="flex justify-between gap-3 border-t border-slate-100 pt-2">
                  <dt class="text-slate-600">Estado</dt>
                  <dd class="font-bold text-emerald-700">{credentialStatus}</dd>
                </div>
              </dl>
              <p class="mt-4 text-xs text-slate-600">Subí el brillo de la pantalla si el lector no la toma.</p>
            </dialog>

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
                  class="text-xs font-bold text-brand-navy hover:underline cursor-pointer"
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
                        autocomplete="name"
                        required
                        value={user.name}
                        class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
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
                        inputMode="numeric"
                        autocomplete="off"
                        required
                        bind:value={dniDraft}
                        class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
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

                  {dniChanged && (
                    <div class="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p class="text-sm text-amber-900">
                        <strong>Ojo:</strong> el DNI es lo que usás para ingresar. Desde que guardes, vas a entrar con el nuevo.
                      </p>
                      <div class="space-y-1">
                        <label
                          for="numeroSocioConfirm"
                          class="text-xs font-bold text-slate-600 tracking-wider uppercase block"
                        >
                          Repetí el DNI nuevo
                        </label>
                        <input
                          type="text"
                          id="numeroSocioConfirm"
                          name="numeroSocioConfirm"
                          inputMode="numeric"
                          autocomplete="off"
                          required
                          bind:value={dniConfirm}
                          aria-invalid={dniMismatch}
                          aria-describedby={dniMismatch ? "profile-dni-confirm-error" : undefined}
                          class="w-full bg-white text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:outline-none transition-all"
                        />
                        {dniMismatch && (
                          <p id="profile-dni-confirm-error" role="alert" class="text-xs text-red-700">
                            Los dos DNI no coinciden.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={updateAction.isRunning || dniMismatch}
                    class="py-3 px-6 rounded-2xl bg-brand-navy hover:bg-brand-navy-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
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
                    ["used", "Canjeados"],
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
