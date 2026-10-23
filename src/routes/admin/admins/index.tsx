import { component$, useSignal, useTask$, $, type Signal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { and, asc, eq } from "drizzle-orm";
import { LuCheck, LuCopy, LuKeyRound, LuPlus, LuRefreshCw, LuUserX } from "@qwikest/icons/lucide";
import { getDB } from "~/db";
import { users as usersTable } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { createSession, destroyAllSessionsForUser } from "~/server/auth";
import { deleteAdministrator } from "~/server/admin-users";
import { ActionFeedback } from "~/components/admin/action-feedback";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { SectionHeading } from "~/components/section-heading/section-heading";
import { buenosAiresDay, formatCalendarDay, formatDateTime } from "~/utils/club-content";
import { PasswordField } from "../login/auth-shell";
import { MIN_ADMIN_PASSWORD_LENGTH, generateTemporaryPassword } from "./temporary-password";

function currentAdmin(event: { sharedMap: Map<string, unknown> }): AuthenticatedUser | null {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  return user?.role === "admin" ? user : null;
}

// --- SECURITY & LOADERS ---

export const useAdminUsersLoader = routeLoader$(async (event) => {
  if (!currentAdmin(event)) {
    throw event.redirect(302, "/admin/login/");
  }
  try {
    const db = getDB(event);
    return await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        createdAt: usersTable.createdAt,
        lastLoginAt: usersTable.lastLoginAt,
        mustChangePassword: usersTable.mustChangePassword,
      })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .orderBy(asc(usersTable.name));
  } catch (err) {
    console.error("Failed to load admin users:", err);
    return [];
  }
});

export const useCurrentUserLoader = routeLoader$((event) => {
  return (event.sharedMap.get("user") || null) as AuthenticatedUser | null;
});

// --- ACTIONS ---

const passwordRule = z.string().min(MIN_ADMIN_PASSWORD_LENGTH, `Usá al menos ${MIN_ADMIN_PASSWORD_LENGTH} caracteres.`);

export const useChangePasswordAction = routeAction$(
  async (data, requestEvent) => {
    const me = currentAdmin(requestEvent);
    if (!me) return requestEvent.fail(403, { message: "No autorizado." });
    if (data.newPassword !== data.confirmPassword) {
      return requestEvent.fail(400, { message: "", confirmError: "Las contraseñas nuevas no coinciden." });
    }

    try {
      const db = getDB(requestEvent);
      const { hashPassword, verifyPassword } = await import("~/utils/crypto");
      const [row] = await db.select({ passwordHash: usersTable.passwordHash }).from(usersTable).where(eq(usersTable.id, me.id)).limit(1);
      if (!row || !(await verifyPassword(data.currentPassword, row.passwordHash)).valid) {
        return requestEvent.fail(400, { message: "", currentError: "La contraseña actual no es correcta." });
      }

      await db
        .update(usersTable)
        .set({ passwordHash: await hashPassword(data.newPassword), mustChangePassword: false })
        .where(eq(usersTable.id, me.id));
      // Sessions opened elsewhere with the old password stop working; this one continues.
      await destroyAllSessionsForUser(requestEvent, me.id);
      await createSession(requestEvent, me.id);

      return { success: true };
    } catch (err: any) {
      console.error("Error changing password:", err);
      return requestEvent.fail(500, { message: "Error al actualizar la contraseña." });
    }
  },
  zod$({
    currentPassword: z.string().min(1, "Ingresá tu contraseña actual."),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, "Repetí la contraseña nueva."),
  })
);

export const useRegisterAdminAction = routeAction$(
  async (data, requestEvent) => {
    if (!currentAdmin(requestEvent)) {
      return requestEvent.fail(403, { message: "No autorizado." });
    }

    try {
      const db = getDB(requestEvent);
      const email = data.email.toLowerCase().trim();

      // Check if email already exists
      const [existingUser] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      if (existingUser) {
        return requestEvent.fail(409, {
          message: "El correo electrónico ingresado ya se encuentra registrado.",
        });
      }

      const { hashPassword } = await import("~/utils/crypto");
      const passwordHash = await hashPassword(data.password);
      const userId = "usr-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();

      await db.insert(usersTable).values({
        id: userId,
        email,
        passwordHash,
        name: data.name.trim(),
        role: "admin", // Enforce role admin
        // The person chooses their own password the first time they log in.
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
      });

      return { success: true, name: data.name.trim(), email };
    } catch (e: any) {
      console.error("Admin register admin error:", e);
      return requestEvent.fail(500, {
        message: e.message || "Error al registrar el administrador.",
      });
    }
  },
  zod$({
    name: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres."),
    email: z.string().trim().email("Ingresá un correo electrónico válido."),
    password: passwordRule,
  })
);

/** "Olvidé mi contraseña": another admin issues a temporary one, shown once. */
export const useResetAdminPasswordAction = routeAction$(
  async (data, requestEvent) => {
    const me = currentAdmin(requestEvent);
    if (!me) return requestEvent.fail(403, { message: "No autorizado." });
    if (data.userId === me.id) {
      return requestEvent.fail(400, { message: "Para tu propia cuenta usá “Cambiar mi contraseña”." });
    }

    try {
      const db = getDB(requestEvent);
      const temporaryPassword = generateTemporaryPassword();
      const { hashPassword } = await import("~/utils/crypto");
      const [updated] = await db
        .update(usersTable)
        .set({ passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true })
        .where(and(eq(usersTable.id, data.userId), eq(usersTable.role, "admin")))
        .returning({ name: usersTable.name, email: usersTable.email });
      if (!updated) return requestEvent.fail(404, { message: "No se encontró ese administrador." });
      await destroyAllSessionsForUser(requestEvent, data.userId);
      return { success: true, name: updated.name, email: updated.email, temporaryPassword };
    } catch (err) {
      console.error("Admin password reset error:", err);
      return requestEvent.fail(500, { message: "No se pudo restablecer la contraseña. Intentá de nuevo." });
    }
  },
  zod$({ userId: z.string().min(1) }),
);

export const useDeleteAdminAction = routeAction$(
  async (data, requestEvent) => {
    const me = currentAdmin(requestEvent);
    if (!me) return requestEvent.fail(403, { message: "No autorizado." });
    if (data.userId === me.id) return requestEvent.fail(400, { message: "No podés darte de baja a vos mismo." });

    try {
      const result = await deleteAdministrator(requestEvent, data.userId);
      if (!result.ok) return requestEvent.fail(result.status, { message: result.message });
      return { success: true, name: result.name };
    } catch (err) {
      console.error("Admin delete error:", err);
      return requestEvent.fail(500, { message: "No se pudo dar de baja al administrador. Intentá de nuevo." });
    }
  },
  zod$({ userId: z.string().min(1) }),
);

const AdminAvatar = component$<{ name: string; isMe: boolean }>(({ name, isMe }) => (
  <div aria-hidden="true" class={["flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold uppercase", isMe ? "bg-accent text-primary" : "bg-primary text-white"]}>
    {name.charAt(0)}
  </div>
));

const CopyButton = component$<{ text: string; label: string }>(({ text, label }) => {
  const copied = useSignal(false);
  return (
    <button
      type="button"
      onClick$={async () => {
        try {
          await navigator.clipboard.writeText(text);
          copied.value = true;
          setTimeout(() => (copied.value = false), 2500);
        } catch {
          copied.value = false;
        }
      }}
      class="btn btn-sm btn-outline"
    >
      {copied.value ? <LuCheck class="h-4 w-4" aria-hidden="true" /> : <LuCopy class="h-4 w-4" aria-hidden="true" />}
      <span aria-live="polite">{copied.value ? "Copiada" : label}</span>
    </button>
  );
});

interface TemporaryCredentials {
  name: string;
  email: string;
  password: string;
  isNew: boolean;
}

/** Shown once after creating an admin or resetting a password: nobody can see it again later. */
const TemporaryPasswordPanel = component$<{ credentials: Signal<TemporaryCredentials | null> }>(({ credentials }) => {
  const value = credentials.value;
  if (!value) return null;
  return (
    <section role="status" aria-labelledby="temporary-title" class="card border-l-4 border-l-accent p-5 sm:p-6 space-y-4">
      <div class="space-y-1">
        <h2 id="temporary-title" class="font-display text-lg font-semibold uppercase tracking-wide text-primary">
          {value.isNew ? `${value.name} ya es administrador` : `Contraseña temporal para ${value.name}`}
        </h2>
        <p class="text-sm text-slate-600">
          Pasale estos datos por un medio privado. Cuando ingrese en <strong>/admin/login</strong> el panel le va a pedir que elija su propia contraseña. Esta es la única vez que la ves.
        </p>
      </div>
      <dl class="grid gap-3 sm:grid-cols-2">
        <div>
          <dt class="field-label">Usuario</dt>
          <dd class="font-semibold text-primary break-all">{value.email}</dd>
        </div>
        <div>
          <dt class="field-label">Contraseña temporal</dt>
          <dd class="flex flex-wrap items-center gap-3">
            <code class="bg-slate-100 px-3 py-2 font-mono text-base font-bold tracking-wider text-primary">{value.password}</code>
            <CopyButton text={value.password} label="Copiar" />
          </dd>
        </div>
      </dl>
      <button type="button" onClick$={() => (credentials.value = null)} class="min-h-11 text-sm font-semibold text-primary underline underline-offset-4 cursor-pointer">
        Listo, ya la pasé
      </button>
    </section>
  );
});

function formatDay(iso: string | null): string {
  return iso ? formatCalendarDay(buenosAiresDay(iso)) : "—";
}

export default component$(() => {
  const adminUsers = useAdminUsersLoader();
  const currentUser = useCurrentUserLoader();
  const changePasswordAction = useChangePasswordAction();
  const registerAdminAction = useRegisterAdminAction();
  const resetAction = useResetAdminPasswordAction();
  const deleteAction = useDeleteAdminAction();

  const isCreateAdminOpen = useSignal(false);
  const isChangingMyPassword = useSignal(false);
  const newPassword = useSignal("");
  const credentials = useSignal<TemporaryCredentials | null>(null);
  const target = useSignal<{ id: string; name: string } | null>(null);
  const isResetOpen = useSignal(false);
  const isDeleteOpen = useSignal(false);
  const dialogError = useSignal("");

  // Without JS the form posts the whole page: reopen the panel that failed so its errors show.
  useTask$(({ track }) => {
    if (track(() => changePasswordAction.value)?.failed) isChangingMyPassword.value = true;
    if (track(() => registerAdminAction.value)?.failed) isCreateAdminOpen.value = true;
  });

  const admins = adminUsers.value;
  const meId = currentUser.value?.id;
  const canDelete = admins.length > 1;

  const openCreate = $(() => {
    newPassword.value = generateTemporaryPassword();
    isCreateAdminOpen.value = true;
    isChangingMyPassword.value = false;
  });

  const confirmReset$ = $(async () => {
    if (!target.value) return;
    const { value } = await resetAction.submit({ userId: target.value.id });
    if (value.failed) {
      dialogError.value = value.message || "No se pudo restablecer la contraseña.";
      return;
    }
    if (value.success && value.temporaryPassword) {
      credentials.value = { name: value.name, email: value.email, password: value.temporaryPassword, isNew: false };
    }
    isResetOpen.value = false;
  });

  const confirmDelete$ = $(async () => {
    if (!target.value) return;
    const { value } = await deleteAction.submit({ userId: target.value.id });
    if (value.failed) {
      dialogError.value = value.message || "No se pudo dar de baja.";
      return;
    }
    isDeleteOpen.value = false;
  });

  const changeFailure = changePasswordAction.value?.failed
    ? (changePasswordAction.value as { message?: string; currentError?: string; confirmError?: string; fieldErrors?: { currentPassword?: string; newPassword?: string; confirmPassword?: string } })
    : undefined;
  const registerErrors = registerAdminAction.value?.failed ? registerAdminAction.value.fieldErrors : undefined;

  const rowActions = (userItem: (typeof admins)[number]) =>
    userItem.id === meId ? (
      !isChangingMyPassword.value && (
        <button
          type="button"
          onClick$={() => {
            isChangingMyPassword.value = true;
            isCreateAdminOpen.value = false;
          }}
          class="btn btn-sm btn-outline"
        >
          <LuKeyRound class="h-4 w-4" aria-hidden="true" />
          Cambiar mi contraseña
        </button>
      )
    ) : (
      <>
        <button
          type="button"
          onClick$={() => {
            target.value = { id: userItem.id, name: userItem.name };
            dialogError.value = "";
            isResetOpen.value = true;
          }}
          class="btn btn-sm btn-outline"
        >
          <LuRefreshCw class="h-4 w-4" aria-hidden="true" />
          Restablecer contraseña
        </button>
        {canDelete && (
          <button
            type="button"
            onClick$={() => {
              target.value = { id: userItem.id, name: userItem.name };
              dialogError.value = "";
              isDeleteOpen.value = true;
            }}
            class="btn btn-sm border-red-700 bg-white text-red-700 hover:bg-red-50"
          >
            <LuUserX class="h-4 w-4" aria-hidden="true" />
            Dar de baja
          </button>
        )}
      </>
    );

  const nameCell = (userItem: (typeof admins)[number]) => (
    <div class="flex items-center gap-3">
      <AdminAvatar name={userItem.name} isMe={userItem.id === meId} />
      <div class="min-w-0">
        <p class="flex flex-wrap items-center gap-1.5 font-semibold text-slate-800">
          {userItem.name}
          {userItem.id === meId && <span class="badge badge-accent">Vos</span>}
          {userItem.mustChangePassword && <span class="badge badge-muted">Contraseña temporal</span>}
        </p>
        <p class="text-xs text-slate-600 break-words">{userItem.email}</p>
      </div>
    </div>
  );

  return (
    <div class="w-full px-4 sm:px-10 py-8 sm:py-10 space-y-6 pb-24 font-sans text-slate-800 flex flex-col flex-1">
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <SectionHeading as="h1" eyebrow="Administración" title="Administradores" size="md">
          <p class="mt-3 max-w-2xl text-sm text-slate-600">
            Quiénes pueden entrar a este panel. Si alguien olvida su contraseña, restablecela desde su fila: no se envían correos.
          </p>
        </SectionHeading>
        <div class="flex flex-wrap gap-2">
          <button type="button" onClick$={() => (isCreateAdminOpen.value ? (isCreateAdminOpen.value = false) : openCreate())} class="btn btn-dark whitespace-nowrap">
            <LuPlus class="h-4 w-4" aria-hidden="true" />
            {isCreateAdminOpen.value ? "Cerrar alta" : "Agregar administrador"}
          </button>
        </div>
      </div>

      <TemporaryPasswordPanel credentials={credentials} />
      {changePasswordAction.value?.success && !isChangingMyPassword.value && (
        <ActionFeedback value={changePasswordAction.value} success="Tu contraseña se actualizó. Las sesiones abiertas en otros dispositivos se cerraron." />
      )}
      <ActionFeedback value={deleteAction.value} success={deleteAction.value?.success ? `${deleteAction.value.name} ya no tiene acceso al panel.` : undefined} />

      {/* Register Admin Form Panel */}
      {isCreateAdminOpen.value && (
        <Form
          action={registerAdminAction}
          onSubmitCompleted$={() => {
            const result = registerAdminAction.value;
            if (result?.success && "email" in result) {
              credentials.value = { name: result.name, email: result.email, password: newPassword.value, isNew: true };
              isCreateAdminOpen.value = false;
            }
          }}
          class="card p-5 sm:p-6 space-y-5"
        >
          <div class="space-y-1">
            <h2 class="font-display text-lg font-semibold uppercase tracking-wide text-primary">Nuevo administrador</h2>
            <p class="text-sm text-slate-600">Le damos una contraseña temporal; al primer ingreso elige la suya.</p>
          </div>

          {registerAdminAction.value?.failed && registerAdminAction.value.message && <ActionFeedback value={registerAdminAction.value} />}

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label for="new-admin-name" class="field-label">Nombre completo</label>
              <input
                id="new-admin-name"
                type="text"
                name="name"
                required
                autocomplete="off"
                placeholder="Ej.: Marcela Ríos"
                aria-invalid={registerErrors?.name ? "true" : undefined}
                aria-describedby={registerErrors?.name ? "new-admin-name-error" : undefined}
                class="field text-base sm:text-sm"
              />
              {registerErrors?.name && <p id="new-admin-name-error" class="mt-1.5 text-xs font-semibold text-red-700">{registerErrors.name}</p>}
            </div>

            <div>
              <label for="new-admin-email" class="field-label">Correo (es su usuario)</label>
              <input
                id="new-admin-email"
                type="email"
                name="email"
                required
                autocomplete="off"
                placeholder="Ej.: marcela@lprc.com.ar"
                aria-invalid={registerErrors?.email ? "true" : undefined}
                aria-describedby={registerErrors?.email ? "new-admin-email-error" : undefined}
                class="field text-base sm:text-sm"
              />
              {registerErrors?.email && <p id="new-admin-email-error" class="mt-1.5 text-xs font-semibold text-red-700">{registerErrors.email}</p>}
            </div>

            <div>
              <label for="new-admin-password" class="field-label">Contraseña temporal</label>
              <input
                id="new-admin-password"
                type="text"
                name="password"
                required
                minLength={MIN_ADMIN_PASSWORD_LENGTH}
                autocomplete="off"
                spellcheck={false}
                bind:value={newPassword}
                aria-invalid={registerErrors?.password ? "true" : undefined}
                aria-describedby={registerErrors?.password ? "new-admin-password-help new-admin-password-error" : "new-admin-password-help"}
                class="field font-mono text-base sm:text-sm"
              />
              <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick$={() => (newPassword.value = generateTemporaryPassword())} class="btn btn-sm btn-outline">
                  <LuRefreshCw class="h-4 w-4" aria-hidden="true" />
                  Generar
                </button>
                <CopyButton text={newPassword.value} label="Copiar" />
              </div>
              <p id="new-admin-password-help" class="mt-1.5 text-xs text-slate-600">Mínimo {MIN_ADMIN_PASSWORD_LENGTH} caracteres. Solo sirve para el primer ingreso.</p>
              {registerErrors?.password && <p id="new-admin-password-error" class="mt-1.5 text-xs font-semibold text-red-700">{registerErrors.password}</p>}
            </div>
          </div>

          <div class="flex flex-wrap justify-end gap-3">
            <button type="button" onClick$={() => (isCreateAdminOpen.value = false)} class="btn btn-outline">
              Cancelar
            </button>
            <button type="submit" disabled={registerAdminAction.isRunning} class="btn btn-primary">
              {registerAdminAction.isRunning ? "Registrando..." : "Dar de alta"}
            </button>
          </div>
        </Form>
      )}

      {/* Own password change */}
      {isChangingMyPassword.value && currentUser.value && (
        <Form
          action={changePasswordAction}
          onSubmitCompleted$={() => {
            if (changePasswordAction.value?.success) isChangingMyPassword.value = false;
          }}
          class="card p-5 sm:p-6 space-y-5"
        >
          <div class="space-y-1">
            <h2 class="font-display text-lg font-semibold uppercase tracking-wide text-primary">Cambiar mi contraseña</h2>
            <p class="text-sm text-slate-600">Se cierran tus sesiones en otros dispositivos; esta sigue abierta.</p>
          </div>
          {changeFailure?.message && <ActionFeedback value={changePasswordAction.value} />}
          <input type="text" name="username" value={currentUser.value.email} autoComplete="username" class="sr-only" tabIndex={-1} aria-hidden="true" readOnly />
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PasswordField
              id="admin-current-password"
              name="currentPassword"
              label="Contraseña actual"
              autocomplete="current-password"
              error={changeFailure?.fieldErrors?.currentPassword ?? changeFailure?.currentError}
            />
            <PasswordField
              id="admin-new-password"
              name="newPassword"
              label="Contraseña nueva"
              autocomplete="new-password"
              minLength={MIN_ADMIN_PASSWORD_LENGTH}
              hint={`Mínimo ${MIN_ADMIN_PASSWORD_LENGTH} caracteres.`}
              error={changeFailure?.fieldErrors?.newPassword}
            />
            <PasswordField
              id="admin-confirm-password"
              name="confirmPassword"
              label="Repetí la nueva"
              autocomplete="new-password"
              minLength={MIN_ADMIN_PASSWORD_LENGTH}
              error={changeFailure?.fieldErrors?.confirmPassword ?? changeFailure?.confirmError}
            />
          </div>
          <div class="flex flex-wrap justify-end gap-3">
            <button type="button" disabled={changePasswordAction.isRunning} onClick$={() => (isChangingMyPassword.value = false)} class="btn btn-outline">
              Cancelar
            </button>
            <button type="submit" disabled={changePasswordAction.isRunning} class="btn btn-primary">
              {changePasswordAction.isRunning ? "Guardando..." : "Guardar contraseña"}
            </button>
          </div>
        </Form>
      )}

      {/* Admins: stacked cards on phones, table from md up */}
      <ul class="space-y-3 md:hidden">
        {admins.map((userItem) => (
          <li key={userItem.id} class="card p-4 space-y-3">
            {nameCell(userItem)}
            <dl class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt class="font-bold uppercase tracking-wide text-slate-600">Alta</dt>
                <dd class="text-slate-800">{formatDay(userItem.createdAt)}</dd>
              </div>
              <div>
                <dt class="font-bold uppercase tracking-wide text-slate-600">Último acceso</dt>
                <dd class="text-slate-800">{userItem.lastLoginAt ? `${formatDateTime(userItem.lastLoginAt)} hs` : "Nunca"}</dd>
              </div>
            </dl>
            <div class="flex flex-wrap gap-2">{rowActions(userItem)}</div>
          </li>
        ))}
      </ul>

      <div class="hidden md:block overflow-x-auto card">
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap">
              <th scope="col" class="px-5 py-3">Administrador</th>
              <th scope="col" class="px-5 py-3">Alta</th>
              <th scope="col" class="px-5 py-3">Último acceso</th>
              <th scope="col" class="px-5 py-3"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            {admins.map((userItem) => (
              <tr key={userItem.id} class="hover:bg-slate-50">
                <td class="min-w-56 px-5 py-3">{nameCell(userItem)}</td>
                <td class="px-5 py-3 whitespace-nowrap text-slate-700">{formatDay(userItem.createdAt)}</td>
                <td class="px-5 py-3 whitespace-nowrap text-slate-700">{userItem.lastLoginAt ? `${formatDateTime(userItem.lastLoginAt)} hs` : "Nunca"}</td>
                <td class="px-5 py-3">
                  <div class="flex flex-col items-stretch gap-2 whitespace-nowrap 2xl:flex-row 2xl:justify-end">{rowActions(userItem)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!canDelete && <p class="text-xs text-slate-600">Sos el único administrador: para poder dar de baja cuentas tiene que haber al menos dos.</p>}

      <ConfirmDialog
        open={isResetOpen}
        title={`Restablecer la contraseña de ${target.value?.name ?? ""}`}
        confirmLabel="Generar contraseña temporal"
        pendingLabel="Generando..."
        pending={resetAction.isRunning}
        error={dialogError.value}
        onConfirm$={confirmReset$}
      >
        <p>Su contraseña actual deja de funcionar y se cierran sus sesiones abiertas. Te mostramos una contraseña temporal para que se la pases; al ingresar va a tener que elegir una nueva.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={isDeleteOpen}
        title={`Dar de baja a ${target.value?.name ?? ""}`}
        confirmLabel="Dar de baja"
        pendingLabel="Dando de baja..."
        pending={deleteAction.isRunning}
        error={dialogError.value}
        onConfirm$={confirmDelete$}
      >
        <p>Pierde el acceso al panel de inmediato y se cierran sus sesiones. Si vuelve a necesitarlo, hay que darlo de alta de nuevo.</p>
      </ConfirmDialog>
    </div>
  );
});

export const head: DocumentHead = {
  title: "LPRC Club - Administradores del Portal",
  meta: [
    {
      name: "description",
      content: "Visualizar y gestionar cuentas de administradores.",
    },
  ],
};
