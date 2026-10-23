import { component$, useSignal, type Signal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { desc, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users as usersTable } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { LuPlus, LuLock } from "@qwikest/icons/lucide";
import { ActionFeedback } from "~/components/admin/action-feedback";

// --- SECURITY & LOADERS ---

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
    }));
  } catch (err) {
    console.error("Failed to load admin users:", err);
    return [];
  }
});

export const useCurrentUserLoader = routeLoader$((event) => {
  return (event.sharedMap.get("user") || null) as AuthenticatedUser | null;
});

// --- ACTIONS ---

export const useChangePasswordAction = routeAction$(
  async (data, requestEvent) => {
    const currentUser = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!currentUser || currentUser.role !== "admin") {
      return requestEvent.fail(403, { message: "No autorizado." });
    }
    // Security: Only allow changing own password
    if (currentUser.id !== data.userId) {
      return requestEvent.fail(403, { message: "Solo tenés autorización para cambiar tu propia contraseña." });
    }

    try {
      const db = getDB(requestEvent);
      const { hashPassword } = await import("~/utils/crypto");
      const passwordHash = await hashPassword(data.newPassword);

      await db
        .update(usersTable)
        .set({ passwordHash })
        .where(eq(usersTable.id, data.userId));

      return { success: true };
    } catch (err: any) {
      console.error("Error changing password:", err);
      return requestEvent.fail(500, { message: "Error al actualizar la contraseña." });
    }
  },
  zod$({
    userId: z.string(),
    newPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  })
);

export const useRegisterAdminAction = routeAction$(
  async (data, requestEvent) => {
    const adminUser = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!adminUser || adminUser.role !== "admin") {
      return requestEvent.fail(403, { message: "No autorizado." });
    }

    try {
      const db = getDB(requestEvent);
      const email = data.email.toLowerCase().trim();

      // Check if email already exists
      const [existingUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      if (existingUser) {
        return requestEvent.fail(409, {
          message: "El correo electrónico ingresado ya se encuentra registrado.",
        });
      }

      const { hashPassword } = await import("~/utils/crypto");
      const passwordHash = await hashPassword(data.password);
      const userId = "usr-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();

      await db.insert(usersTable).values({
        id: userId,
        email,
        passwordHash,
        name: data.name.trim(),
        role: "admin", // Enforce role admin
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (e: any) {
      console.error("Admin register admin error:", e);
      return requestEvent.fail(500, {
        message: e.message || "Error al registrar el administrador.",
      });
    }
  },
  zod$({
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    email: z.string().email("Ingresá un correo electrónico válido."),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  })
);

const AdminAvatar = component$<{ name: string; isMe: boolean }>(({ name, isMe }) => (
  <div aria-hidden="true" class={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black uppercase text-white shadow-sm ${isMe ? "bg-brand-navy" : "bg-slate-500"}`}>
    {name.charAt(0)}
  </div>
));

const PasswordButton = component$<{ open: Signal<boolean> }>(({ open }) => (
  <button
    type="button"
    onClick$={() => (open.value = true)}
    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
  >
    <LuLock class="w-3.5 h-3.5" />
    <span>Cambiar Contraseña</span>
  </button>
));

export default component$(() => {
  const adminUsers = useAdminUsersLoader();
  const currentUser = useCurrentUserLoader();
  const changePasswordAction = useChangePasswordAction();
  const registerAdminAction = useRegisterAdminAction();

  const isCreateAdminOpen = useSignal(false);
  const isChangingMyPassword = useSignal(false);
  const admins = adminUsers.value.filter((u) => u.role === "admin");

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      {/* SaaS Dashboard layout header */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-navy"></span>
            <span class="text-[11px] font-extrabold tracking-widest text-slate-500 uppercase">
              Administración / Personal
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-none">
            Administradores
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Gestioná los accesos y credenciales de los administradores con privilegios del sistema.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick$={() => {
              isCreateAdminOpen.value = !isCreateAdminOpen.value;
            }}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer animate-none"
          >
            <LuPlus class="w-4 h-4" />
            <span>{isCreateAdminOpen.value ? "Cerrar Panel" : "Agregar Administrador"}</span>
          </button>
        </div>
      </div>

      <div class="space-y-6 animate-in fade-in duration-300 text-left">
        {/* Form Actions Feedbacks (failures show inside the open form) */}
        {registerAdminAction.value?.success && (
          <ActionFeedback value={registerAdminAction.value} success="¡Administrador registrado y dado de alta en el sistema!" />
        )}
        {changePasswordAction.value?.success && (
          <ActionFeedback value={changePasswordAction.value} success="¡Contraseña actualizada!" />
        )}

        {/* Register Admin Form Panel */}
        {isCreateAdminOpen.value && (
          <Form
            action={registerAdminAction}
            onSubmitCompleted$={() => {
              // Keep the panel and its values open when the email is rejected
              if (registerAdminAction.value?.success) isCreateAdminOpen.value = false;
            }}
            class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 animate-in slide-in-from-top-6 duration-300"
          >
            <div class="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Registrar Nuevo Administrador</h4>
              <button
                type="button"
                onClick$={() => (isCreateAdminOpen.value = false)}
                class="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>

            {registerAdminAction.value?.failed && registerAdminAction.value.message && <ActionFeedback value={registerAdminAction.value} />}

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="space-y-1">
                <label for="new-admin-name" class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nombre Completo</label>
                <input
                  id="new-admin-name"
                  type="text"
                  name="name"
                  required
                  autocomplete="off"
                  placeholder="Ej: Marcelo Admin"
                  aria-invalid={!!registerAdminAction.value?.fieldErrors?.name}
                  aria-describedby={registerAdminAction.value?.fieldErrors?.name ? "new-admin-name-error" : undefined}
                  class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
                />
                {registerAdminAction.value?.fieldErrors?.name && (
                  <p id="new-admin-name-error" role="alert" class="text-xs text-red-700">{registerAdminAction.value.fieldErrors.name}</p>
                )}
              </div>

              <div class="space-y-1">
                <label for="new-admin-email" class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Correo Electrónico</label>
                <input
                  id="new-admin-email"
                  type="email"
                  name="email"
                  required
                  autocomplete="off"
                  placeholder="Ej: marcelo@lprc.ar"
                  aria-invalid={!!registerAdminAction.value?.fieldErrors?.email}
                  aria-describedby={registerAdminAction.value?.fieldErrors?.email ? "new-admin-email-error" : undefined}
                  class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
                />
                {registerAdminAction.value?.fieldErrors?.email && (
                  <p id="new-admin-email-error" role="alert" class="text-xs text-red-700">{registerAdminAction.value.fieldErrors.email}</p>
                )}
              </div>

              <div class="space-y-1">
                <label for="new-admin-password" class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Contraseña Inicial</label>
                <input
                  id="new-admin-password"
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  autocomplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  aria-invalid={!!registerAdminAction.value?.fieldErrors?.password}
                  aria-describedby={registerAdminAction.value?.fieldErrors?.password ? "new-admin-password-error" : undefined}
                  class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
                />
                {registerAdminAction.value?.fieldErrors?.password && (
                  <p id="new-admin-password-error" role="alert" class="text-xs text-red-700">{registerAdminAction.value.fieldErrors.password}</p>
                )}
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick$={() => (isCreateAdminOpen.value = false)}
                class="px-5 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={registerAdminAction.isRunning}
                class="px-6 py-3 rounded-2xl bg-brand-navy hover:bg-brand-navy-light disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                {registerAdminAction.isRunning ? "Registrando..." : "Dar de Alta"}
              </button>
            </div>
          </Form>
        )}

        {/* Own password change: one panel above the list, used from both layouts */}
        {isChangingMyPassword.value && currentUser.value && (
          <Form
            action={changePasswordAction}
            onSubmitCompleted$={() => {
              if (changePasswordAction.value?.success) isChangingMyPassword.value = false;
            }}
            class="bg-white rounded-3xl border border-slate-200 p-6 shadow-md space-y-4"
          >
            <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Cambiar mi contraseña</h4>
            {changePasswordAction.value?.failed && changePasswordAction.value.message && (
              <ActionFeedback value={changePasswordAction.value} />
            )}
            <input type="hidden" name="userId" value={currentUser.value.id} />
            <div class="space-y-1 max-w-sm">
              <label for="admin-new-password" class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nueva contraseña</label>
              <input
                id="admin-new-password"
                type="password"
                name="newPassword"
                required
                minLength={6}
                autocomplete="new-password"
                placeholder="Mínimo 6 caracteres"
                aria-invalid={!!changePasswordAction.value?.fieldErrors?.newPassword}
                aria-describedby={changePasswordAction.value?.fieldErrors?.newPassword ? "admin-new-password-error" : undefined}
                class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
              />
              {changePasswordAction.value?.fieldErrors?.newPassword && (
                <p id="admin-new-password-error" role="alert" class="text-xs text-red-700">{changePasswordAction.value.fieldErrors.newPassword}</p>
              )}
            </div>
            <div class="flex gap-3">
              <button
                type="button"
                disabled={changePasswordAction.isRunning}
                onClick$={() => (isChangingMyPassword.value = false)}
                class="px-5 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={changePasswordAction.isRunning}
                class="px-6 py-3 rounded-2xl bg-brand-navy hover:bg-brand-navy-light disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                {changePasswordAction.isRunning ? "Guardando..." : "Guardar contraseña"}
              </button>
            </div>
          </Form>
        )}

        {/* Admins: stacked cards on phones, table from sm up */}
        <ul class="space-y-3 sm:hidden">
          {admins.map((userItem) => {
            const isMe = userItem.id === currentUser.value?.id;
            return (
              <li key={userItem.id} class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div class="flex items-center gap-2.5">
                  <AdminAvatar name={userItem.name} isMe={isMe} />
                  <div class="min-w-0">
                    <p class="font-bold text-slate-800">{userItem.name}{isMe && <span class="ml-1.5 text-[11px] bg-brand-navy/10 text-brand-navy px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Tú</span>}</p>
                    <p class="text-xs text-slate-500 break-all">{userItem.email}</p>
                  </div>
                </div>
                {isMe && !isChangingMyPassword.value && <PasswordButton open={isChangingMyPassword} />}
              </li>
            );
          })}
        </ul>

        <div class="hidden sm:block overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table class="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                <th class="px-6 py-4">Nombre</th>
                <th class="px-6 py-4">Correo</th>
                <th class="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
              {admins.map((userItem) => {
                const isMe = userItem.id === currentUser.value?.id;
                return (
                  <tr key={userItem.id} class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-800">
                      <div class="flex items-center gap-2.5">
                        <AdminAvatar name={userItem.name} isMe={isMe} />
                        <span class="flex items-center gap-1.5">
                          {userItem.name}
                          {isMe && (
                            <span class="text-[11px] bg-brand-navy/10 text-brand-navy px-2 py-0.5 rounded-full font-black uppercase tracking-wider border border-brand-navy-light/10">
                              Tú
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-slate-500">{userItem.email}</td>
                    <td class="px-6 py-4 text-center">
                      {isMe ? (
                        !isChangingMyPassword.value && <PasswordButton open={isChangingMyPassword} />
                      ) : (
                        <span class="text-xs text-slate-400 italic">Sin acciones permitidas</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "LPRC Club - Administradores del Portal",
  meta: [
    {
      name: "description",
      content: "Visualizar y gestionar cuentas de administradores.",
    },
  ],
};
