import { component$, useSignal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuPlus } from "@qwikest/icons/lucide";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDB } from "~/db";
import { users as usersTable } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { findUsersByDni } from "~/server/member-dni";
import { isValidDni, normalizeDni } from "~/utils/dni";
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

// --- ACTIONS ---

export const useChangeUserRoleAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      // Only member <-> Gold here; admins are managed from /admin/admins.
      const [updated] = await db
        .update(usersTable)
        .set({ role: data.role, premiumExpiresAt: null })
        .where(and(eq(usersTable.id, data.userId), ne(usersTable.role, "admin")))
        .returning({ name: usersTable.name, role: usersTable.role });
      if (!updated) return requestEvent.fail(404, { message: "No se encontró el socio." });

      return { success: true, name: updated.name, role: updated.role };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "No se pudo cambiar el tipo de socio." });
    }
  },
  zod$({
    userId: z.string(),
    role: z.enum(["member", "premium"]),
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
      const dni = normalizeDni(data.numeroSocio);

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

      // Check if DNI (numeroSocio) already exists
      const [existingDni] = await findUsersByDni(requestEvent, dni);

      if (existingDni) {
        return requestEvent.fail(409, {
          message: "El DNI ingresado ya se encuentra registrado para otro usuario.",
        });
      }

      const { hashPassword } = await import("~/utils/crypto");
      // Generate a random secure dummy password under the hood
      const dummyPassword = crypto.randomUUID();
      const passwordHash = await hashPassword(dummyPassword);
      const userId = "usr-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();

      await db.insert(usersTable).values({
        id: userId,
        email,
        passwordHash,
        name: data.name.trim(),
        numeroSocio: dni,
        role: "member", // Set default member role
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (e: any) {
      console.error("Admin register user error:", e);
      return requestEvent.fail(500, {
        message: e.message || "Error al registrar el socio.",
      });
    }
  },
  zod$({
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    email: z.string().email("Ingresá un correo electrónico válido."),
    numeroSocio: z.string().refine(isValidDni, "Ingresá un DNI de 5 a 9 números, con o sin puntos o espacios."),
  })
);

/** Member/Gold selector; the role is the real data the old always-"Activo" badge stood in for. */
const RoleForm = component$<{
  action: ReturnType<typeof useChangeUserRoleAction>;
  userId: string;
  name: string;
  role: string;
}>((props) => (
  <Form action={props.action} class="flex items-center gap-2">
    <input type="hidden" name="userId" value={props.userId} />
    <select
      name="role"
      aria-label={`Tipo de socio de ${props.name}`}
      disabled={props.action.isRunning}
      onChange$={(_, el) => el.form?.requestSubmit()}
      class="bg-white border border-slate-200 rounded-xl text-base sm:text-xs font-bold px-3 py-2 focus:border-brand-navy focus:outline-none cursor-pointer disabled:opacity-50"
    >
      <option value="member" selected={props.role !== "premium"}>Socio</option>
      <option value="premium" selected={props.role === "premium"}>Socio Gold</option>
    </select>
  </Form>
));

export default component$(() => {
  const adminUsers = useAdminUsersLoader();
  const registerUserAction = useRegisterUserAction();
  const changeRoleAction = useChangeUserRoleAction();

  const isCreateUserOpen = useSignal(false);
  const members = adminUsers.value.filter((u) => u.role !== "admin");

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
            Socios del Club
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Administrá los socios habilitados en el sistema y registrá nuevas cuentas.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick$={() => {
              isCreateUserOpen.value = !isCreateUserOpen.value;
            }}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <LuPlus class="w-4 h-4" />
            <span>{isCreateUserOpen.value ? "Cerrar Panel" : "Registrar Socio"}</span>
          </button>
        </div>
      </div>

      <div class="space-y-6 animate-in fade-in duration-300 text-left">
        {/* Form Actions Feedbacks (registration failures show inside the open form) */}
        {registerUserAction.value?.success && (
          <ActionFeedback value={registerUserAction.value} success="¡Socio del Club registrado y dado de alta en el sistema!" />
        )}
        <ActionFeedback
          value={changeRoleAction.value}
          success={changeRoleAction.value?.success ? `✓ ${changeRoleAction.value.name} ahora es ${changeRoleAction.value.role === "premium" ? "socio Gold" : "socio"}.` : undefined}
        />

        {/* Register User Form Panel */}
        {isCreateUserOpen.value && (
          <Form
            action={registerUserAction}
            onSubmitCompleted$={() => {
              // Keep the panel and its values open when the DNI or email is rejected
              if (registerUserAction.value?.success) isCreateUserOpen.value = false;
            }}
            class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 animate-in slide-in-from-top-6 duration-300"
          >
            <div class="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Registrar Nuevo Socio del Club</h4>
              <button
                type="button"
                onClick$={() => (isCreateUserOpen.value = false)}
                class="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕ Cerrar
              </button>
            </div>

            {registerUserAction.value?.failed && registerUserAction.value.message && <ActionFeedback value={registerUserAction.value} />}

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="space-y-1">
                <label for="new-member-name" class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nombre Completo</label>
                <input
                  id="new-member-name"
                  type="text"
                  name="name"
                  required
                  autocomplete="off"
                  placeholder="Ej: Diego Spinelli"
                  aria-invalid={!!registerUserAction.value?.fieldErrors?.name}
                  aria-describedby={registerUserAction.value?.fieldErrors?.name ? "new-member-name-error" : undefined}
                  class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
                />
                {registerUserAction.value?.fieldErrors?.name && (
                  <p id="new-member-name-error" role="alert" class="text-xs text-red-700">{registerUserAction.value.fieldErrors.name}</p>
                )}
              </div>

              <div class="space-y-1">
                <label for="new-member-email" class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Correo Electrónico</label>
                <input
                  id="new-member-email"
                  type="email"
                  name="email"
                  required
                  autocomplete="off"
                  placeholder="Ej: dspinelli@lprc.ar"
                  aria-invalid={!!registerUserAction.value?.fieldErrors?.email}
                  aria-describedby={registerUserAction.value?.fieldErrors?.email ? "new-member-email-error" : undefined}
                  class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
                />
                {registerUserAction.value?.fieldErrors?.email && (
                  <p id="new-member-email-error" role="alert" class="text-xs text-red-700">{registerUserAction.value.fieldErrors.email}</p>
                )}
              </div>

              <div class="space-y-1">
                <label for="new-member-dni" class="text-xs font-bold text-slate-500 uppercase tracking-wider block">DNI / Nro. Socio</label>
                <input
                  id="new-member-dni"
                  type="text"
                  name="numeroSocio"
                  required
                  inputMode="numeric"
                  autocomplete="off"
                  placeholder="Ej: 12345678"
                  aria-invalid={!!registerUserAction.value?.fieldErrors?.numeroSocio}
                  aria-describedby={registerUserAction.value?.fieldErrors?.numeroSocio ? "new-member-dni-error" : undefined}
                  class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
                />
                {registerUserAction.value?.fieldErrors?.numeroSocio && (
                  <p id="new-member-dni-error" role="alert" class="text-xs text-red-700">{registerUserAction.value.fieldErrors.numeroSocio}</p>
                )}
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
                class="px-6 py-3 rounded-2xl bg-brand-navy hover:bg-brand-navy-light disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                {registerUserAction.isRunning ? "Registrando..." : "Confirmar Alta"}
              </button>
            </div>
          </Form>
        )}

        {/* Members: stacked cards on phones, table from sm up */}
        <ul class="space-y-3 sm:hidden">
          {members.map((userItem) => (
            <li key={userItem.id} class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div class="space-y-1">
                <p class="font-bold text-slate-800">{userItem.name}</p>
                <p class="font-mono text-xs font-bold text-slate-600">DNI {userItem.numeroSocio || "S/D"}</p>
                <p class="text-xs text-slate-500 break-all">{userItem.email}</p>
              </div>
              <RoleForm action={changeRoleAction} userId={userItem.id} name={userItem.name} role={userItem.role} />
            </li>
          ))}
          {members.length === 0 && <li class="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">Todavía no hay socios registrados.</li>}
        </ul>

        <div class="hidden sm:block overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table class="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                <th class="px-6 py-4">DNI / Nro. Socio</th>
                <th class="px-6 py-4">Nombre Completo</th>
                <th class="px-6 py-4">Correo Electrónico</th>
                <th class="px-6 py-4">Tipo de socio</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
              {members.map((userItem) => (
                <tr key={userItem.id} class="hover:bg-slate-50 transition-colors">
                  <td class="px-6 py-4 font-mono text-slate-800 font-bold">{userItem.numeroSocio || "S/D"}</td>
                  <td class="px-6 py-4 text-slate-700">{userItem.name}</td>
                  <td class="px-6 py-4 text-slate-500">{userItem.email}</td>
                  <td class="px-6 py-4">
                    <RoleForm action={changeRoleAction} userId={userItem.id} name={userItem.name} role={userItem.role} />
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={4} class="px-6 py-10 text-center text-slate-500">Todavía no hay socios registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "LPRC Club - Socios",
  meta: [
    {
      name: "description",
      content: "Gestionar cuentas y membresías de socios.",
    },
  ],
};
