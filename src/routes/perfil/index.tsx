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
import { LuChevronDown, LuScanLine, LuShield, LuTicket, LuX } from "@qwikest/icons/lucide";
import { CouponCard } from "~/components/ui/CouponCard";
import NotificationPanel from "~/components/notification-panel/notification-panel";
import { createQrDataUrl } from "~/server/qr";
import { getCouponHistory } from "~/server/coupon-history";
import { findUsersByDni, isPlaceholderEmail } from "~/server/member-dni";
import { CLUB } from "~/utils/club";
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
    // Members loaded without an email carry a reserved placeholder; never show it as theirs.
    email: isPlaceholderEmail(user.email) ? "" : user.email,
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

const COUPON_TABS = [
  ["active", "Activos"],
  ["used", "Canjeados"],
  ["expired", "Vencidos"],
  ["all", "Todos"],
] as const;

const EMPTY_COUPONS: Record<(typeof COUPON_TABS)[number][0], string> = {
  active: "No tenés cupones activos.",
  used: "No tenés cupones canjeados.",
  expired: "No tenés cupones vencidos.",
  all: "Todavía no generaste cupones.",
};

const settingsLabel = "text-xs font-bold uppercase tracking-[0.06em] text-slate-600";

export default component$(() => {
  const userLoader = useUserLoader();
  const updateAction = useUpdateProfileAction();
  const logoutAction = useLogoutAction();

  const user = userLoader.value;
  const showEditForm = useSignal(false);
  // Settings stay folded unless the member opens them (or just submitted them without JavaScript).
  const settingsExpanded = useSignal(Boolean(updateAction.value));
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
    <div class="bg-background">
      <section class="border-b-4 border-accent bg-primary text-white">
        <div class="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-10 lg:px-8">
          <div>
            <p class="eyebrow text-accent">Socios · {CLUB.name}</p>
            <h1 class="heading-display mt-2 text-3xl sm:text-4xl">Hola, {user.name.split(" ")[0]}</h1>
            <span class="title-bar mt-3" aria-hidden="true" />
            <p class="mt-3 text-sm text-slate-300">Tu credencial, tus cupones y los avisos del club.</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            {user.role === "admin" && (
              <Link href="/admin" class="btn btn-primary btn-sm">
                <LuShield class="h-4 w-4" aria-hidden="true" />
                Panel admin
              </Link>
            )}
            <Form action={logoutAction}>
              <button type="submit" class="btn btn-outline-light btn-sm">
                Cerrar sesión
              </button>
            </Form>
          </div>
        </div>
      </section>

      <div class="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {updateAction.value?.success && (
          <p role="status" class="border-l-4 border-green-700 bg-green-50 px-5 py-4 text-sm font-bold text-green-900">
            Guardamos los cambios de tu perfil.
          </p>
        )}

        <div class="grid items-start gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <section aria-labelledby="credential-title" class="space-y-4">
            <h2 id="credential-title" class="eyebrow text-amber-900">
              Tu credencial
            </h2>

            <div class="relative mx-auto flex aspect-[1.586/1] w-full max-w-sm select-none flex-col justify-between border-l-4 border-accent bg-primary p-5 text-white shadow-lg lg:mx-0">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3">
                  <img src="/lprc.avif" alt="" width={120} height={101} class="h-auto w-12 shrink-0" />
                  <div>
                    <p class="font-display text-sm font-semibold uppercase leading-tight tracking-wider">{CLUB.name}</p>
                    <p class="eyebrow mt-0.5 text-[10px] text-accent">Credencial digital</p>
                  </div>
                </div>
              </div>

              <div class="flex items-end justify-between gap-3">
                <div class="min-w-0 space-y-2">
                  <span class={["badge", user.role === "premium" ? "badge-accent" : "bg-white/15 text-white"]}>{credentialStatus}</span>
                  <p class="heading-display truncate text-lg leading-tight">{user.name}</p>
                  <p class="text-xs text-slate-300">
                    DNI <span class="font-semibold tracking-wider text-white">{user.numeroSocio || "Sin informar"}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick$={() => credentialDialog.value?.showModal()}
                  aria-label="Ampliar el QR de tu credencial"
                  class="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center bg-white p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <img src={user.credentialQr} alt="" width={56} height={56} class="object-contain" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick$={() => credentialDialog.value?.showModal()}
              class="btn btn-primary mx-auto w-full max-w-sm px-3 sm:px-6 lg:mx-0"
            >
              <LuScanLine class="hidden h-4 w-4 sm:block" aria-hidden="true" />
              Mostrar credencial para escanear
            </button>

            {/* Full-screen credential: big enough for a scanner at the counter. */}
            <dialog
              ref={credentialDialog}
              aria-labelledby="credential-dialog-title"
              class="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto border-t-4 border-accent bg-white p-6 text-center text-primary shadow-2xl backdrop:bg-slate-950/80"
            >
              <div class="flex items-start justify-between gap-4 text-left">
                <div>
                  <p class="eyebrow text-amber-900">Credencial digital · {CLUB.shortName}</p>
                  <h2 id="credential-dialog-title" class="heading-display mt-1 text-2xl">
                    {user.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick$={() => credentialDialog.value?.close()}
                  aria-label="Cerrar credencial"
                  class="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-slate-300 text-slate-700 hover:border-primary hover:text-primary"
                >
                  <LuX class="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <img
                src={user.credentialQr}
                alt={`QR de la credencial de ${user.name}`}
                width={260}
                height={260}
                class="mx-auto my-6 h-[260px] w-[260px] max-w-full"
              />
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between gap-3 border-t border-line pt-2">
                  <dt class="text-slate-600">DNI</dt>
                  <dd class="font-bold tracking-widest">{user.numeroSocio || "Sin informar"}</dd>
                </div>
                <div class="flex justify-between gap-3 border-t border-line pt-2">
                  <dt class="text-slate-600">Categoría</dt>
                  <dd class="font-bold">{credentialStatus}</dd>
                </div>
              </dl>
              <p class="mt-4 text-xs text-slate-600">Subí el brillo de la pantalla si el lector no la toma.</p>
            </dialog>
          </section>

          <section id="mis-cupones" class="scroll-mt-52 space-y-4" aria-labelledby="coupons-title">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <h2 id="coupons-title" class="heading-display text-2xl text-primary sm:text-3xl">
                Mis cupones
              </h2>
              <Link href="/beneficios/" class="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary underline underline-offset-4">
                Buscar beneficios
              </Link>
            </div>
            <nav aria-label="Estado de los cupones" class="flex flex-wrap gap-2">
              {COUPON_TABS.map(([state, label]) => (
                <Link
                  key={state}
                  href={`/perfil/?estado=${state}#mis-cupones`}
                  aria-current={history.status === state ? "page" : undefined}
                  class={[
                    "inline-flex min-h-11 items-center border px-3 font-display text-xs font-semibold uppercase tracking-wider transition-colors",
                    history.status === state
                      ? "border-primary bg-primary text-white"
                      : "border-slate-300 bg-white text-primary hover:border-primary",
                  ]}
                >
                  {label} ({history.counts[state]})
                </Link>
              ))}
            </nav>
            {history.records.length ? (
              <div class="space-y-3">
                {history.records.map((coupon) => (
                  <CouponCard key={coupon.id} coupon={coupon} tone="light" />
                ))}
              </div>
            ) : (
              <div class="flex flex-col items-start gap-3 border border-line bg-surface p-6 text-sm text-slate-600">
                <LuTicket class="h-7 w-7 text-primary" aria-hidden="true" />
                <p>{EMPTY_COUPONS[history.status as keyof typeof EMPTY_COUPONS] ?? EMPTY_COUPONS.all}</p>
                <Link href="/beneficios/" class="btn btn-primary">
                  Explorar beneficios
                </Link>
              </div>
            )}
            {history.pages > 1 && (
              <nav aria-label="Páginas de cupones" class="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-slate-700">
                {history.page > 1 && (
                  <Link class="inline-flex min-h-11 items-center underline" href={`/perfil/?estado=${history.status}&pagina=${history.page - 1}#mis-cupones`}>
                    ← Anterior
                  </Link>
                )}
                <span>
                  Página {history.page} de {history.pages} · {history.total} cupones
                </span>
                {history.page < history.pages && (
                  <Link class="inline-flex min-h-11 items-center underline" href={`/perfil/?estado=${history.status}&pagina=${history.page + 1}#mis-cupones`}>
                    Siguiente →
                  </Link>
                )}
              </nav>
            )}
          </section>
        </div>

        <div class="grid items-start gap-8 lg:grid-cols-2">
          <NotificationPanel id="avisos-del-club" />

          <details open={settingsExpanded.value} onToggle$={(_, el) => (settingsExpanded.value = el.open)} class="group card">
            <summary class="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:p-6 [&::-webkit-details-marker]:hidden">
              <span>
                <span class="heading-display block text-xl text-primary">Ajustes del perfil</span>
                <span class="mt-1 block text-sm text-slate-600">Revisá tus datos.</span>
              </span>
              <LuChevronDown class="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>

            <div class="border-t border-line p-5 sm:p-6">
              {showEditForm.value ? (
                <Form action={updateAction} class="space-y-5">
                  {updateAction.value?.message && (
                    <p role="alert" class="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                      {updateAction.value.message}
                    </p>
                  )}
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label for="name" class="field-label">
                        Nombre y apellido
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        autocomplete="name"
                        required
                        value={user.name}
                        class="field text-base sm:text-sm"
                        aria-invalid={!!updateAction.value?.fieldErrors?.name}
                        aria-describedby={updateAction.value?.fieldErrors?.name ? "profile-name-error" : undefined}
                      />
                      {updateAction.value?.fieldErrors?.name && (
                        <p id="profile-name-error" role="alert" class="mt-1.5 text-xs font-semibold text-red-700">
                          {updateAction.value.fieldErrors.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label for="numeroSocio" class="field-label">
                        DNI
                      </label>
                      <input
                        type="text"
                        id="numeroSocio"
                        name="numeroSocio"
                        inputMode="numeric"
                        autocomplete="off"
                        required
                        bind:value={dniDraft}
                        class="field text-base sm:text-sm"
                        aria-invalid={!!updateAction.value?.fieldErrors?.numeroSocio}
                        aria-describedby={updateAction.value?.fieldErrors?.numeroSocio ? "profile-member-error" : undefined}
                      />
                      {updateAction.value?.fieldErrors?.numeroSocio && (
                        <p id="profile-member-error" role="alert" class="mt-1.5 text-xs font-semibold text-red-700">
                          {updateAction.value.fieldErrors.numeroSocio}
                        </p>
                      )}
                    </div>
                  </div>

                  {dniChanged && (
                    <div class="space-y-3 border-l-4 border-accent bg-amber-50 p-4">
                      <p class="text-sm text-amber-900">
                        <strong>Ojo:</strong> el DNI es lo que usás para ingresar. Desde que guardes, vas a entrar con el nuevo.
                      </p>
                      <div>
                        <label for="numeroSocioConfirm" class="field-label">
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
                          class="field text-base sm:text-sm"
                        />
                        {dniMismatch && (
                          <p id="profile-dni-confirm-error" role="alert" class="mt-1.5 text-xs font-semibold text-red-700">
                            Los dos DNI no coinciden.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div class="flex flex-wrap gap-3">
                    <button type="submit" disabled={updateAction.isRunning || dniMismatch} class="btn btn-dark">
                      {updateAction.isRunning ? "Guardando…" : "Guardar cambios"}
                    </button>
                    <button type="button" onClick$={() => (showEditForm.value = false)} class="btn btn-outline">
                      Cancelar
                    </button>
                  </div>
                </Form>
              ) : (
                <>
                  <dl class="grid grid-cols-1 gap-5 text-sm sm:grid-cols-2">
                    <div>
                      <dt class={settingsLabel}>Nombre y apellido</dt>
                      <dd class="mt-1 font-semibold text-primary">{user.name}</dd>
                    </div>
                    <div>
                      <dt class={settingsLabel}>Correo electrónico</dt>
                      <dd class="mt-1 break-all font-semibold text-primary">{user.email || "Sin informar"}</dd>
                    </div>
                    <div>
                      <dt class={settingsLabel}>DNI</dt>
                      <dd class="mt-1 font-semibold text-primary">{user.numeroSocio || "Sin informar"}</dd>
                    </div>
                    <div>
                      <dt class={settingsLabel}>En el portal desde</dt>
                      <dd class="mt-1 font-semibold text-primary">
                        {new Date(user.createdAt).toLocaleDateString("es-AR", {
                          timeZone: "America/Argentina/Buenos_Aires",
                        })}
                      </dd>
                    </div>
                  </dl>
                  <button type="button" onClick$={() => (showEditForm.value = true)} class="btn btn-outline btn-sm mt-6">
                    Modificar datos
                  </button>
                </>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Mi cuenta - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content:
        "Tu credencial digital, tus cupones y los avisos de La Plata Rugby Club.",
    },
  ],
};
