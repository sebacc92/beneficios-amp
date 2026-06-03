import { component$, useSignal, useTask$, $ } from "@builder.io/qwik";
import { useLocation, Link, server$ } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { coupons } from "~/db/schema";
import { eq } from "drizzle-orm";

interface CouponDetails {
  id: string;
  code: string;
  benefitId: string;
  benefitTitle: string;
  benefitResumen: string;
  userId: string;
  userName: string;
  userMatricula: string | null;
  status: "active" | "used" | "expired";
  createdAt: string;
  usedAt: string | null;
}

export const fetchCouponAction = server$(async function(code: string): Promise<CouponDetails | null> {
  const db = getDB(this);
  const [record] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, code))
    .limit(1);

  if (!record) return null;
  return record as CouponDetails;
});

export const redeemCouponAction = server$(async function(code: string): Promise<{ success: boolean; error?: string }> {
  const db = getDB(this);
  const [record] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, code))
    .limit(1);

  if (!record) {
    return { success: false, error: "El cupón no existe." };
  }

  if (record.status !== "active") {
    return { success: false, error: `El cupón ya ha sido marcado como ${record.status}.` };
  }

  await db
    .update(coupons)
    .set({
      status: "used",
      usedAt: new Date().toISOString(),
    })
    .where(eq(coupons.code, code));

  return { success: true };
});

export default component$(() => {
  const loc = useLocation();
  const codeInput = useSignal(loc.url.searchParams.get("code") || "");
  const currentCoupon = useSignal<CouponDetails | null>(null);
  const searchError = useSignal<string | null>(null);
  const isSearching = useSignal(false);
  const isRedeeming = useSignal(false);
  const redeemSuccess = useSignal(false);

  const searchCoupon = $(async (code: string) => {
    const cleanCode = code.trim().replace(/\s/g, "");
    if (!cleanCode || cleanCode.length < 5) {
      searchError.value = "Por favor ingresá un código válido.";
      currentCoupon.value = null;
      return;
    }

    isSearching.value = true;
    searchError.value = null;
    try {
      const result = await fetchCouponAction(cleanCode);
      if (result) {
        currentCoupon.value = result;
      } else {
        searchError.value = "No se encontró ningún cupón con ese código.";
        currentCoupon.value = null;
      }
    } catch {
      searchError.value = "Ocurrió un error al buscar el cupón.";
      currentCoupon.value = null;
    } finally {
      isSearching.value = false;
    }
  });

  const handleRedeem = $(async () => {
    if (!currentCoupon.value || isRedeeming.value) return;
    isRedeeming.value = true;
    try {
      const res = await redeemCouponAction(currentCoupon.value.code);
      if (res.success) {
        redeemSuccess.value = true;
        // Refresh details
        currentCoupon.value = {
          ...currentCoupon.value,
          status: "used",
          usedAt: new Date().toISOString(),
        };
      } else {
        searchError.value = res.error || "Error al canjear el cupón.";
      }
    } catch {
      searchError.value = "Ocurrió un error al procesar el canje.";
    } finally {
      isRedeeming.value = false;
    }
  });

  // Automatically search if code query param is present
  useTask$(({ track }) => {
    const code = track(() => loc.url.searchParams.get("code"));
    if (code) {
      searchCoupon(code);
    }
  });

  return (
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans flex flex-col justify-between">
      {/* Header Banner */}
      <div class="max-w-md w-full mx-auto space-y-8 flex-grow">
        <div class="text-center">
          <Link href="/" class="inline-block">
            <img
              src="/logo-beneficios_amp2.webp"
              alt="AMP Logo"
              width={160}
              height={60}
              class="h-14 w-auto mx-auto object-contain"
            />
          </Link>
          <h2 class="mt-6 text-3xl font-black text-brand-green-dark tracking-tight leading-tight">
            Validador de Cupones
          </h2>
          <p class="mt-2 text-xs text-slate-500 font-medium">
            Portal exclusivo para comercios adheridos de la AMP+
          </p>
        </div>

        {/* Card Container */}
        <div class="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
          
          {/* Search Box */}
          <div class="space-y-2">
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest block">
              Código de Cupón
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                placeholder="Ej: 123456"
                value={codeInput.value}
                onInput$={(ev) => {
                  codeInput.value = (ev.target as HTMLInputElement).value;
                }}
                class="flex-grow font-mono text-lg font-black tracking-widest text-slate-800 border border-slate-250 py-3 px-4 rounded-2xl shadow-inner focus:outline-none focus:border-brand-green text-center uppercase"
                preventdefault:keydown
                onKeyDown$={(ev) => {
                  if (ev.key === "Enter") {
                    searchCoupon(codeInput.value);
                  }
                }}
              />
              <button
                type="button"
                onClick$={() => searchCoupon(codeInput.value)}
                disabled={isSearching.value}
                class="px-6 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-extrabold uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center disabled:opacity-50"
              >
                {isSearching.value ? (
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Buscar"
                )}
              </button>
            </div>
          </div>

          {searchError.value && (
            <div class="p-4 bg-red-50 border border-red-200 rounded-2xl text-center">
              <p class="text-xs font-bold text-red-700 leading-relaxed">
                {searchError.value}
              </p>
            </div>
          )}

          {/* Coupon Information Details Card */}
          {currentCoupon.value && (
            <div class="space-y-6 animate-fade-in border-t border-slate-100 pt-6">
              
              {/* Badge Status */}
              <div class="text-center">
                {currentCoupon.value.status === "active" ? (
                  <span class="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-250 uppercase tracking-widest">
                    ✓ Cupón Activo / Válido
                  </span>
                ) : (
                  <span class="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black bg-slate-150 text-slate-500 border border-slate-250 uppercase tracking-widest">
                    ✗ Ya Canjeado
                  </span>
                )}
              </div>

              {/* Benefit & Member description */}
              <div class="bg-slate-50 rounded-2xl p-5 border border-slate-150 space-y-4 text-xs font-semibold text-slate-600">
                <div class="border-b border-slate-200/80 pb-3 space-y-1">
                  <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Beneficio</span>
                  <h4 class="text-sm font-black text-slate-800">{currentCoupon.value.benefitTitle}</h4>
                  <p class="text-[11px] font-bold text-brand-gold">{currentCoupon.value.benefitResumen}</p>
                </div>

                <div class="grid grid-cols-2 gap-4 pb-3 border-b border-slate-200/80">
                  <div>
                    <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Médico</span>
                    <span class="text-slate-800 font-bold block mt-0.5">{currentCoupon.value.userName}</span>
                  </div>
                  <div>
                    <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Matrícula</span>
                    <span class="font-mono text-slate-800 font-bold block mt-0.5">{currentCoupon.value.userMatricula || "N/A"}</span>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Generado el</span>
                    <span class="text-slate-800 font-bold block mt-0.5">
                      {new Date(currentCoupon.value.createdAt).toLocaleDateString("es-AR")} {new Date(currentCoupon.value.createdAt).toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {currentCoupon.value.usedAt && (
                    <div>
                      <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Canjeado el</span>
                      <span class="text-slate-800 font-bold block mt-0.5">
                        {new Date(currentCoupon.value.usedAt).toLocaleDateString("es-AR")} {new Date(currentCoupon.value.usedAt).toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action confirm button */}
              {currentCoupon.value.status === "active" && !redeemSuccess.value && (
                <button
                  type="button"
                  onClick$={handleRedeem}
                  disabled={isRedeeming.value}
                  class="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-sm font-extrabold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isRedeeming.value ? (
                    <>
                      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Procesando Canje...</span>
                    </>
                  ) : (
                    <>
                      <svg class="w-5 h-5 text-white stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0" />
                      </svg>
                      <span>Aplicar Descuento / Canjear</span>
                    </>
                  )}
                </button>
              )}

              {/* Redeemed Success Banner */}
              {redeemSuccess.value && (
                <div class="p-5 bg-emerald-50 border border-emerald-250 rounded-2xl text-center space-y-2 animate-toast-up">
                  <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600 font-bold text-lg shadow-inner">
                    ✓
                  </div>
                  <h4 class="text-sm font-black text-emerald-800 uppercase tracking-wide">¡Descuento Canjeado!</h4>
                  <p class="text-xs text-emerald-650 leading-relaxed">
                    El beneficio ha sido registrado y aplicado exitosamente para el médico agremiado.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <div class="mt-8 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest pb-4">
        AMP+ &copy; {new Date().getFullYear()} &middot; Calle 6 Nº 1137/35, La Plata
      </div>
    </div>
  );
});
