import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackToTop from '@/components/BackToTop';
import { CartProvider } from '@/lib/CartContext';

export const metadata: Metadata = {
  title: 'Cartes cadeaux parapente biplace',
  description: 'Offrez un baptême de parapente biplace à La Clusaz. Cartes cadeaux disponibles pour toutes les occasions, envoi par email ou courrier.',
  alternates: { canonical: '/bons-cadeaux', languages: { fr: '/bons-cadeaux', 'x-default': '/bons-cadeaux' } },
  openGraph: {
    title: 'Cartes cadeaux parapente biplace · La Clusaz',
    description: 'Offrez un baptême de parapente biplace à La Clusaz. Cartes cadeaux disponibles pour toutes les occasions, envoi par email ou courrier.',
    images: [{ url: '/cadeau-body.webp', alt: 'Carte cadeau parapente Fluide La Clusaz' }],
  },
};

const giftCardSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Carte cadeau vol parapente biplace – Fluide Parapente',
  description: 'Offrez un baptême de parapente biplace à La Clusaz. Carte cadeau envoyée par email ou courrier.',
  image: 'https://reservation.fluide-parapente.fr/cadeau-body.webp',
  brand: { '@type': 'Brand', name: 'Fluide Parapente' },
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '70',
    highPrice: '180',
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
  },
};

export default function BonsCadeauxLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(giftCardSchema) }}
      />
      <Navbar transparentOnTop />
      {children}
      <Footer />
      <BackToTop />
    </CartProvider>
  );
}
