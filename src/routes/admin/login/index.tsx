import { component$ } from "@builder.io/qwik";
import { routeAction$, zod$, z, Link, Form } from "@builder.io/qwik-city";
import type { DocumentHead } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import {
  hashPassword,
  verifyPassword,
  createAdminSessionToken,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
} from "~/server/admin-auth";
import { rateLimit, clientIp } from "~/server/rate-limit";
import { LuShieldCheck } from "@qwikest/icons/lucide";

export const useLoginAction = routeAction$(
  async ({ email, password }, event) => {
    const { cookie, redirect, env, request, fail } = event;
    // Anti fuerza-bruta: máx. 10 intentos por IP cada 5 minutos.
    if (!rateLimit(`admin-login:${clientIp(request)}`, 10, 5 * 60 * 1000)) {
      return fail(429, {
        message: "Demasiados intentos. Esperá unos minutos y volvé a probar.",
      });
    }

    const db = getDB(event);
    const cleanEmail = email.trim().toLowerCase();

    // Auto-seed: si todavía no existe ningún administrador, se crea uno con
    // las credenciales bootstrap de las variables de entorno.
    const [existingAdmin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);
    if (!existingAdmin) {
      const seedEmail = env.get("PRIVATE_BOOTSTRAP_ADMIN_EMAIL")?.trim().toLowerCase();
      const seedPass = env.get("PRIVATE_BOOTSTRAP_ADMIN_PASSWORD");
      const seedName = env.get("PRIVATE_BOOTSTRAP_ADMIN_NAME") || "Administrador";
      if (seedEmail && seedPass) {
        await db.insert(users).values({
          id: "usr-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
          email: seedEmail,
          passwordHash: await hashPassword(seedPass),
          name: seedName,
          role: "admin",
          createdAt: new Date().toISOString(),
        });
      }
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    let ok = false;
    if (user && user.role === "admin") {
      const result = await verifyPassword(password, user.passwordHash);
      ok = result.ok;
      // Migración de hashes legacy (SHA-256 sin salt): se re-guardan con
      // PBKDF2 en el primer login exitoso.
      if (ok && result.needsRehash) {
        await db
          .update(users)
          .set({ passwordHash: await hashPassword(password) })
          .where(eq(users.id, user.id));
      }
    }

    if (!ok || !user) {
      return fail(400, { message: "Correo o contraseña incorrectos." });
    }

    const isProd = import.meta.env.PROD || process.env.NODE_ENV === "production";
    cookie.set(ADMIN_SESSION_COOKIE, await createAdminSessionToken(env, user.id), {
      path: "/",
      httpOnly: true,
      secure: !!isProd,
      sameSite: "lax",
      maxAge: ADMIN_SESSION_MAX_AGE,
    });

    throw redirect(302, "/admin");
  },
  zod$({
    email: z.string().email("Ingresá un correo válido."),
    password: z.string().min(1, "Ingresá tu contraseña."),
  })
);

export default component$(() => {
  const loginAction = useLoginAction();
  const errors = loginAction.value?.fieldErrors;

  return (
    <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1329] p-6 font-sans">
      <div class="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-brand-green/10 blur-3xl" />
      <div class="absolute -right-40 -bottom-40 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

      <div class="relative z-10 w-full max-w-md">
        <div class="mb-8 text-center">
          <div class="mx-auto mb-5 inline-flex rounded-2xl bg-white px-6 py-4 shadow-md">
            <img
              src="/Logo-amp+.png"
              alt="AMP+ Club de Beneficios"
              width={160}
              height={58}
              class="h-10 w-auto object-contain"
            />
          </div>
          <h1 class="flex items-center justify-center gap-2 text-xl font-display font-extrabold text-white">
            <LuShieldCheck class="h-5 w-5 text-brand-green" />
            Acceso administrativo
          </h1>
          <p class="mt-1 text-xs font-bold tracking-widest text-slate-500 uppercase">
            Ingresá tus credenciales de panel
          </p>
        </div>

        <div class="rounded-3xl border border-slate-800 bg-[#080E1C]/80 p-8 shadow-2xl backdrop-blur-md">
          <Form action={loginAction} class="space-y-5">
            <div>
              <label class="mb-1.5 block text-xs font-bold tracking-wider text-slate-400 uppercase">
                Correo electrónico
              </label>
              <input
                type="email"
                name="email"
                placeholder="admin@amepla.org.ar"
                autoFocus
                class="w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3.5 text-sm text-white transition-colors outline-none placeholder:text-slate-600 focus:border-brand-green"
              />
              {errors?.email && (
                <p class="mt-1 text-xs text-red-400">{errors.email[0]}</p>
              )}
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-bold tracking-wider text-slate-400 uppercase">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                autoComplete="current-password"
                class="w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3.5 text-sm text-white transition-colors outline-none placeholder:text-slate-600 focus:border-brand-green"
              />
              {errors?.password && (
                <p class="mt-1 text-xs text-red-400">{errors.password[0]}</p>
              )}
            </div>

            {loginAction.value?.failed && loginAction.value?.message && (
              <div class="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p class="text-sm font-semibold text-red-400">
                  {loginAction.value.message}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loginAction.isRunning}
              class="mt-2 w-full rounded-2xl bg-brand-green py-3.5 text-sm font-bold tracking-wider text-white uppercase shadow-lg transition-all duration-200 hover:bg-brand-green-light disabled:opacity-60 cursor-pointer"
            >
              {loginAction.isRunning ? "Iniciando..." : "Ingresar"}
            </button>
          </Form>
        </div>

        <div class="mt-6 text-center">
          <Link
            href="/"
            class="text-xs font-bold text-slate-500 underline underline-offset-2 transition-colors hover:text-white"
          >
            ← Volver al sitio
          </Link>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Acceso administrativo — AMP+ Club de Beneficios",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
};
