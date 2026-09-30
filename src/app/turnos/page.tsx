import TurnosClient from "./turnos-client";

type TurnosPageProps = {
  searchParams?: Promise<{
    treatment?: string;
    promo?: string;
    giftCard?: string;
  }>;
};

export default async function TurnosPage({ searchParams }: TurnosPageProps) {
  const params = (await searchParams) ?? {};

  return (
    <TurnosClient
      initialTreatment={params.treatment}
      initialPromo={params.promo}
      initialGiftCard={params.giftCard}
    />
  );
}
