import { component$, useSignal, useVisibleTask$, type Signal } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import { and, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { benefits, coupons } from "~/db/schema";
import { getSessionUser } from "~/server/auth";
import { isCouponBenefitAvailable } from "~/server/coupons";

export type CouponStatus = "active" | "used" | "expired";

/** Current status of one of the signed-in member's coupons (null when it is not theirs). */
export const fetchCouponStatus = server$(async function (couponId: string): Promise<CouponStatus | null> {
  const user = getSessionUser(this);
  if (!user) return null;
  const [record] = await getDB(this)
    .select({ status: coupons.status, validUntil: benefits.validUntil, benefitId: benefits.id })
    .from(coupons)
    .leftJoin(benefits, eq(benefits.id, coupons.benefitId))
    .where(and(eq(coupons.id, couponId), eq(coupons.userId, user.id)))
    .limit(1);
  if (!record) return null;
  const available = record.benefitId !== null && isCouponBenefitAvailable({ validUntil: record.validUntil });
  return record.status === "active" && !available ? "expired" : record.status;
});

/**
 * While an active coupon is on screen: keeps the screen on (so it does not lock while the
 * cashier scans it) and re-checks its status, so a redeemed coupon flips without a reload.
 */
export const CouponLiveStatus = component$<{ couponId: string; status: Signal<CouponStatus> }>(({ couponId, status }) => {
  const announcement = useSignal("");

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    const current = track(() => status.value);
    if (current !== "active") return;

    type WakeLockSentinelLike = { release: () => Promise<void> };
    const wakeLockApi = (navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    }).wakeLock;
    let sentinel: WakeLockSentinelLike | null = null;
    let stopped = false;

    const keepAwake = async () => {
      if (!wakeLockApi || document.visibilityState !== "visible") return;
      try {
        sentinel = await wakeLockApi.request("screen");
        if (stopped) await sentinel.release();
      } catch {
        // Battery saver or an unsupported browser: the coupon still works.
      }
    };
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await fetchCouponStatus(couponId);
        if (next && next !== status.value) {
          status.value = next;
          announcement.value = next === "used" ? "El cupón fue canjeado." : "El cupón ya no está vigente.";
        }
      } catch {
        // Offline: keep showing the coupon as it was.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void keepAwake();
        void refresh();
      }
    };

    void keepAwake();
    const timer = setInterval(refresh, 20_000);
    document.addEventListener("visibilitychange", onVisibility);
    cleanup(() => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
    });
  });

  return (
    <p class="sr-only" role="status" aria-live="polite">
      {announcement.value}
    </p>
  );
});

/** Copies the coupon code, falling back to a selection when the clipboard API is blocked. */
export const CopyCodeButton = component$<{ code: string; label?: string; class?: string }>((props) => {
  const feedback = useSignal("");
  return (
    <span class="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick$={async () => {
          try {
            await navigator.clipboard.writeText(props.code);
          } catch {
            const field = document.createElement("textarea");
            field.value = props.code;
            field.setAttribute("readonly", "");
            field.style.position = "fixed";
            field.style.opacity = "0";
            document.body.appendChild(field);
            field.select();
            document.execCommand("copy");
            field.remove();
          }
          feedback.value = "Código copiado";
          setTimeout(() => (feedback.value = ""), 2500);
        }}
        class={props.class ?? "min-h-11 rounded-xl border border-current/30 px-4 py-2 text-sm font-bold hover:bg-white/10 cursor-pointer"}
      >
        {props.label ?? "Copiar código"}
      </button>
      <span role="status" aria-live="polite" class="text-xs font-bold min-h-4">
        {feedback.value}
      </span>
    </span>
  );
});
