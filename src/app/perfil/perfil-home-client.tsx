"use client";

import { CalendarDays, Check, ChevronRight, Clock3, Percent, Phone, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { TrackedLink } from "@/components/analytics/tracked-link";
import { usePerfilSession } from "@/components/perfil/perfil-session-provider";
import { isLikelyWhatsappNumber } from "@/lib/booking/salon-availability";
import { GA_EVENT_CUSTOMER_SESSION_START, trackEvent, trackPerfilMenuClick } from "@/lib/gtag";
import { isUpcomingReservation } from "@/lib/reservations/customer-public-serialize";

type MenuItem = {
  href: string;
  title: string;
  subtitle: string;
  Icon: typeof CalendarDays;
  /** Etiqueta GA4 (`event_label`) para `perfil_menu_click`. */
  trackLabel: string;
  badge?: string;
  disabled?: boolean;
};

export function PerfilHomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me, welcomeName, reservations, logout, onLoginSuccess } = usePerfilSession();

  const [phoneInput, setPhoneInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(() => searchParams.get("saved") === "1");

  useEffect(() => {
    if (searchParams.get("saved") !== "1") return;
    setSavedToast(true);
    router.replace("/perfil", { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (!savedToast) return;
    const t = window.setTimeout(() => setSavedToast(false), 3500);
    return () => window.clearTimeout(t);
  }, [savedToast]);

  const upcoming = useMemo(
    () =>
      (reservations ?? [])
        .filter((r) => isUpcomingReservation(r))
        .sort((a, b) => a.startsAtIso.localeCompare(b.startsAtIso)),
    [reservations],
  );
  const nextAppointment = upcoming[0] ?? null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isLikelyWhatsappNumber(phoneInput)) {
      setError("Ingresá un WhatsApp válido (10 a 15 dígitos).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/me/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ phone: phoneInput.trim(), source: "perfil" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo iniciar sesión.");
        return;
      }
      trackEvent({
        action: GA_EVENT_CUSTOMER_SESSION_START,
        category: "auth",
        label: "perfil",
      });
      setPhoneInput("");
      await onLoginSuccess();
    } catch {
      setError("Sin conexión. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  }

  const menuItems: MenuItem[] = [
    {
      href: "/perfil/mis-datos",
      title: "Mis datos",
      subtitle: "Nombre y WhatsApp",
      trackLabel: "mis_datos",
      Icon: User,
    },
    {
      href: "/perfil/mis-turnos",
      title: "Mis turnos",
      subtitle: "Ver, cambiar o cancelar",
      trackLabel: "mis_turnos",
      Icon: CalendarDays,
      badge: me === "authed" ? String(upcoming.length) : undefined,
    },
    {
      href: "/perfil/historial-tratamientos",
      title: "Historial",
      subtitle: "Sesiones realizadas",
      trackLabel: "historial",
      Icon: Clock3,
    },
    {
      href: "/tratamientos?from=perfil",
      title: "Servicios",
      subtitle: "Catálogo completo",
      trackLabel: "servicios",
      Icon: Sparkles,
    },
    {
      href: "/promociones?from=perfil",
      title: "Promociones",
      subtitle: "Beneficios del mes",
      trackLabel: "promociones",
      Icon: Percent,
    },
    {
      href: "/contacto",
      title: "Contacto",
      subtitle: "WhatsApp, ubicación e Instagram",
      trackLabel: "contacto",
      Icon: Phone,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-10 pb-28">
      {savedToast ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-5">
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[16px] font-medium text-emerald-900 shadow-lg"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </span>
            Datos actualizados.
          </div>
        </div>
      ) : null}
      <header className="mb-6">
        <h1 className="font-heading text-5xl font-bold tracking-tight text-gray-900">Mi perfil</h1>
        {me === "authed" ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xl text-gray-700">
              Hola, <span className="font-semibold text-gray-900">{welcomeName ?? "bienvenido/a"}</span>
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleLogout()}
              className="cursor-pointer text-[15px] text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline disabled:opacity-50"
            >
              Cerrar sesión
            </button>
          </div>
        ) : me === "guest" ? (
          <p className="mt-2 text-lg text-gray-600">Accedé con tu WhatsApp para ver tus turnos.</p>
        ) : (
          <p className="mt-2 text-lg text-gray-400">Comprobando sesión…</p>
        )}
      </header>

      {me === "guest" ? (
        <section
          id="acceso"
          className="mb-6 rounded-[24px] border border-gray-100 bg-[#F5F5F5] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
        >
          <p className="text-sm font-semibold tracking-wide text-[#B88E2F] uppercase">Acceso rápido</p>
          <p className="mt-2 text-[16px] text-gray-700">Usá el mismo WhatsApp que al reservar en la web o en el salón.</p>
          <form onSubmit={(e) => void handleLogin(e)} className="mt-4 space-y-4">
            <div>
              <label htmlFor="perfil-phone" className="text-[16px] font-semibold text-gray-900">
                WhatsApp
              </label>
              <input
                id="perfil-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="Ej: +54 9 11 2345-6789"
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-[16px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#B88E2F] focus:ring-2 focus:ring-[#B88E2F]/25"
              />
            </div>
            {error ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[16px] text-red-800">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-[#B88E2F] text-[16px] font-semibold text-white shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Ingresando…" : "Ver mis turnos"}
            </button>
          </form>
        </section>
      ) : null}

      {me === "authed" ? (
        <>
          <TrackedLink
            href="/turnos"
            trackAction="reservar_turno"
            trackLabel="perfil"
            className="mb-4 flex h-14 w-full items-center justify-center rounded-full bg-[#B88E2F] text-lg font-semibold text-white shadow-lg transition active:scale-[0.98]"
          >
            Reservar nuevo turno
          </TrackedLink>

          {nextAppointment ? (
            <Link
              href="/perfil/mis-turnos"
              onClick={() => trackPerfilMenuClick("proximo_turno")}
              className="mb-6 block rounded-[24px] border border-[#B88E2F]/30 bg-[#B88E2F]/8 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition hover:border-[#B88E2F]/50"
            >
              <p className="text-sm font-semibold text-[#B88E2F] uppercase tracking-wide">Próximo turno</p>
              <p className="mt-2 text-xl font-semibold text-gray-900">{nextAppointment.treatmentName}</p>
              <p className="mt-1 text-[16px] text-gray-600">
                {nextAppointment.displayDate} · {nextAppointment.timeLocal} hs
              </p>
              <p className="mt-3 text-[15px] font-medium text-[#B88E2F]">Ver detalle →</p>
            </Link>
          ) : (
            <p className="mb-6 rounded-[24px] border border-gray-100 bg-white px-5 py-4 text-[16px] text-gray-600 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
              No tenés turnos próximos. Reservá cuando quieras.
            </p>
          )}
        </>
      ) : null}

      <section className="space-y-3">
        <p className="text-sm font-semibold tracking-wide text-gray-500 uppercase">Menú</p>
        {menuItems.map(({ href, title, subtitle, Icon, badge, disabled, trackLabel }) =>
          disabled ? (
            <div
              key={title}
              className="flex items-center justify-between rounded-[24px] border border-gray-100 bg-gray-50 px-5 py-4 opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Icon className="h-6 w-6 text-gray-400" strokeWidth={1.6} />
                </div>
                <div>
                  <p className="text-[17px] font-semibold text-gray-700">{title}</p>
                  <p className="text-[15px] text-gray-400">{subtitle}</p>
                </div>
              </div>
            </div>
          ) : (
            <Link
              key={href}
              href={href}
              onClick={() => trackPerfilMenuClick(trackLabel)}
              className="flex cursor-pointer items-center justify-between rounded-[24px] border border-gray-50 bg-white px-5 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition active:scale-[0.99] hover:border-[#B88E2F]/25"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F5F5]">
                  <Icon className="h-6 w-6 text-[#B88E2F]" strokeWidth={1.6} />
                </div>
                <div>
                  <p className="text-[17px] font-semibold text-gray-900">{title}</p>
                  <p className="text-[15px] text-gray-500">{subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {badge !== undefined && Number(badge) > 0 ? (
                  <span className="rounded-full bg-[#B88E2F] px-2.5 py-0.5 text-[13px] font-semibold text-white">
                    {badge}
                  </span>
                ) : null}
                <ChevronRight className="h-5 w-5 text-gray-300" strokeWidth={2} />
              </div>
            </Link>
          ),
        )}
      </section>
    </main>
  );
}
