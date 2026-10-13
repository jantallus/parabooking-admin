import { Suspense } from 'react';
import type { Metadata } from 'next';
import BookingClient from './BookingClient';
import type { FlightType, Complement, GiftCardShopTemplate } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Réserver un vol parapente biplace',
  description: 'Réservez votre baptême de parapente biplace à La Clusaz. Choisissez votre vol, votre date et votre créneau en ligne. Disponibilités en temps réel.',
  alternates: { canonical: '/booking', languages: { fr: '/booking', 'x-default': '/booking' } },
  openGraph: {
    title: 'Réserver un vol parapente biplace à La Clusaz',
    description: 'Réservez votre baptême de parapente biplace à La Clusaz. Choisissez votre vol, votre date et votre créneau en ligne. Disponibilités en temps réel.',
    images: [{ url: '/hiver-hero.jpg', width: 1920, height: 2880, alt: 'Vol parapente biplace à La Clusaz' }],
  },
};

const BACKEND_URL = process.env.API_URL ?? 'http://localhost:3001';

async function fetchInitialData() {
  try {
    const [resFlights, resComplements, resTemplates, resSettings] = await Promise.all([
      fetch(`${BACKEND_URL}/api/flight-types`, { next: { revalidate: 300 } }),
      fetch(`${BACKEND_URL}/api/complements`, { next: { revalidate: 300 } }),
      fetch(`${BACKEND_URL}/api/gift-card-templates?publicOnly=true`, { next: { revalidate: 300 } }),
      fetch(`${BACKEND_URL}/api/public/site-settings`, { next: { revalidate: 300 } }),
    ]);
    const flights: FlightType[] = resFlights.ok ? await resFlights.json() : [];
    const complements: Complement[] = resComplements.ok ? await resComplements.json() : [];
    const giftTemplates: GiftCardShopTemplate[] = resTemplates.ok ? await resTemplates.json() : [];
    const settings = resSettings.ok ? await resSettings.json() : {};
    const displayDaysCount: number = settings.display_days_count ? parseInt(settings.display_days_count) : 3;
    return { flights, complements, giftTemplates, displayDaysCount };
  } catch {
    return { flights: [], complements: [], giftTemplates: [], displayDaysCount: 3 };
  }
}

function buildSchema(flights: FlightType[]) {
  const activeFlights = flights.filter(f => f.is_active !== false);
  const prices = activeFlights.map(f => f.price_cents / 100);
  const lowPrice = prices.length ? Math.min(...prices).toString() : '70';
  const highPrice = prices.length ? Math.max(...prices).toString() : '180';

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: 'Fluide Parapente — Réservation en ligne',
    description: 'Réservez en ligne votre baptême de parapente biplace à La Clusaz. Créneaux disponibles hiver et été.',
    url: 'https://reservation.fluide-parapente.fr/booking',
    telephone: '+33677285102',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'La Clusaz',
      addressRegion: 'Haute-Savoie',
      addressCountry: 'FR',
    },
    geo: { '@type': 'GeoCoordinates', latitude: 45.9042, longitude: 6.4232 },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Formules parapente biplace',
      itemListElement: activeFlights.map(f => ({
        '@type': 'Offer',
        name: f.name,
        description: f.description ?? undefined,
        price: (f.price_cents / 100).toString(),
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: `https://reservation.fluide-parapente.fr/booking`,
        ...(f.duration_minutes ? { duration: `PT${f.duration_minutes}M` } : {}),
      })),
    },
    aggregateOffer: {
      '@type': 'AggregateOffer',
      lowPrice,
      highPrice,
      priceCurrency: 'EUR',
      offerCount: activeFlights.length,
    },
  };
}

export default async function Page() {
  const { flights, complements, giftTemplates, displayDaysCount } = await fetchInitialData();
  const schema = buildSchema(flights);

  return (
    <>
      <link rel="preload" href="/hiver-hero.webp" as="image" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <Suspense fallback={null}>
        <BookingClient
          initialFlights={flights}
          initialComplements={complements}
          initialGiftTemplates={giftTemplates}
          initialDisplayDaysCount={displayDaysCount}
        />
      </Suspense>
    </>
  );
}
