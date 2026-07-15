import { component$ } from "@builder.io/qwik";
import {
  routeAction$,
  zod$,
  z,
  Form,
  useLocation,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { eq, or } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { validateMember } from "~/server/membership";
import { rateLimit, clientIp } from "~/server/rate-limit";
import { LuLock } from "@qwikest/icons/lucide";

// Login de agremiados: el DNI se valida en vivo contra el padrón oficial de la
// AMP. La tabla local `users` es solo la copia del portal: se crea/actualiza
// sola en cada login exitoso (nombre y email siempre frescos del padrón).
// Solo se permiten rutas internas relativas (evita open-redirect).
function safeRedirect(target: string | undefined): string {
  if (target && target.startsWith("/") && !target.startsWith("//")) {
    return target;
  }
  return "/perfil";
}

export const useLoginAction = routeAction$(
  async ({ dni, redirect: redirectTo }, event) => {
    const { request, cookie, redirect, fail } = event;

    if (!rateLimit(`member-login:${clientIp(request)}`, 15, 5 * 60 * 1000)) {
      return fail(429, {
        message: "Demasiados intentos. Esperá unos minutos y volvé a probar.",
      });
    }

    const result = await validateMember(event, dni);
    if (!result.valid || !result.member) {
      return fail(400, {
        message: result.reason || "El DNI ingresado no figura en el padrón.",
      });
    }

    const m = result.member;
    const db = getDB(event);
    const now = new Date().toISOString();

    // Upsert de la copia local (match por dni, o por matricula legacy).
    const [existing] = await db
      .select()
      .from(users)
      .where(or(eq(users.dni, m.dni!), eq(users.matricula, m.dni!)))
      .limit(1);

    let userId: string;
    if (existing) {
      userId = existing.id;
      const sync = {
        name: m.name,
        dni: m.dni,
        padronId: m.padronId,
        origen: m.origen,
        lastSyncedAt: now,
      };
      try {
        // El email del padrón puede chocar con el unique de otra fila local:
        // en ese caso se actualiza todo menos el email.
        await db
          .update(users)
          .set(m.email ? { ...sync, email: m.email } : sync)
          .where(eq(users.id, existing.id));
      } catch {
        await db.update(users).set(sync).where(eq(users.id, existing.id));
      }
    } else {
      userId = "usr-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();
      const baseRow = {
        id: userId,
        passwordHash: "padron", // los agremiados no usan contraseña
        name: m.name,
        matricula: m.matricula,
        dni: m.dni,
        padronId: m.padronId,
        origen: m.origen,
        lastSyncedAt: now,
        role: "member" as const,
        createdAt: now,
      };
      try {
        await db.insert(users).values({
          ...baseRow,
          email: m.email || `agremiado-${m.dni}@padron.amepla`,
        });
      } catch {
        // Colisión de email con otra fila: se registra con email placeholder.
        await db.insert(users).values({
          ...baseRow,
          email: `agremiado-${m.dni}@padron.amepla`,
        });
      }
    }

    cookie.set("session_token", userId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 días
    });

    throw redirect(302, safeRedirect(redirectTo));
  },
  zod$({
    dni: z
      .string()
      .trim()
      .regex(/^\d{6,9}$/, "Ingresá tu DNI solo con números, sin puntos."),
    redirect: z.string().optional(),
  })
);

export default component$(() => {
  const loginAction = useLoginAction();
  const errors = loginAction.value?.fieldErrors;
  const location = useLocation();
  const redirectTo = location.url.searchParams.get("redirect") || "";

  return (
    <div class="bg-slate-50 min-h-[85vh] py-16 px-4 flex flex-col justify-center items-center font-sans">
      <div class="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">

        {/* Title branding */}
        <div class="text-center space-y-2">
          <div class="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mx-auto">
            <LuLock class="w-5 h-5 text-brand-green" />
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none mt-3">
            Iniciar Sesión
          </h1>
          <p class="text-xs sm:text-sm text-slate-400 font-medium">
            Ingresá tu DNI para acceder al portal de beneficios y credencial digital.
          </p>
        </div>

        {/* Global Error message */}
        {loginAction.value?.failed && loginAction.value?.message && (
          <div class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 animate-fade-in shadow-sm">
            ✗ {loginAction.value.message}
          </div>
        )}

        {/* Form */}
        <Form action={loginAction} class="space-y-5">
          {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
          <div class="space-y-1">
            <label for="dni" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
              DNI / Identificación
            </label>
            <input
              type="text"
              id="dni"
              name="dni"
              inputMode="numeric"
              required
              placeholder="Ingresá tu número de DNI"
              class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all font-mono font-bold text-center"
            />
            {errors?.dni && (
              <p class="text-xs text-red-600 font-semibold pt-1">{errors.dni[0]}</p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loginAction.isRunning}
            class="w-full flex items-center justify-center py-3.5 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
          >
            {loginAction.isRunning ? "Verificando en el padrón..." : "Ingresar"}
          </button>
        </Form>

        {/* Foot link */}
        <div class="pt-6 border-t border-slate-100 text-center">
          <p class="text-xs sm:text-sm text-slate-400 font-semibold leading-relaxed">
            El acceso se valida contra el padrón oficial de la AMP. <br />
            <span class="text-slate-500 font-bold block mt-1">Si tu DNI no figura, comunicate con la administración de la AMP.</span>
          </p>
        </div>

      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Iniciar Sesión - Club de Beneficios AMP",
  meta: [
    {
      name: "description",
      content: "Ingresá con tu DNI al Club de Beneficios de la Agremiación Médica Platense para descargar tus cupones y credencial digital.",
    },
  ],
};
