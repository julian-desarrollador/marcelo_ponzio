"use client";

import { TrackedLink } from "@/components/analytics/tracked-link";
import { DesignUpdateAnnouncement } from "@/components/announcements/design-update-announcement";
import { VacationAnnouncement } from "@/components/announcements/vacation-announcement";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { BrandLogo } from "@/components/brand-logo";
import { isVacationAnnouncementEligible } from "@/lib/announcements/vacation-oct-2026";
import { HOME_FEATURED_PROMO } from "@/lib/home-featured-promo";
import { HOME_HERO_IMAGE_URL } from "@/lib/home-hero-image";
import { ArrowRight, Percent, Sparkles } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

let hasShownHomeSplash = false;

const SPLASH_MAX_MS = 900;
const SPLASH_MIN_VISIBLE_MS = 360;
const SPLASH_AFTER_LOAD_MS = 90;

function BrandHeading({ size = "home" }: { size?: "splash" | "home" }) {
  const isSplash = size === "splash";

  return (
    <div className="text-center">
      <p className={`home-brand-name ${isSplash ? "home-brand-name--splash" : "home-brand-name--home"}`}>
        <span className="block">Marcelo</span>
        <span className="block">Ponzio</span>
      </p>
      <p className={`home-brand-role ${isSplash ? "home-brand-role--splash" : "home-brand-role--home"}`}>Estilista</p>
      <p className={`home-brand-tagline ${isSplash ? "home-brand-tagline--splash" : "home-brand-tagline--home"}`}>
        Color · Corte · Peinado
      </p>
    </div>
  );
}

function SplashScreen({ onLogoReady }: { onLogoReady: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111111] px-6 text-white">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="inline-flex flex-col items-center gap-3">
          <BrandLogo
            size="splash"
            fetchPriority="high"
            decoding="sync"
            onLoad={onLogoReady}
            onError={onLogoReady}
          />
          <BrandHeading size="splash" />
        </div>
        <p className="mx-auto mt-8 max-w-xs text-sm leading-relaxed text-[var(--soft-gray)]">
          Asesoramiento y técnica profesional para que tu pelo luzca como vos querés.
        </p>
      </div>
    </div>
  );
}

function HomeContent() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#111111] text-white">
      <h1 className="sr-only">Marcelo Ponzio Estilista</h1>

      <div className="fixed top-0 right-0 left-0 z-0 h-[100svh] md:hidden">
        <Image
          src={HOME_HERO_IMAGE_URL}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          quality={85}
          className="object-cover object-[center_35%] grayscale"
          aria-hidden
        />
        <div aria-hidden className="hero-dark-overlay absolute inset-0" />
      </div>

      <div
        aria-hidden
        className="fixed top-0 right-0 left-0 z-0 hidden h-[100svh] bg-[#111111] md:block"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 120% 70% at 50% -15%, rgba(228,202,105,0.14), transparent 52%)",
            "radial-gradient(ellipse 80% 55% at 100% 40%, rgba(206,120,50,0.07), transparent 45%)",
            "radial-gradient(ellipse 60% 50% at 0% 75%, rgba(228,202,105,0.05), transparent 42%)",
            "linear-gradient(to bottom, #151515 0%, #111111 38%, #101010 100%)",
          ].join(","),
        }}
      />

      <main className="relative z-20 mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-5 pt-[max(2.75rem,env(safe-area-inset-top))] pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">
        <header className="flex shrink-0 justify-center">
          <div className="inline-flex flex-col items-center gap-1.5">
            <BrandLogo size="home" fetchPriority="high" />
            <BrandHeading />
          </div>
        </header>

        <div className="mt-[min(13vh,7.25rem)] flex shrink-0 flex-col gap-3.5">
          <TrackedLink
            href={HOME_FEATURED_PROMO.href}
            trackAction="ver_promociones"
            trackLabel="home_destacado"
            className="flex items-center gap-3 rounded-[1.35rem] border border-white/12 bg-black/55 p-4 backdrop-blur-md transition active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.22em] text-[var(--premium-gold)] uppercase">
                {HOME_FEATURED_PROMO.label}
              </p>
              <p className="mt-1.5 font-heading text-[21px] leading-tight text-white">{HOME_FEATURED_PROMO.title}</p>
              <p className="mt-1 text-[13px] leading-snug text-[var(--soft-gray)]">{HOME_FEATURED_PROMO.subtitle}</p>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--premium-gold)]/15 ring-1 ring-[var(--premium-gold)]/40">
              <ArrowRight className="h-5 w-5 text-[var(--premium-gold)]" strokeWidth={2.25} />
            </span>
          </TrackedLink>

          <div className="grid grid-cols-2 gap-3">
            <TrackedLink
              href="/tratamientos"
              trackAction="ver_tratamientos"
              trackLabel="home"
              className="flex min-h-[5.75rem] flex-col items-center justify-center gap-2.5 rounded-[1.35rem] border border-white/12 bg-black/55 px-3 py-5 backdrop-blur-md transition active:scale-[0.99]"
            >
              <Sparkles className="h-7 w-7 text-[var(--premium-gold)]" strokeWidth={1.75} />
              <span className="text-[15px] font-medium text-white">Tratamientos</span>
            </TrackedLink>
            <TrackedLink
              href="/promociones"
              trackAction="ver_promociones"
              trackLabel="home"
              className="flex min-h-[5.75rem] flex-col items-center justify-center gap-2.5 rounded-[1.35rem] border border-white/12 bg-black/55 px-3 py-5 backdrop-blur-md transition active:scale-[0.99]"
            >
              <Percent className="h-7 w-7 text-[var(--premium-gold)]" strokeWidth={1.75} />
              <span className="text-[15px] font-medium text-white">Promociones</span>
            </TrackedLink>
          </div>

          <TrackedLink
            href="/turnos"
            trackAction="reservar_turno"
            trackLabel="home"
            className="home-cta-reservar mt-3"
          >
            Reservar turno
          </TrackedLink>
        </div>
      </main>

      <AppBottomNav />
    </div>
  );
}

export default function Home() {
  const [showSplash, setShowSplash] = useState(!hasShownHomeSplash);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(false);
  const openedAtRef = useRef(0);

  const dismissSplash = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (maxTimerRef.current !== null) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    hasShownHomeSplash = true;
    setShowSplash(false);
  }, []);

  useLayoutEffect(() => {
    if (hasShownHomeSplash || !showSplash) return;
    openedAtRef.current = Date.now();
  }, [showSplash]);

  useEffect(() => {
    if (hasShownHomeSplash) {
      setShowSplash(false);
      return;
    }
    if (!showSplash) return;
    maxTimerRef.current = setTimeout(dismissSplash, SPLASH_MAX_MS);
    return () => {
      if (maxTimerRef.current !== null) {
        clearTimeout(maxTimerRef.current);
        maxTimerRef.current = null;
      }
    };
  }, [showSplash, dismissSplash]);

  const handleSplashReady = useCallback(() => {
    const elapsed = Date.now() - openedAtRef.current;
    const wait = Math.max(SPLASH_AFTER_LOAD_MS, SPLASH_MIN_VISIBLE_MS - elapsed);
    window.setTimeout(dismissSplash, wait);
  }, [dismissSplash]);

  if (showSplash) {
    return <SplashScreen onLogoReady={handleSplashReady} />;
  }

  return (
    <>
      <HomeContent />
      <HomeAnnouncements />
    </>
  );
}

function HomeAnnouncements() {
  const [showVacation, setShowVacation] = useState<boolean | null>(null);

  useEffect(() => {
    setShowVacation(isVacationAnnouncementEligible());
  }, []);

  if (showVacation === null) return null;
  if (showVacation) return <VacationAnnouncement />;
  return <DesignUpdateAnnouncement scope="/" />;
}
