import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, server$, type DocumentHead } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { coupons, customBenefits } from "~/db/schema";
import { getMerchant, MERCHANT_COOKIE } from "~/server/merchant-auth";
import { validateMember, type MemberValidationResult } from "~/server/membership";

interface PanelBenefit {
  id: string;
  titulo: string;
  resumen: string;
  slug: string;
}

// --- Guard: solo locales logueados. Resuelve el beneficio (local) por slug. ---
export const usePanel = routeLoader$(async (event) => {
  const m = await getMerchant(event);
  if (!m) throw event.redirect(302, "/comercios");
  const db = getDB(event);
  const [b] = await db.select().from(customBenefits).where(eq(customBenefits.slug, m.benefitSlug)).limit(1);
  const benefit: PanelBenefit | null = b
    ? { id: b.id, titulo: b.titulo, resumen: b.resumen, slug: b.slug }
    : null;
  return { username: m.username, benefit };
});

export const useLogout = routeAction$(async (_data, event) => {
  event.cookie.delete(MERCHANT_COOKIE, { path: "/" });
  throw event.redirect(302, "/comercios");
});

async function generateUniqueCode(db: any): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const [dup] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
    if (!dup) return code;
  }
  return "U" + Date.now().toString().slice(-7);
}

// --- Validación del agremiado por matrícula/DNI ---
export const validateMemberServer = server$(async function(query: string): Promise<MemberValidationResult> {
  const merchant = await getMerchant(this);
  if (!merchant) return { valid: false, member: null, reason: "Sesión expirada." };
  return validateMember(this, query);
});

// --- Registrar el uso: crea un cupón "usado" para el beneficio del local ---
export const registerUsageServer = server$(async function(payload: {
  memberId: string | null;
  memberName: string;
  memberMatricula: string | null;
}): Promise<{ success: boolean; error?: string; code?: string }> {
  const merchant = await getMerchant(this);
  if (!merchant) return { success: false, error: "Sesión expirada." };
  const db = getDB(this);
  const [b] = await db.select().from(customBenefits).where(eq(customBenefits.slug, merchant.benefitSlug)).limit(1);
  if (!b) return { success: false, error: "El beneficio asociado a este local no está disponible." };

  try {
    const code = await generateUniqueCode(db);
    const now = new Date().toISOString();
    await db.insert(coupons).values({
      id: crypto.randomUUID(),
      code,
      benefitId: b.id,
      benefitTitle: b.titulo,
      benefitResumen: b.resumen,
      userId: payload.memberId || "externo",
      userName: payload.memberName,
      userMatricula: payload.memberMatricula,
      status: "used",
      createdAt: now,
      usedAt: now,
    });
    return { success: true, code };
  } catch (err) {
    console.error("Error registrando uso:", err);
    return { success: false, error: "No se pudo registrar el uso. Intentá de nuevo." };
  }
});

export default component$(() => {
  const panel = usePanel();
  const logout = useLogout();

  const memberQuery = useSignal("");
  const memberResult = useSignal<MemberValidationResult | null>(null);
  const memberError = useSignal<string | null>(null);
  const isValidating = useSignal(false);
  const isRegistering = useSignal(false);
  const usageSuccess = useSignal(false);
  const registeredCode = useSignal<string | null>(null);

  const validateMemberQuery = $(async () => {
    const q = memberQuery.value.trim();
    memberError.value = null;
    memberResult.value = null;
    usageSuccess.value = false;
    if (q.length < 4) {
      memberError.value = "Ingresá una matrícula o DNI válido.";
      return;
    }
    isValidating.value = true;
    try {
      const res = await validateMemberServer(q);
      memberResult.value = res;
      if (!res.valid) memberError.value = res.reason || "Agremiado no válido.";
    } catch {
      memberError.value = "Ocurrió un error al validar.";
    } finally {
      isValidating.value = false;
    }
  });

  const handleRegister = $(async () => {
    const res = memberResult.value;
    if (!res?.valid || !res.member || isRegistering.value) return;
    isRegistering.value = true;
    try {
      const r = await registerUsageServer({
        memberId: res.member.id,
        memberName: res.member.name,
        memberMatricula: res.member.matricula ?? res.member.dni,
      });
      if (r.success) {
        usageSuccess.value = true;
        registeredCode.value = r.code ?? null;
      } else {
        memberError.value = r.error || "No se pudo registrar el uso.";
      }
    } catch {
      memberError.value = "Ocurrió un error al registrar el uso.";
    } finally {
      isRegistering.value = false;
    }
  });

  const reset = $(() => {
    memberQuery.value = "";
    memberResult.value = null;
    memberError.value = null;
    usageSuccess.value = false;
    registeredCode.value = null;
  });

  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-sans">
      {/* Top bar */}
      <header class="bg-white border-b border-slate-200 shadow-sm">
        <div class="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div class="min-w-0">
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none">Local</span>
            <span class="text-sm font-extrabold text-slate-800 truncate block">
              {panel.value.benefit?.titulo || panel.value.username}
            </span>
          </div>
          <Form action={logout}>
            <button type="submit" class="px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all">
              Salir
            </button>
          </Form>
        </div>
      </header>

      <main class="max-w-md w-full mx-auto px-4 py-10 space-y-6">
        <div class="text-center">
          <h1 class="text-2xl font-black text-brand-green-dark tracking-tight">Registrar Beneficio</h1>
          <p class="text-xs text-slate-500 font-medium mt-1">
            Validá al agremiado por matrícula o DNI y registrá el uso del descuento.
          </p>
        </div>

        {!panel.value.benefit && (
          <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center">
            <p class="text-xs font-bold text-amber-700">
              Este local todavía no tiene un beneficio asociado. Contactá a la AMP+.
            </p>
          </div>
        )}

        <div class="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
          {/* Benefit context */}
          {panel.value.benefit && (
            <div class="bg-slate-50 rounded-2xl p-4 border border-slate-150 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Beneficio del local</span>
                <span class="text-sm font-black text-slate-800 truncate block">{panel.value.benefit.titulo}</span>
              </div>
              <span class="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-black bg-brand-gold text-brand-green-dark shadow-sm whitespace-nowrap">
                {panel.value.benefit.resumen}
              </span>
            </div>
          )}

          {/* Input matrícula/DNI */}
          <div class="space-y-2">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest block">
              Matrícula o DNI del agremiado
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                placeholder="Ej: 93914485"
                value={memberQuery.value}
                onInput$={(ev) => { memberQuery.value = (ev.target as HTMLInputElement).value; }}
                onKeyDown$={(ev) => {
                  if (ev.key === "Enter") {
                    ev.preventDefault();
                    validateMemberQuery();
                  }
                }}
                class="flex-grow min-w-0 font-mono text-lg font-black tracking-widest text-slate-800 border border-slate-250 py-3 px-4 rounded-2xl shadow-inner focus:outline-none focus:border-brand-green text-center"
              />
              <button
                type="button"
                onClick$={validateMemberQuery}
                disabled={isValidating.value}
                class="px-6 py-3 rounded-2xl border-2 border-brand-green text-brand-green hover:bg-brand-green/5 text-xs font-extrabold uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center disabled:opacity-50"
              >
                {isValidating.value ? <div class="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" /> : "Validar"}
              </button>
            </div>
          </div>

          {memberError.value && (
            <div class="p-4 bg-red-50 border border-red-200 rounded-2xl text-center">
              <p class="text-xs font-bold text-red-700 leading-relaxed">{memberError.value}</p>
            </div>
          )}

          {memberResult.value?.valid && memberResult.value.member && (
            <div class="space-y-6 animate-fade-in border-t border-slate-100 pt-6">
              <div class="text-center">
                <span class="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-250 uppercase tracking-widest">
                  ✓ Agremiado Válido
                </span>
              </div>
              <div class="bg-slate-50 rounded-2xl p-5 border border-slate-150 space-y-4 text-xs font-semibold text-slate-600">
                <div class="border-b border-slate-200/80 pb-3">
                  <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Agremiado</span>
                  <h4 class="text-sm font-black text-slate-800 mt-0.5">{memberResult.value.member.name}</h4>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Matrícula / DNI</span>
                    <span class="font-mono text-slate-800 font-bold block mt-0.5">{memberResult.value.member.matricula || "N/A"}</span>
                  </div>
                  <div>
                    <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Tipo</span>
                    <span class="text-slate-800 font-bold block mt-0.5 capitalize">{memberResult.value.member.tipo}</span>
                  </div>
                  <div>
                    <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Estado</span>
                    <span class="text-emerald-700 font-bold block mt-0.5 capitalize">{memberResult.value.member.estado}</span>
                  </div>
                  <div>
                    <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Beneficio</span>
                    <span class="text-brand-gold font-bold block mt-0.5">{panel.value.benefit?.resumen || "—"}</span>
                  </div>
                </div>
              </div>

              {!usageSuccess.value ? (
                <button
                  type="button"
                  onClick$={handleRegister}
                  disabled={isRegistering.value || !panel.value.benefit}
                  class="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-sm font-extrabold uppercase tracking-wider transition-all shadow-lg shadow-brand-green/25 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isRegistering.value ? (
                    <>
                      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Registrando...</span>
                    </>
                  ) : (
                    <>
                      <svg class="w-5 h-5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0" />
                      </svg>
                      <span>Registrar uso del descuento</span>
                    </>
                  )}
                </button>
              ) : (
                <div class="space-y-4 animate-fade-in">
                  <div class="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                    <div class="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600 mb-3 shadow-inner">
                      <svg class="w-6 h-6 stroke-current fill-none stroke-[2.5]" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h4 class="text-base font-black text-emerald-800 tracking-wide">¡Uso registrado!</h4>
                    <p class="text-xs text-emerald-700 leading-relaxed mt-1">
                      Descuento aplicado para <span class="font-bold">{memberResult.value.member.name}</span>.
                    </p>
                    {registeredCode.value && (
                      <div class="mt-4 pt-4 border-t border-emerald-200/70">
                        <span class="text-[10px] font-extrabold text-emerald-600/80 uppercase tracking-widest block">Comprobante</span>
                        <span class="font-mono text-2xl font-black text-emerald-800 tracking-[0.2em] block mt-1">{registeredCode.value}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick$={reset}
                    class="w-full px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold uppercase tracking-wider transition-all active:scale-95"
                  >
                    Registrar otro agremiado
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Panel del Local | AMP+",
};
