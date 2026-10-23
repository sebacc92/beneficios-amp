import { component$ } from "@builder.io/qwik";
import { Form, routeAction$, routeLoader$, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuAlertCircle } from "@qwikest/icons/lucide";
import { createSession, destroySession, getSessionUser } from "~/server/auth";
import { changeTemporaryAdminPassword } from "~/server/admin-users";
import { ADMIN_HOME_PATH, ADMIN_LOGIN_PATH, RETURN_PARAM, safeAdminReturnPath } from "~/utils/return-path";
import { MIN_ADMIN_PASSWORD_LENGTH } from "../admins/temporary-password";
import { AdminAuthShell, PasswordField } from "../login/auth-shell";

// Reached only through plugin@auth while the account still has a temporary password.
export const useForcedChangeContext = routeLoader$((event) => {
  const user = getSessionUser(event);
  const returnTo = safeAdminReturnPath(event.url.searchParams.get(RETURN_PARAM));
  if (!user || user.role !== "admin") throw event.redirect(302, `${ADMIN_LOGIN_PATH}/`);
  if (!user.mustChangePassword) throw event.redirect(302, returnTo ?? ADMIN_HOME_PATH);
  return { name: user.name, returnTo };
});

export const useForcedPasswordChangeAction = routeAction$(
  async (data, event) => {
    const user = getSessionUser(event);
    if (!user || user.role !== "admin") return event.fail(403, { message: "Tu sesión terminó. Ingresá de nuevo." });
    if (data.newPassword !== data.confirmPassword) {
      return event.fail(400, { message: "", confirmError: "Las contraseñas no coinciden." });
    }

    try {
      const result = await changeTemporaryAdminPassword(event, data.newPassword);
      if (!result.ok) {
        if (result.reason === "same_password") {
          return event.fail(400, { message: "", newError: "Elegí una contraseña distinta de la temporal." });
        }
        return event.fail(403, { message: "La cuenta ya no tiene una contraseña temporal. Volvé a ingresar." });
      }
      await createSession(event, user.id);
    } catch (err) {
      console.error("Forced password change failed:", err);
      return event.fail(500, { message: "No se pudo guardar la contraseña. Intentá de nuevo." });
    }

    throw event.redirect(302, safeAdminReturnPath(data.volver) ?? ADMIN_HOME_PATH);
  },
  zod$({
    newPassword: z.string().min(MIN_ADMIN_PASSWORD_LENGTH, `Usá al menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres.`),
    confirmPassword: z.string().min(1, "Repetí la contraseña nueva."),
    volver: z.string().optional(),
  }),
);

export const useForcedChangeLogoutAction = routeAction$(async (_, event) => {
  await destroySession(event);
  throw event.redirect(302, `${ADMIN_LOGIN_PATH}/`);
});

export default component$(() => {
  const context = useForcedChangeContext();
  const action = useForcedPasswordChangeAction();
  const logout = useForcedChangeLogoutAction();
  const failed = action.value?.failed
    ? (action.value as { message?: string; newError?: string; confirmError?: string; fieldErrors?: { newPassword?: string; confirmPassword?: string } })
    : undefined;
  const newError = failed?.fieldErrors?.newPassword ?? failed?.newError;
  const confirmError = failed?.fieldErrors?.confirmPassword ?? failed?.confirmError;

  return (
    <AdminAuthShell
      title="Elegí tu contraseña"
      subtitle={`Hola, ${context.value.name}. Ingresaste con una contraseña temporal: antes de seguir, elegí una propia que solo sepas vos.`}
    >
      {failed?.message && (
        <div role="alert" class="flex items-start gap-2 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          <LuAlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{failed.message}</span>
        </div>
      )}

      <Form action={action} class="space-y-5">
        {context.value.returnTo && <input type="hidden" name="volver" value={context.value.returnTo} />}
        <PasswordField
          id="new-password"
          name="newPassword"
          label="Contraseña nueva"
          autocomplete="new-password"
          minLength={MIN_ADMIN_PASSWORD_LENGTH}
          hint={`Mínimo ${MIN_ADMIN_PASSWORD_LENGTH} caracteres. Una frase corta es fácil de recordar y difícil de adivinar.`}
          error={newError}
        />
        <PasswordField
          id="confirm-password"
          name="confirmPassword"
          label="Repetí la contraseña nueva"
          autocomplete="new-password"
          minLength={MIN_ADMIN_PASSWORD_LENGTH}
          error={confirmError}
        />
        <button type="submit" disabled={action.isRunning} class="btn btn-primary w-full">
          {action.isRunning ? "Guardando..." : "Guardar y entrar al panel"}
        </button>
      </Form>

      <Form action={logout} class="border-t border-slate-200 pt-4">
        <button type="submit" disabled={logout.isRunning} class="min-h-11 text-sm font-semibold text-primary underline-offset-4 hover:underline cursor-pointer">
          No soy yo / cerrar sesión
        </button>
      </Form>
    </AdminAuthShell>
  );
});

export const head: DocumentHead = {
  title: "Cambiar contraseña - Panel LPRC",
  meta: [{ name: "robots", content: "noindex, nofollow" }],
};
