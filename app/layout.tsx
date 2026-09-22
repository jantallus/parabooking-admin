import "./globals.css";
import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  metadataBase: new URL('https://reservation.fluide-parapente.fr'),
  title: {
    default: 'Fluide Parapente · Réservation La Clusaz',
    template: '%s · Fluide Parapente La Clusaz',
  },
  description: 'Réservez votre baptême de parapente biplace à La Clusaz avec Fluide Parapente. Vols disponibles hiver et été.',
  openGraph: {
    siteName: 'Fluide Parapente',
    locale: 'fr_FR',
    type: 'website',
    images: [{ url: '/hero-parapente.jpg', width: 1200, height: 630, alt: 'Parapente biplace à La Clusaz' }],
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: false, follow: false },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'SportsActivityLocation'],
  name: 'Fluide Parapente',
  description: 'École de parapente et vols biplaces à La Clusaz, Haute-Savoie.',
  url: 'https://reservation.fluide-parapente.fr',
  image: 'https://reservation.fluide-parapente.fr/hero-parapente.jpg',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'La Clusaz',
    postalCode: '74220',
    addressCountry: 'FR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 45.9044,
    longitude: 6.4233,
  },
  priceRange: '€€',
  currenciesAccepted: 'EUR',
  sameAs: ['https://www.fluide-parapente.fr'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        {/* Consent Mode v2 — doit absolument être avant GTM */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          window.gtag = function(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            ad_storage: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
          });
          try {
            var c = localStorage.getItem('fluide_consent_v1');
            if (c) {
              var v = JSON.parse(c).granted ? 'granted' : 'denied';
              gtag('consent', 'update', { ad_storage: v, analytics_storage: v });
            }
          } catch(e) {}
        `}} />
      </head>
      <body>
        {/* Google Tag Manager */}
        <Script id="gtm" strategy="beforeInteractive">{`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-PWVR7R46');
        `}</Script>
        <noscript>
          <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PWVR7R46"
            height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} />
        </noscript>
        {children}
      </body>
    </html>
  );
}
