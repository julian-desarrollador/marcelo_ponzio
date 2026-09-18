"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";

import { TrackedLink } from "@/components/analytics/tracked-link";
import { AppBottomNav } from "@/components/app-bottom-nav";
import { LightPageHeader } from "@/components/light-page-header";
import { EXPERIENCE_PACKAGES_ENABLED } from "@/lib/treatments/experience-packages";

const EXPERIENCE_PROMOS = [
  {
    id: "vacaciones-octubre",
    title: "Vacaciones",
    alt: "Marcelo de vacaciones del 10 al 25 de octubre; la peluquería sigue abierta, atiende Lucas.",
    imageSrc: "/promo/publicidad_marce_vacaciones.jpeg",
    width: 853,
    height: 1280,
    href: "/turnos",
    cta: "Reservar turno",
  },
  {
    id: "mp-experiences",
    title: "MP Experiences",
    alt: "MP Experiences: una experiencia pensada para cada cabello. Productos premium, técnicas personalizadas, resultados naturales.",
    imageSrc: "/promo/mp_experiences.jpeg",
    width: 971,
    height: 1280,
    href: "/turnos",
    cta: "Reservar turno",
  },
  {
    id: "color",
    title: "Color Experience",
    alt: "Color Experience: Essential, Signature y Premium. Elegí la experiencia que mejor va con vos.",
    imageSrc: "/promo/color.jpeg",
    width: 853,
    height: 1280,
    href: EXPERIENCE_PACKAGES_ENABLED ? "/turnos?promo=color" : "/turnos?treatment=color",
    cta: "Reservar Color Experience",
  },
  {
    id: "balayage",
    title: "Balayage Experience",
    alt: "Balayage Experience: Essential, Signature y Premium. Luz, dimensión y cuidado en cada detalle.",
    imageSrc: "/promo/balayage.jpeg",
    width: 853,
    height: 1280,
    href: EXPERIENCE_PACKAGES_ENABLED ? "/turnos?promo=balayage" : "/turnos?treatment=balayage",
    cta: "Reservar Balayage Experience",
  },
] as const;

export function PromocionesClient() {
  const searchParams = useSearchParams();
  const fromPerfil = searchParams.get("from") === "perfil";

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="mx-auto w-full max-w-md px-5 pt-10 pb-28">
        <LightPageHeader
          title="Promociones"
          subtitle="MP Experiences, Color y Balayage"
          backHref={fromPerfil ? "/perfil" : undefined}
          backLabel="Volver al perfil"
        />

        <section className="space-y-6">
          {EXPERIENCE_PROMOS.map((promo) => (
            <article
              key={promo.id}
              className="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
            >
              <Image
                src={promo.imageSrc}
                alt={promo.alt}
                width={promo.width}
                height={promo.height}
                sizes="(max-width: 448px) 100vw, 448px"
                className="h-auto w-full"
              />
              <div className="p-4">
                <TrackedLink
                  href={promo.href}
                  trackAction="reservar_turno"
                  trackLabel={`promociones_${promo.id}`}
                  className="flex h-11 w-full items-center justify-center rounded-full bg-[#B88E2F] text-[15px] font-semibold text-white shadow-md transition active:scale-[0.98]"
                >
                  {promo.cta}
                </TrackedLink>
              </div>
            </article>
          ))}
        </section>
      </main>

      <AppBottomNav />
    </div>
  );
}
