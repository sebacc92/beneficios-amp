import { component$ } from "@builder.io/qwik";
import { Form, Link, routeAction$, routeLoader$, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { asc, eq } from "drizzle-orm";
import { LuClock, LuInbox, LuMail, LuMessageCircle, LuPhone, LuPlus, LuUndo2 } from "@qwikest/icons/lucide";
import { ActionFeedback } from "~/components/admin/action-feedback";
import { SectionHeading } from "~/components/section-heading/section-heading";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import {
  countPendingMerchantRequests,
  countPendingSuggestions,
  getMerchantRequest,
  getMerchantRequestInbox,
  getSuggestion,
  getSuggestionInbox,
  saveMerchantRequestFollowUp,
  saveSuggestionFollowUp,
  setMerchantRequestStatus,
  setSuggestionStatus,
} from "~/server/club-content";
import {
  formatDateTime,
  isMerchantRequestStatus,
  merchantRequestStatusLabels,
  type MerchantRequestStatus,
} from "~/utils/club-content";
import {
  isSuggestionStatus,
  suggestionStatusLabels,
  type SuggestionStatus,
} from "~/utils/suggestions";
import { CLUB, whatsappLink } from "~/utils/club";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

type Inbox = "comercios" | "sugerencias";

/** Pending items older than this get flagged: someone wrote to the club and is still waiting. */
const STALE_AFTER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const relativeFormatter = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

function daysSince(iso: string, now = Date.now()): number {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : Math.max(0, Math.floor((now - time) / DAY_MS));
}

/** "hoy", "ayer", "hace 9 días", "hace 2 meses". */
function relativeAge(iso: string): string {
  const days = daysSince(iso);
  if (days === 0) return "hoy";
  return days < 60 ? relativeFormatter.format(-days, "day") : relativeFormatter.format(-Math.floor(days / 30), "month");
}

/**
 * Argentine numbers the way people type them ("0221 15-555-0000", "221 5550000")
 * become the 549 + area + number WhatsApp expects. Anything else is used as typed.
 */
function whatsappNumberFor(phone: string): string | null {
  let digits = phone.replace(/\D/g, "").replace(/^00/, "");
  if (digits.startsWith("54")) digits = digits.slice(2).replace(/^9/, "");
  digits = digits.replace(/^0/, "");
  if (digits.length === 12) {
    const mobilePrefix = [2, 3, 4].find((at) => digits.slice(at, at + 2) === "15");
    if (mobilePrefix !== undefined) digits = digits.slice(0, mobilePrefix) + digits.slice(mobilePrefix + 2);
  }
  if (digits.length === 10) return `549${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function requireAdmin(event: { sharedMap: Map<string, unknown> }): AuthenticatedUser | null {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  return user?.role === "admin" ? user : null;
}

/** Pending totals for the switcher between the two inboxes. */
export const useInboxPendingLoader = routeLoader$(async (event) => {
  if (!requireAdmin(event)) throw event.redirect(302, "/admin/login/");
  const inbox: Inbox = event.url.searchParams.get("bandeja") === "sugerencias" ? "sugerencias" : "comercios";
  try {
    const [comercios, sugerencias] = await Promise.all([
      countPendingMerchantRequests(event),
      countPendingSuggestions(event),
    ]);
    return { inbox, pending: { comercios, sugerencias } };
  } catch (err) {
    console.error("Failed to count pending inbox items:", err);
    return { inbox, pending: { comercios: 0, sugerencias: 0 } };
  }
});

/** Names offered as "Responsable": the panel's administrators. */
export const useAdminNamesLoader = routeLoader$(async (event) => {
  const user = requireAdmin(event);
  if (!user) throw event.redirect(302, "/admin/login/");
  try {
    const rows = await getDB(event).select({ name: users.name }).from(users).where(eq(users.role, "admin")).orderBy(asc(users.name));
    return { names: rows.map((row) => row.name), me: user.name };
  } catch (err) {
    console.error("Failed to load admin names:", err);
    return { names: [user.name], me: user.name };
  }
});

export const useSuggestionsLoader = routeLoader$(async (event) => {
  if (!requireAdmin(event)) throw event.redirect(302, "/admin/login/");
  const requested = event.url.searchParams.get("estado");
  const status: SuggestionStatus | "all" = requested === "all" || isSuggestionStatus(requested) ? requested : "pending";
  if (event.url.searchParams.get("bandeja") !== "sugerencias") {
    return { status, suggestions: [], counts: { pending: 0, reviewed: 0, discarded: 0, all: 0 } };
  }
  try {
    return { status, ...(await getSuggestionInbox(event, status)) };
  } catch (err) {
    console.error("Failed to load suggestions:", err);
    return { status, suggestions: [], counts: { pending: 0, reviewed: 0, discarded: 0, all: 0 }, loadError: true };
  }
});

export const useMerchantRequestsLoader = routeLoader$(async (event) => {
  if (!requireAdmin(event)) throw event.redirect(302, "/admin/login/");
  const requested = event.url.searchParams.get("estado");
  const status: MerchantRequestStatus | "all" = requested === "all" || isMerchantRequestStatus(requested) ? requested : "pending";
  if (event.url.searchParams.get("bandeja") === "sugerencias") {
    return { status, requests: [], counts: { pending: 0, contacted: 0, discarded: 0, all: 0 } };
  }
  try {
    return { status, ...(await getMerchantRequestInbox(event, status)) };
  } catch (err) {
    console.error("Failed to load merchant requests:", err);
    return { status, requests: [], counts: { pending: 0, contacted: 0, discarded: 0, all: 0 }, loadError: true };
  }
});

/** What "Deshacer" sends back: the status and contact date before the change. */
interface UndoState {
  id: string;
  status: string;
  contactedAt: string;
  name: string;
}

// Same schema for both inboxes (each setter validates its own statuses), so one feedback component serves both.
const statusSchema = {
  id: z.string(),
  name: z.string(),
  status: z.string(),
  undo: z.string().optional(),
  // Only read when undoing; "" restores an empty contact date.
  contactedAt: z.string().optional(),
};

export const useUpdateRequestStatusAction = routeAction$(
  async (data, requestEvent) => {
    if (!requireAdmin(requestEvent)) return requestEvent.fail(403, { message: "No autorizado." });
    try {
      const previous = await getMerchantRequest(requestEvent, data.id);
      if (!previous) return requestEvent.fail(404, { message: "La solicitud ya no existe." });
      const isUndo = data.undo === "1";
      const changed = await setMerchantRequestStatus(
        requestEvent,
        data.id,
        data.status,
        isUndo ? { contactedAt: data.contactedAt || null } : {},
      );
      if (!changed || !isMerchantRequestStatus(data.status)) return requestEvent.fail(404, { message: "La solicitud ya no existe o el estado no es válido." });
      const label = merchantRequestStatusLabels[data.status].toLowerCase();
      if (isUndo) return { success: true, message: `Listo, “${data.name}” volvió a ${label}.` };
      const undo: UndoState = { id: data.id, status: previous.status, contactedAt: previous.contactedAt ?? "", name: data.name };
      return { success: true, message: `“${data.name}” quedó como ${label}.`, undo };
    } catch (err) {
      console.error("Update merchant request error:", err);
      return requestEvent.fail(500, { message: "No se pudo actualizar la solicitud. Intentá de nuevo." });
    }
  },
  zod$(statusSchema),
);

export const useUpdateSuggestionStatusAction = routeAction$(
  async (data, requestEvent) => {
    if (!requireAdmin(requestEvent)) return requestEvent.fail(403, { message: "No autorizado." });
    try {
      const previous = await getSuggestion(requestEvent, data.id);
      if (!previous) return requestEvent.fail(404, { message: "El mensaje ya no existe." });
      const isUndo = data.undo === "1";
      if (!(await setSuggestionStatus(requestEvent, data.id, data.status)) || !isSuggestionStatus(data.status)) {
        return requestEvent.fail(404, { message: "El mensaje ya no existe o el estado no es válido." });
      }
      const label = suggestionStatusLabels[data.status].toLowerCase();
      if (isUndo) return { success: true, message: `Listo, el mensaje de ${data.name} volvió a ${label}.` };
      const undo: UndoState = { id: data.id, status: previous.status, contactedAt: "", name: data.name };
      return { success: true, message: `El mensaje de ${data.name} quedó como ${label}.`, undo };
    } catch (err) {
      console.error("Update suggestion error:", err);
      return requestEvent.fail(500, { message: "No se pudo actualizar el mensaje. Intentá de nuevo." });
    }
  },
  zod$(statusSchema),
);

const followUpSchema = {
  id: z.string(),
  notes: z.string().max(2000, "Las notas pueden tener hasta 2000 caracteres.").optional(),
  assignedTo: z.string().max(120).optional(),
  contacted: z.string().optional(),
};

export const useMerchantFollowUpAction = routeAction$(
  async (data, requestEvent) => {
    if (!requireAdmin(requestEvent)) return requestEvent.fail(403, { message: "No autorizado." });
    try {
      const saved = await saveMerchantRequestFollowUp(requestEvent, data.id, { notes: data.notes ?? "", assignedTo: data.assignedTo ?? "" });
      if (!saved) return requestEvent.fail(404, { message: "La solicitud ya no existe." });
      return { success: true, id: data.id };
    } catch (err) {
      console.error("Save merchant follow-up error:", err);
      return requestEvent.fail(500, { message: "No se pudo guardar el seguimiento. Intentá de nuevo." });
    }
  },
  zod$(followUpSchema),
);

export const useSuggestionFollowUpAction = routeAction$(
  async (data, requestEvent) => {
    if (!requireAdmin(requestEvent)) return requestEvent.fail(403, { message: "No autorizado." });
    try {
      const saved = await saveSuggestionFollowUp(requestEvent, data.id, {
        notes: data.notes ?? "",
        assignedTo: data.assignedTo ?? "",
        contacted: data.contacted === "on",
      });
      if (!saved) return requestEvent.fail(404, { message: "El mensaje ya no existe." });
      return { success: true, id: data.id };
    } catch (err) {
      console.error("Save suggestion follow-up error:", err);
      return requestEvent.fail(500, { message: "No se pudo guardar el seguimiento. Intentá de nuevo." });
    }
  },
  zod$(followUpSchema),
);

const statusTone: Record<string, string> = {
  pending: "badge-accent",
  contacted: "bg-emerald-50 text-emerald-800",
  reviewed: "bg-emerald-50 text-emerald-800",
  discarded: "badge-muted",
};

const suggestionTabs: { value: SuggestionStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "reviewed", label: "Revisadas" },
  { value: "discarded", label: "Descartadas" },
  { value: "all", label: "Todas" },
];

const tabs: { value: MerchantRequestStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "contacted", label: "Contactadas" },
  { value: "discarded", label: "Descartadas" },
  { value: "all", label: "Todas" },
];

/** Which explicit buttons each state offers; the first one is the usual next step. */
const merchantMoves: Record<MerchantRequestStatus, { status: MerchantRequestStatus; label: string }[]> = {
  pending: [{ status: "contacted", label: "Marcar contactado" }, { status: "discarded", label: "Descartar" }],
  contacted: [{ status: "pending", label: "Volver a pendiente" }, { status: "discarded", label: "Descartar" }],
  discarded: [{ status: "pending", label: "Volver a pendiente" }, { status: "contacted", label: "Marcar contactado" }],
};

const suggestionMoves: Record<SuggestionStatus, { status: SuggestionStatus; label: string }[]> = {
  pending: [{ status: "reviewed", label: "Marcar revisada" }, { status: "discarded", label: "Descartar" }],
  reviewed: [{ status: "pending", label: "Volver a pendiente" }, { status: "discarded", label: "Descartar" }],
  discarded: [{ status: "pending", label: "Volver a pendiente" }, { status: "reviewed", label: "Marcar revisada" }],
};

const StatusFilter = component$<{
  label: string;
  base: string;
  current: string;
  items: { value: string; label: string; count: number }[];
}>(({ label, base, current, items }) => (
  <nav aria-label={label} class="flex flex-wrap gap-2">
    {items.map((tab) => (
      <Link
        key={tab.value}
        href={`${base}&estado=${tab.value}`}
        aria-current={current === tab.value ? "page" : undefined}
        class={[
          "inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          current === tab.value ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-700 hover:border-primary",
        ]}
      >
        {tab.label}
        <span class={["px-1.5 text-xs font-bold", current === tab.value ? "bg-accent text-primary" : "bg-slate-100 text-slate-700"]}>{tab.count}</span>
      </Link>
    ))}
  </nav>
));

/** Result of a status change, with "Deshacer" since the item usually leaves the current tab. */
const StatusFeedback = component$<{
  action: ReturnType<typeof useUpdateRequestStatusAction>;
}>(({ action }) => {
  const value = action.value;
  if (!value) return null;
  if (value.failed) return <ActionFeedback value={value} />;
  if (!("success" in value) || !value.success) return null;
  const undo = "undo" in value ? (value.undo as UndoState | undefined) : undefined;
  return (
    <div role="status" class="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 border-l-4 border-primary bg-white px-4 py-3 text-sm font-semibold text-primary shadow-md">
      <span>{value.message}</span>
      {undo && (
        <Form action={action}>
          <input type="hidden" name="id" value={undo.id} />
          <input type="hidden" name="status" value={undo.status} />
          <input type="hidden" name="contactedAt" value={undo.contactedAt} />
          <input type="hidden" name="name" value={undo.name} />
          <input type="hidden" name="undo" value="1" />
          <button type="submit" disabled={action.isRunning} class="btn btn-sm btn-outline">
            <LuUndo2 class="h-4 w-4" aria-hidden="true" />
            Deshacer
          </button>
        </Form>
      )}
    </div>
  );
});

const AgeLine = component$<{ createdAt: string; pending: boolean; prefix: string; extra?: string }>(({ createdAt, pending, prefix, extra }) => {
  const stale = pending && daysSince(createdAt) > STALE_AFTER_DAYS;
  return (
    <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
      {extra && <span>{extra}</span>}
      {extra && <span aria-hidden="true">·</span>}
      <span>
        {prefix} <time dateTime={createdAt} title={`${formatDateTime(createdAt)} hs`} class="font-semibold text-slate-700">{relativeAge(createdAt)}</time>
        {" "}({formatDateTime(createdAt)} hs)
      </span>
      {stale && (
        <span class="badge bg-red-50 text-red-800">
          <LuClock class="h-3.5 w-3.5" aria-hidden="true" />
          Hace más de {STALE_AFTER_DAYS} días sin respuesta
        </span>
      )}
    </p>
  );
});

const ContactLinks = component$<{ name: string; email: string; phone: string | null; whatsappText: string; mailSubject: string }>(
  ({ name, email, phone, whatsappText, mailSubject }) => {
    const whatsappNumber = phone ? whatsappNumberFor(phone) : null;
    const linkClass = "inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline";
    return (
      <div class="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-200 pt-3 text-sm">
        <span class="font-bold text-slate-800">{name}</span>
        <a href={`mailto:${email}?subject=${encodeURIComponent(mailSubject)}`} class={linkClass}>
          <LuMail class="h-4 w-4" aria-hidden="true" />
          <span class="break-all">{email}</span>
        </a>
        {phone && (
          <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} class={linkClass}>
            <LuPhone class="h-4 w-4" aria-hidden="true" />
            {phone}
          </a>
        )}
        {whatsappNumber && (
          <a href={whatsappLink(whatsappText, whatsappNumber)} target="_blank" rel="noopener noreferrer" class={linkClass}>
            <LuMessageCircle class="h-4 w-4" aria-hidden="true" />
            WhatsApp<span class="sr-only"> a {name} (se abre en otra pestaña)</span>
          </a>
        )}
      </div>
    );
  },
);

interface FollowUpProps {
  action: ReturnType<typeof useMerchantFollowUpAction> | ReturnType<typeof useSuggestionFollowUpAction>;
  id: string;
  notes: string | null;
  assignedTo: string | null;
  contactedAt: string | null;
  /** Suggestions record the answer to the member here; requests do it with "Marcar contactado". */
  withContactedBox?: boolean;
}

const FollowUp = component$<FollowUpProps>(({ action, id, notes, assignedTo, contactedAt, withContactedBox }) => {
  const admins = useAdminNamesLoader();
  const options = assignedTo && !admins.value.names.includes(assignedTo) ? [...admins.value.names, assignedTo] : admins.value.names;
  const saved = action.value && "id" in action.value && action.value.id === id && !action.value.failed;
  const failed = action.value?.failed && action.formData?.get("id") === id ? action.value.message : undefined;
  const summary = [assignedTo ? `Responsable: ${assignedTo}` : "Sin responsable", notes ? "con notas" : null].filter(Boolean).join(" · ");

  return (
    <details class="group border-t border-slate-200 pt-3" open={Boolean(notes || assignedTo)}>
      <summary class="cursor-pointer py-2.5 text-sm font-semibold text-primary">
        Seguimiento interno <span class="font-normal text-slate-600">— {summary}</span>
      </summary>
      <Form action={action} class="mt-3 grid gap-4 sm:grid-cols-[minmax(0,15rem)_1fr]">
        <input type="hidden" name="id" value={id} />
        <div>
          <label for={`assigned-${id}`} class="field-label">Responsable</label>
          <select id={`assigned-${id}`} name="assignedTo" class="field text-base sm:text-sm">
            <option value="" selected={!assignedTo}>Sin asignar</option>
            {options.map((name) => (
              <option key={name} value={name} selected={assignedTo === name}>
                {name === admins.value.me ? `${name} (vos)` : name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label for={`notes-${id}`} class="field-label">Notas internas</label>
          <textarea
            id={`notes-${id}`}
            name="notes"
            rows={3}
            maxLength={2000}
            placeholder="Ej.: Llamé el martes; prefieren 10% en vez de 15%. Volver a llamar el lunes."
            class="field text-base sm:text-sm"
            value={notes ?? ""}
          />
          <p class="mt-1 text-xs text-slate-600">Solo las ve el equipo del panel.</p>
        </div>
        {withContactedBox && (
          <label class="flex min-h-11 items-center gap-3 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="contacted" checked={Boolean(contactedAt)} class="h-5 w-5 accent-primary" />
            Ya le respondimos{contactedAt ? ` (el ${formatDateTime(contactedAt)} hs)` : ""}
          </label>
        )}
        <div class="flex flex-wrap items-center justify-end gap-3 sm:col-span-2">
          {saved && <span role="status" class="text-sm font-semibold text-emerald-800">Seguimiento guardado.</span>}
          {failed && <span role="alert" class="text-sm font-semibold text-red-700">{failed}</span>}
          <button type="submit" disabled={action.isRunning} class="btn btn-sm btn-dark">
            {action.isRunning && action.formData?.get("id") === id ? "Guardando..." : "Guardar seguimiento"}
          </button>
        </div>
      </Form>
    </details>
  );
});

const EmptyInbox = component$<{ title: string; text: string }>(({ title, text }) => (
  <div class="card border-dashed p-10 text-center space-y-2">
    <LuInbox class="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
    <p class="font-bold text-slate-800">{title}</p>
    <p class="text-sm text-slate-600">{text}</p>
  </div>
));

const SuggestionsInbox = component$(() => {
  const inbox = useSuggestionsLoader();
  const statusAction = useUpdateSuggestionStatusAction();
  const followUpAction = useSuggestionFollowUpAction();
  const { status, suggestions, counts } = inbox.value;

  return (
    <>
      <StatusFilter
        label="Filtrar sugerencias por estado"
        base="/admin/solicitudes/?bandeja=sugerencias"
        current={status}
        items={suggestionTabs.map((tab) => ({ ...tab, count: counts[tab.value] }))}
      />

      <StatusFeedback action={statusAction} />
      {"loadError" in inbox.value && (
        <div role="alert" class="border-l-4 border-red-600 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
          No se pudieron cargar las sugerencias. Recargá la página.
        </div>
      )}
      {status === "pending" && suggestions.length > 1 && (
        <p class="text-xs text-slate-600">Ordenadas de la más antigua a la más nueva: arriba queda quien espera hace más tiempo.</p>
      )}

      {suggestions.length === 0 ? (
        <EmptyInbox
          title={status === "pending" ? "No hay sugerencias pendientes" : "No hay sugerencias en esta vista"}
          text="Lo que los socios envían desde “Sugerencias” aparece acá."
        />
      ) : (
        <ul class="space-y-4">
          {suggestions.map((item) => {
            const current = isSuggestionStatus(item.status) ? item.status : "pending";
            const stale = current === "pending" && daysSince(item.createdAt) > STALE_AFTER_DAYS;
            return (
              <li key={item.id} class={["card p-5 sm:p-6 space-y-4", stale && "border-l-4 border-l-red-600"]}>
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div class="min-w-0 space-y-1.5">
                    <div class="flex flex-wrap items-center gap-2">
                      <h2 class="font-display text-xl font-semibold uppercase tracking-wide text-primary">{item.tipo}</h2>
                      <span class={["badge", statusTone[current]]}>{suggestionStatusLabels[current]}</span>
                    </div>
                    <AgeLine createdAt={item.createdAt} pending={current === "pending"} prefix="Recibido" extra={item.comercio ?? undefined} />
                    {item.updatedAt && <p class="text-xs text-slate-600">Última actualización: {formatDateTime(item.updatedAt)} hs</p>}
                  </div>

                  <div class="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
                    {suggestionMoves[current].map((move, index) => (
                      <Form key={move.status} action={statusAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="name" value={item.nombre} />
                        <input type="hidden" name="status" value={move.status} />
                        <button type="submit" disabled={statusAction.isRunning} class={["btn btn-sm", index === 0 ? "btn-dark" : "btn-outline"]}>
                          {move.label}
                        </button>
                      </Form>
                    ))}
                  </div>
                </div>

                <p class="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{item.mensaje}</p>

                <ContactLinks
                  name={item.nombre}
                  email={item.email}
                  phone={item.telefono}
                  whatsappText={`Hola ${item.nombre}! Te escribimos de ${CLUB.name} por el mensaje que nos dejaste en el portal de beneficios.`}
                  mailSubject={`${CLUB.name}: tu mensaje al Club de Beneficios`}
                />

                <FollowUp
                  action={followUpAction}
                  id={item.id}
                  notes={item.notes}
                  assignedTo={item.assignedTo}
                  contactedAt={item.contactedAt}
                  withContactedBox
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
});

const MerchantRequestsInbox = component$(() => {
  const inbox = useMerchantRequestsLoader();
  const statusAction = useUpdateRequestStatusAction();
  const followUpAction = useMerchantFollowUpAction();
  const { status, requests, counts } = inbox.value;

  return (
    <>
      <StatusFilter
        label="Filtrar solicitudes por estado"
        base="/admin/solicitudes/?bandeja=comercios"
        current={status}
        items={tabs.map((tab) => ({ ...tab, count: counts[tab.value] }))}
      />

      <StatusFeedback action={statusAction} />
      {"loadError" in inbox.value && (
        <div role="alert" class="border-l-4 border-red-600 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
          No se pudieron cargar las solicitudes. Recargá la página.
        </div>
      )}
      {status === "pending" && requests.length > 1 && (
        <p class="text-xs text-slate-600">Ordenadas de la más antigua a la más nueva: arriba queda quien espera hace más tiempo.</p>
      )}

      {requests.length === 0 ? (
        <EmptyInbox
          title={status === "pending" ? "No hay solicitudes pendientes" : "No hay solicitudes en esta vista"}
          text="Las nuevas propuestas de comercios aparecen acá apenas las envían."
        />
      ) : (
        <ul class="space-y-4">
          {requests.map((request) => {
            const current = isMerchantRequestStatus(request.status) ? request.status : "pending";
            const stale = current === "pending" && daysSince(request.createdAt) > STALE_AFTER_DAYS;
            const newBenefitHref = `/admin/benefits/?nuevo=1&titulo=${encodeURIComponent(request.businessName)}&telefono=${encodeURIComponent(request.phone)}`;
            return (
              <li key={request.id} class={["card p-5 sm:p-6 space-y-4", stale && "border-l-4 border-l-red-600"]}>
                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div class="min-w-0 space-y-1.5">
                    <div class="flex flex-wrap items-center gap-2">
                      <h2 class="font-display text-xl font-semibold uppercase tracking-wide text-primary">{request.businessName}</h2>
                      <span class={["badge", statusTone[current]]}>{merchantRequestStatusLabels[current]}</span>
                    </div>
                    <AgeLine createdAt={request.createdAt} pending={current === "pending"} prefix="Recibida" extra={request.category} />
                    {(request.contactedAt || request.updatedAt) && (
                      <p class="text-xs text-slate-600">
                        {request.contactedAt && <>Contactado el {formatDateTime(request.contactedAt)} hs</>}
                        {request.contactedAt && request.updatedAt && " · "}
                        {request.updatedAt && <>Última actualización: {formatDateTime(request.updatedAt)} hs</>}
                      </p>
                    )}
                  </div>

                  <div class="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
                    {merchantMoves[current].map((move, index) => (
                      <Form key={move.status} action={statusAction}>
                        <input type="hidden" name="id" value={request.id} />
                        <input type="hidden" name="name" value={request.businessName} />
                        <input type="hidden" name="status" value={move.status} />
                        <button type="submit" disabled={statusAction.isRunning} class={["btn btn-sm", index === 0 ? "btn-dark" : "btn-outline"]}>
                          {move.label}
                        </button>
                      </Form>
                    ))}
                  </div>
                </div>

                <p class="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{request.proposal}</p>

                <ContactLinks
                  name={request.contactName}
                  email={request.email}
                  phone={request.phone}
                  whatsappText={`Hola ${request.contactName}! Te escribimos de ${CLUB.name} por la propuesta de ${request.businessName} para el Club de Beneficios.`}
                  mailSubject={`${CLUB.name}: propuesta de ${request.businessName}`}
                />

                <div class="flex flex-wrap items-center gap-3">
                  <Link href={newBenefitHref} class="btn btn-sm btn-primary">
                    <LuPlus class="h-4 w-4" aria-hidden="true" />
                    Crear beneficio con estos datos
                  </Link>
                  <span class="text-xs text-slate-600">Abre el alta de beneficios con el nombre y el teléfono del comercio.</span>
                </div>

                <FollowUp
                  action={followUpAction}
                  id={request.id}
                  notes={request.notes}
                  assignedTo={request.assignedTo}
                  contactedAt={request.contactedAt}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
});

export default component$(() => {
  const pending = useInboxPendingLoader();
  const { inbox } = pending.value;
  const inboxes: { value: Inbox; label: string; count: number }[] = [
    { value: "comercios", label: "Comercios", count: pending.value.pending.comercios },
    { value: "sugerencias", label: "Sugerencias y reclamos", count: pending.value.pending.sugerencias },
  ];

  return (
    <div class="w-full px-4 sm:px-10 py-8 sm:py-10 space-y-6 pb-24 font-sans text-slate-800 flex flex-col flex-1">
      <SectionHeading as="h1" eyebrow="Administración" title="Solicitudes" size="md">
        <p class="mt-3 max-w-2xl text-sm text-slate-600">
          Las propuestas de comercios de “Sumate al Club” y lo que los socios envían desde “Sugerencias”. Marcá cada una
          cuando la atiendas, anotá quién la sigue y qué se habló.
        </p>
      </SectionHeading>

      <nav aria-label="Bandeja" class="flex flex-wrap gap-x-2 border-b border-slate-200">
        {inboxes.map((item) => (
          <Link
            key={item.value}
            href={`/admin/solicitudes/?bandeja=${item.value}`}
            aria-current={inbox === item.value ? "page" : undefined}
            class={[
              "-mb-px inline-flex min-h-11 items-center gap-2 border-b-4 px-3 sm:px-4 text-sm font-bold uppercase tracking-wide transition-colors",
              inbox === item.value ? "border-accent text-primary" : "border-transparent text-slate-600 hover:text-primary",
            ]}
          >
            {item.label}
            {item.count > 0 && (
              <span class="badge badge-dark">{item.count}<span class="sr-only"> pendientes</span></span>
            )}
          </Link>
        ))}
      </nav>

      {inbox === "sugerencias" ? <SuggestionsInbox /> : <MerchantRequestsInbox />}
    </div>
  );
});

export const head: DocumentHead = {
  title: "Solicitudes - Panel de Administración LPRC",
};
