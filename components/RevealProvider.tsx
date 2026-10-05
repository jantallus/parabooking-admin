'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function RevealProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/booking')) return;

    let observer: IntersectionObserver | null = null;
    let rafId: number;

    // Double-rAF ensures opacity:0 is painted before we add .revealed
    // so the CSS transition is guaranteed to play
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer?.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
        );
        document.querySelectorAll('[data-reveal]:not(.revealed)').forEach(el => observer!.observe(el));
      });
    });

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
