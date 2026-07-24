import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";

interface RaffleCountdownProps {
  /** Fecha del sorteo en formato YYYY-MM-DD. Se cuenta regresiva hasta las 00:00 de ese día. */
  drawDate: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Cuenta regresiva en vivo (días/horas/minutos/segundos) hasta la fecha del
 * sorteo. Corre solo en el cliente (depende de "ahora") para evitar
 * desajustes entre el render del servidor y el navegador.
 */
export const RaffleCountdown = component$<RaffleCountdownProps>(({ drawDate }) => {
  const timeLeft = useSignal<TimeLeft | null>(null);
  const isPast = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const target = new Date(`${drawDate}T00:00:00`).getTime();

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        isPast.value = true;
        return;
      }
      timeLeft.value = {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff / 3600000) % 24),
        minutes: Math.floor((diff / 60000) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      };
    };

    tick();
    const interval = setInterval(tick, 1000);
    cleanup(() => clearInterval(interval));
  });

  if (isPast.value) {
    return (
      <span class="text-xs sm:text-sm font-black uppercase tracking-wider text-brand-gold">
        ¡Sorteando muy pronto!
      </span>
    );
  }

  // Placeholder mientras hidrata en el cliente: mismo alto, sin mostrar 00:00:00:00.
  if (!timeLeft.value) {
    return <div class="h-[46px] sm:h-[52px]" />;
  }

  const units: { value: number; label: string }[] = [
    { value: timeLeft.value.days, label: "días" },
    { value: timeLeft.value.hours, label: "hs" },
    { value: timeLeft.value.minutes, label: "min" },
    { value: timeLeft.value.seconds, label: "seg" },
  ];

  return (
    <div class="flex items-center gap-1.5 sm:gap-2">
      {units.map((u, i) => (
        <div
          key={i}
          class="flex flex-col items-center justify-center bg-white/10 border border-white/15 rounded-lg sm:rounded-xl w-11 sm:w-13 py-1 sm:py-1.5"
        >
          <span class="text-sm sm:text-lg font-black font-mono leading-none tabular-nums text-white">
            {String(u.value).padStart(2, "0")}
          </span>
          <span class="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider text-brand-gold mt-0.5">
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
});
