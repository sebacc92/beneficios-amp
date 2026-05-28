import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
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

export default component$(() => {
  const adminUsers = useAdminUsersLoader();
  const changeUserRoleAction = useChangeUserRoleAction();

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
            Administradores
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Gestioná los accesos y roles de los administradores del sistema.
          </p>
        </div>
      </div>

      <div class="space-y-6 animate-in fade-in duration-300 text-left">
        {/* Admins Table */}
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
                .filter((u) => u.role === "admin")
                .map((userItem) => (
                  <tr key={userItem.id} class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-800">{userItem.name}</td>
                    <td class="px-6 py-4 text-slate-500">{userItem.email}</td>
                    <td class="px-6 py-4 text-slate-500 font-mono">{userItem.matricula || "S/M"}</td>
                    <td class="px-6 py-4">
                      <span class="px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider bg-purple-50 text-purple-700 border-purple-100">
                        {userItem.role}
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
                          <option value="admin" selected>Admin</option>
                          <option value="member">Miembro</option>
                          <option value="premium">Premium</option>
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
  title: "AMP+ Club - Administradores del Portal",
  meta: [
    {
      name: "description",
      content: "Visualizar y gestionar cuentas de administradores.",
    },
  ],
};
