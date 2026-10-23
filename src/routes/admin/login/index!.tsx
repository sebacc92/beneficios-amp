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
import { LuAlertCircle } from "@qwikest/icons/lucide";
import { getDB } from "~/db";
import { users as usersTable } from "~/db/schema";
import { createSession, getSessionUser } from "~/server/auth";
import { rateLimitByIp } from "~/server/rate-limit";
import { hashPassword, verifyPassword } from "~/utils/crypto";
import {
  ADMIN_HOME_PATH,
  ADMIN_PASSWORD_CHANGE_PATH,
  RETURN_PARAM,
  adminPathWithReturn,
  safeAdminReturnPath,
} from "~/utils/return-path";
import { AdminAuthShell, PasswordField } from "./auth-shell";

// Admins use a username or email + password, so the member DNI
// form at /login cannot authenticate them. This is their entry point.
export const useLoginContext = routeLoader$((event) => {
  const returnTo = safeAdminReturnPath(event.url.searchParams.get(RETURN_PARAM));
  if (getSessionUser(event)?.role === "admin") {
    throw event.redirect(302, returnTo ?? ADMIN_HOME_PATH);
  }
  return { returnTo };
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
    let mustChangePassword = false;

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
      mustChangePassword = Boolean(user.mustChangePassword);
    } catch (err) {
      console.error("Admin login error:", err);
      return event.fail(500, { message: "Error al iniciar sesión. Intentá de nuevo." });
    }

    const destination = safeAdminReturnPath(data.volver) ?? ADMIN_HOME_PATH;
    throw event.redirect(302, mustChangePassword ? adminPathWithReturn(ADMIN_PASSWORD_CHANGE_PATH, destination) : destination);
  },
  zod$({
    email: z.string().trim().min(1, "Ingresá tu usuario o correo electrónico."),
    password: z.string().min(1, "Ingresá tu contraseña."),
    volver: z.string().optional(),
  }),
);

export default component$(() => {
  const context = useLoginContext();
  const loginAction = useAdminLoginAction();
  const fieldErrors = loginAction.value?.failed ? loginAction.value.fieldErrors : undefined;
  const message = loginAction.value?.failed ? loginAction.value.message : undefined;

  return (
    <AdminAuthShell
      title="Panel de administración"
      subtitle={
        context.value.returnTo
          ? "Ingresá con tu usuario de administrador. Después volvés a la página que querías abrir."
          : "Acceso exclusivo para administradores del portal de beneficios del club."
      }
    >
      {message && (
        <div role="alert" class="flex items-start gap-2 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <LuAlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <Form action={loginAction} class="space-y-5">
        {context.value.returnTo && <input type="hidden" name="volver" value={context.value.returnTo} />}
        <div>
          <label for="email" class="field-label">Usuario o correo electrónico</label>
          <input
            type="text"
            id="email"
            name="email"
            required
            autoComplete="username"
            autoCapitalize="off"
            spellcheck={false}
            placeholder="usuario o email"
            aria-invalid={fieldErrors?.email ? "true" : undefined}
            aria-describedby={fieldErrors?.email ? "email-error" : undefined}
            class="field text-base sm:text-sm"
          />
          {fieldErrors?.email && <p id="email-error" class="mt-1.5 text-xs font-semibold text-red-700">{fieldErrors.email}</p>}
        </div>

        <PasswordField
          id="password"
          name="password"
          label="Contraseña"
          autocomplete="current-password"
          error={fieldErrors?.password}
        />

        <button type="submit" disabled={loginAction.isRunning} class="btn btn-primary w-full">
          {loginAction.isRunning ? "Verificando..." : "Ingresar al panel"}
        </button>
      </Form>

      <details class="group border-t border-slate-200 pt-4 text-sm">
        <summary class="cursor-pointer font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          ¿Olvidaste tu contraseña?
        </summary>
        <p class="mt-3 text-slate-600">
          No enviamos correos para recuperarla. Pedile a otro administrador que entre a <strong>Administradores</strong> y
          toque <strong>Restablecer contraseña</strong> en tu fila: te va a pasar una contraseña temporal y, al ingresar con
          ella, el panel te pide que elijas una nueva.
        </p>
      </details>

      <div q:slot="footer" class="text-center">
        <a href="/" class="inline-flex min-h-11 items-center text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline">
          Volver al sitio
        </a>
      </div>
    </AdminAuthShell>
  );
});

export const head: DocumentHead = {
  title: "Panel de Administración - LPRC",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
};
