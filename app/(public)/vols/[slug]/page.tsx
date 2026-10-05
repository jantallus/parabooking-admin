import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Mountain, Clock, Ticket } from 'lucide-react';
import { InfoIcon } from '@/components/icons/ActivityIcons';
import BookingClient from '../../booking/BookingClient';
import OtherFlightsSection from './OtherFlightsSection';
import BackNavigationGuard from './BackNavigationGuard';
import { VOL_PAGES } from '../config';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const config = VOL_PAGES[slug];
  if (!config) return {};
  return {
    title: config.name,
    alternates: { canonical: `/vols/${slug}`, languages: { fr: `/vols/${slug}`, 'x-default': `/vols/${slug}` } },
    openGraph: {
      title: `${config.name} · La Clusaz`,
      images: [{ url: config.heroImage, alt: config.name }],
    },
  };
}

export default async function VolPage({ params }: Props) {
  const { slug } = await params;
  const config = VOL_PAGES[slug];
  if (!config) notFound();


  return (
    <div style={{ backgroundColor: '#FFFFFF', color: '#1D1D1B' }}>
      {config.backUrl && <BackNavigationGuard to={config.backUrl} />}

      {/* ── Contenu blanc avec SVG décoratif ── */}
      <div style={{ position: 'relative' }}>

      {/* ── Présentation : photo gauche / texte droite ── */}
      <section className="py-[70px]">
        <div className="flex flex-wrap" style={{ width: '92%', maxWidth: '1240px', margin: '0 auto' }}>

          {/* Photo — col40 */}
          <div className="w-full md:w-1/2 lg:w-[40%]" style={{ padding: '15px 20px' }}>
            <div style={{ borderRadius: '10px', overflow: 'hidden', aspectRatio: '1/1' }}>
              <img
                src={config.heroImage}
                alt={config.name}
                fetchPriority="high"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          </div>

          {/* Spacer — col3, desktop only */}
          <div className="hidden lg:block lg:w-[3%]" />

          {/* Contenu — col57 */}
          <div className="w-full lg:w-[57%]" style={{ padding: '15px 20px' }}>

            {/* Titre */}
            <h1 style={{
              color: '#312783', fontWeight: 700,
              fontSize: 'clamp(1.75rem, 4vw, 48px)',
              lineHeight: 1.1, margin: 0,
            }}>
              {config.name}
            </h1>

            {/* Dénivelé + prix */}
            <p style={{ fontWeight: 700, display: 'flex', alignItems: 'center', margin: '10px 0', color: '#E6007E', fontSize: '18px' }}>
              <span style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>
                {config.statIcon === 'Clock'
                  ? <Clock size={20} strokeWidth={1.5} />
                  : <Mountain size={20} strokeWidth={1.5} />
                }
              </span>
              {config.denivele}
            </p>
            <p style={{ fontWeight: 700, display: 'flex', alignItems: 'center', margin: '10px 0', color: '#E6007E', fontSize: '18px' }}>
              <span style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>
                <InfoIcon size={20} />
              </span>
              {config.priceFrom}
            </p>
            {config.season === 'Standard' && (
              <p style={{ fontWeight: 700, display: 'flex', alignItems: 'center', margin: '10px 0', color: '#E6007E', fontSize: '18px' }}>
                <span style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>
                  <Ticket size={20} strokeWidth={1.5} />
                </span>
                Montée en télésiège comprise
              </p>
            )}
            {config.timeLabel && (
              <p style={{ fontWeight: 700, display: 'flex', alignItems: 'center', margin: '10px 0', color: '#E6007E', fontSize: '18px' }}>
                <span style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>
                  <img src="/temps-restant.png" alt="" aria-hidden="true" style={{ width: 20, height: 20, objectFit: 'contain', filter: 'invert(14%) sepia(95%) saturate(6100%) hue-rotate(314deg) brightness(99%) contrast(104%)' }} />
                </span>
                {config.timeLabel}
              </p>
            )}


          </div>
        </div>
      </section>

      {/* ── Grille de créneaux ── */}
      <div id="etape-2">
        <Suspense fallback={<div style={{ minHeight: '120px' }} />}>
          <BookingClient volOverride={config.volParam} seasonOverride={config.season} />
        </Suspense>
      </div>

      {/* ── SVG décoratif bas-droite ── */}
      <img
        src="/bg-single-rose2.svg"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute', right: 0, bottom: 0,
          width: 'clamp(300px, 40vw, 560px)',
          pointerEvents: 'none', userSelect: 'none', display: 'block',
        }}
      />

      </div>{/* fin contenu blanc */}

      {/* ── Autres vols ── */}
      <div data-reveal>
        <OtherFlightsSection currentVolParam={config.volParam} season={config.season} />
      </div>

    </div>
  );
}
