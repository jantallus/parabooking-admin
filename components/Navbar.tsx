"use client";
import { useState, useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useCart } from '@/lib/CartContext';

const LINKS = [
  { label: 'Parapente La Clusaz',  href: 'https://www.fluide-parapente.fr/' },
  { label: 'Baptême et vol hiver', href: 'https://www.fluide-parapente.fr/bapteme-vol-biplace/' },
  { label: 'Baptême et vol été',   href: 'https://www.fluide-parapente.fr/bapteme-vol-ete/' },
  { label: 'Infos pratiques',      href: 'https://www.fluide-parapente.fr/informations-pratiques/' },
  { label: 'Cartes cadeaux',       href: 'https://reservation.fluide-parapente.fr/bons-cadeaux' },
];

const CTA = { label: 'Réserver un vol', href: 'https://reservation.fluide-parapente.fr/booking' };

export default function Navbar({ transparentOnTop = false }: { transparentOnTop?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [ctaHovered, setCtaHovered] = useState(false);
  const { cartSummary, openCart } = useCart();
  const [hoveredMobileLink, setHoveredMobileLink] = useState<string | null>(null);
  const [mobileCTAHovered, setMobileCTAHovered] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!transparentOnTop) return;
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparentOnTop]);

  const [isDesktop, setIsDesktop] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isTransparent = transparentOnTop && isDesktop && !scrolled && !open;

  return (
    <>
      <style>{`
        /* Hamburger */
        .hbg-inner,
        .hbg-inner::before,
        .hbg-inner::after {
          display: block;
          width: 30px;
          height: 2px;
          background: #fff;
          border-radius: 5px;
          position: absolute;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .hbg-wrap { position: relative; width: 35px; height: 20px; }
        .hbg-inner { top: 50%; margin-top: -2px; }
        .hbg-inner::before { content: ''; top: -10px; }
        .hbg-inner::after  { content: ''; bottom: -10px; }
        .hbg-open .hbg-inner           { transform: translate3d(0, 1px, 0) rotate(45deg); }
        .hbg-open .hbg-inner::before   { transform: rotate(-45deg) translate3d(-5.71429px, -6px, 0); opacity: 0; }
        .hbg-open .hbg-inner::after    { transform: translate3d(0, -11px, 0) rotate(-90deg); }
      `}</style>

      <header className="lg:h-[90px] h-[80px]" style={{ backgroundColor: isTransparent ? 'transparent' : '#312783', position: 'sticky', top: 0, zIndex: 50, width: '100%', transition: 'background-color 0.3s ease' }}>

        {/* Logo */}
        <a
          href="https://www.fluide-parapente.fr/"
          aria-label="Fluide Parapente — accueil"
          className="lg:top-[20px] top-[15px]"
          style={{ position: 'absolute', left: '30px', display: 'block', lineHeight: 0 }}
        >
          <img src="/logo-fluide-blanc.svg" alt="Fluide Parapente" className="lg:w-[130px] w-[125px]" style={{ height: 'auto' }} />
        </a>

        {/* Nav desktop */}
        <nav
          className="hidden lg:flex fluide-nav"
          aria-label="Navigation principale"
        >
          {LINKS.map(l => {
            const isActive = pathname === new URL(l.href).pathname;
            return <a key={l.href} href={l.href} className={`nav-link${isActive ? ' nav-link-active' : ''}`}>{l.label}</a>;
          })}
        </nav>

        {/* CTA */}
        {cartSummary && cartSummary.totalItems > 0 && openCart ? (
          <button
            className="hidden lg:inline-flex nav-cta"
            onClick={openCart}
            style={{
              position: 'absolute',
              right: '29px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: ctaHovered
                ? (cartSummary.step === 3 && cartSummary.isFormValid ? '#c2006a' : '#b85590')
                : (cartSummary.step === 3 && cartSummary.isFormValid ? '#E6007E' : '#c966a3'),
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: '15px',
              fontWeight: 700,
              lineHeight: '24px',
              padding: '10px 17px',
              borderRadius: '5px',
              border: 'none',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.2s ease',
              cursor: 'pointer',
              alignItems: 'center',
              gap: '8px',
            }}
            onPointerEnter={() => setCtaHovered(true)}
            onPointerLeave={() => setCtaHovered(false)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <span>{cartSummary.totalItems} vol{cartSummary.totalItems > 1 ? 's' : ''} · {cartSummary.finalPrice}€</span>
          </button>
        ) : (
          <a
            href={CTA.href}
            className="hidden lg:inline-block nav-cta"
            style={{
              position: 'absolute',
              right: '29px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: ctaHovered ? '#312783' : '#E6007E',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: '16px',
              fontWeight: 700,
              lineHeight: '24px',
              padding: '12px 17px',
              borderRadius: '5px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.3s ease',
            }}
            onPointerEnter={() => setCtaHovered(true)}
            onPointerLeave={() => setCtaHovered(false)}
          >
            {CTA.label}
          </a>
        )}

        {/* Mobile : calendrier + hamburger */}
        <div
          className="lg:hidden flex items-center"
          style={{ position: 'absolute', right: 16, top: 0, height: '80px' }}
        >
          {cartSummary && cartSummary.totalItems > 0 && openCart ? (
            <button
              onClick={openCart}
              aria-label="Voir le panier"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 84, height: '100%', position: 'relative', top: '-2.5px', left: '4.5px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                <span style={{ position: 'absolute', top: '-6px', right: '-8px', minWidth: '18px', height: '18px', borderRadius: '9px', backgroundColor: '#E6007E', color: 'white', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                  {cartSummary.totalItems}
                </span>
              </div>
            </button>
          ) : (
            <a
              href={CTA.href}
              aria-label="Réserver un vol"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 84, height: '100%', position: 'relative', top: '-2.5px', left: '4.5px' }}
            >
              <img src="/calendar.svg" alt="Réserver" style={{ width: '27px', height: 'auto' }} />
            </a>
          )}
          <button
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 60, height: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', top: '0px', left: '3.5px' }}
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setOpen(o => !o)}
          >
            <div className={`hbg-wrap${open ? ' hbg-open' : ''}`}>
              <div className="hbg-inner" />
            </div>
          </button>
        </div>

        {/* Menu mobile */}
        <nav
          className="lg:hidden"
          style={{
            position: 'fixed',
            top: '80px',
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#312783',
            zIndex: 9999,
            overflowY: 'auto',
            padding: '10px 30px 40px',
            transform: open ? 'translateX(0)' : 'translateX(100%)',
            opacity: open ? 1 : 0,
            visibility: open ? 'visible' : 'hidden',
            transition: open
              ? 'transform 0.65s ease, opacity 0.65s cubic-bezier(0.8, 0, 1, 1)'
              : 'transform 0.65s ease, opacity 0.65s cubic-bezier(0, 0, 0.2, 1), visibility 0s linear 0.65s',
          }}
        >
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 auto', display: 'block' }}>
            {LINKS.map(l => {
              const isActive = pathname === new URL(l.href).pathname;
              return (
                <li key={l.href} style={{ textAlign: 'center', display: 'block', margin: '20px 0', padding: 0, lineHeight: '25px' }}>
                  <a
                    href={l.href}
                    style={{ display: 'block', color: (hoveredMobileLink === l.href || isActive) ? '#E6007E' : '#fff', fontWeight: 700, fontSize: '20px', textDecoration: 'none', transition: 'color 0.3s ease' }}
                    onClick={() => setOpen(false)}
                    onPointerEnter={() => setHoveredMobileLink(l.href)}
                    onPointerLeave={() => setHoveredMobileLink(null)}
                  >{l.label}</a>
                </li>
              );
            })}
          </ul>
          <div style={{ marginTop: '30px', textAlign: 'center' }}>
            <a
              href={CTA.href}
              style={{ display: 'inline-block', backgroundColor: mobileCTAHovered ? '#312783' : '#E6007E', color: '#fff', fontWeight: 700, fontSize: '18px', lineHeight: '24px', padding: '12px 17px', borderRadius: '5px', textDecoration: 'none', transition: 'background-color 0.3s ease' }}
              onClick={() => setOpen(false)}
              onPointerEnter={() => setMobileCTAHovered(true)}
              onPointerLeave={() => setMobileCTAHovered(false)}
            >{CTA.label}</a>
          </div>
        </nav>
      </header>
    </>
  );
}
