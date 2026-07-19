import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  server$,
  Form,
  Link,
  z,
  zod$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users, coupons } from "~/db/schema";
import { getCustomBenefits } from "~/server/cache";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { LuShield, LuBell, LuTicket } from "@qwikest/icons/lucide";
import { getVapidPublicKey, savePushSubscription, removePushSubscription } from "~/server/webpush";
import { makeCredentialToken } from "~/server/credential-token";

// Loader to retrieve the logged-in user from the sharedMap (populated by middleware)
export const useUserLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user) {
    throw event.redirect(302, "/login");
  }
  return user;
});

// Historial de descargas de cupones del agremiado logueado. Sale de la tabla
// `coupons` (que se alimenta al descargar el cupón). El slug para linkear se
// resuelve contra el catálogo (benefitId guardado = String(benefit.id)),
// con un fallback de coincidencia por título en caso de IDs aleatorios legados.
export const useCouponHistory = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user) return [];
  try {
    const db = getDB(event);
    const rows = await db.select().from(coupons).where(eq(coupons.userId, user.id));
    const list = await getCustomBenefits(event).catch(() => []);
    const slugById: Record<string, string> = {};
    const slugByTitle: Record<string, string> = {};
    for (const b of list) {
      slugById[String(b.id)] = b.url;
      if (b.titulo) {
        slugByTitle[b.titulo.toLowerCase().trim()] = b.url;
      }
    }
    return rows
      .map((c) => ({
        code: c.code,
        benefitTitle: c.benefitTitle,
        slug:
          slugById[c.benefitId] ||
          slugByTitle[c.benefitTitle.toLowerCase().trim()] ||
          null,
        status: c.status,
        createdAt: c.createdAt,
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // más reciente primero
  } catch (err) {
    console.error("[perfil] no se pudo cargar el historial de descargas:", err);
    return [];
  }
});

// URL absoluta de verificación (QR del carnet). El token va cifrado: nunca
// expone el DNI/matrícula ni permite enumerar beneficiarios.
export const useCredentialVerifyUrl = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user) return null;
  const idKey = (user.dni || user.matricula || "").trim();
  if (!idKey) return null;
  const token = await makeCredentialToken(event.env, {
    d: idKey,
    m: user.matricula,
    n: user.name,
    iat: Date.now(),
  });
  return `${event.url.origin}/verificar/${token}`;
});

// Action to update user profile details
export const useUpdateProfileAction = routeAction$(
  async (data, requestEvent) => {
    try {
      const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
      if (!user) return requestEvent.fail(401, { message: "Sesión expirada." });

      const db = getDB(requestEvent);
      const email = data.email.trim().toLowerCase();

      // El email es único: si ya lo usa OTRA cuenta, avisamos sin romper.
      const [taken] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (taken && taken.id !== user.id) {
        return requestEvent.fail(409, { message: "Ese correo ya está en uso por otra cuenta." });
      }

      // OJO: el DNI NO se actualiza acá (viene del padrón, es de solo lectura).
      await db
        .update(users)
        .set({
          name: data.name.trim(),
          matricula: data.matricula.trim(),
          email,
        })
        .where(eq(users.id, user.id));

      return { success: true };
    } catch (e: any) {
      console.error("Profile update error:", e);
      return requestEvent.fail(500, { message: "Error al actualizar los datos." });
    }
  },
  zod$({
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    matricula: z.string().min(2, "Por favor ingresá tu matrícula provincial."),
    email: z.string().email("Ingresá un correo electrónico válido."),
  })
);

// Action to log out (delete session cookie)
export const useLogoutAction = routeAction$(async (_, requestEvent) => {
  requestEvent.cookie.delete("session_token", { path: "/" });
  throw requestEvent.redirect(302, "/login");
});

// Clave pública VAPID para suscribir el navegador.
export const usePushKey = routeLoader$((event) => {
  return getVapidPublicKey(event);
});

// Guarda la suscripción push del navegador, atada al usuario logueado.
export const pushSubscribeServer = server$(async function (subscriptionJson: string) {
  const user = this.sharedMap.get("user") as AuthenticatedUser | undefined;
  try {
    await savePushSubscription(this, subscriptionJson, user?.id || null);
    return { success: true };
  } catch (err) {
    console.error("pushSubscribe error:", err);
    return { success: false };
  }
});

export const pushUnsubscribeServer = server$(async function (endpoint: string) {
  try {
    await removePushSubscription(this, endpoint);
    return { success: true };
  } catch (err) {
    console.error("pushUnsubscribe error:", err);
    return { success: false };
  }
});

// Convierte la clave pública VAPID (base64url) al formato que espera el navegador.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default component$(() => {
  const userLoader = useUserLoader();
  const updateAction = useUpdateProfileAction();
  const logoutAction = useLogoutAction();
  const pushKey = usePushKey();
  const verifyUrl = useCredentialVerifyUrl();
  const couponHistory = useCouponHistory();

  const user = userLoader.value;
  const showEditForm = useSignal(false);

  // Estado real de notificaciones push.
  const pushSupported = useSignal(true);
  const pushEnabled = useSignal(false);
  const pushBusy = useSignal(false);
  const pushError = useSignal<string | null>(null);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator) ||
      typeof window === "undefined" ||
      !("PushManager" in window) ||
      !pushKey.value
    ) {
      pushSupported.value = false;
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      pushEnabled.value = !!sub && Notification.permission === "granted";
    } catch {
      /* ignore */
    }
  });

  const togglePush = $(async () => {
    if (pushBusy.value || !pushSupported.value) return;
    pushError.value = null;
    pushBusy.value = true;
    try {
      if (!pushEnabled.value) {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          pushError.value = "Necesitás permitir las notificaciones en el navegador.";
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(pushKey.value) as BufferSource,
        });
        const res = await pushSubscribeServer(JSON.stringify(sub.toJSON()));
        if (res.success) pushEnabled.value = true;
        else pushError.value = "No se pudo guardar la suscripción.";
      } else {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          await pushUnsubscribeServer(sub.endpoint);
          await sub.unsubscribe();
        }
        pushEnabled.value = false;
      }
    } catch (err) {
      console.error("togglePush error:", err);
      pushError.value = "Ocurrió un error al cambiar las notificaciones.";
    } finally {
      pushBusy.value = false;
    }
  });

  return (
    <div class="bg-slate-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div class="max-w-4xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-6 gap-4">
          <div>
            <span class="text-xs font-bold tracking-widest text-slate-400 uppercase">Portal de Usuarios</span>
            <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none mt-1">
              Bienvenido/a, {user.name.split(" ")[0]}
            </h1>
            <p class="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Gestioná tu credencial, accedé a tus beneficios y personalizá tu experiencia.
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
            ✓ Los cambios en tu perfil médico fueron guardados con éxito.
          </div>
        )}

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Column: Digital Credential */}
          <div class="md:col-span-1 space-y-6">
            <h2 class="text-sm font-bold tracking-wider text-slate-500 uppercase">Credencial Digital</h2>
            
            {/* Elegant Medical Card */}
            <div
              class="w-full aspect-[1.586/1] max-w-sm mx-auto rounded-2xl relative p-5 flex flex-col justify-between overflow-hidden shadow-xl border select-none group transition-all duration-500 transform hover:scale-[1.02] bg-gradient-to-br from-brand-green-dark to-brand-green text-white border-slate-700"
            >
              {/* Top row */}
              <div class="flex justify-between items-start relative z-10">
                <div class="flex flex-col">
                  <span class="font-display font-extrabold text-sm sm:text-base leading-none tracking-tight">
                    AMP<span class="text-brand-gold">+</span>
                  </span>
                  <span class="text-[8px] uppercase tracking-wider text-slate-300 font-bold mt-0.5">
                    Credencial Oficial
                  </span>
                </div>
                
                {/* Role Badge */}
                <span
                  class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8px] font-extrabold tracking-widest uppercase border bg-brand-green border-brand-gold text-white"
                >
                  <span>Agremiado</span>
                </span>
              </div>

              {/* Bottom row (Doctor details) */}
              <div class="space-y-2.5 relative z-10">
                <div class="space-y-0.5">
                  <div class="text-[8px] font-bold text-slate-300 tracking-wider uppercase">Médico Agremiado</div>
                  <div class="font-display font-bold text-xs sm:text-sm truncate tracking-wide uppercase">
                    {user.name}
                  </div>
                </div>

                <div class="flex justify-between items-end">
                  <div class="space-y-0.5">
                    <div class="text-[8px] font-bold text-slate-300 tracking-wider uppercase">DNI / Matrícula</div>
                    <div class="font-bold text-xs tracking-widest">{user.matricula || "S/M"}</div>
                  </div>
                  
                  {/* QR chico dentro de la tarjeta (apunta a la verificación real) */}
                  {verifyUrl.value && (
                    <div class="w-9 h-9 bg-white rounded-md p-0.5 flex items-center justify-center border border-slate-200">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&margin=2&data=${encodeURIComponent(verifyUrl.value)}`}
                        alt="QR de verificación"
                        width={32}
                        height={32}
                        class="object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* QR de verificación grande y escaneable */}
            {verifyUrl.value && (
              <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col items-center text-center space-y-3">
                <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wide">QR de Verificación</h3>
                {/* Fondo blanco + padding = quiet zone; alto contraste negro/blanco */}
                <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-inner">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=16&ecc=M&color=000000&bgcolor=ffffff&data=${encodeURIComponent(verifyUrl.value)}`}
                    alt="Código QR para verificar la credencial"
                    width={240}
                    height={240}
                    class="w-[240px] h-[240px] object-contain"
                  />
                </div>
                <p class="text-[11px] text-slate-500 font-medium leading-relaxed max-w-[240px]">
                  Mostrá este código en el comercio. Al escanearlo se verifica tu credencial en tiempo real contra el padrón de la AMP.
                </p>
              </div>
            )}

            {/* Push Notifications Switch (real Web Push) */}
            <div class="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wide">Notificaciones Push</h3>
                  <p class="text-[10px] text-slate-400 font-medium">Avisos de nuevos beneficios.</p>
                </div>
                <button
                  type="button"
                  disabled={pushBusy.value || !pushSupported.value}
                  onClick$={togglePush}
                  class={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                    pushEnabled.value ? "bg-brand-green" : "bg-slate-300"
                  }`}
                >
                  <span
                    class={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      pushEnabled.value ? "translate-x-5.5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {!pushSupported.value ? (
                <div class="inline-flex items-start gap-1.5 rounded-xl bg-slate-50 border border-slate-150 text-[10px] font-semibold text-slate-500 p-3 leading-relaxed">
                  <LuBell class="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-400" />
                  <span>Tu navegador no soporta notificaciones. En iPhone, agregá la app a la pantalla de inicio para habilitarlas.</span>
                </div>
              ) : pushError.value ? (
                <div class="inline-flex items-start gap-1.5 rounded-xl bg-red-50 border border-red-100 text-[10px] font-semibold text-red-700 p-3 leading-relaxed animate-fade-in">
                  <LuBell class="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-500" />
                  <span>{pushError.value}</span>
                </div>
              ) : pushEnabled.value ? (
                <div class="inline-flex items-start gap-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[10px] font-semibold text-emerald-800 p-3 leading-relaxed animate-fade-in">
                  <LuBell class="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span>¡Notificaciones activadas! Te avisaremos cuando agreguemos nuevos beneficios.</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Column: Profile Settings */}
          <div class="md:col-span-2 space-y-8">
            
            {/* Profile Settings form card */}
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div class="space-y-0.5">
                  <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Ajustes del Perfil</h3>
                  <p class="text-xs text-slate-400 font-medium">Mantené tus credenciales actualizadas.</p>
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
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1">
                      <label for="name" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={user.name}
                        class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                      />
                    </div>

                    <div class="space-y-1">
                      <label for="matricula" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                        Matrícula
                      </label>
                      <input
                        type="text"
                        id="matricula"
                        name="matricula"
                        required
                        value={user.matricula || ""}
                        class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                      />
                    </div>

                    <div class="space-y-1">
                      <label class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                        DNI <span class="normal-case text-slate-400 font-medium tracking-normal">· del padrón, no editable</span>
                      </label>
                      <input
                        type="text"
                        value={user.dni || "No registrado"}
                        readOnly
                        disabled
                        class="w-full bg-slate-100 text-slate-500 text-sm px-4 py-3 rounded-2xl border border-slate-200 cursor-not-allowed"
                      />
                    </div>

                    <div class="space-y-1">
                      <label for="email" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                        Correo Electrónico <span class="normal-case text-slate-400 font-medium tracking-normal">· opcional</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={user.email || ""}
                        placeholder="tu@email.com"
                        class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  {updateAction.value?.failed && updateAction.value.fieldErrors?.email && (
                    <p class="text-xs font-bold text-red-600">{updateAction.value.fieldErrors.email}</p>
                  )}

                  <button
                    type="submit"
                    disabled={updateAction.isRunning}
                    class="py-3 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
                  >
                    {updateAction.isRunning ? "Guardando..." : "Guardar Ajustes"}
                  </button>
                </Form>
              ) : (
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm py-2">
                  <div class="space-y-1">
                    <span class="text-xs font-bold text-slate-400 uppercase block tracking-wider">Nombre Completo</span>
                    <span class="font-semibold text-slate-800">{user.name}</span>
                  </div>

                  <div class="space-y-1">
                    <span class="text-xs font-bold text-slate-400 uppercase block tracking-wider">Correo Electrónico</span>
                    <span class="font-semibold text-slate-800">{user.email}</span>
                  </div>

                  <div class="space-y-1">
                    <span class="text-xs font-bold text-slate-400 uppercase block tracking-wider">DNI</span>
                    <span class="font-semibold text-slate-800">{user.dni || "No registrado"}</span>
                  </div>

                  <div class="space-y-1">
                    <span class="text-xs font-bold text-slate-400 uppercase block tracking-wider">Matrícula</span>
                    <span class="font-semibold text-slate-800">{user.matricula || "No registrada"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Historial de descargas de cupones (real, desde la tabla coupons) */}
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
              <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-4">
                Mi Historial de Descargas
              </h3>
              {couponHistory.value.length === 0 ? (
                <div class="flex items-center justify-center gap-2 py-6 text-slate-400 text-xs sm:text-sm font-medium">
                  <LuTicket class="w-5 h-5 text-purple-400 animate-pulse" />
                  <span>Aún no has impreso ni descargado cupones de beneficios recientemente.</span>
                </div>
              ) : (
                <ul class="divide-y divide-slate-100">
                  {couponHistory.value.map((c) => {
                    const estado =
                      c.status === "used"
                        ? { label: "Usado", cls: "bg-slate-100 text-slate-500 border-slate-200" }
                        : c.status === "expired"
                          ? { label: "Vencido", cls: "bg-red-50 text-red-600 border-red-200" }
                          : { label: "Activo", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
                    return (
                      <li key={c.code} class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3.5">
                        <div class="min-w-0">
                          {c.slug ? (
                            <Link href={`/beneficio/${c.slug}`} class="text-sm font-bold text-brand-green-dark hover:text-brand-green hover:underline truncate block">
                              {c.benefitTitle}
                            </Link>
                          ) : (
                            <span class="text-sm font-bold text-slate-700 truncate block">{c.benefitTitle}</span>
                          )}
                          <span class="text-[11px] text-slate-400 font-semibold">
                            {new Date(c.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            {"  ·  "}Código: <span class="font-mono text-slate-500">{c.code.slice(0, 3)} {c.code.slice(3)}</span>
                          </span>
                        </div>
                        <span class={["inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0", estado.cls]}>
                          {estado.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Mi Perfil Médico - Club de Beneficios AMP",
  meta: [
    {
      name: "description",
      content: "Gestioná tu credencial digital y consultá tus beneficios médicos personalizados del Club de Beneficios AMP.",
    },
  ],
};
