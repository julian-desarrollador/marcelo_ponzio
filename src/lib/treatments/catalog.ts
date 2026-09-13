import { isOfferedTreatmentId } from "@/lib/treatments/experience-packages";

/** Categorías para filtrar en la app de turnos y en la lista de servicios. */
export const TREATMENT_CATEGORIES = ["Cortes y peinado", "Color", "Tratamiento"] as const;

export type TreatmentCategory = (typeof TREATMENT_CATEGORIES)[number];

// La madrecita

const IMG = {
  corte: "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=80",
  peinado: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80",
  color: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=80",
  mechas: "https://images.unsplash.com/photo-1633681926022-84c122e8b9d3?auto=format&fit=crop&w=900&q=80",
  salon: "https://images.unsplash.com/photo-1560066987-138a9a6e6fd4?auto=format&fit=crop&w=900&q=80",
  trat: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=900&q=80",
} as const;

export type SalonTreatment = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  category: TreatmentCategory;
  durationLabel: string;
  durationMinutes: number;
  imageUrl: string;
  /** Precio de lista (flyer). La seña de Mercado Pago es aparte. */
  priceLabel?: string;
  badge?: string;
  experienceFamily?: "color-experience" | "balayage-experience";
};

/** Servicios oficiales Marcelo Ponzio Estilista (duraciones según mensaje del salón). */
export const SALON_TREATMENTS: SalonTreatment[] = [
  {
    id: "color-essential",
    name: "Color Essential",
    subtitle: "Color + terminación · 1 h 30 min",
    description: "Color Experience Essential: color y terminación. Lavado incluido.",
    category: "Color",
    durationLabel: "1 h 30 min",
    durationMinutes: 90,
    imageUrl: IMG.color,
    priceLabel: "$70.000",
    experienceFamily: "color-experience",
  },
  {
    id: "color-signature",
    name: "Color Signature",
    subtitle: "Color + corte + peinado · 2 h",
    description:
      "Combinamos color, corte y peinado para lograr un resultado armónico, actual y personalizado, que realce tus facciones y se adapte a tu estilo de vida.",
    category: "Color",
    durationLabel: "2 h",
    durationMinutes: 120,
    imageUrl: IMG.salon,
    priceLabel: "$95.000",
    badge: "La más elegida",
    experienceFamily: "color-experience",
  },
  {
    id: "color-premium",
    name: "Color Premium",
    subtitle: "Color + corte + tratamiento + peinado · 2 h 30 min",
    description:
      "Color Experience Premium: color, corte, tratamiento premium y peinado. Lavado incluido.",
    category: "Color",
    durationLabel: "2 h 30 min",
    durationMinutes: 150,
    imageUrl: IMG.salon,
    priceLabel: "$115.000",
    experienceFamily: "color-experience",
  },
  {
    id: "balayage-essential",
    name: "Balayage Essential",
    subtitle: "Balayage + terminación · 2 h",
    description:
      "Técnica de iluminación personalizada que aporta luz, dimensión y movimiento al cabello, con un resultado natural y elegante, adaptado a tu tono de piel, tu estilo y la forma de tu rostro. Incluye balayage y terminación.",
    category: "Color",
    durationLabel: "2 h",
    durationMinutes: 120,
    imageUrl: IMG.mechas,
    priceLabel: "$150.000",
    experienceFamily: "balayage-experience",
  },
  {
    id: "balayage-signature",
    name: "Balayage Signature",
    subtitle: "Balayage + corte + tratamiento + peinado · 2 h 30 min",
    description:
      "Técnica de iluminación personalizada que aporta luz, dimensión y movimiento al cabello, con un resultado natural y elegante, adaptado a tu tono de piel, tu estilo y la forma de tu rostro. Incluye balayage, corte, tratamiento y peinado.",
    category: "Color",
    durationLabel: "2 h 30 min",
    durationMinutes: 150,
    imageUrl: IMG.mechas,
    priceLabel: "$185.000",
    badge: "La más elegida",
    experienceFamily: "balayage-experience",
  },
  {
    id: "balayage-premium",
    name: "Balayage Premium",
    subtitle: "Balayage personalizado + tratamiento intensivo + corte + peinado · 3 h",
    description:
      "Técnica de iluminación personalizada que aporta luz, dimensión y movimiento al cabello, con un resultado natural y elegante, adaptado a tu tono de piel, tu estilo y la forma de tu rostro. Incluye balayage personalizado, tratamiento intensivo, corte y peinado.",
    category: "Color",
    durationLabel: "3 h",
    durationMinutes: 180,
    imageUrl: IMG.mechas,
    priceLabel: "$215.000",
    experienceFamily: "balayage-experience",
  },
  {
    id: "servicio-completo",
    name: "Servicio completo",
    subtitle: "Color, lavado, corte y peinado · 1 h 30 min",
    description:
      "Incluye color, lavado, corte y peinado. En todos los servicios el lavado está incluido. Reemplazado por Color Signature en altas nuevas.",
    category: "Color",
    durationLabel: "1 h 30 min",
    durationMinutes: 90,
    imageUrl: IMG.salon,
  },
  {
    id: "corte-dama",
    name: "Corte Dama",
    subtitle: "30 min",
    description: "Corte para dama. Lavado incluido.",
    category: "Cortes y peinado",
    durationLabel: "30 min",
    durationMinutes: 30,
    imageUrl: IMG.corte,
  },
  {
    id: "despuntado",
    name: "Despuntado",
    subtitle: "15 min",
    description: "Mantenimiento de puntas. Lavado incluido.",
    category: "Cortes y peinado",
    durationLabel: "15 min",
    durationMinutes: 15,
    imageUrl: IMG.corte,
  },
  {
    id: "peinado-brushing",
    name: "Peinado",
    subtitle: "Brushing · 30 min",
    description: "Peinado con brushing. Lavado incluido.",
    category: "Cortes y peinado",
    durationLabel: "30 min",
    durationMinutes: 30,
    imageUrl: IMG.peinado,
  },
  {
    id: "peinado-ondas",
    name: "Peinado con ondas",
    subtitle: "30 min",
    description: "Peinado con ondas. Lavado incluido.",
    category: "Cortes y peinado",
    durationLabel: "30 min",
    durationMinutes: 30,
    imageUrl: IMG.peinado,
  },
  {
    id: "peinado-medio-recogido",
    name: "Peinado medio recogido",
    subtitle: "30 min",
    description: "Semi recogido. Lavado incluido.",
    category: "Cortes y peinado",
    durationLabel: "30 min",
    durationMinutes: 30,
    imageUrl: IMG.peinado,
  },
  {
    id: "peinado-recogido",
    name: "Peinado recogido",
    subtitle: "40 min",
    description: "Recogido completo. Lavado incluido.",
    category: "Cortes y peinado",
    durationLabel: "40 min",
    durationMinutes: 40,
    imageUrl: IMG.peinado,
  },
  {
    id: "color",
    name: "Color",
    subtitle: "1 h",
    description: "Servicio de color. Lavado incluido.",
    category: "Color",
    durationLabel: "1 h",
    durationMinutes: 60,
    imageUrl: IMG.color,
  },
  {
    id: "color-retoque-reflejos",
    name: "Color con retoque de reflejos (laterales y arriba)",
    subtitle: "1 h",
    description: "Color con retoque de reflejos en laterales y parte superior. Lavado incluido.",
    category: "Color",
    durationLabel: "1 h",
    durationMinutes: 60,
    imageUrl: IMG.mechas,
  },
  {
    id: "color-mechas-total",
    name: "Color con mechas (toda la cabeza)",
    subtitle: "1 h 30 min",
    description: "Color con mechas en toda la cabeza. Lavado incluido.",
    category: "Color",
    durationLabel: "1 h 30 min",
    durationMinutes: 90,
    imageUrl: IMG.mechas,
  },
  {
    id: "shampoo-color",
    name: "Shampoo color",
    subtitle: "30 min",
    description: "Shampoo de color. Lavado incluido.",
    category: "Color",
    durationLabel: "30 min",
    durationMinutes: 30,
    imageUrl: IMG.color,
  },
  {
    id: "mechas-contramechas",
    name: "Mechas y contra mechas",
    subtitle: "2 h",
    description: "Mechas y contramechas. Lavado incluido.",
    category: "Color",
    durationLabel: "2 h",
    durationMinutes: 120,
    imageUrl: IMG.mechas,
  },
  {
    id: "balayage",
    name: "Balayage",
    subtitle: "2 h",
    description:
      "Técnica de iluminación personalizada que aporta luz, dimensión y movimiento al cabello, con un resultado natural y elegante, adaptado a tu tono de piel, tu estilo y la forma de tu rostro.",
    category: "Color",
    durationLabel: "2 h",
    durationMinutes: 120,
    imageUrl: IMG.mechas,
  },
  {
    id: "reflejos-gorra",
    name: "Reflejos gorra",
    subtitle: "2 h",
    description: "Reflejos con gorra. Lavado incluido.",
    category: "Color",
    durationLabel: "2 h",
    durationMinutes: 120,
    imageUrl: IMG.mechas,
  },
  {
    id: "reflejos-papel-retoque",
    name: "Reflejos papel retoque",
    subtitle: "1 h 30 min",
    description: "Reflejos con papel — retoque. Lavado incluido.",
    category: "Color",
    durationLabel: "1 h 30 min",
    durationMinutes: 90,
    imageUrl: IMG.mechas,
  },
  {
    id: "reflejos-papel-completo",
    name: "Reflejos papel completo",
    subtitle: "2 h",
    description: "Reflejos con papel — completo. Lavado incluido.",
    category: "Color",
    durationLabel: "2 h",
    durationMinutes: 120,
    imageUrl: IMG.mechas,
  },
  {
    id: "barrido",
    name: "Barrido",
    subtitle: "≈45 min (según trabajo y largo)",
    description:
      "Tiempo según el trabajo y el largo del pelo; aproximadamente 45 minutos. Lavado incluido.",
    category: "Color",
    durationLabel: "≈45 min",
    durationMinutes: 45,
    imageUrl: IMG.color,
  },
  {
    id: "planchado",
    name: "Planchado",
    subtitle: "1 h",
    description: "Planchado. Lavado incluido.",
    category: "Tratamiento",
    durationLabel: "1 h",
    durationMinutes: 60,
    imageUrl: IMG.trat,
  },
  {
    id: "keratina",
    name: "Keratina",
    subtitle: "1 h · incluye peinado",
    description:
      "Tratamiento de keratina. Incluye lavado y peinado (keratina y aminoácidos llevan peinado incluido).",
    category: "Tratamiento",
    durationLabel: "1 h",
    durationMinutes: 60,
    imageUrl: IMG.trat,
  },
  {
    id: "tratamiento-aminoacidos",
    name: "Tratamiento Aminoácidos",
    subtitle: "1 h · incluye peinado",
    description:
      "Tratamiento con aminoácidos. Incluye lavado y peinado (keratina y aminoácidos llevan peinado incluido).",
    category: "Tratamiento",
    durationLabel: "1 h",
    durationMinutes: 60,
    imageUrl: IMG.trat,
  },
  {
    id: "laminado",
    name: "Laminado",
    subtitle: "30 min",
    description: "Tratamiento laminado capilar. Lavado incluido.",
    category: "Tratamiento",
    durationLabel: "30 min",
    durationMinutes: 30,
    imageUrl: IMG.trat,
  },
  {
    id: "ampolla",
    name: "Ampolla",
    subtitle: "30 min",
    description: "Tratamiento con ampolla. Lavado incluido.",
    category: "Tratamiento",
    durationLabel: "30 min",
    durationMinutes: 30,
    imageUrl: IMG.trat,
  },
];

export function findCatalogTreatmentById(id: string): SalonTreatment | undefined {
  return SALON_TREATMENTS.find((x) => x.id === id);
}

export function findCatalogTreatmentByName(name: string): SalonTreatment | undefined {
  const t = name.trim();
  return SALON_TREATMENTS.find((x) => x.name === t);
}

/** Solo servicios que se ofrecen para turnos nuevos. */
export function findSalonTreatmentByName(name: string): SalonTreatment | undefined {
  const t = findCatalogTreatmentByName(name);
  if (!t || !isOfferedTreatmentId(t.id)) return undefined;
  return t;
}

export function findSalonTreatmentById(id: string): SalonTreatment | undefined {
  const t = findCatalogTreatmentById(id);
  if (!t || !isOfferedTreatmentId(t.id)) return undefined;
  return t;
}

/** Duración mostrada en el panel; si es reserva antigua, devuelve un texto genérico. */
export function panelDurationLabel(treatmentName: string, category: string): string {
  const byName = findCatalogTreatmentByName(treatmentName);
  if (byName) return byName.durationLabel;
  if (category === "Láser") return "45–60 min";
  if (category === "Facial") return "60 min";
  if (category === "Corporal") return "50 min";
  return "Consultar";
}
