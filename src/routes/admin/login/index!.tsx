import { component$ } from "@builder.io/qwik";
import {
  routeAction$,
  routeLoader$,
  Form,
  z,
  zod$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users as usersTable } from "~/db/schema";
import { createSession, getSessionUser } from "~/server/auth";
import { rateLimitByIp } from "~/server/rate-limit";
import { hashPassword, verifyPassword } from "~/utils/crypto";
import { LuLock } from "@qwikest/icons/lucide";

// Admins use a username or email + password, so the member DNI
// form at /login cannot authenticate them. This is their entry point.
export const useRedirectIfLogged = routeLoader$((event) => {
  if (getSessionUser(event)?.role === "admin") {
    throw event.redirect(302, "/admin/stats");
  }
  return null;
});

export const useAdminLoginAction = routeAction$(
  async (data, event) => {
    const limit = rateLimitByIp(event, "admin-login", 8, 10 * 60 * 1000);
    if (!limit.allowed) {
      return event.fail(429, {
        message: `Demasiados intentos fallidos. Probá de nuevo en ${Math.ceil(limit.retryAfter / 60)} minuto(s).`,
      });
    }

    const email = data.email.toLowerCase().trim();

    try {
      const db = getDB(event);
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      // Same message for unknown email and wrong password, so the form cannot be
      // used to enumerate which addresses exist.
      const invalid = { message: "Usuario o contraseña incorrectos." };
      if (!user || user.role !== "admin") {
        return event.fail(401, invalid);
      }

      const { valid, needsRehash } = await verifyPassword(data.password, user.passwordHash);
      if (!valid) {
        return event.fail(401, invalid);
      }

      // Transparently upgrade hashes still stored with the old unsalted scheme.
      if (needsRehash) {
        try {
          await db
            .update(usersTable)
            .set({ passwordHash: await hashPassword(data.password) })
            .where(eq(usersTable.id, user.id));
        } catch (err) {
          console.error("Failed to upgrade password hash:", err);
        }
      }

      await createSession(event, user.id);
    } catch (err) {
      console.error("Admin login error:", err);
      return event.fail(500, { message: "Error al iniciar sesión. Intentá de nuevo." });
    }

    throw event.redirect(302, "/admin/stats");
  },
  zod$({
    email: z.string().trim().min(1, "Ingresá tu usuario o correo electrónico."),
    password: z.string().min(1, "Ingresá tu contraseña."),
  }),
);

export default component$(() => {
  useRedirectIfLogged();
  const loginAction = useAdminLoginAction();

  return (
    <div class="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 font-sans">
      <div class="max-w-md w-full bg-white rounded-3xl p-8 sm:p-10 shadow-xl space-y-8">
        <div class="text-center space-y-2">
          <div class="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mx-auto">
            <LuLock class="w-5 h-5 text-brand-green" />
          </div>
          <h1 class="text-2xl font-display font-extrabold text-brand-green-dark tracking-tight mt-3">
            Panel de Administración
          </h1>
          <p class="text-xs sm:text-sm text-slate-400 font-medium">
            Acceso exclusivo para administradores de la LPRC.
          </p>
        </div>

        {loginAction.value?.failed && (
          <div class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 shadow-sm">
            ✗ {loginAction.value.message ?? "No se pudo iniciar sesión."}
          </div>
        )}

        <Form action={loginAction} class="space-y-5">
          <div class="space-y-1">
            <label for="email" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
              Usuario o correo electrónico
            </label>
            <input
              type="text"
              id="email"
              name="email"
              required
              autoComplete="username"
              placeholder="diego"
              class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
            />
          </div>

          <div class="space-y-1">
            <label for="password" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loginAction.isRunning}
            class="w-full flex items-center justify-center py-3.5 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
          >
            {loginAction.isRunning ? "Verificando..." : "Ingresar al panel"}
          </button>
        </Form>

        <div class="pt-6 border-t border-slate-100 text-center">
          <a href="/" class="text-xs text-slate-400 font-semibold hover:text-brand-green transition-colors">
            ← Volver al sitio
          </a>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Panel de Administración - LPRC",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
};
