"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import {
  isVacationAnnouncementEligible,
  markVacationAnnouncementSeen,
} from "@/lib/announcements/vacation-oct-2026";

export function VacationAnnouncement() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isVacationAnnouncementEligible()) return;
    setOpen(true);
  }, []);

  const dismiss = useCallback(() => {
    markVacationAnnouncementSeen();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-5 py-6"
      onClick={dismiss}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vacation-announcement-title"
        className="flex w-max max-w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl bg-black shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="vacation-announcement-title" className="sr-only">
          Vacaciones
        </h2>
        <Image
          src="/promo/publicidad_marce_vacaciones.jpeg"
          alt="Marcelo de vacaciones del 10 al 25 de octubre; la peluquería sigue abierta, atiende Lucas."
          width={853}
          height={1280}
          sizes="(max-width: 448px) 100vw, 384px"
          className="h-auto max-h-[calc(100dvh-9.5rem)] w-auto max-w-[min(24rem,calc(100vw-2.5rem))]"
          priority
        />
        <div className="shrink-0 px-4 pb-4 pt-3">
          <button
            type="button"
            onClick={dismiss}
            className="flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-[#B88E2F] text-[16px] font-semibold text-white shadow-sm transition hover:bg-[#A67D28] active:scale-[0.99]"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
