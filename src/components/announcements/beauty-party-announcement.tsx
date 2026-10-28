"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import {
  hasSeenBeautyPartyAnnouncement,
  markBeautyPartyAnnouncementSeen,
} from "@/lib/announcements/beauty-party";

export function BeautyPartyAnnouncement() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasSeenBeautyPartyAnnouncement()) return;
    setOpen(true);
  }, []);

  const dismiss = useCallback(() => {
    markBeautyPartyAnnouncementSeen();
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
        aria-labelledby="beauty-party-announcement-title"
        className="flex w-max max-w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl bg-black shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="beauty-party-announcement-title" className="sr-only">
          Beauty Party
        </h2>
        <Image
          src="/beauty_party.jpeg"
          alt="Beauty Party: maquillaje profesional y peinado de fiesta, $160.000."
          width={1024}
          height={1536}
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
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
