import { component$ } from "@builder.io/qwik";
import { Form, Link, routeAction$, routeLoader$, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuInbox, LuMail, LuPhone } from "@qwikest/icons/lucide";
import { ActionFeedback } from "~/components/admin/action-feedback";
import {
  countPendingMerchantRequests,
  countPendingSuggestions,
  getMerchantRequestInbox,
  getSuggestionInbox,
  setMerchantRequestStatus,
  setSuggestionStatus,
} from "~/server/club-content";
import {
  MERCHANT_REQUEST_STATUSES,
  formatDateTime,
  isMerchantRequestStatus,
  merchantRequestStatusLabels,
  type MerchantRequestStatus,
} from "~/utils/club-content";
import {
  SUGGESTION_STATUSES,
  isSuggestionStatus,
  suggestionStatusLabels,
  type SuggestionStatus,
} from "~/utils/suggestions";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

type Inbox = "comercios" | "sugerencias";

/** Pending totals for the switcher between the two inboxes. */
export const useInboxPendingLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
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

export const useSuggestionsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
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
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
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

export const useUpdateRequestStatusAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });
    try {
      if (!(await setMerchantRequestStatus(requestEvent, data.id, data.status))) {
        return requestEvent.fail(404, { message: "La solicitud ya no existe o el estado no es válido." });
      }
      const label = merchantRequestStatusLabels[data.status as MerchantRequestStatus];
      return { success: true, message: `“${data.businessName}” quedó como ${label.toLowerCase()}.` };
    } catch (err) {
      console.error("Update merchant request error:", err);
      return requestEvent.fail(500, { message: "No se pudo actualizar la solicitud. Intentá de nuevo." });
    }
  },
  zod$({
    id: z.string(),
    status: z.enum(MERCHANT_REQUEST_STATUSES),
    businessName: z.string(),
  }),
);

export const useUpdateSuggestionStatusAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });
    try {
      if (!(await setSuggestionStatus(requestEvent, data.id, data.status))) {
        return requestEvent.fail(404, { message: "El mensaje ya no existe o el estado no es válido." });
      }
      const label = suggestionStatusLabels[data.status as SuggestionStatus];
      return { success: true, message: `El mensaje de ${data.nombre} quedó como ${label.toLowerCase()}.` };
    } catch (err) {
      console.error("Update suggestion error:", err);
      return requestEvent.fail(500, { message: "No se pudo actualizar el mensaje. Intentá de nuevo." });
    }
  },
  zod$({
    id: z.string(),
    status: z.enum(SUGGESTION_STATUSES),
    nombre: z.string(),
  }),
);

const suggestionTone: Record<SuggestionStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  reviewed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  discarded: "bg-slate-100 text-slate-600 border-slate-200",
};

const suggestionTabs: { value: SuggestionStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "reviewed", label: "Revisadas" },
  { value: "discarded", label: "Descartadas" },
  { value: "all", label: "Todas" },
];

const statusTone: Record<MerchantRequestStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  contacted: "bg-emerald-50 text-emerald-800 border-emerald-200",
  discarded: "bg-slate-100 text-slate-600 border-slate-200",
};

const tabs: { value: MerchantRequestStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "contacted", label: "Contactadas" },
  { value: "discarded", label: "Descartadas" },
  { value: "all", label: "Todas" },
];

const SuggestionsInbox = component$(() => {
  const inbox = useSuggestionsLoader();
  const statusAction = useUpdateSuggestionStatusAction();
  const { status, suggestions, counts } = inbox.value;

  return (
    <>
      <nav aria-label="Filtrar sugerencias por estado" class="flex flex-wrap gap-2">
        {suggestionTabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/solicitudes/?bandeja=sugerencias&estado=${tab.value}`}
            aria-current={status === tab.value ? "page" : undefined}
            class={[
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors",
              status === tab.value
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            ]}
          >
            {tab.label}
            <span class={["rounded-full px-2 text-xs", status === tab.value ? "bg-white/20" : "bg-slate-100"]}>{counts[tab.value]}</span>
          </Link>
        ))}
      </nav>

      <ActionFeedback value={statusAction.value} success={statusAction.value?.message} />
      {"loadError" in inbox.value && (
        <div role="alert" class="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-xs font-bold text-red-700 shadow-sm">
          No se pudieron cargar las sugerencias. Recargá la página.
        </div>
      )}

      {suggestions.length === 0 ? (
        <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-2">
          <LuInbox class="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <p class="font-bold text-slate-700">
            {status === "pending" ? "No hay sugerencias pendientes" : "No hay sugerencias en esta vista"}
          </p>
          <p class="text-sm text-slate-500">Lo que los socios envían desde “Sugerencias” aparece acá.</p>
        </div>
      ) : (
        <ul class="space-y-4">
          {suggestions.map((item) => {
            const current = isSuggestionStatus(item.status) ? item.status : "pending";
            return (
              <li key={item.id} class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div class="min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <h2 class="text-lg font-bold text-slate-800">{item.tipo}</h2>
                      <span class={["rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider", suggestionTone[current]]}>
                        {suggestionStatusLabels[current]}
                      </span>
                    </div>
                    <p class="text-xs text-slate-500">
                      {item.comercio ? `${item.comercio} · ` : ""}Recibido el {formatDateTime(item.createdAt)} hs
                    </p>
                  </div>

                  <Form action={statusAction} class="flex items-center gap-2 shrink-0">
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="nombre" value={item.nombre} />
                    <label for={`suggestion-status-${item.id}`} class="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Estado
                    </label>
                    <select
                      id={`suggestion-status-${item.id}`}
                      name="status"
                      value={current}
                      aria-busy={statusAction.isRunning}
                      onChange$={(_, element) => element.form?.requestSubmit()}
                      class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-bold text-slate-700 focus:border-brand-navy focus:outline-none"
                    >
                      {SUGGESTION_STATUSES.map((option) => (
                        <option key={option} value={option}>{suggestionStatusLabels[option]}</option>
                      ))}
                    </select>
                  </Form>
                </div>

                <p class="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{item.mensaje}</p>

                <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-sm">
                  <span class="font-bold text-slate-700">{item.nombre}</span>
                  <a href={`mailto:${item.email}`} class="inline-flex items-center gap-1.5 font-semibold text-brand-navy hover:underline">
                    <LuMail class="h-4 w-4" aria-hidden="true" />
                    {item.email}
                  </a>
                  {item.telefono && (
                    <a href={`tel:${item.telefono.replace(/[^\d+]/g, "")}`} class="inline-flex items-center gap-1.5 font-semibold text-brand-navy hover:underline">
                      <LuPhone class="h-4 w-4" aria-hidden="true" />
                      {item.telefono}
                    </a>
                  )}
                </div>
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
  const { status, requests, counts } = inbox.value;

  return (
    <>
      <nav aria-label="Filtrar por estado" class="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/solicitudes/?bandeja=comercios&estado=${tab.value}`}
            aria-current={status === tab.value ? "page" : undefined}
            class={[
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors",
              status === tab.value
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            ]}
          >
            {tab.label}
            <span class={["rounded-full px-2 text-xs", status === tab.value ? "bg-white/20" : "bg-slate-100"]}>{counts[tab.value]}</span>
          </Link>
        ))}
      </nav>

      <ActionFeedback value={statusAction.value} success={statusAction.value?.message} />
      {"loadError" in inbox.value && (
        <div role="alert" class="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-xs font-bold text-red-700 shadow-sm">
          No se pudieron cargar las solicitudes. Recargá la página.
        </div>
      )}

      {requests.length === 0 ? (
        <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-2">
          <LuInbox class="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <p class="font-bold text-slate-700">
            {status === "pending" ? "No hay solicitudes pendientes" : "No hay solicitudes en esta vista"}
          </p>
          <p class="text-sm text-slate-500">Las nuevas propuestas de comercios aparecen acá apenas las envían.</p>
        </div>
      ) : (
        <ul class="space-y-4">
          {requests.map((request) => {
            const current = isMerchantRequestStatus(request.status) ? request.status : "pending";
            return (
              <li key={request.id} class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div class="min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <h2 class="text-lg font-bold text-slate-800">{request.businessName}</h2>
                      <span class={["rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider", statusTone[current]]}>
                        {merchantRequestStatusLabels[current]}
                      </span>
                    </div>
                    <p class="text-xs text-slate-500">
                      {request.category} · Recibida el {formatDateTime(request.createdAt)} hs
                    </p>
                  </div>

                  <Form action={statusAction} class="flex items-center gap-2 shrink-0">
                    <input type="hidden" name="id" value={request.id} />
                    <input type="hidden" name="businessName" value={request.businessName} />
                    <label for={`request-status-${request.id}`} class="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Estado
                    </label>
                    <select
                      id={`request-status-${request.id}`}
                      name="status"
                      value={current}
                      aria-busy={statusAction.isRunning}
                      onChange$={(_, element) => element.form?.requestSubmit()}
                      class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base sm:text-sm font-bold text-slate-700 focus:border-brand-navy focus:outline-none"
                    >
                      {MERCHANT_REQUEST_STATUSES.map((option) => (
                        <option key={option} value={option}>{merchantRequestStatusLabels[option]}</option>
                      ))}
                    </select>
                  </Form>
                </div>

                <p class="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{request.proposal}</p>

                <div class="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-sm">
                  <span class="font-bold text-slate-700">{request.contactName}</span>
                  <a href={`mailto:${request.email}`} class="inline-flex items-center gap-1.5 font-semibold text-brand-navy hover:underline">
                    <LuMail class="h-4 w-4" aria-hidden="true" />
                    {request.email}
                  </a>
                  <a href={`tel:${request.phone.replace(/[^\d+]/g, "")}`} class="inline-flex items-center gap-1.5 font-semibold text-brand-navy hover:underline">
                    <LuPhone class="h-4 w-4" aria-hidden="true" />
                    {request.phone}
                  </a>
                </div>
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
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1">
      <div class="border-b border-slate-200 pb-7 space-y-1.5 text-left">
        <div class="flex items-center space-x-2">
          <span class="w-2 h-2 rounded-full bg-brand-navy"></span>
          <span class="text-[11px] font-extrabold tracking-widest text-slate-500 uppercase">Administración / Solicitudes</span>
        </div>
        <h1 class="text-3xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-none">Solicitudes</h1>
        <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
          Las propuestas de comercios de “Sumate al Club” y lo que los socios envían desde “Sugerencias”. Cambiá el estado de cada una para llevar el seguimiento.
        </p>
      </div>

      <nav aria-label="Bandeja" class="flex flex-wrap gap-2 border-b border-slate-200">
        {inboxes.map((item) => (
          <Link
            key={item.value}
            href={`/admin/solicitudes/?bandeja=${item.value}`}
            aria-current={inbox === item.value ? "page" : undefined}
            class={[
              "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition-colors",
              inbox === item.value
                ? "border-brand-navy text-brand-navy-dark"
                : "border-transparent text-slate-500 hover:text-slate-700",
            ]}
          >
            {item.label}
            {item.count > 0 && (
              <span class="rounded-full bg-amber-100 px-2 text-xs text-amber-900">{item.count}<span class="sr-only"> pendientes</span></span>
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
