import { component$, Slot, useId, useSignal, useTask$, $, type QRL, type Signal } from "@builder.io/qwik";
import { isBrowser } from "@builder.io/qwik/build";
import { routeLoader$, routeAction$, Form, Link, useNavigate, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuCheck, LuCopy, LuCrown, LuFileUp, LuPencil, LuPlus, LuSearch, LuTicket, LuUserX, LuX } from "@qwikest/icons/lucide";
import { and, asc, count, desc, eq, ne, or, sql, type SQL } from "drizzle-orm";
import { getDB } from "~/db";
import { pushSubscriptions, sessions, users as usersTable } from "~/db/schema";
import { normalizedDniExpression } from "~/db/dni-expression.mjs";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import {
  classifyMemberImport,
  findUsersByDni,
  importMembers,
  isPlaceholderEmail,
  parseMemberCsv,
  placeholderEmail,
  type ClassifiedImportRow,
} from "~/server/member-dni";
import { MAX_IMPORT_ROWS, isValidDni, normalizeDni } from "~/utils/dni";
import { buenosAiresDay, formatCalendarDay, formatDateTime } from "~/utils/club-content";
import { ActionFeedback } from "~/components/admin/action-feedback";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { SectionHeading } from "~/components/section-heading/section-heading";

const PAGE_SIZE = 20;
const MAX_CSV_CHARS = 400_000;

function currentAdmin(event: { sharedMap: Map<string, unknown> }): AuthenticatedUser | null {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  return user?.role === "admin" ? user : null;
}

// Search ignores case and the usual Spanish accents on both sides ("perez" finds "Pérez").
const ACCENTS: [string, string][] = [
  ["á", "a"], ["é", "e"], ["í", "i"], ["ó", "o"], ["ú", "u"], ["ü", "u"], ["ñ", "n"],
  ["Á", "a"], ["É", "e"], ["Í", "i"], ["Ó", "o"], ["Ú", "u"], ["Ü", "u"], ["Ñ", "n"],
];

function foldedColumn(column: SQL | typeof usersTable.name): SQL {
  return ACCENTS.reduce<SQL>((expression, [from, to]) => sql`replace(${expression}, ${from}, ${to})`, sql`lower(${column})`);
}

function foldText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** End of the chosen day in Buenos Aires, so a Gold "hasta el 31/12" still works all of that day. */
function goldExpiryIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T23:59:59.999-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDay(iso: string | null): string {
  return iso ? formatCalendarDay(buenosAiresDay(iso)) : "—";
}

// --- SECURITY & LOADERS ---

export const useMembersLoader = routeLoader$(async (event) => {
  if (!currentAdmin(event)) {
    throw event.redirect(302, "/admin/login/");
  }
  const query = (event.url.searchParams.get("buscar") ?? "").trim().slice(0, 80);
  const requestedPage = Math.max(1, Number.parseInt(event.url.searchParams.get("pagina") ?? "1", 10) || 1);
  const empty = { query, page: 1, pages: 1, total: 0, members: [], totals: { members: 0, gold: 0 } };

  try {
    const db = getDB(event);
    const conditions: SQL[] = [ne(usersTable.role, "admin")];
    if (query) {
      const pattern = likePattern(foldText(query));
      const options: SQL[] = [
        sql`${foldedColumn(usersTable.name)} LIKE ${pattern} ESCAPE '\\'`,
        sql`lower(${usersTable.email}) LIKE ${pattern} ESCAPE '\\'`,
      ];
      // "30.123", "30 123 456" and "30123456" all find the same member.
      const digits = normalizeDni(query);
      if (/^\d{3,9}$/.test(digits)) options.push(sql`${sql.raw(normalizedDniExpression)} LIKE ${`%${digits}%`}`);
      conditions.push(or(...options)!);
    }
    const where = and(...conditions);

    const [[{ total }], [totals]] = await Promise.all([
      db.select({ total: count() }).from(usersTable).where(where),
      db
        .select({ members: count(), gold: sql<number>`coalesce(sum(case when ${usersTable.role} = 'premium' then 1 else 0 end), 0)` })
        .from(usersTable)
        .where(ne(usersTable.role, "admin")),
    ]);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(requestedPage, pages);
    const rows = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        numeroSocio: usersTable.numeroSocio,
        role: usersTable.role,
        premiumExpiresAt: usersTable.premiumExpiresAt,
        createdAt: usersTable.createdAt,
        lastLoginAt: usersTable.lastLoginAt,
      })
      .from(usersTable)
      .where(where)
      .orderBy(desc(usersTable.createdAt), asc(usersTable.name))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

    return {
      query,
      page,
      pages,
      total,
      totals: { members: totals.members, gold: Number(totals.gold) },
      members: rows.map((row) => ({ ...row, email: isPlaceholderEmail(row.email) ? null : row.email })),
    };
  } catch (err) {
    console.error("Failed to load members:", err);
    return { ...empty, loadError: true };
  }
});

interface MemberRow {
  id: string;
  name: string;
  email: string | null;
  numeroSocio: string | null;
  role: "admin" | "member" | "premium";
  premiumExpiresAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

// --- ACTIONS ---

const memberFields = {
  name: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres.").max(120, "Hasta 120 caracteres."),
  email: z.union([z.literal(""), z.string().trim().email("Ingresá un correo electrónico válido.")]).optional(),
  numeroSocio: z.string().refine(isValidDni, "Ingresá un DNI de 5 a 9 números, con o sin puntos o espacios."),
};

/** Same duplicate rules for the alta and the edition; `exceptId` is the member being edited. */
async function duplicateError(event: Parameters<typeof findUsersByDni>[0], email: string, dni: string, exceptId?: string) {
  if (email) {
    const [taken] = await getDB(event)
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(exceptId ? and(eq(usersTable.email, email), ne(usersTable.id, exceptId)) : eq(usersTable.email, email))
      .limit(1);
    if (taken) return { email: "Ese correo ya es de otra cuenta." };
  }
  const sameDni = (await findUsersByDni(event, dni)).filter((user) => user.id !== exceptId);
  if (sameDni.length) return { numeroSocio: `Ese DNI ya está registrado (${sameDni[0].name}).` };
  return null;
}

export const useRegisterUserAction = routeAction$(
  async (data, requestEvent) => {
    if (!currentAdmin(requestEvent)) {
      return requestEvent.fail(403, { message: "No autorizado." });
    }

    try {
      const db = getDB(requestEvent);
      const dni = normalizeDni(data.numeroSocio);
      const email = (data.email ?? "").toLowerCase().trim();
      const duplicate = await duplicateError(requestEvent, email, dni);
      if (duplicate) return requestEvent.fail(409, { message: "Revisá los datos marcados.", fieldErrors: duplicate });

      const { hashPassword } = await import("~/utils/crypto");
      // Members log in with their DNI; the password column is required but never used.
      const passwordHash = await hashPassword(crypto.randomUUID());
      const userId = "usr-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();

      await db.insert(usersTable).values({
        id: userId,
        email: email || placeholderEmail(dni),
        passwordHash,
        name: data.name.trim(),
        numeroSocio: dni,
        role: "member",
        createdAt: new Date().toISOString(),
      });

      return { success: true, name: data.name.trim(), dni, loginUrl: `${requestEvent.url.origin}/login/` };
    } catch (e: any) {
      console.error("Admin register user error:", e);
      return requestEvent.fail(500, { message: e.message || "Error al registrar el socio." });
    }
  },
  zod$(memberFields)
);

export const useUpdateMemberAction = routeAction$(
  async (data, requestEvent) => {
    if (!currentAdmin(requestEvent)) return requestEvent.fail(403, { message: "No autorizado." });
    try {
      const db = getDB(requestEvent);
      const dni = normalizeDni(data.numeroSocio);
      const email = (data.email ?? "").toLowerCase().trim();
      const duplicate = await duplicateError(requestEvent, email, dni, data.id);
      if (duplicate) return requestEvent.fail(409, { message: "Revisá los datos marcados.", fieldErrors: duplicate });

      const [updated] = await db
        .update(usersTable)
        .set({ name: data.name.trim(), email: email || placeholderEmail(dni), numeroSocio: dni })
        .where(and(eq(usersTable.id, data.id), ne(usersTable.role, "admin")))
        .returning({ name: usersTable.name });
      if (!updated) return requestEvent.fail(404, { message: "No se encontró el socio." });
      return { success: true, name: updated.name };
    } catch (err) {
      console.error("Update member error:", err);
      return requestEvent.fail(500, { message: "No se pudieron guardar los cambios. Intentá de nuevo." });
    }
  },
  zod$({ id: z.string().min(1), ...memberFields }),
);

export const useSetGoldAction = routeAction$(
  async (data, requestEvent) => {
    if (!currentAdmin(requestEvent)) return requestEvent.fail(403, { message: "No autorizado." });
    const gold = data.gold === "1";
    const expiresAt = gold && data.expiresOn ? goldExpiryIso(data.expiresOn) : null;
    if (gold && data.expiresOn && (!expiresAt || data.expiresOn < buenosAiresDay())) {
      return requestEvent.fail(400, { message: "", fieldErrors: { expiresOn: "Elegí una fecha de hoy en adelante, o dejala vacía si no vence." } });
    }

    try {
      // Only member <-> Gold here; admins are managed from /admin/admins.
      const [updated] = await getDB(requestEvent)
        .update(usersTable)
        .set({ role: gold ? "premium" : "member", premiumExpiresAt: expiresAt })
        .where(and(eq(usersTable.id, data.id), ne(usersTable.role, "admin")))
        .returning({ name: usersTable.name, role: usersTable.role, premiumExpiresAt: usersTable.premiumExpiresAt });
      if (!updated) return requestEvent.fail(404, { message: "No se encontró el socio." });

      const message = !gold
        ? `${updated.name} ahora es socio sin Gold.`
        : updated.premiumExpiresAt
          ? `${updated.name} es socio Gold hasta el ${formatDay(updated.premiumExpiresAt)}.`
          : `${updated.name} es socio Gold, sin vencimiento.`;
      return { success: true, message };
    } catch (err) {
      console.error("Set Gold error:", err);
      return requestEvent.fail(500, { message: "No se pudo cambiar el tipo de socio." });
    }
  },
  zod$({
    id: z.string().min(1),
    gold: z.enum(["0", "1"]),
    expiresOn: z.string().optional(),
  }),
);

export const useDeleteMemberAction = routeAction$(
  async (data, requestEvent) => {
    if (!currentAdmin(requestEvent)) return requestEvent.fail(403, { message: "No autorizado." });
    try {
      const db = getDB(requestEvent);
      const [member] = await db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(and(eq(usersTable.id, data.id), ne(usersTable.role, "admin")))
        .limit(1);
      if (!member) return requestEvent.fail(404, { message: "No se encontró el socio." });
      // Coupons keep their own copy of name and DNI, so the history stays readable.
      await db.delete(sessions).where(eq(sessions.userId, data.id));
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, data.id));
      await db.delete(usersTable).where(eq(usersTable.id, data.id));
      return { success: true, name: member.name };
    } catch (err) {
      console.error("Delete member error:", err);
      return requestEvent.fail(500, { message: "No se pudo dar de baja al socio. Intentá de nuevo." });
    }
  },
  zod$({ id: z.string().min(1) }),
);

const csvSchema = { csv: z.string().min(1, "Elegí un archivo o pegá el padrón.").max(MAX_CSV_CHARS, "El archivo es demasiado grande.") };

function summarize(rows: ClassifiedImportRow[]) {
  return {
    valid: rows.filter((row) => row.status === "valid").length,
    duplicate: rows.filter((row) => row.status === "duplicate").length,
    error: rows.filter((row) => row.status === "error").length,
  };
}

export const useImportPreviewAction = routeAction$(
  async (data, requestEvent) => {
    if (!currentAdmin(requestEvent)) return requestEvent.fail(403, { message: "No autorizado." });
    const parsed = parseMemberCsv(data.csv);
    if (parsed.error) return requestEvent.fail(400, { message: parsed.error });
    if (parsed.rows.length === 0) return requestEvent.fail(400, { message: "No encontramos filas con datos." });
    try {
      const rows = await classifyMemberImport(requestEvent, parsed.rows);
      return { success: true, rows, summary: summarize(rows), csv: data.csv };
    } catch (err) {
      console.error("Import preview error:", err);
      return requestEvent.fail(500, { message: "No se pudo revisar el archivo. Intentá de nuevo." });
    }
  },
  zod$(csvSchema),
);

export const useImportConfirmAction = routeAction$(
  async (data, requestEvent) => {
    if (!currentAdmin(requestEvent)) return requestEvent.fail(403, { message: "No autorizado." });
    const parsed = parseMemberCsv(data.csv);
    if (parsed.error) return requestEvent.fail(400, { message: parsed.error });
    try {
      // Classified again: someone may have registered one of these DNIs since the preview.
      const rows = await classifyMemberImport(requestEvent, parsed.rows);
      const { hashPassword } = await import("~/utils/crypto");
      const created = await importMembers(requestEvent, rows, await hashPassword(crypto.randomUUID()));
      return { success: true, created, skipped: rows.length - created, loginUrl: `${requestEvent.url.origin}/login/` };
    } catch (err) {
      console.error("Import members error:", err);
      return requestEvent.fail(500, { message: "No se pudo completar la importación. Ninguna fila quedó a medias: revisá el listado y probá de nuevo." });
    }
  },
  zod$(csvSchema),
);

// --- UI ---

/** Modal for the forms of a row (Gold, editar). Destructive confirmations use ConfirmDialog. */
const PanelDialog = component$<{ open: Signal<boolean>; title: string }>(({ open, title }) => {
  const dialog = useSignal<HTMLDialogElement>();
  const titleId = useId();

  useTask$(({ track }) => {
    const isOpen = track(() => open.value);
    if (!isBrowser || !dialog.value) return;
    if (isOpen && !dialog.value.open) dialog.value.showModal();
    if (!isOpen && dialog.value.open) dialog.value.close();
  });

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg border-t-4 border-accent bg-white p-0 text-left text-slate-800 shadow-xl backdrop:bg-slate-950/60"
      onClose$={() => (open.value = false)}
    >
      <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <h2 id={titleId} class="font-display text-lg font-semibold uppercase tracking-wide text-primary">{title}</h2>
        <button type="button" onClick$={() => (open.value = false)} class="flex h-11 w-11 shrink-0 items-center justify-center text-slate-600 hover:text-primary cursor-pointer" aria-label="Cerrar">
          <LuX class="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div class="p-5">
        <Slot />
      </div>
    </dialog>
  );
});

const CopyText = component$<{ text: string; label: string }>(({ text, label }) => {
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
      <span aria-live="polite">{copied.value ? "Copiado" : label}</span>
    </button>
  );
});

const FieldError = component$<{ id: string; message?: string }>(({ id, message }) =>
  message ? <p id={id} class="mt-1.5 text-xs font-semibold text-red-700">{message}</p> : null,
);

const statusLabel: Record<ClassifiedImportRow["status"], string> = { valid: "Se importa", duplicate: "Duplicado", error: "Con error" };
const statusTone: Record<ClassifiedImportRow["status"], string> = {
  valid: "bg-emerald-50 text-emerald-800",
  duplicate: "badge-muted",
  error: "bg-red-50 text-red-800",
};

const ImportPanel = component$<{ onClose$: QRL<() => void> }>(({ onClose$ }) => {
  const preview = useImportPreviewAction();
  const confirm = useImportConfirmAction();
  const csv = useSignal(String(preview.formData?.get("csv") ?? ""));
  const fileName = useSignal("");
  const isReadingFile = useSignal(false);
  const fileError = useSignal("");
  const filter = useSignal<"all" | ClassifiedImportRow["status"]>("all");

  const readFile = $(async (_: Event, input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    isReadingFile.value = true;
    fileError.value = "";
    fileName.value = file.name;
    // Invalidate the old review immediately, including while the new file is being read.
    csv.value = "";
    try {
      csv.value = await file.text();
    } catch {
      fileError.value = "No pudimos leer el archivo. Volvé a elegirlo o pegá su contenido.";
    } finally {
      isReadingFile.value = false;
    }
  });

  const result = preview.value?.success ? preview.value : null;
  // Multipart submissions use CRLF; textarea values use LF. Compare their actual text.
  const reviewChanged = Boolean(result && result.csv.replace(/\r\n?/g, "\n") !== csv.value.replace(/\r\n?/g, "\n"));
  const done = confirm.value?.success ? confirm.value : null;
  const rows = result ? result.rows.filter((row) => filter.value === "all" || row.status === filter.value) : [];

  return (
    <section aria-labelledby="import-title" class="card p-5 sm:p-6 space-y-5">
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h2 id="import-title" class="font-display text-lg font-semibold uppercase tracking-wide text-primary">Importar padrón</h2>
          <p class="text-sm text-slate-600">
            Un CSV con <strong>nombre, email (opcional) y DNI</strong>, como lo exporta Excel o Google Sheets (separado por coma o punto y coma). Hasta {MAX_IMPORT_ROWS} filas por vez. Primero revisamos el archivo y después confirmás.
          </p>
        </div>
        <button type="button" onClick$={onClose$} class="flex h-11 w-11 shrink-0 items-center justify-center text-slate-600 hover:text-primary cursor-pointer" aria-label="Cerrar importación">
          <LuX class="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {done ? (
        <div role="status" class="border-l-4 border-emerald-700 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 space-y-1">
          <p class="font-semibold">Se importaron {done.created} {done.created === 1 ? "socio" : "socios"}.</p>
          {done.skipped > 0 && <p>{done.skipped} {done.skipped === 1 ? "fila no se importó" : "filas no se importaron"} por estar duplicadas o con errores.</p>}
          <p>Ya pueden ingresar con su DNI en {done.loginUrl}</p>
        </div>
      ) : (
        <>
          <Form action={preview} class="space-y-4">
            <div class="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
              <div>
                <label for="import-file" class="field-label">Archivo CSV</label>
                <label for="import-file" class="btn btn-outline w-full">
                  <LuFileUp class="h-4 w-4" aria-hidden="true" />
                  Elegir archivo
                </label>
                <input id="import-file" type="file" accept=".csv,text/csv,text/plain" onChange$={readFile} disabled={isReadingFile.value || confirm.isRunning} class="sr-only" />
                <p class="mt-1.5 text-xs text-slate-600 break-all">{fileName.value ? `Elegido: ${fileName.value}` : "O pegá el contenido en el cuadro."}</p>
                {isReadingFile.value && <p role="status" class="mt-1.5 text-xs text-slate-600">Leyendo archivo...</p>}
                {fileError.value && <p role="alert" class="mt-1.5 text-sm text-red-700">{fileError.value}</p>}
              </div>
              <div>
                <label for="import-csv" class="field-label">Contenido</label>
                <textarea
                  id="import-csv"
                  name="csv"
                  rows={5}
                  bind:value={csv}
                  disabled={isReadingFile.value || confirm.isRunning}
                  spellcheck={false}
                  placeholder={"nombre;email;dni\nJuana Pérez;juana@mail.com;30.123.456\nCarlos Díaz;;28999111"}
                  class="field font-mono text-sm"
                />
              </div>
            </div>
            {preview.value?.failed && <ActionFeedback value={preview.value} />}
            <div class="flex justify-end">
              <button type="submit" disabled={preview.isRunning || confirm.isRunning || isReadingFile.value || !csv.value.trim()} class="btn btn-dark">
                {preview.isRunning ? "Revisando..." : "Revisar archivo"}
              </button>
            </div>
          </Form>

          {result && (
            <div class="space-y-4 border-t border-slate-200 pt-5">
              {reviewChanged && (
                <p id="import-review-changed" role="status" class="border-l-4 border-amber-700 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  El contenido cambió. Esta vista previa corresponde a la revisión anterior. Tocá “Revisar archivo” antes de importar los cambios.
                </p>
              )}
              <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar filas de la vista previa">
                {([
                  ["all", `Todas (${result.rows.length})`],
                  ["valid", `Se importan (${result.summary.valid})`],
                  ["duplicate", `Duplicadas (${result.summary.duplicate})`],
                  ["error", `Con error (${result.summary.error})`],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter.value === value}
                    onClick$={() => (filter.value = value)}
                    class={[
                      "min-h-11 border px-3 text-sm font-semibold cursor-pointer",
                      filter.value === value ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-700 hover:border-primary",
                    ]}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div class="max-h-96 overflow-auto border border-slate-200">
                <table class="w-full text-left text-sm">
                  <thead class="sticky top-0 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th scope="col" class="px-3 py-2">Fila</th>
                      <th scope="col" class="px-3 py-2">Nombre</th>
                      <th scope="col" class="px-3 py-2">Email</th>
                      <th scope="col" class="px-3 py-2">DNI</th>
                      <th scope="col" class="px-3 py-2">Resultado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-200">
                    {rows.slice(0, 500).map((row) => (
                      <tr key={row.line}>
                        <td class="px-3 py-2 text-slate-600">{row.line}</td>
                        <td class="px-3 py-2">{row.name || "—"}</td>
                        <td class="px-3 py-2 break-all text-slate-700">{row.email || <span class="text-slate-500">Sin email</span>}</td>
                        <td class="px-3 py-2 font-mono">{row.dni || "—"}</td>
                        <td class="px-3 py-2">
                          <span class={["badge", statusTone[row.status]]}>{statusLabel[row.status]}</span>
                          {row.reason && <p class="mt-1 text-xs text-slate-600">{row.reason}</p>}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={5} class="px-3 py-6 text-center text-slate-600">No hay filas en esta vista.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {rows.length > 500 && <p class="text-xs text-slate-600">Se muestran las primeras 500 filas de esta vista.</p>}

              <Form action={confirm} class="flex flex-wrap items-center justify-end gap-3">
                <input type="hidden" name="csv" value={result.csv} />
                {confirm.value?.failed && <ActionFeedback value={confirm.value} />}
                <p class="text-sm text-slate-600">Las filas duplicadas o con error no se importan.</p>
                <button type="submit" disabled={confirm.isRunning || preview.isRunning || isReadingFile.value || reviewChanged || result.summary.valid === 0} aria-describedby={reviewChanged ? "import-review-changed" : undefined} class="btn btn-primary">
                  {confirm.isRunning
                    ? "Importando..."
                    : reviewChanged ? "Revisá de nuevo para importar"
                    : `Importar ${result.summary.valid} ${result.summary.valid === 1 ? "socio" : "socios"}`}
                </button>
              </Form>
            </div>
          )}
        </>
      )}
    </section>
  );
});

export default component$(() => {
  const membersLoader = useMembersLoader();
  const registerUserAction = useRegisterUserAction();
  const updateAction = useUpdateMemberAction();
  const goldAction = useSetGoldAction();
  const deleteAction = useDeleteMemberAction();
  const navigate = useNavigate();

  const isCreateUserOpen = useSignal(false);
  const isImportOpen = useSignal(false);
  const search = useSignal(membersLoader.value.query);
  const selected = useSignal<MemberRow | null>(null);
  const isGoldOpen = useSignal(false);
  const isEditOpen = useSignal(false);
  const isDeleteOpen = useSignal(false);
  const goldChoice = useSignal(false);
  const deleteError = useSignal("");

  // Without JS the form posts the whole page: reopen the panel that failed so its errors show.
  useTask$(({ track }) => {
    if (track(() => registerUserAction.value)?.failed) isCreateUserOpen.value = true;
  });

  const { members, total, page, pages, query, totals } = membersLoader.value;
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (query) params.set("buscar", query);
    if (target > 1) params.set("pagina", String(target));
    const text = params.toString();
    return `/admin/users/${text ? `?${text}` : ""}`;
  };

  const openGold = $((member: MemberRow) => {
    selected.value = member;
    goldChoice.value = member.role !== "premium";
    isGoldOpen.value = true;
  });
  const openEdit = $((member: MemberRow) => {
    selected.value = member;
    isEditOpen.value = true;
  });
  const openDelete = $((member: MemberRow) => {
    selected.value = member;
    deleteError.value = "";
    isDeleteOpen.value = true;
  });
  const confirmDelete$ = $(async () => {
    if (!selected.value) return;
    const { value } = await deleteAction.submit({ id: selected.value.id });
    if (value.failed) {
      deleteError.value = value.message || "No se pudo dar de baja. Intentá de nuevo.";
      return;
    }
    isDeleteOpen.value = false;
  });

  const registered = registerUserAction.value?.success ? registerUserAction.value : null;
  const registerErrors = registerUserAction.value?.failed ? registerUserAction.value.fieldErrors : undefined;
  // Errors belong to the member they were submitted for, not to the next one opened.
  const editFailure = updateAction.value?.failed && updateAction.formData?.get("id") === selected.value?.id ? updateAction.value : undefined;
  const goldFailure = goldAction.value?.failed && goldAction.formData?.get("id") === selected.value?.id ? goldAction.value : undefined;
  const today = buenosAiresDay();

  const typeCell = (member: MemberRow) => {
    const expired = member.role === "premium" && member.premiumExpiresAt && Date.parse(member.premiumExpiresAt) < Date.now();
    return (
      <div class="space-y-1">
        {member.role === "premium" ? (
          <span class={["badge", expired ? "badge-muted" : "badge-accent"]}>
            <LuCrown class="h-3.5 w-3.5" aria-hidden="true" />
            Gold
          </span>
        ) : (
          <span class="badge badge-muted">Socio</span>
        )}
        {member.role === "premium" && (
          <p class={["text-xs", expired ? "font-semibold text-red-700" : "text-slate-600"]}>
            {member.premiumExpiresAt ? `${expired ? "Venció el" : "Hasta el"} ${formatDay(member.premiumExpiresAt)}` : "Sin vencimiento"}
          </p>
        )}
      </div>
    );
  };

  const iconButton = "flex h-9 w-9 shrink-0 items-center justify-center border cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  /** Labeled buttons on cards; the table uses icons (with names for screen readers and a tooltip) to fit. */
  const actions = (member: MemberRow, compact = false) => (
    <>
      <button
        type="button"
        onClick$={() => openGold(member)}
        class="btn btn-sm btn-outline whitespace-nowrap"
        aria-label={compact ? `${member.role === "premium" ? "Cambiar Gold de" : "Pasar a Gold a"} ${member.name}` : undefined}
      >
        <LuCrown class="h-4 w-4" aria-hidden="true" />
        {compact ? "Gold" : member.role === "premium" ? "Cambiar Gold" : "Pasar a Gold"}
      </button>
      {compact ? (
        <button type="button" onClick$={() => openEdit(member)} class={[iconButton, "border-primary text-primary hover:bg-slate-100"]} aria-label={`Editar a ${member.name}`} title="Editar">
          <LuPencil class="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button type="button" onClick$={() => openEdit(member)} class="btn btn-sm btn-outline whitespace-nowrap">
          <LuPencil class="h-4 w-4" aria-hidden="true" />
          Editar
        </button>
      )}
      {member.numeroSocio &&
        (compact ? (
          <Link href={`/admin/cupones/?buscar=${encodeURIComponent(member.numeroSocio)}`} class={[iconButton, "border-primary text-primary hover:bg-slate-100"]} aria-label={`Cupones de ${member.name}`} title="Ver sus cupones">
            <LuTicket class="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <Link href={`/admin/cupones/?buscar=${encodeURIComponent(member.numeroSocio)}`} class="btn btn-sm btn-outline whitespace-nowrap">
            <LuTicket class="h-4 w-4" aria-hidden="true" />
            Cupones
          </Link>
        ))}
      <button
        type="button"
        onClick$={() => openDelete(member)}
        class={[iconButton, "border-red-700 text-red-700 hover:bg-red-50"]}
        aria-label={`Dar de baja a ${member.name}`}
        title="Dar de baja"
      >
        <LuUserX class="h-4 w-4" aria-hidden="true" />
      </button>
    </>
  );

  return (
    <div class="w-full px-4 sm:px-10 py-8 sm:py-10 space-y-6 pb-24 font-sans text-slate-800 flex flex-col flex-1">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading as="h1" eyebrow="Administración" title="Socios" size="md">
          <p class="mt-3 max-w-2xl text-sm text-slate-600">
            {totals.members} {totals.members === 1 ? "socio habilitado" : "socios habilitados"} · {totals.gold} Gold. Los socios ingresan al portal con su <strong>DNI</strong>: el portal usa el DNI como número de socio.
          </p>
        </SectionHeading>
        <div class="flex flex-wrap gap-2 lg:shrink-0 lg:flex-nowrap">
          <button
            type="button"
            onClick$={() => {
              isImportOpen.value = !isImportOpen.value;
              isCreateUserOpen.value = false;
            }}
            class="btn btn-outline whitespace-nowrap"
            aria-expanded={isImportOpen.value}
          >
            <LuFileUp class="h-4 w-4" aria-hidden="true" />
            Importar padrón
          </button>
          <button
            type="button"
            onClick$={() => {
              isCreateUserOpen.value = !isCreateUserOpen.value;
              isImportOpen.value = false;
            }}
            class="btn btn-dark whitespace-nowrap"
            aria-expanded={isCreateUserOpen.value}
          >
            <LuPlus class="h-4 w-4" aria-hidden="true" />
            Registrar socio
          </button>
        </div>
      </div>

      {registered && !isCreateUserOpen.value && (
        <div role="status" class="card border-l-4 border-l-emerald-700 p-5 space-y-3">
          <p class="font-semibold text-slate-800">
            {registered.name} quedó registrado. Ya puede ingresar con su DNI {registered.dni} en {registered.loginUrl}
          </p>
          <CopyText
            label="Copiar mensaje para el socio"
            text={`¡Hola ${registered.name}! Ya podés usar los beneficios de La Plata Rugby Club: entrá a ${registered.loginUrl} e ingresá con tu DNI (${registered.dni}).`}
          />
        </div>
      )}
      <ActionFeedback value={goldAction.value} success={goldAction.value?.success ? goldAction.value.message : undefined} />
      <ActionFeedback value={updateAction.value?.success ? updateAction.value : undefined} success={updateAction.value?.success ? `Se guardaron los datos de ${updateAction.value.name}.` : undefined} />
      <ActionFeedback value={deleteAction.value} success={deleteAction.value?.success ? `${deleteAction.value.name} fue dado de baja. Sus cupones siguen en el historial.` : undefined} />

      {isImportOpen.value && <ImportPanel onClose$={() => (isImportOpen.value = false)} />}

      {isCreateUserOpen.value && (
        <Form
          action={registerUserAction}
          onSubmitCompleted$={() => {
            // Keep the panel and its values open when the DNI or email is rejected
            if (registerUserAction.value?.success) isCreateUserOpen.value = false;
          }}
          class="card p-5 sm:p-6 space-y-5"
        >
          <div class="space-y-1">
            <h2 class="font-display text-lg font-semibold uppercase tracking-wide text-primary">Registrar socio</h2>
            <p class="text-sm text-slate-600">Con el DNI alcanza para que pueda ingresar; el email es opcional.</p>
          </div>

          {registerUserAction.value?.failed && registerUserAction.value.message && <ActionFeedback value={registerUserAction.value} />}

          <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label for="new-member-name" class="field-label">Nombre completo</label>
              <input
                id="new-member-name"
                type="text"
                name="name"
                required
                autocomplete="off"
                placeholder="Ej.: Juana Pérez"
                aria-invalid={registerErrors?.name ? "true" : undefined}
                aria-describedby={registerErrors?.name ? "new-member-name-error" : undefined}
                class="field text-base sm:text-sm"
              />
              <FieldError id="new-member-name-error" message={registerErrors?.name} />
            </div>

            <div>
              <label for="new-member-dni" class="field-label">DNI</label>
              <input
                id="new-member-dni"
                type="text"
                name="numeroSocio"
                required
                inputMode="numeric"
                autocomplete="off"
                placeholder="Ej.: 30.123.456"
                aria-invalid={registerErrors?.numeroSocio ? "true" : undefined}
                aria-describedby={registerErrors?.numeroSocio ? "new-member-dni-help new-member-dni-error" : "new-member-dni-help"}
                class="field text-base sm:text-sm"
              />
              <p id="new-member-dni-help" class="mt-1.5 text-xs text-slate-600">Es lo que escribe para ingresar y funciona como su número de socio.</p>
              <FieldError id="new-member-dni-error" message={registerErrors?.numeroSocio} />
            </div>

            <div>
              <label for="new-member-email" class="field-label">Email (opcional)</label>
              <input
                id="new-member-email"
                type="email"
                name="email"
                autocomplete="off"
                placeholder="Ej.: juana@mail.com"
                aria-invalid={registerErrors?.email ? "true" : undefined}
                aria-describedby={registerErrors?.email ? "new-member-email-error" : undefined}
                class="field text-base sm:text-sm"
              />
              <FieldError id="new-member-email-error" message={registerErrors?.email} />
            </div>
          </div>

          <div class="flex flex-wrap justify-end gap-3">
            <button type="button" onClick$={() => (isCreateUserOpen.value = false)} class="btn btn-outline">
              Cancelar
            </button>
            <button type="submit" disabled={registerUserAction.isRunning} class="btn btn-primary">
              {registerUserAction.isRunning ? "Registrando..." : "Confirmar alta"}
            </button>
          </div>
        </Form>
      )}

      <form
        method="get"
        action="/admin/users/"
        role="search"
        preventdefault:submit
        onSubmit$={() => {
          const value = search.value.trim();
          navigate(value ? `/admin/users/?buscar=${encodeURIComponent(value)}` : "/admin/users/");
        }}
        class="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div class="flex-1 sm:max-w-xl">
          <label for="member-search" class="field-label">Buscar socio</label>
          <input
            id="member-search"
            type="search"
            name="buscar"
            bind:value={search}
            placeholder="Nombre, email o DNI (con o sin puntos)"
            class="field text-base sm:text-sm"
          />
        </div>
        <div class="flex gap-2">
          <button type="submit" class="btn btn-dark">
            <LuSearch class="h-4 w-4" aria-hidden="true" />
            Buscar
          </button>
          {query && (
            <Link href="/admin/users/" onClick$={() => (search.value = "")} class="btn btn-outline">
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {"loadError" in membersLoader.value && (
        <div role="alert" class="border-l-4 border-red-600 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
          No se pudo cargar el listado de socios. Recargá la página.
        </div>
      )}

      <p class="text-sm text-slate-600" aria-live="polite">
        {total === 0
          ? query
            ? `No encontramos socios para “${query}”. Probá con parte del apellido o con el DNI sin puntos.`
            : "Todavía no hay socios registrados."
          : `${query ? `${total} ${total === 1 ? "resultado" : "resultados"} para “${query}”` : `${total} socios`} · mostrando ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)}, los más nuevos primero.`}
      </p>

      {/* Members: stacked cards on phones, table from lg up */}
      {members.length > 0 && (
        <>
          <ul class="space-y-3 xl:hidden">
            {members.map((member) => (
              <li key={member.id} class="card p-4 space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-semibold text-slate-800">{member.name}</p>
                    <p class="text-xs text-slate-600 break-all">{member.email ?? "Sin email"}</p>
                  </div>
                  {typeCell(member)}
                </div>
                <dl class="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt class="font-bold uppercase tracking-wide text-slate-600">DNI</dt>
                    <dd class="font-mono font-semibold text-slate-800">{member.numeroSocio || "—"}</dd>
                  </div>
                  <div>
                    <dt class="font-bold uppercase tracking-wide text-slate-600">Alta</dt>
                    <dd class="text-slate-800">{formatDay(member.createdAt)}</dd>
                  </div>
                  <div>
                    <dt class="font-bold uppercase tracking-wide text-slate-600">Último acceso</dt>
                    <dd class="text-slate-800">{member.lastLoginAt ? formatDay(member.lastLoginAt) : "Nunca"}</dd>
                  </div>
                </dl>
                <div class="flex flex-wrap items-center gap-2">{actions(member)}</div>
              </li>
            ))}
          </ul>

          <div class="hidden xl:block card overflow-x-auto">
            <table class="w-full text-left border-collapse text-sm">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600 whitespace-nowrap">
                  <th scope="col" class="px-3 py-3">Socio</th>
                  <th scope="col" class="px-3 py-3">DNI <span class="sr-only">(número de socio)</span></th>
                  <th scope="col" class="px-3 py-3">Tipo</th>
                  <th scope="col" class="px-3 py-3">Alta</th>
                  <th scope="col" class="px-3 py-3">Último acceso</th>
                  <th scope="col" class="px-3 py-3"><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                {members.map((member) => (
                  <tr key={member.id} class="align-top hover:bg-slate-50">
                    <td class="min-w-48 px-3 py-3">
                      <p class="font-semibold text-slate-800">{member.name}</p>
                      <p class={["text-xs break-words", member.email ? "text-slate-600" : "text-slate-500"]}>{member.email ?? "Sin email"}</p>
                    </td>
                    <td class="px-3 py-3 font-mono font-semibold text-slate-800 whitespace-nowrap">{member.numeroSocio || "—"}</td>
                    <td class="px-3 py-3">{typeCell(member)}</td>
                    <td class="px-3 py-3 whitespace-nowrap text-slate-700">{formatDay(member.createdAt)}</td>
                    <td class="px-3 py-3 whitespace-nowrap text-slate-700">
                      {member.lastLoginAt ? <time dateTime={member.lastLoginAt} title={`${formatDateTime(member.lastLoginAt)} hs`}>{formatDay(member.lastLoginAt)}</time> : "Nunca"}
                    </td>
                    <td class="px-3 py-3">
                      <div class="flex items-center justify-end gap-2">{actions(member, true)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pages > 1 && (
        <nav aria-label="Páginas de socios" class="flex flex-wrap items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} class="btn btn-sm btn-outline">Anterior</Link>
          ) : (
            <span class="btn btn-sm btn-outline" aria-disabled="true">Anterior</span>
          )}
          <span class="text-sm text-slate-600">Página {page} de {pages}</span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} class="btn btn-sm btn-outline">Siguiente</Link>
          ) : (
            <span class="btn btn-sm btn-outline" aria-disabled="true">Siguiente</span>
          )}
        </nav>
      )}

      <PanelDialog open={isGoldOpen} title={selected.value?.role === "premium" ? `Gold de ${selected.value.name}` : `Pasar a Gold a ${selected.value?.name ?? ""}`}>
        {selected.value && (
          <Form
            key={selected.value.id}
            action={goldAction}
            onSubmitCompleted$={() => {
              if (goldAction.value?.success) isGoldOpen.value = false;
            }}
            class="space-y-5"
          >
            <input type="hidden" name="id" value={selected.value.id} />
            <fieldset class="space-y-2">
              <legend class="field-label">Tipo de socio</legend>
              <label class="flex min-h-11 items-center gap-3 border border-slate-300 px-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-slate-50">
                <input type="radio" name="gold" value="1" checked={goldChoice.value} onChange$={() => (goldChoice.value = true)} class="h-5 w-5 accent-primary" />
                <span><strong>Socio Gold</strong> <span class="text-sm text-slate-600">— accede a los beneficios exclusivos Gold</span></span>
              </label>
              <label class="flex min-h-11 items-center gap-3 border border-slate-300 px-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-slate-50">
                <input type="radio" name="gold" value="0" checked={!goldChoice.value} onChange$={() => (goldChoice.value = false)} class="h-5 w-5 accent-primary" />
                <span><strong>Socio</strong> <span class="text-sm text-slate-600">— sin beneficios Gold</span></span>
              </label>
            </fieldset>
            {goldChoice.value && (
              <div>
                <label for="gold-expires" class="field-label">Gold hasta (opcional)</label>
                <input
                  id="gold-expires"
                  type="date"
                  name="expiresOn"
                  min={today}
                  value={selected.value.premiumExpiresAt ? buenosAiresDay(selected.value.premiumExpiresAt) : ""}
                  aria-describedby={goldFailure?.fieldErrors?.expiresOn ? "gold-expires-help gold-expires-error" : "gold-expires-help"}
                  aria-invalid={goldFailure?.fieldErrors?.expiresOn ? "true" : undefined}
                  class="field text-base sm:text-sm"
                />
                <p id="gold-expires-help" class="mt-1.5 text-xs text-slate-600">Ese día todavía es Gold; al siguiente vuelve a ser socio común. Vacío = sin vencimiento.</p>
                <FieldError id="gold-expires-error" message={goldFailure?.fieldErrors?.expiresOn} />
              </div>
            )}
            {goldFailure?.message && <ActionFeedback value={goldAction.value} />}
            <div class="flex flex-wrap justify-end gap-3">
              <button type="button" onClick$={() => (isGoldOpen.value = false)} class="btn btn-outline">Cancelar</button>
              <button type="submit" disabled={goldAction.isRunning} class="btn btn-primary">
                {goldAction.isRunning ? "Guardando..." : "Confirmar cambio"}
              </button>
            </div>
          </Form>
        )}
      </PanelDialog>

      <PanelDialog open={isEditOpen} title={`Editar a ${selected.value?.name ?? ""}`}>
        {selected.value && (
          <Form
            key={selected.value.id}
            action={updateAction}
            onSubmitCompleted$={() => {
              if (updateAction.value?.success) isEditOpen.value = false;
            }}
            class="space-y-4"
          >
            <input type="hidden" name="id" value={selected.value.id} />
            {editFailure?.message && <ActionFeedback value={updateAction.value} />}
            <div>
              <label for="edit-member-name" class="field-label">Nombre completo</label>
              <input id="edit-member-name" type="text" name="name" required value={selected.value.name} aria-invalid={editFailure?.fieldErrors?.name ? "true" : undefined} aria-describedby="edit-member-name-error" class="field text-base sm:text-sm" />
              <FieldError id="edit-member-name-error" message={editFailure?.fieldErrors?.name} />
            </div>
            <div>
              <label for="edit-member-dni" class="field-label">DNI</label>
              <input id="edit-member-dni" type="text" name="numeroSocio" required inputMode="numeric" value={selected.value.numeroSocio ?? ""} aria-invalid={editFailure?.fieldErrors?.numeroSocio ? "true" : undefined} aria-describedby="edit-member-dni-help edit-member-dni-error" class="field text-base sm:text-sm" />
              <p id="edit-member-dni-help" class="mt-1.5 text-xs text-slate-600">Si lo cambiás, desde ahora ingresa con el DNI nuevo. Sus cupones anteriores conservan el DNI con el que se emitieron.</p>
              <FieldError id="edit-member-dni-error" message={editFailure?.fieldErrors?.numeroSocio} />
            </div>
            <div>
              <label for="edit-member-email" class="field-label">Email (opcional)</label>
              <input id="edit-member-email" type="email" name="email" value={selected.value.email ?? ""} aria-invalid={editFailure?.fieldErrors?.email ? "true" : undefined} aria-describedby="edit-member-email-error" class="field text-base sm:text-sm" />
              <FieldError id="edit-member-email-error" message={editFailure?.fieldErrors?.email} />
            </div>
            <div class="flex flex-wrap justify-end gap-3 pt-1">
              <button type="button" onClick$={() => (isEditOpen.value = false)} class="btn btn-outline">Cancelar</button>
              <button type="submit" disabled={updateAction.isRunning} class="btn btn-primary">
                {updateAction.isRunning ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </Form>
        )}
      </PanelDialog>

      <ConfirmDialog
        open={isDeleteOpen}
        title={`Dar de baja a ${selected.value?.name ?? ""}`}
        confirmLabel="Dar de baja"
        pendingLabel="Dando de baja..."
        pending={deleteAction.isRunning}
        error={deleteError.value}
        onConfirm$={confirmDelete$}
      >
        <p>Se borra su cuenta y se cierran sus sesiones: ya no va a poder ingresar con su DNI. Los cupones que generó quedan en el historial.</p>
        <p>No se puede deshacer; para volver a habilitarlo hay que registrarlo de nuevo.</p>
      </ConfirmDialog>
    </div>
  );
});

export const head: DocumentHead = {
  title: "LPRC Club - Socios",
  meta: [
    {
      name: "description",
      content: "Gestionar cuentas y membresías de socios.",
    },
  ],
};
