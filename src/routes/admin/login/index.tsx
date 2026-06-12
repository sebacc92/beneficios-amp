import { component$ } from "@builder.io/qwik";
import {
  routeAction$,
  routeLoader$,
  Form,
  Link,
  z,
  zod$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { LuLock, LuShield } from "@qwikest/icons/lucide";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { verifyPassword } from "~/utils/crypto";

// If an admin is already logged in, skip the form.
export const useRedirectIfAdmin = routeLoader$((event) => {
  const current = event.sharedMap.get("user") as { role?: string } | undefined;
  if (current?.role === "admin") {
    throw event.redirect(302, "/admin");
  }
  return null;
});

export const useAdminLoginAction = routeAction$(
  async (data, event) => {
    const email = data.email.toLowerCase().trim();

    const db = getDB(event);
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Always run the verify step even when the user is missing, so attackers
    // can't distinguish unknown emails from wrong passwords by response time.
    const dummyHash =
      "pbkdf2$100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";
    const passwordOk = await verifyPassword(data.password, user?.passwordHash ?? dummyHash);

    if (!user || !passwordOk || user.role !== "admin") {
      return event.fail(401, {
        message: "Credenciales inválidas o cuenta sin permisos de administrador.",
      });
    }

    event.cookie.set("session_token", user.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: event.url.protocol === "https:",
      maxAge: 60 * 60 * 8, // 8 hours for admin sessions
    });

    throw event.redirect(302, "/admin");
  },
  zod$({
    email: z.string().email("Ingresá un correo electrónico válido."),
    password: z.string().min(1, "Ingresá tu contraseña."),
  })
);

export default component$(() => {
  useRedirectIfAdmin();
  const action = useAdminLoginAction();

  return (
    <div class="bg-slate-50 min-h-screen py-16 px-4 flex flex-col justify-center items-center font-sans">
      <div class="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm space-y-8">
        <div class="text-center space-y-2">
          <div class="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 mx-auto">
            <LuShield class="w-5 h-5 text-brand-gold-dark" />
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none mt-3">
            Panel de Administración
          </h1>
          <p class="text-xs sm:text-sm text-slate-400 font-medium">
            Acceso exclusivo para administradores autorizados de la AMP.
          </p>
        </div>

        {action.value?.failed && (
          <div class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 shadow-sm">
            ✗ {action.value.message || "Credenciales inválidas."}
          </div>
        )}

        <Form action={action} class="space-y-5">
          <div class="space-y-1">
            <label for="email" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
              Correo electrónico
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              autoComplete="username"
              placeholder="admin@amepla.org.ar"
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
            disabled={action.isRunning}
            class="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
          >
            <LuLock class="w-4 h-4" />
            {action.isRunning ? "Verificando..." : "Ingresar al panel"}
          </button>
        </Form>

        <div class="pt-6 border-t border-slate-100 text-center">
          <p class="text-xs text-slate-400 font-semibold">
            ¿Sos médico agremiado?{" "}
            <Link href="/login" class="text-brand-green hover:underline font-bold">
              Ingresá con tu DNI
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Panel de Administración - AMP",
  meta: [
    {
      name: "description",
      content: "Acceso al panel administrativo del Portal de Beneficios de la Agremiación Médica Platense.",
    },
    { name: "robots", content: "noindex,nofollow" },
  ],
};
