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
  async ({ username, password }, event) => {
    const { cookie, redirect, env, request, fail } = event;
    // Anti fuerza-bruta: máx. 10 intentos por IP cada 5 minutos.
    if (!rateLimit(`admin-login:${clientIp(request)}`, 10, 5 * 60 * 1000)) {
      return fail(429, {
        message: "Demasiados intentos. Esperá unos minutos y volvé a probar.",
      });
    }

    const db = getDB(event);
    const cleanUsername = username.trim().toLowerCase();

    // Auto-seed: si todavía no existe ningún administrador, se crea uno con
    // las credenciales bootstrap de las variables de entorno.
    const [existingAdmin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);
    if (!existingAdmin) {
      const seedUsername = env.get("PRIVATE_BOOTSTRAP_ADMIN_USERNAME")?.trim().toLowerCase() || "admin";
      const seedEmail = env.get("PRIVATE_BOOTSTRAP_ADMIN_EMAIL")?.trim().toLowerCase() || "admin@amepla.org.ar";
      const seedPass = env.get("PRIVATE_BOOTSTRAP_ADMIN_PASSWORD");
      const seedName = env.get("PRIVATE_BOOTSTRAP_ADMIN_NAME") || "Administrador";
      if (seedPass) {
        await db.insert(users).values({
          id: "usr-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
          username: seedUsername,
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
      .where(eq(users.username, cleanUsername))
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
      return fail(400, { message: "Usuario o contraseña incorrectos." });
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
    username: z.string().min(1, "Ingresá tu nombre de usuario."),
    password: z.string().min(1, "Ingresá tu contraseña."),
  })
);

export default component$(() => {
  const loginAction = useLoginAction();
  const errors = loginAction.value?.fieldErrors;

  return (
    // w-full es clave: el layout raíz envuelve /admin en un contenedor flex,
    // sin esto la página queda encogida contra el borde izquierdo.
    <div class="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0b1329] px-4 py-10 sm:p-6 font-sans">
      {/* Glows decorativos con la paleta de la marca */}
      <div class="pointer-events-none absolute -top-32 -left-32 h-112 w-112 rounded-full bg-brand-green-accent/10 blur-3xl" />
      <div class="pointer-events-none absolute -right-32 -bottom-32 h-112 w-112 rounded-full bg-brand-green/25 blur-3xl" />
      <div class="pointer-events-none absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-brand-gold/5 blur-3xl" />

      <div class="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Marca */}
        <div class="mb-8 text-center">
          <div class="mx-auto mb-6 inline-flex rounded-2xl bg-white px-6 py-4 shadow-xl shadow-black/30">
            <img
              src="/Logo-amp+.png"
              alt="AMP+ Club de Beneficios"
              width={160}
              height={58}
              class="h-9 sm:h-10 w-auto object-contain"
            />
          </div>
          <h1 class="flex items-center justify-center gap-2 text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
            <LuShieldCheck class="h-5 w-5 text-brand-green-accent" />
            Acceso administrativo
          </h1>
          <p class="mt-2 text-[10px] sm:text-xs font-extrabold tracking-widest text-slate-500 uppercase">
            Ingresá tus credenciales de panel
          </p>
        </div>

        {/* Card del formulario */}
        <div class="rounded-3xl border border-white/10 bg-[#080E1C]/80 p-6 sm:p-8 shadow-2xl shadow-black/40 backdrop-blur-md ring-1 ring-black/40">
          <Form action={loginAction} class="space-y-5">
            <div class="space-y-1.5">
              <label
                for="admin-username"
                class="block text-xs font-bold tracking-wider text-slate-400 uppercase"
              >
                Nombre de usuario
              </label>
              <input
                id="admin-username"
                type="text"
                name="username"
                placeholder="admin"
                autoFocus
                autoComplete="username"
                autoCapitalize="none"
                spellcheck={false}
                class="w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3.5 text-sm text-white transition-all outline-none placeholder:text-slate-600 focus:border-brand-green-accent focus:ring-1 focus:ring-brand-green-accent/50"
              />
              {errors?.username && (
                <p class="text-xs font-semibold text-red-400">{errors.username[0]}</p>
              )}
            </div>

            <div class="space-y-1.5">
              <label
                for="admin-password"
                class="block text-xs font-bold tracking-wider text-slate-400 uppercase"
              >
                Contraseña
              </label>
              <input
                id="admin-password"
                type="password"
                name="password"
                placeholder="••••••••"
                autoComplete="current-password"
                class="w-full rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3.5 text-sm text-white transition-all outline-none placeholder:text-slate-600 focus:border-brand-green-accent focus:ring-1 focus:ring-brand-green-accent/50"
              />
              {errors?.password && (
                <p class="text-xs font-semibold text-red-400">{errors.password[0]}</p>
              )}
            </div>

            {loginAction.value?.failed && loginAction.value?.message && (
              <div
                role="alert"
                class="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400"
              >
                {loginAction.value.message}
              </div>
            )}

            <button
              type="submit"
              disabled={loginAction.isRunning}
              class="mt-2 w-full rounded-2xl bg-brand-green py-3.5 text-sm font-bold tracking-wider text-white uppercase shadow-lg shadow-brand-green/25 transition-all duration-200 hover:bg-brand-green-light active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 cursor-pointer"
            >
              {loginAction.isRunning ? "Iniciando..." : "Ingresar"}
            </button>
          </Form>
        </div>

        {/* Pie */}
        <div class="mt-6 flex flex-col items-center gap-3 text-center">
          <Link
            href="/"
            class="text-xs font-bold text-slate-500 underline underline-offset-2 transition-colors hover:text-white"
          >
            ← Volver al sitio
          </Link>
          <p class="text-[10px] font-bold tracking-widest text-slate-600 uppercase">
            AMP+ Club de Beneficios · Panel administrativo
          </p>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Acceso administrativo — AMP+ Club de Beneficios",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
};
