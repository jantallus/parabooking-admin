'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function RevealProvider() {
  const pathname = usePathname();

  useEffect(() => {
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    let raf1: number, raf2: number;

    const scan = () => {
      document.querySelectorAll('[data-reveal]:not([data-revealed])').forEach(el => io?.observe(el));
    };

    const observeNew = (nodes: NodeList) => {
      let hasReveal = false;
      nodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const el = node as Element;
        if (el.hasAttribute('data-reveal') || el.querySelectorAll?.('[data-reveal]').length) hasReveal = true;
      });
      if (!hasReveal) return;
      // double-rAF so opacity:0 is painted before observer fires
      requestAnimationFrame(() => requestAnimationFrame(() => scan()));
    };

    const handleScanEvent = () => requestAnimationFrame(() => requestAnimationFrame(() => scan()));

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        io = new IntersectionObserver(
          (entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                (entry.target as HTMLElement).setAttribute('data-revealed', '');
                io?.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
        );

        scan();

        mo = new MutationObserver(mutations =>
          mutations.forEach(m => observeNew(m.addedNodes))
        );
        mo.observe(document.body, { childList: true, subtree: true });
      });
    });

    window.addEventListener('reveal:scan', handleScanEvent);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      io?.disconnect();
      mo?.disconnect();
      window.removeEventListener('reveal:scan', handleScanEvent);
    };
  }, [pathname]);

  return null;
}
