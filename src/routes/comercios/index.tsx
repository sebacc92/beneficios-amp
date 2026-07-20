import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { merchants } from "~/db/schema";
import { hashPassword } from "~/utils/crypto";
import { ensureMerchantsTable, getMerchant, MERCHANT_COOKIE } from "~/server/merchant-auth";

// Si ya hay sesión activa, ir directo al panel.
export const useMerchantRedirect = routeLoader$(async (event) => {
  const m = await getMerchant(event);
  if (m) throw event.redirect(302, "/comercios/panel");
  return null;
});

export const useMerchantLogin = routeAction$(
  async (data, event) => {
    const db = getDB(event);
    await ensureMerchantsTable(db);
    const username = data.username.toLowerCase().trim();

    const [m] = await db.select().from(merchants).where(eq(merchants.username, username)).limit(1);
    if (!m) return event.fail(401, { message: "Usuario o contraseña incorrectos." });
    if (!m.isActive) return event.fail(403, { message: "La cuenta del local está deshabilitada." });

    const hash = await hashPassword(data.password);
    if (hash !== m.passwordHash) return event.fail(401, { message: "Usuario o contraseña incorrectos." });

    event.cookie.set(MERCHANT_COOKIE, m.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });
    throw event.redirect(302, "/comercios/panel");
  },
  zod$({
    username: z.string().min(1, "Ingresá tu usuario."),
    password: z.string().min(1, "Ingresá tu contraseña."),
  })
);

export default component$(() => {
  const login = useMerchantLogin();

  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans flex flex-col justify-center">
      <div class="max-w-md w-full mx-auto space-y-8">
        <div class="text-center">
          <Link href="/" class="inline-block">
            <img src="/Logo.webp" alt="AMP+" width={200} height={77} class="h-16 w-auto mx-auto object-contain" />
          </Link>
          <h2 class="mt-6 text-3xl font-black text-brand-green-dark tracking-tight leading-tight">
            Portal de Comercios
          </h2>
          <p class="mt-2 text-xs text-slate-500 font-medium">
            Acceso exclusivo para locales adheridos de la AMP+
          </p>
        </div>

        <Form action={login} class="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8 space-y-5">
          <div class="space-y-2">
            <label for="username" class="text-xs font-black text-slate-400 uppercase tracking-widest block">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="usuario del local"
              class="w-full text-sm font-semibold text-slate-800 border border-slate-250 py-3 px-4 rounded-2xl shadow-inner focus:outline-none focus:border-brand-green"
            />
          </div>

          <div class="space-y-2">
            <label for="password" class="text-xs font-black text-slate-400 uppercase tracking-widest block">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              class="w-full text-sm font-semibold text-slate-800 border border-slate-250 py-3 px-4 rounded-2xl shadow-inner focus:outline-none focus:border-brand-green"
            />
          </div>

          {login.value?.failed && (
            <div class="p-4 bg-red-50 border border-red-200 rounded-2xl text-center">
              <p class="text-xs font-bold text-red-700">
                {login.value.message || "No se pudo iniciar sesión."}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={login.isRunning}
            class="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-sm font-extrabold uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {login.isRunning ? (
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Ingresar"
            )}
          </button>
        </Form>

        <p class="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          ¿Sos un local y no tenés acceso? Contactá a la AMP+
        </p>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Portal de Comercios | AMP+",
};
