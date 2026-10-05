'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function RevealProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/booking')) return;

    const observe = () => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('revealed');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
      );
      document.querySelectorAll('[data-reveal]:not(.revealed)').forEach(el => observer.observe(el));
      return observer;
    };

    const observer = observe();
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
