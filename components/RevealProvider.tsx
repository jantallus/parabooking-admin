'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function RevealProvider() {
  const pathname = usePathname();

  useEffect(() => {
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    let raf1: number, raf2: number;

    const observe = (el: Element) => io?.observe(el);

    const observeNew = (nodes: NodeList) => {
      const found: Element[] = [];
      nodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const el = node as Element;
        if (el.hasAttribute('data-reveal') && !el.classList.contains('revealed')) found.push(el);
        el.querySelectorAll?.('[data-reveal]:not(.revealed)').forEach(c => found.push(c));
      });
      if (!found.length) return;
      // double-rAF so opacity:0 is painted before observer fires
      requestAnimationFrame(() => requestAnimationFrame(() => found.forEach(observe)));
    };

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        io = new IntersectionObserver(
          (entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                io?.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
        );

        document.querySelectorAll('[data-reveal]:not(.revealed)').forEach(observe);

        mo = new MutationObserver(mutations =>
          mutations.forEach(m => observeNew(m.addedNodes))
        );
        mo.observe(document.body, { childList: true, subtree: true });
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      io?.disconnect();
      mo?.disconnect();
    };
  }, [pathname]);

  return null;
}
