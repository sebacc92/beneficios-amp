import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";

/**
 * Members enter with their DNI and have no password, and administrators can only change
 * their own password once logged in. This page explains that instead of faking an email.
 */
export default component$(() => {
  return (
    <div class="bg-slate-50 min-h-[80vh] py-16 px-4 flex flex-col justify-center items-center font-sans">
      <div class="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm space-y-8 animate-fade-in-up">
        <div class="text-center space-y-2">
          <h1 class="text-3xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-none">
            ¿No podés ingresar?
          </h1>
          <p class="text-sm text-slate-600 font-medium">
            Los socios no usan contraseña: ingresan con su DNI.
          </p>
        </div>

        <div class="space-y-4 text-left">
          <section class="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
            <h2 class="text-sm font-bold text-slate-800">Si sos socio</h2>
            <p class="text-sm text-slate-600 leading-relaxed">
              Entrá con tu DNI, con o sin puntos. Si el portal no lo reconoce, comunicate con la secretaría del club al{" "}
              <a href="tel:+542214895777" class="font-bold text-brand-navy hover:underline">(0221) 489-5777</a>.
            </p>
            <Link
              href="/login/"
              class="w-full flex items-center justify-center py-3.5 px-6 rounded-2xl bg-brand-navy hover:bg-brand-navy-light text-white text-sm font-bold shadow-md transition-all duration-300"
            >
              Ingresar con mi DNI
            </Link>
          </section>

          <section class="rounded-2xl border border-slate-200 p-5 space-y-2">
            <h2 class="text-sm font-bold text-slate-800">Si administrás el portal</h2>
            <p class="text-sm text-slate-600 leading-relaxed">
              No enviamos enlaces de recuperación por correo. Si no recordás tu contraseña, pedile al equipo técnico del portal que la restablezca. Una vez adentro, la podés cambiar desde “Administradores”.
            </p>
            <Link href="/admin/login/" class="inline-block text-sm font-bold text-brand-navy hover:underline">
              Ir al ingreso de administradores
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Recuperar Contraseña - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content: "Cómo ingresar al Club de Beneficios de La Plata Rugby Club: los socios entran con su DNI.",
    },
  ],
};
