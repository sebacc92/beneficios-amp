import { component$, useSignal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuPlus, LuCrown } from "@qwikest/icons/lucide";
import { desc, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users as usersTable } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

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
      matricula: u.matricula,
      role: u.role,
      createdAt: u.createdAt,
    }));
  } catch (err) {
    console.error("Failed to load admin users:", err);
    return [];
  }
});

// --- ACTIONS ---

export const useChangeUserRoleAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      await db
        .update(usersTable)
        .set({ role: data.role as any })
        .where(eq(usersTable.id, data.userId));

      return { success: true };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Failed to update role." });
    }
  },
  zod$({
    userId: z.string(),
    role: z.enum(["admin", "member", "premium"]),
  })
);

export const useRegisterUserAction = routeAction$(
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
        matricula: data.matricula ? data.matricula.trim() : null,
        role: data.role as any,
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (e: any) {
      console.error("Admin register user error:", e);
      return requestEvent.fail(500, {
        message: e.message || "Error al registrar el agremiado.",
      });
    }
  },
  zod$({
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    email: z.string().email("Ingresá un correo electrónico válido."),
    matricula: z.string().min(2, "Por favor ingresá la matrícula provincial."),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
    role: z.enum(["member", "premium"]),
  })
);

export default component$(() => {
  const adminUsers = useAdminUsersLoader();
  const changeUserRoleAction = useChangeUserRoleAction();
  const registerUserAction = useRegisterUserAction();

  const isCreateUserOpen = useSignal(false);

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      {/* SaaS Dashboard layout header */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Personal
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Médicos Agremiados
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Administrá los médicos agremiados habilitados en el sistema y registrá nuevas cuentas.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick$={() => {
              isCreateUserOpen.value = !isCreateUserOpen.value;
            }}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <LuPlus class="w-4 h-4" />
            <span>{isCreateUserOpen.value ? "Cerrar Panel" : "Registrar Agremiado"}</span>
          </button>
        </div>
      </div>

      <div class="space-y-6 animate-in fade-in duration-300 text-left">
        {/* Form Actions Feedbacks */}
        {registerUserAction.value?.failed && (
          <div class="rounded-2xl border border-red-150 bg-red-50 px-4 py-3.5 text-xs font-bold text-red-800 shadow-sm">
            Error al registrar médico agremiado: {registerUserAction.value.message || "Por favor, verifica los campos."}
          </div>
        )}
        {registerUserAction.value?.success && (
          <div class="rounded-2xl border border-emerald-150 bg-emerald-50 px-4 py-3.5 text-xs font-bold text-emerald-800 shadow-sm">
            ¡Médico Agremiado registrado exitosamente y dado de alta en el sistema!
          </div>
        )}

        {/* Register User Form Panel */}
        {isCreateUserOpen.value && (
          <Form action={registerUserAction} onSubmit$={() => {
            isCreateUserOpen.value = false;
          }} class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 animate-in slide-in-from-top-6 duration-300">
            <div class="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Registrar Nuevo Médico Agremiado</h4>
              <button
                type="button"
                onClick$={() => (isCreateUserOpen.value = false)}
                class="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nombre Completo</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Ej: Dr. Diego Spinelli"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Correo Electrónico</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="Ej: dspinelli@amepla.org.ar"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Matrícula Provincial</label>
                <input
                  type="text"
                  name="matricula"
                  required
                  placeholder="Ej: 11111"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Contraseña Inicial</label>
                <input
                  type="password"
                  name="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nivel de Membresía</label>
                <select
                  name="role"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer"
                >
                  <option value="member">Miembro Regular</option>
                  <option value="premium">Miembro Premium</option>
                </select>
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick$={() => (isCreateUserOpen.value = false)}
                class="px-5 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={registerUserAction.isRunning}
                class="px-6 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                {registerUserAction.isRunning ? "Registrando..." : "Confirmar Alta"}
              </button>
            </div>
          </Form>
        )}

        {/* Users Table */}
        <div class="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table class="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th class="px-6 py-4">Nombre</th>
                <th class="px-6 py-4">Correo</th>
                <th class="px-6 py-4">Matrícula</th>
                <th class="px-6 py-4">Rol Actual</th>
                <th class="px-6 py-4 text-center">Modificar Nivel</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
              {adminUsers.value
                .filter((u) => u.role !== "admin")
                .map((userItem) => (
                  <tr key={userItem.id} class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-800">{userItem.name}</td>
                    <td class="px-6 py-4 text-slate-500">{userItem.email}</td>
                    <td class="px-6 py-4 text-slate-500 font-mono">{userItem.matricula || "S/M"}</td>
                    <td class="px-6 py-4">
                      <span
                        class={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${userItem.role === "premium"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                      >
                        {userItem.role === "premium" ? (
                          <>
                            <LuCrown class="w-2.5 h-2.5" />
                            <span>Premium</span>
                          </>
                        ) : (
                          <span>General</span>
                        )}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <Form action={changeUserRoleAction} class="flex items-center justify-center gap-1.5">
                        <input type="hidden" name="userId" value={userItem.id} />
                        <select
                          name="role"
                          onChange$={(e, el) => {
                            el.form?.requestSubmit();
                          }}
                          class="bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs p-1"
                        >
                          <option value="member" selected={userItem.role === "member"}>Miembro</option>
                          <option value="premium" selected={userItem.role === "premium"}>Premium</option>
                          <option value="admin" selected={userItem.role === "admin"}>Admin</option>
                        </select>
                      </Form>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Club - Médicos Agremiados",
  meta: [
    {
      name: "description",
      content: "Gestionar cuentas y membresías de médicos agremiados.",
    },
  ],
};
