"use client";
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'fluide_consent_v1';

function updateConsent(granted: boolean) {
  if (typeof window === 'undefined') return;
  const val = granted ? 'granted' : 'denied';
  const w = window as any;
  if (typeof w.gtag === 'function') {
    w.gtag('consent', 'update', { ad_storage: val, analytics_storage: val });
  }
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/login') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      // localStorage inaccessible (navigation privée)
    }
  }, []);

  const handleChoice = (granted: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ granted, date: new Date().toISOString() }));
    } catch { /* ignore */ }
    updateConsent(granted);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#1e1b4b',
        color: '#f1f5f9',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.25)',
      }}
    >
      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', flex: '1 1 260px', color: '#cbd5e1' }}>
        Nous utilisons des cookies pour mesurer l'audience et améliorer notre service.{' '}
        <a
          href="/politique-confidentialite"
          style={{ color: '#E6007E', textDecoration: 'underline' }}
        >
          En savoir plus
        </a>
      </p>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={() => handleChoice(false)}
          style={{
            padding: '8px 16px',
            borderRadius: '4px',
            border: '1px solid #475569',
            backgroundColor: 'transparent',
            color: '#94a3b8',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          Refuser
        </button>
        <button
          onClick={() => handleChoice(true)}
          style={{
            padding: '8px 20px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#E6007E',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            cursor: 'pointer',
          }}
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
