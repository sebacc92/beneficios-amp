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
import { LuShield, LuCrown, LuBell, LuTicket } from "@qwikest/icons/lucide";

// Loader to retrieve the logged-in user from the sharedMap (populated by middleware)
export const useUserLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user) {
    throw event.redirect(302, "/login");
  }
  return user;
});

// Action to update user profile details
export const useUpdateProfileAction = routeAction$(
  async (data, requestEvent) => {
    try {
      const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
      if (!user) return requestEvent.fail(401, { message: "Sesión expirada." });

      const db = getDB(requestEvent);
      await db
        .update(users)
        .set({
          name: data.name.trim(),
          matricula: data.matricula.trim(),
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
  })
);

// Action to log out (delete session cookie)
export const useLogoutAction = routeAction$(async (_, requestEvent) => {
  requestEvent.cookie.delete("session_token", { path: "/" });
  throw requestEvent.redirect(302, "/login");
});

export default component$(() => {
  const userLoader = useUserLoader();
  const updateAction = useUpdateProfileAction();
  const logoutAction = useLogoutAction();

  const user = userLoader.value;
  const showEditForm = useSignal(false);
  const showPushPrompt = useSignal(false);

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
              Gestioná tu credencial, visualizá tus accesos premium y personalizá tu experiencia.
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
              class={`w-full aspect-[1.586/1] max-w-sm mx-auto rounded-2xl relative p-5 flex flex-col justify-between overflow-hidden shadow-xl border select-none group transition-all duration-500 transform hover:scale-[1.02] ${
                user.role === "premium"
                  ? "bg-gradient-to-br from-slate-900 via-slate-800 to-brand-green-dark text-white border-brand-gold/40"
                  : "bg-gradient-to-br from-brand-green-dark to-brand-green text-white border-slate-700"
              }`}
            >
              {/* Premium Glow effect */}
              {user.role === "premium" && (
                <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent pointer-events-none"></div>
              )}

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
                  class={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8px] font-extrabold tracking-widest uppercase border ${
                    user.role === "premium"
                      ? "bg-brand-gold text-brand-green-dark border-brand-gold"
                      : "bg-brand-green border-brand-gold text-white"
                  }`}
                >
                  {user.role === "premium" ? (
                    <>
                      <LuCrown class="w-2.5 h-2.5" />
                      <span>Premium</span>
                    </>
                  ) : (
                    <span>General</span>
                  )}
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
                    <div class="text-[8px] font-bold text-slate-300 tracking-wider uppercase">Matrícula Prov.</div>
                    <div class="font-bold text-xs tracking-widest">{user.matricula || "S/M"}</div>
                  </div>
                  
                  {/* QR Mockup inside Card */}
                  <div class="w-9 h-9 bg-white rounded-md p-0.5 flex items-center justify-center border border-slate-200">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=AMP:${user.id}`}
                      alt="QR Credential"
                      width={32}
                      height={32}
                      class="object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated Push Alert Switch */}
            <div class="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wide">Notificaciones Push</h3>
                  <p class="text-[10px] text-slate-400 font-medium">Alertas de cupones por expirar.</p>
                </div>
                <button
                  onClick$={() => (showPushPrompt.value = !showPushPrompt.value)}
                  class={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                    showPushPrompt.value ? "bg-brand-green" : "bg-slate-300"
                  }`}
                >
                  <span
                    class={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      showPushPrompt.value ? "translate-x-5.5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {showPushPrompt.value && (
                <div class="inline-flex items-start gap-1.5 rounded-xl bg-amber-50 border border-amber-100 text-[10px] font-semibold text-amber-800 p-3 leading-relaxed animate-fade-in">
                  <LuBell class="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-600" />
                  <span>¡Notificaciones activadas! Te avisaremos cuando agreguemos nuevos beneficios en tu área.</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Upgrade Premium & Profile Settings */}
          <div class="md:col-span-2 space-y-8">
            
            {/* Premium Promotion Banner if General */}
            {user.role !== "premium" && (
              <div class="relative overflow-hidden rounded-3xl border border-brand-gold bg-gradient-to-br from-slate-900 via-slate-800 to-brand-green-dark p-6 sm:p-8 text-white shadow-lg animate-in fade-in duration-300">
                <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-brand-gold/15 via-transparent to-transparent pointer-events-none"></div>
                <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div class="space-y-3 max-w-md">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-gold text-brand-green-dark text-[10px] font-extrabold tracking-widest uppercase">
                      <LuCrown class="w-3 h-3 text-brand-green-dark" />
                      <span>AMP+ Premium</span>
                    </span>
                    <h3 class="text-xl sm:text-2xl font-display font-extrabold tracking-tight leading-tight">
                      Desbloqueá Beneficios Exclusivos de Alta Jerarquía
                    </h3>
                    <p class="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                      Accedé a descuentos superiores en cadenas de hoteles de lujo (Los Cauquenes 40% OFF), spas, capacitaciones especializadas, soporte prioritario por IA y navegación sin publicidad.
                    </p>
                  </div>
                  <Link
                    href="/perfil/checkout"
                    class="flex items-center justify-center py-3.5 px-6 rounded-2xl bg-brand-gold hover:bg-brand-gold/90 text-brand-green-dark font-extrabold text-sm shadow-md transition-all duration-300 cursor-pointer self-start md:self-center"
                  >
                    Actualizar por $1.500/mes
                  </Link>
                </div>
              </div>
            )}

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
                        Matrícula Provincial
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
                  </div>

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
                    <span class="text-xs font-bold text-slate-400 uppercase block tracking-wider">Matrícula Provincial</span>
                    <span class="font-semibold text-slate-800">{user.matricula || "No registrada"}</span>
                  </div>

                  <div class="space-y-1">
                    <span class="text-xs font-bold text-slate-400 uppercase block tracking-wider">Fecha de Creación</span>
                    <span class="font-semibold text-slate-800">
                      {new Date(user.createdAt).toLocaleDateString("es-AR")}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Custom static voucher history tab */}
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
              <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-4">
                Mi Historial de Descargas
              </h3>
              <div class="flex items-center justify-center gap-2 py-6 text-slate-400 text-xs sm:text-sm font-medium">
                <LuTicket class="w-5 h-5 text-purple-400 animate-pulse" />
                <span>Aún no has impreso ni descargado cupones de beneficios recientemente.</span>
              </div>
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
